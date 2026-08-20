---
title: Linux网络编程套接字详解：UDP、TCP与客户端服务器模型
date: 2026-08-20 15:50:00
categories:
  - Linux
tags:
  - Linux
  - Socket
  - TCP
  - UDP
  - 网络编程
---

Socket 是应用程序使用网络协议栈的主要接口。Linux 把套接字抽象为文件描述符，因此可以使用 `read`、`write`、`close`，也可以使用更适合网络语义的 `recv`、`send`、`recvfrom` 和 `sendto`。

本文从 IP、端口和网络字节序出发，分别梳理 UDP 与 TCP 的编程流程，并给出经过边界和错误处理完善的示例。

<!-- more -->

## 一、网络通信需要哪些标识

### 1.1 IP 地址

IP 地址用于在网络层标识通信接口和路由目标。一个网络包包含源 IP 和目的 IP。

### 1.2 端口号

同一主机可能同时运行浏览器、SSH、数据库和自定义服务器。16 位端口号帮助传输层把数据分用到相应通信端点。

端口范围为 `0` 到 `65535`。通常：

- `0` 到 `1023` 为系统/知名端口范围，在 Linux 上绑定往往需要相应权限；
- 客户端可绑定端口 `0`，让内核选择临时端口；
- 服务端应避免与已有服务冲突。

### 1.3 五元组

一条 TCP 流通常由以下五元组区分：

```text
源 IP、源端口、目的 IP、目的端口、传输层协议
```

因此同一个服务器监听端口可以同时服务大量客户端，只要连接五元组不同。

## 二、TCP 与 UDP 的直观区别

| 特性 | TCP | UDP |
| --- | --- | --- |
| 连接 | 连接导向 | 无连接 |
| 数据形态 | 有序字节流 | 保留数据报边界 |
| 可靠性 | 确认、重传、排序、拥塞控制 | 尽力而为，应用按需补充可靠机制 |
| 广播/组播 | 不直接支持 | 支持相应 IP 模式 |
| 常见场景 | HTTP/1.1、HTTP/2、SSH、数据库 | DNS、实时媒体、游戏、QUIC 的承载 |

“UDP 不可靠”不等于“使用 UDP 的应用一定不可靠”。QUIC 等协议会在 UDP 之上实现自己的可靠性、安全性与拥塞控制。

## 三、网络字节序

多字节整数在内存中的字节排列可能是：

- 大端：高位字节放在低地址；
- 小端：低位字节放在低地址。

网络协议通常使用网络字节序，即大端序。常用转换：

```c
#include <arpa/inet.h>

uint16_t network_port = htons(host_port);
uint16_t host_port = ntohs(network_port);
uint32_t network_value = htonl(host_value);
uint32_t host_value = ntohl(network_value);
```

不要对单字节字段进行这些转换，也不要对已经是网络字节序的字段重复转换。

## 四、地址结构

### 4.1 通用地址

Socket API 使用通用指针：

```c
struct sockaddr
```

实际编程通常准备具体地址结构，再强制转换为 `struct sockaddr *`。

### 4.2 IPv4 地址

```c
struct sockaddr_in address;

memset(&address, 0, sizeof(address));
address.sin_family = AF_INET;
address.sin_port = htons(8080);
address.sin_addr.s_addr = htonl(INADDR_ANY);
```

`INADDR_ANY` 用于服务器监听本机所有合适的 IPv4 地址，它不代表一个可以由客户端连接的远端地址。

### 4.3 IPv6 地址

IPv6 使用：

```c
struct sockaddr_in6
```

同时支持 IPv4/IPv6 和域名时，更推荐使用 `getaddrinfo` 与 `sockaddr_storage`，不要把程序结构写死为 IPv4。

## 五、地址转换

### 5.1 `inet_pton`

把文本 IP 转为二进制地址：

```c
struct in_addr address;
int rc = inet_pton(AF_INET, "192.0.2.10", &address);
```

返回值：

- `1`：成功；
- `0`：文本不是合法地址；
- `-1`：地址族等参数错误。

### 5.2 `inet_ntop`

把二进制地址转为文本：

```c
char text[INET_ADDRSTRLEN];
const char *result = inet_ntop(AF_INET, &address, text, sizeof(text));
```

IPv6 使用 `INET6_ADDRSTRLEN`。

新代码优先使用 `inet_pton`/`inet_ntop`：

- 支持 IPv4 和 IPv6；
- 错误语义更清晰；
- 输出缓冲区由调用者提供；
- 避免历史 `inet_ntoa` 返回静态缓冲区带来的覆盖问题。

### 5.3 域名解析 `getaddrinfo`

```c
#include <netdb.h>

int getaddrinfo(const char *node,
                const char *service,
                const struct addrinfo *hints,
                struct addrinfo **result);
```

它能处理域名、服务名、IPv4 和 IPv6。遍历返回链表逐个尝试，最后使用 `freeaddrinfo` 释放。

## 六、创建套接字

```c
#include <sys/socket.h>

int socket(int domain, int type, int protocol);
```

常见组合：

```c
socket(AF_INET, SOCK_STREAM, 0);  /* IPv4 TCP */
socket(AF_INET, SOCK_DGRAM, 0);   /* IPv4 UDP */
socket(AF_INET6, SOCK_STREAM, 0); /* IPv6 TCP */
```

返回新的文件描述符，失败返回 `-1`。

Linux 可在类型中组合：

```c
socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC | SOCK_NONBLOCK, 0);
```

这样能在创建时原子设置 close-on-exec 和非阻塞标志，减少多线程程序中的竞态窗口。

## 七、UDP 编程流程

### 7.1 UDP 服务端

1. `socket(AF_INET, SOCK_DGRAM, 0)`；
2. `bind` 到本地地址与端口；
3. `recvfrom` 接收一个数据报并获得来源地址；
4. `sendto` 向该来源返回数据；
5. `close`。

### 7.2 UDP 客户端

1. 创建 UDP 套接字；
2. 准备服务器地址；
3. `sendto`；
4. `recvfrom`；
5. 关闭套接字。

客户端通常可以不显式 `bind`，首次发送时内核会选择本地 IP 和临时端口。

### 7.3 最小 UDP 回显服务端

```c
#define _POSIX_C_SOURCE 200809L

#include <arpa/inet.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

int main(void)
{
    int fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (fd == -1) {
        perror("socket");
        return EXIT_FAILURE;
    }

    struct sockaddr_in local;
    memset(&local, 0, sizeof(local));
    local.sin_family = AF_INET;
    local.sin_port = htons(9090);
    local.sin_addr.s_addr = htonl(INADDR_ANY);

    if (bind(fd, (struct sockaddr *)&local, sizeof(local)) == -1) {
        perror("bind");
        close(fd);
        return EXIT_FAILURE;
    }

    for (;;) {
        unsigned char buffer[2048];
        struct sockaddr_storage peer;
        socklen_t peer_length = sizeof(peer);

        ssize_t n = recvfrom(fd, buffer, sizeof(buffer), 0,
                             (struct sockaddr *)&peer, &peer_length);
        if (n < 0) {
            if (errno == EINTR) {
                continue;
            }
            perror("recvfrom");
            break;
        }

        ssize_t sent = sendto(fd, buffer, (size_t)n, 0,
                              (struct sockaddr *)&peer, peer_length);
        if (sent < 0) {
            perror("sendto");
        } else if (sent != n) {
            fputs("unexpected partial UDP send\n", stderr);
        }
    }

    close(fd);
    return EXIT_FAILURE;
}
```

测试：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic udp_echo.c -o udp_echo
./udp_echo
```

另一个终端：

```bash
printf 'hello udp\n' | nc -u -w 1 127.0.0.1 9090
```

### 7.4 UDP 必须考虑的问题

- 数据报可能丢失、重复、乱序；
- 接收缓冲区不足时数据报会被截断或丢弃；
- 一个 `recvfrom` 对应读取一个数据报，不会把两个数据报合并成一个；
- 发送过大的 UDP 数据报可能触发 IP 分片，丢失风险增大；
- 应用需要自行设计请求 ID、重试、去重和超时；
- `sendto` 成功只表示数据交给本机协议栈，不代表对端应用已经收到。

## 八、TCP 服务端流程

### 8.1 `bind`

```c
int bind(int sockfd,
         const struct sockaddr *address,
         socklen_t address_length);
```

它把套接字与本地地址绑定。服务器通常绑定固定端口，客户端通常由内核自动选择临时端口。

### 8.2 `listen`

```c
int listen(int sockfd, int backlog);
```

它把流式套接字转换为监听套接字。`backlog` 是等待连接队列的重要提示值，但实际有效上限还受内核设置和实现影响，不能简单解释成“服务器最多只能连接 backlog 个客户端”。

### 8.3 `accept`

```c
int accept(int listen_fd,
           struct sockaddr *peer,
           socklen_t *peer_length);
```

`accept` 返回一个**新的已连接套接字**：

- 监听套接字继续负责接收新连接；
- 已连接套接字负责与一个客户端收发数据。

这就像接待台和服务窗口：接待台不能拿去与每位顾客完成全部业务。

Linux 还提供：

```c
int accept4(int sockfd, struct sockaddr *addr,
            socklen_t *addrlen, int flags);
```

可使用 `SOCK_CLOEXEC | SOCK_NONBLOCK` 原子设置新描述符属性。

### 8.4 服务端调用顺序

```text
socket -> setsockopt(可选) -> bind -> listen
       -> accept -> recv/send -> close(连接)
       -> accept 下一条连接
```

## 九、TCP 客户端流程

```text
解析地址 -> socket -> connect -> send/recv -> close
```

```c
int connect(int sockfd,
            const struct sockaddr *address,
            socklen_t address_length);
```

阻塞套接字的 `connect` 通常等待连接成功或失败。非阻塞 `connect` 可能返回 `-1/EINPROGRESS`，之后要监控可写事件并使用 `getsockopt(SO_ERROR)` 判断最终结果，不能只看到“可写”就认为连接成功。

## 十、完整 TCP 回显服务端

下面示例为便于理解采用“一次处理一个连接”的迭代模型。它展示了正确的部分读写、`EINTR`、`SIGPIPE` 和描述符清理。

```c
#define _POSIX_C_SOURCE 200809L

#include <arpa/inet.h>
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int send_all(int fd, const void *buffer, size_t length)
{
    const unsigned char *p = buffer;

    while (length > 0) {
        ssize_t n = send(fd, p, length, MSG_NOSIGNAL);
        if (n > 0) {
            p += (size_t)n;
            length -= (size_t)n;
            continue;
        }
        if (n < 0 && errno == EINTR) {
            continue;
        }
        return -1;
    }

    return 0;
}

static void serve_connection(int client_fd)
{
    unsigned char buffer[4096];

    for (;;) {
        ssize_t n = recv(client_fd, buffer, sizeof(buffer), 0);
        if (n > 0) {
            if (send_all(client_fd, buffer, (size_t)n) == -1) {
                perror("send");
                return;
            }
            continue;
        }
        if (n == 0) {
            return;
        }
        if (errno == EINTR) {
            continue;
        }
        perror("recv");
        return;
    }
}

int main(void)
{
    int listen_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_fd == -1) {
        perror("socket");
        return EXIT_FAILURE;
    }

    int reuse = 1;
    if (setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR,
                   &reuse, sizeof(reuse)) == -1) {
        perror("setsockopt SO_REUSEADDR");
        close(listen_fd);
        return EXIT_FAILURE;
    }

    struct sockaddr_in local;
    memset(&local, 0, sizeof(local));
    local.sin_family = AF_INET;
    local.sin_port = htons(9090);
    local.sin_addr.s_addr = htonl(INADDR_ANY);

    if (bind(listen_fd, (struct sockaddr *)&local, sizeof(local)) == -1) {
        perror("bind");
        close(listen_fd);
        return EXIT_FAILURE;
    }

    if (listen(listen_fd, SOMAXCONN) == -1) {
        perror("listen");
        close(listen_fd);
        return EXIT_FAILURE;
    }

    for (;;) {
        struct sockaddr_in peer;
        socklen_t peer_length = sizeof(peer);

        int client_fd = accept(listen_fd,
                               (struct sockaddr *)&peer,
                               &peer_length);
        if (client_fd == -1) {
            if (errno == EINTR) {
                continue;
            }
            perror("accept");
            break;
        }

        char ip[INET_ADDRSTRLEN];
        const char *text = inet_ntop(AF_INET, &peer.sin_addr,
                                     ip, sizeof(ip));
        printf("client %s:%u connected\n",
               text != NULL ? text : "?",
               (unsigned)ntohs(peer.sin_port));

        serve_connection(client_fd);
        close(client_fd);
    }

    close(listen_fd);
    return EXIT_FAILURE;
}
```

编译运行：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic tcp_echo_server.c -o tcp_echo_server
./tcp_echo_server
```

测试：

```bash
nc 127.0.0.1 9090
```

## 十一、一个支持域名的 TCP 客户端

```c
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <netdb.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static int connect_to(const char *host, const char *service)
{
    struct addrinfo hints;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;

    struct addrinfo *addresses = NULL;
    int rc = getaddrinfo(host, service, &hints, &addresses);
    if (rc != 0) {
        fprintf(stderr, "getaddrinfo: %s\n", gai_strerror(rc));
        return -1;
    }

    int fd = -1;
    for (struct addrinfo *p = addresses; p != NULL; p = p->ai_next) {
        fd = socket(p->ai_family, p->ai_socktype, p->ai_protocol);
        if (fd == -1) {
            continue;
        }

        if (connect(fd, p->ai_addr, p->ai_addrlen) == 0) {
            break;
        }

        close(fd);
        fd = -1;
    }

    freeaddrinfo(addresses);
    return fd;
}

int main(int argc, char **argv)
{
    if (argc != 3) {
        fprintf(stderr, "usage: %s HOST PORT\n", argv[0]);
        return EXIT_FAILURE;
    }

    int fd = connect_to(argv[1], argv[2]);
    if (fd == -1) {
        fputs("unable to connect\n", stderr);
        return EXIT_FAILURE;
    }

    const char request[] = "hello tcp\n";
    size_t offset = 0;
    while (offset < sizeof(request) - 1) {
        ssize_t n = send(fd, request + offset,
                         sizeof(request) - 1 - offset,
                         MSG_NOSIGNAL);
        if (n > 0) {
            offset += (size_t)n;
        } else if (n < 0 && errno == EINTR) {
            continue;
        } else {
            perror("send");
            close(fd);
            return EXIT_FAILURE;
        }
    }

    char buffer[256];
    ssize_t n;
    do {
        n = recv(fd, buffer, sizeof(buffer), 0);
    } while (n < 0 && errno == EINTR);

    if (n > 0) {
        fwrite(buffer, 1, (size_t)n, stdout);
    } else if (n < 0) {
        perror("recv");
    }

    close(fd);
    return n < 0 ? EXIT_FAILURE : EXIT_SUCCESS;
}
```

## 十二、TCP 是字节流

TCP 不保留应用写入边界：

```c
send(fd, "abc", 3, 0);
send(fd, "def", 3, 0);
```

接收方可能：

- 一次收到 `abcdef`；
- 先收到 `ab`，再收到 `cdef`；
- 以其他合法方式拆分。

一次 `recv` 只代表“当前取到这些字节”，不代表读到一条完整业务消息。

### 12.1 常见消息边界方案

1. 固定长度；
2. 分隔符，例如文本行 `\n`；
3. 长度前缀，例如 4 字节网络序长度 + 负载；
4. 自描述协议，例如正确解析 HTTP 首部和 `Content-Length`；
5. 连接关闭表示消息结束，但会失去连接复用能力。

长度前缀协议应限制最大长度，防止恶意长度导致巨大内存分配。

## 十三、部分读写

阻塞套接字的 `send` 也可能只发送部分数据。正确做法是维护偏移量，循环发送剩余部分。

非阻塞套接字还要处理：

- `EAGAIN`/`EWOULDBLOCK`：当前暂时不能继续；
- `EINTR`：被信号打断；
- 连接错误；
- 待发送缓冲区与可写事件订阅。

不能在非阻塞 `send` 返回 `EAGAIN` 后直接丢弃剩余响应。

## 十四、连接关闭

### 14.1 `recv` 返回 `0`

TCP 中 `recv` 返回 `0` 表示对端已关闭发送方向，当前方向到达 EOF。

### 14.2 `close`

`close` 释放当前进程的文件描述符引用。真正的 TCP 终止行为还与其他描述符引用、未发送数据和套接字选项有关。

### 14.3 `shutdown`

```c
int shutdown(int sockfd, int how);
```

`how`：

- `SHUT_RD`：关闭读取方向；
- `SHUT_WR`：关闭写方向，向对端表达本方不再发送；
- `SHUT_RDWR`：两个方向。

半关闭适合“请求已发送完，但还要继续接收响应”的协议。

## 十五、并发服务器模型

### 15.1 迭代服务器

一次只处理一个连接。简单，但一个慢客户端会阻塞后续客户端。

### 15.2 多进程

每个连接 `fork` 子进程：

- 隔离较好；
- 创建和切换成本较高；
- 父子进程要关闭各自不需要的描述符；
- 父进程要回收子进程。

### 15.3 每连接一线程

实现容易，但连接很多时线程数量、栈内存和调度开销明显。

### 15.4 线程池

固定工作线程消费任务，避免频繁创建线程。仍要处理阻塞 I/O 导致工作线程被长期占用的问题。

### 15.5 I/O 多路复用

`select`、`poll`、`epoll` 让少量线程监控大量描述符。事件循环负责连接状态与非阻塞 I/O，耗时业务可再交给工作线程池。

## 十六、常用套接字选项

### 16.1 `SO_REUSEADDR`

```c
int value = 1;
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &value, sizeof(value));
```

常用于服务端重启和地址绑定语义。它不等于“绕过一切端口占用”，也不应被描述为允许任意多个完全相同监听套接字。

### 16.2 `SO_REUSEPORT`

Linux 等系统支持多个套接字绑定相同地址和端口，并由内核分配连接或数据报。它与 `SO_REUSEADDR` 目的不同，需要结合权限和负载均衡设计。

### 16.3 `SO_KEEPALIVE`

启用 TCP keepalive 探测长期空闲连接。默认参数往往很保守，应用还应考虑协议级心跳和业务超时。

### 16.4 `TCP_NODELAY`

禁用 Nagle 算法，可能降低小消息延迟，也可能增加小包数量。应通过业务特征和测试决定，而不是所有连接都机械开启。

### 16.5 收发超时

`SO_RCVTIMEO` 和 `SO_SNDTIMEO` 可影响阻塞调用，但复杂服务器通常使用非阻塞 I/O 与统一定时器管理超时。

## 十七、排查命令

监听端口：

```bash
ss -lntp
ss -lnup
```

连接状态：

```bash
ss -ntp 'sport = :9090 or dport = :9090'
```

查看进程描述符：

```bash
ls -l /proc/PID/fd
lsof -nP -p PID
```

抓包：

```bash
sudo tcpdump -ni any 'tcp port 9090'
sudo tcpdump -ni any 'udp port 9090'
```

## 十八、常见错误

1. `server.h` 声明 `int initListenFd();`，定义却带参数；C 中空形参列表表示“参数未指定”，应写 `int initListenFd(unsigned short port);`；
2. 在 `bind`、`listen` 失败后仍继续调用 `accept`；
3. 把监听描述符当作已连接描述符收发数据；
4. 忘记把端口转换为网络字节序；
5. `accept` 前没有初始化 `socklen_t`；
6. 认为一次 `recv` 能读完请求；
7. 忽略 `send` 的部分写；
8. 把返回 `-1` 直接转换为无符号类型，导致出现巨大数值；
9. 对 `EAGAIN` 直接关闭连接；
10. 忘记关闭父进程或子进程中多余的连接描述符；
11. 直接信任客户端提供的长度、路径和文本；
12. 只依赖 IP 地址做身份认证。

## 十九、安全边界

暴露到网络的程序必须假设输入不可信：

- 限制消息长度和连接数；
- 设置空闲、读取、写入和业务超时；
- 防止路径穿越、整数溢出和缓冲区越界；
- 正确处理慢客户端与背压；
- 使用 TLS 保护敏感数据；
- 最小权限运行；
- 设置文件描述符和内存上限；
- 记录必要日志，但避免泄露密钥和用户隐私。

## 二十、总结

1. IP 地址定位网络目标，端口号区分通信端点，五元组区分网络流。
2. UDP 保留数据报边界，但应用要自行处理丢失、重复、乱序与超时。
3. TCP 服务端基本流程是 `socket -> bind -> listen -> accept -> recv/send`。
4. `accept` 返回新连接描述符，监听描述符继续接收新连接。
5. TCP 是字节流，一次 `recv` 不等于一条完整消息。
6. 任何网络程序都必须正确处理部分读写、`EINTR`、`EAGAIN`、EOF 和资源清理。
7. 高并发场景通常使用非阻塞 I/O、I/O 多路复用、连接状态机与线程池协作。

