---
title: Linux高级IO详解：select、poll、epoll与Reactor
date: 2026-08-20 16:20:00
categories:
  - Linux
tags:
  - Linux
  - 高级IO
  - select
  - poll
  - epoll
  - Reactor
---

网络 I/O 通常包含两个阶段：等待事件就绪，以及在用户空间与内核之间复制数据。高并发服务器的核心不是让一次复制凭空消失，而是更高效地管理大量连接上的等待、就绪和状态推进。

本文介绍五种经典 I/O 模型，重点分析 `select`、`poll` 和 `epoll`，并给出一个正确处理非阻塞读写、边缘触发和输出缓冲区的 epoll 回显服务器。

<!-- more -->

## 一、一次 I/O 的两个阶段

以套接字读取为例：

1. **等待数据就绪**：数据从网络到达网卡并进入内核接收缓冲区；
2. **复制数据**：`recv` 把数据从内核缓冲区复制到用户缓冲区。

“就绪”不等于“业务消息完整”：

- TCP 可读只说明当前有字节、EOF 或错误；
- 一条 HTTP 请求可能要多次读取；
- 一次读取也可能包含多条应用消息。

## 二、五种经典 I/O 模型

### 2.1 阻塞 I/O

默认套接字通常是阻塞的。调用 `recv` 时若暂无数据，线程睡眠等待；数据就绪后完成复制并返回。

优点：

- 编程直观；
- CPU 不会因空轮询被持续占用。

缺点：

- 一个线程同一时刻通常只能阻塞在一个操作上；
- 大量连接可能需要大量线程或进程；
- 慢客户端会长期占用执行资源。

### 2.2 非阻塞 I/O

非阻塞描述符没有数据时立即返回：

```text
return -1, errno = EAGAIN 或 EWOULDBLOCK
```

如果应用不断循环调用 `recv`，会形成忙轮询并浪费 CPU。非阻塞 I/O 通常要与事件通知机制配合。

### 2.3 I/O 多路复用

`select`、`poll`、`epoll` 可以让一个线程等待多个描述符的就绪事件。事件到来后，应用再调用 `accept`、`recv` 或 `send`。

它们通知的是“可以尝试 I/O”，不自动完成业务读取和解析。

### 2.4 信号驱动 I/O

应用配置异步通知，描述符就绪时内核发送 `SIGIO` 等信号。信号处理和事件合并使复杂网络服务器不常直接采用这一模型。

### 2.5 异步 I/O

应用提交操作后继续执行，内核在 I/O 完成时通知应用。与就绪通知的区别：

- `epoll` 告诉应用“现在可以读/写”；
- 完成式异步 I/O 告诉应用“请求的 I/O 已经完成”。

Linux 相关接口包括 POSIX AIO 和 `io_uring`。不同接口对文件、套接字和实际异步能力的支持不同，不能只凭名称判断性能。

## 三、同步/异步与阻塞/非阻塞

两组概念关注点不同：

- **阻塞/非阻塞**：调用在暂时不能完成时，当前线程是否等待；
- **同步/异步 I/O**：I/O 完成责任和结果通知方式。

`epoll_wait` 本身可以阻塞等待事件，但 `epoll + nonblocking socket` 仍属于同步就绪通知模型：应用收到就绪后主动调用 `recv`/`send` 完成数据复制。

不要把“函数没有立刻返回”“多个线程之间同步”“异步 I/O”三个不同语境混在一起。

## 四、把描述符设为非阻塞

```c
#include <fcntl.h>

int flags = fcntl(fd, F_GETFL, 0);
if (flags == -1) {
    perror("fcntl F_GETFL");
}

if (fcntl(fd, F_SETFL, flags | O_NONBLOCK) == -1) {
    perror("fcntl F_SETFL");
}
```

必须保留原有标志，再按位加入 `O_NONBLOCK`。

创建时原子设置更好：

```c
socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
accept4(listen_fd, NULL, NULL, SOCK_NONBLOCK | SOCK_CLOEXEC);
```

## 五、select

### 5.1 接口

```c
#include <sys/select.h>

int select(int nfds,
           fd_set *readfds,
           fd_set *writefds,
           fd_set *exceptfds,
           struct timeval *timeout);
```

参数：

- `nfds`：被监控最大描述符值加一；
- `readfds`：关注读就绪；
- `writefds`：关注写就绪；
- `exceptfds`：异常条件，不是普通错误集合；
- `timeout`：超时，`NULL` 表示无限等待。

返回：

- `> 0`：就绪描述符数量；
- `0`：超时；
- `-1`：错误，如 `EINTR`、`EBADF`。

### 5.2 `fd_set` 操作

```c
FD_ZERO(&set);
FD_SET(fd, &set);
FD_CLR(fd, &set);
FD_ISSET(fd, &set);
```

### 5.3 输入输出参数会被修改

调用前集合表示“关心哪些描述符”，返回后集合只保留“哪些已经就绪”。因此每次调用要复制主集合：

```c
fd_set ready = master;
int count = select(max_fd + 1, &ready, NULL, NULL, NULL);
```

超时结构在部分系统上也可能被修改，可移植代码应在每次调用前重新设置。

### 5.4 可读意味着什么

读就绪可能表示：

- 接收缓冲区有数据；
- 对端完成有序关闭，此时 `recv` 返回 0；
- 监听套接字有连接可 `accept`；
- 存在待处理错误。

“可读”不保证一定读到正数，也不保证业务消息完整。

### 5.5 可写意味着什么

普通已连接 TCP 套接字大多数时间都可写。如果一直监控所有连接的写事件，事件循环可能持续被唤醒。

正确策略：

- 没有待发送数据时不订阅写事件；
- `send` 部分写或返回 `EAGAIN` 时保存剩余数据并订阅写事件；
- 输出缓冲区清空后取消写事件。

### 5.6 select 的限制

1. `fd_set` 容量受 `FD_SETSIZE` 限制；
2. 每次调用需要准备并复制集合；
3. 返回后要线性扫描描述符范围；
4. 描述符值很大但数量很少时仍可能扫描较大范围；
5. 集合是位图，动态管理不够方便。

`select` 的优点是接口历史悠久、跨平台性较好，适合连接数不大或兼容性要求高的程序。

## 六、poll

### 6.1 接口

```c
#include <poll.h>

int poll(struct pollfd *fds, nfds_t nfds, int timeout);
```

```c
struct pollfd {
    int fd;
    short events;
    short revents;
};
```

常见事件：

| 事件 | 含义 |
| --- | --- |
| `POLLIN` | 可读 |
| `POLLOUT` | 可写 |
| `POLLERR` | 错误 |
| `POLLHUP` | 挂断 |
| `POLLNVAL` | 描述符无效 |

`events` 是输入关注集合，`revents` 是返回事件，实现了字段级输入输出分离。

### 6.2 poll 的优点

- 不受 `fd_set` 位图容量的相同限制；
- 数组结构更适合动态管理；
- 不需要 `max_fd + 1`。

### 6.3 poll 的代价

- 每次调用仍要传递描述符数组；
- 返回后仍需扫描数组；
- 大量连接中只有少数活跃时，扫描成本会增加；
- 删除元素时要管理数组空洞或移动。

把某个 `pollfd.fd` 设为负数，可以让本轮忽略该元素。

## 七、epoll 基础

epoll 是 Linux 专有的就绪通知接口。

### 7.1 创建

新代码使用：

```c
#include <sys/epoll.h>

int epoll_fd = epoll_create1(EPOLL_CLOEXEC);
```

历史 `epoll_create(size)` 的 `size` 在现代 Linux 中被忽略，但必须为正值。

### 7.2 注册、修改和删除

```c
int epoll_ctl(int epfd, int op, int fd,
              struct epoll_event *event);
```

操作：

- `EPOLL_CTL_ADD`；
- `EPOLL_CTL_MOD`；
- `EPOLL_CTL_DEL`。

### 7.3 等待事件

```c
int epoll_wait(int epfd,
               struct epoll_event *events,
               int maxevents,
               int timeout);
```

`events` 数组由用户分配，内核只填充本次返回的就绪项。循环只能遍历返回值 `count`，不能遍历整个数组容量。

### 7.4 常见事件

| 事件 | 作用 |
| --- | --- |
| `EPOLLIN` | 可读 |
| `EPOLLOUT` | 可写 |
| `EPOLLERR` | 错误 |
| `EPOLLHUP` | 挂断 |
| `EPOLLRDHUP` | 流式套接字对端关闭写方向 |
| `EPOLLET` | 边缘触发 |
| `EPOLLONESHOT` | 一次通知后禁用，需重新启用 |

即便没有显式注册，错误和挂断也可能被报告，代码必须处理。

## 八、epoll 为什么适合大量连接

从使用模型看：

1. 关注集合通过 `epoll_ctl` 保存在内核对象中，不必每轮完整重传；
2. `epoll_wait` 返回就绪项，不要求应用扫描所有已注册描述符；
3. 大量连接、少量活跃时能减少无效扫描；
4. 支持 LT、ET、ONESHOT 等模式。

常见实现会使用适合管理关注项和就绪队列的数据结构。不要把“epoll 所有操作严格 O(1)”当作规范保证：

- `epoll_ctl` 需要管理关注集合；
- `epoll_wait` 至少要复制本次返回事件；
- 性能还受回调、缓存、锁、网络协议栈和应用逻辑影响。

## 九、LT 与 ET

### 9.1 水平触发 LT

LT 是默认模式。只要描述符仍处于就绪状态，后续 `epoll_wait` 还会继续报告。

例如接收缓冲区有 2 KiB，只读取 1 KiB，下一轮通常仍报告可读。

优点：

- 容错性较好；
- 可以只处理部分数据；
- 更容易从阻塞模型迁移。

### 9.2 边缘触发 ET

ET 主要在就绪状态发生边缘变化时通知。收到通知后应把操作执行到返回 `EAGAIN`/`EWOULDBLOCK`。

典型读循环：

```c
for (;;) {
    ssize_t n = recv(fd, buffer, sizeof(buffer), 0);
    if (n > 0) {
        consume(buffer, (size_t)n);
        continue;
    }
    if (n == 0) {
        peer_closed();
        break;
    }
    if (errno == EINTR) {
        continue;
    }
    if (errno == EAGAIN || errno == EWOULDBLOCK) {
        break;
    }
    connection_error();
    break;
}
```

ET 通常必须配合非阻塞描述符，否则循环中的下一次读取可能永久阻塞事件线程。

### 9.3 ET 不等于一定更快

ET 可以减少重复通知，但代码状态管理更复杂。实际性能取决于：

- 活跃连接比例；
- 每次事件处理预算；
- 系统调用数量；
- 输出队列和背压；
- 业务处理耗时；
- 多核调度与锁竞争。

## 十、监听套接字在 ET 下的处理

同一时刻可能有多个已排队连接。ET 下不能只调用一次 `accept`，应循环：

```c
for (;;) {
    int client = accept4(listen_fd, NULL, NULL,
                         SOCK_NONBLOCK | SOCK_CLOEXEC);
    if (client >= 0) {
        add_to_epoll(client);
        continue;
    }
    if (errno == EINTR) {
        continue;
    }
    if (errno == EAGAIN || errno == EWOULDBLOCK) {
        break;
    }
    perror("accept4");
    break;
}
```

## 十一、非阻塞写与输出缓冲区

`send` 可能：

- 发送全部数据；
- 只发送一部分；
- 返回 `EAGAIN`；
- 被信号打断；
- 因连接错误失败。

事件驱动服务器必须为每条连接维护：

- 输出缓冲区；
- 已发送偏移量；
- 是否订阅 `EPOLLOUT`；
- 最大待发送字节；
- 写超时。

当缓冲区清空时取消 `EPOLLOUT`，否则套接字长期可写会造成忙循环。

## 十二、完整 epoll ET 回显服务器

下面示例使用 C++17 管理每条连接的输出状态。它展示：

- 非阻塞监听和连接套接字；
- `accept`、`recv`、`send` 一直执行到 `EAGAIN`；
- 部分写与动态 `EPOLLOUT`；
- `EPOLLRDHUP` 半关闭；
- 待发送数据上限；
- close-on-exec；
- ET 模式。

```cpp
#ifndef _GNU_SOURCE
#define _GNU_SOURCE
#endif

#include <arpa/inet.h>
#include <cerrno>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <iostream>
#include <string>
#include <sys/epoll.h>
#include <sys/socket.h>
#include <unordered_map>
#include <unistd.h>

namespace {

constexpr std::uint16_t kPort = 9090;
constexpr std::size_t kMaxPending = 1U << 20;
constexpr int kMaxEvents = 128;

struct Connection {
    std::string output;
    std::size_t sent = 0;
    bool peer_closed = false;
};

[[noreturn]] void die(const char* operation)
{
    std::perror(operation);
    std::exit(EXIT_FAILURE);
}

std::uint32_t connection_events(const Connection& connection)
{
    std::uint32_t events = EPOLLET | EPOLLRDHUP;
    if (!connection.peer_closed) {
        events |= EPOLLIN;
    }
    if (connection.sent < connection.output.size()) {
        events |= EPOLLOUT;
    }
    return events;
}

bool modify_interest(int epoll_fd, int fd, const Connection& connection)
{
    epoll_event event{};
    event.events = connection_events(connection);
    event.data.fd = fd;
    return epoll_ctl(epoll_fd, EPOLL_CTL_MOD, fd, &event) == 0;
}

void close_connection(int epoll_fd,
                      std::unordered_map<int, Connection>& connections,
                      int fd)
{
    epoll_ctl(epoll_fd, EPOLL_CTL_DEL, fd, nullptr);
    close(fd);
    connections.erase(fd);
}

bool flush_output(int fd, Connection& connection)
{
    while (connection.sent < connection.output.size()) {
        const char* data = connection.output.data() + connection.sent;
        std::size_t remaining = connection.output.size() - connection.sent;
        ssize_t n = send(fd, data, remaining, MSG_NOSIGNAL);

        if (n > 0) {
            connection.sent += static_cast<std::size_t>(n);
            continue;
        }
        if (n < 0 && errno == EINTR) {
            continue;
        }
        if (n < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
            return true;
        }
        return false;
    }

    connection.output.clear();
    connection.sent = 0;
    return true;
}

bool read_input(int fd, Connection& connection)
{
    char buffer[8192];

    for (;;) {
        ssize_t n = recv(fd, buffer, sizeof(buffer), 0);
        if (n > 0) {
            connection.output.append(buffer, static_cast<std::size_t>(n));
            if (connection.output.size() - connection.sent > kMaxPending) {
                std::cerr << "connection " << fd
                          << " exceeded output limit\n";
                return false;
            }
            continue;
        }
        if (n == 0) {
            connection.peer_closed = true;
            return true;
        }
        if (errno == EINTR) {
            continue;
        }
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return true;
        }
        return false;
    }
}

void accept_connections(int epoll_fd,
                        int listen_fd,
                        std::unordered_map<int, Connection>& connections)
{
    for (;;) {
        int fd = accept4(listen_fd, nullptr, nullptr,
                         SOCK_NONBLOCK | SOCK_CLOEXEC);
        if (fd >= 0) {
            epoll_event event{};
            event.events = EPOLLIN | EPOLLRDHUP | EPOLLET;
            event.data.fd = fd;

            if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD, fd, &event) == -1) {
                std::perror("epoll_ctl ADD client");
                close(fd);
                continue;
            }

            connections.emplace(fd, Connection{});
            continue;
        }

        if (errno == EINTR) {
            continue;
        }
        if (errno == EAGAIN || errno == EWOULDBLOCK) {
            return;
        }

        std::perror("accept4");
        return;
    }
}

}  // namespace

int main()
{
    int listen_fd = socket(AF_INET,
                           SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC,
                           0);
    if (listen_fd == -1) {
        die("socket");
    }

    int reuse = 1;
    if (setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR,
                   &reuse, sizeof(reuse)) == -1) {
        die("setsockopt");
    }

    sockaddr_in local{};
    local.sin_family = AF_INET;
    local.sin_port = htons(kPort);
    local.sin_addr.s_addr = htonl(INADDR_ANY);

    if (bind(listen_fd, reinterpret_cast<sockaddr*>(&local),
             sizeof(local)) == -1) {
        die("bind");
    }
    if (listen(listen_fd, SOMAXCONN) == -1) {
        die("listen");
    }

    int epoll_fd = epoll_create1(EPOLL_CLOEXEC);
    if (epoll_fd == -1) {
        die("epoll_create1");
    }

    epoll_event listen_event{};
    listen_event.events = EPOLLIN | EPOLLET;
    listen_event.data.fd = listen_fd;
    if (epoll_ctl(epoll_fd, EPOLL_CTL_ADD,
                  listen_fd, &listen_event) == -1) {
        die("epoll_ctl ADD listen");
    }

    std::unordered_map<int, Connection> connections;
    epoll_event events[kMaxEvents];

    for (;;) {
        int count = epoll_wait(epoll_fd, events, kMaxEvents, -1);
        if (count == -1) {
            if (errno == EINTR) {
                continue;
            }
            die("epoll_wait");
        }

        for (int i = 0; i < count; ++i) {
            int fd = events[i].data.fd;
            std::uint32_t ready = events[i].events;

            if (fd == listen_fd) {
                accept_connections(epoll_fd, listen_fd, connections);
                continue;
            }

            auto iterator = connections.find(fd);
            if (iterator == connections.end()) {
                continue;
            }

            Connection& connection = iterator->second;
            bool healthy = true;

            if ((ready & EPOLLERR) != 0U) {
                healthy = false;
            }

            if (healthy && (ready & (EPOLLIN | EPOLLRDHUP)) != 0U) {
                healthy = read_input(fd, connection);
            }

            if (healthy && connection.sent < connection.output.size()) {
                healthy = flush_output(fd, connection);
            }

            if (!healthy ||
                ((ready & EPOLLHUP) != 0U && connection.output.empty()) ||
                (connection.peer_closed && connection.output.empty())) {
                close_connection(epoll_fd, connections, fd);
                continue;
            }

            if (!modify_interest(epoll_fd, fd, connection)) {
                std::perror("epoll_ctl MOD client");
                close_connection(epoll_fd, connections, fd);
            }
        }
    }
}
```

编译运行：

```bash
g++ -std=c++17 -Wall -Wextra -Wpedantic -O2 epoll_echo.cpp -o epoll_echo
./epoll_echo
```

测试：

```bash
nc 127.0.0.1 9090
```

这仍是教学示例。生产服务器还需要协议解析、超时、连接上限、公平调度、优雅退出、日志、指标和更细致的错误策略。

## 十三、Reactor 模型

Reactor 将 I/O 就绪事件分派给对应处理器：

```text
注册事件 -> 等待就绪 -> 事件分发 -> 回调推进连接状态
```

典型组件：

| 组件 | 职责 |
| --- | --- |
| EventLoop | 调用 `epoll_wait`，驱动事件循环 |
| Poller | 封装 epoll 注册和等待 |
| Channel | 描述 fd 关注事件与回调 |
| Connection | 保存输入/输出缓冲区和协议状态 |
| Acceptor | 接收新连接 |
| Timer | 管理超时任务 |
| ThreadPool | 执行耗时业务或计算任务 |

Reactor 解决 I/O 事件调度，不自动解决：

- 应用协议解析；
- 业务线程安全；
- 数据库事务；
- 负载均衡；
- 服务降级；
- 分布式一致性。

## 十四、`EPOLLONESHOT`

多线程同时处理同一连接时，可能出现两个线程并发读取或修改连接状态。`EPOLLONESHOT` 让事件返回一次后暂时禁用，处理完成后通过 `EPOLL_CTL_MOD` 重新启用。

它可以帮助实现“一条连接同一时刻只由一个执行流处理”，但仍要保证：

- 所有返回路径都重新 arm；
- 连接关闭与重新 arm 不竞态；
- 任务队列不会无限积压；
- 输出缓冲区由明确线程拥有。

## 十五、惊群问题

多个线程或进程等待同一监听事件时，一个连接可能唤醒多个等待者，而最终只有一个成功处理，其他执行流白白被唤醒。

现代 Linux、`EPOLLEXCLUSIVE`、`SO_REUSEPORT` 和不同架构可减轻某些场景，但不存在一条适用于所有服务器的简单开关。

选择方案前要明确：

- 多个线程是否共享同一 epoll 实例；
- 是否共享监听套接字；
- 由谁执行 accept；
- 连接怎样分发到事件循环；
- 是否需要 CPU 亲和与负载迁移。

## 十六、定时器与其他可监控对象

epoll 不只能监控网络套接字。Linux 服务器常把多种事件统一成文件描述符：

| 接口 | 用途 |
| --- | --- |
| `timerfd` | 定时器 |
| `eventfd` | 线程/组件唤醒和计数通知 |
| `signalfd` | 将已阻塞信号转换为可读事件 |
| pipe/socketpair | 自唤醒与跨线程通知 |

这样 EventLoop 可以在同一等待点处理 I/O、定时、信号和任务唤醒。

## 十七、公平性与饥饿

ET 要读取到 `EAGAIN`，但单个高流量连接可能持续产生数据，使事件线程长时间服务它。

工程中可采用：

- 每轮最大读取字节数；
- 每连接时间预算；
- `EPOLLONESHOT` + 任务重新排队；
- 多 EventLoop 分片；
- 输出高水位和读暂停；
- 连接级限速。

如果主动提前停止 ET 读取但仍未到 `EAGAIN`，必须设计可靠的重新调度方式，否则可能丢失后续通知机会。

## 十八、背压

如果生产响应的速度长期高于网络发送速度，输出缓冲区会不断增长。

背压策略：

1. 设置输出缓冲区高水位；
2. 暂停读取或暂停上游任务；
3. 限制每连接待处理请求数；
4. 设置写超时；
5. 达到硬上限时关闭连接或降级；
6. 记录队列长度、延迟和丢弃指标。

只要内存够就无限缓存，最终会让整个进程被单个慢客户端拖垮。

## 十九、select、poll、epoll 对比

| 维度 | select | poll | epoll |
| --- | --- | --- | --- |
| 平台 | 广泛 | POSIX 系统广泛 | Linux |
| 关注集合 | 位图 | `pollfd` 数组 | 内核 epoll 实例 |
| 容量 | 受 `FD_SETSIZE` | 无相同位图上限 | 受系统资源限制 |
| 每轮传集合 | 是 | 是 | 注册变化时更新 |
| 返回后扫描 | 扫描 fd 范围 | 扫描数组 | 遍历返回就绪项 |
| LT | 支持 | 支持 | 支持 |
| ET | 不提供同类接口 | 不提供同类接口 | 支持 |
| 适合 | 小规模、兼容性 | 中等规模、接口简单 | 大量连接、低活跃比例 |

不要只看连接数选择接口。少量连接、每条都持续高吞吐时，应用处理和内存复制可能才是主要瓶颈。

## 二十、常见错误

1. `select` 后不重建 `fd_set`；
2. `nfds` 没有传最大 fd 加一；
3. 遍历整个 events 数组，而不是 `epoll_wait` 返回数量；
4. 把“可读”理解成一定有正数业务数据，忽略 EOF；
5. ET 套接字仍使用阻塞模式；
6. ET 只 `recv` 或 `accept` 一次；
7. `send` 返回 `EAGAIN` 后丢弃剩余数据；
8. 始终订阅 `EPOLLOUT`，造成忙循环；
9. 没有输出上限，慢客户端导致内存增长；
10. 关闭 fd 后仍保留事件和连接对象；
11. fd 被系统复用后，旧异步任务错误操作新连接；
12. 在 EventLoop 中执行长时间阻塞业务；
13. 认为 epoll 自动提供线程安全；
14. 认为 epoll 的每个操作都严格 O(1)。

## 二十一、参考资料

- Linux epoll 手册：<https://man7.org/linux/man-pages/man7/epoll.7.html>
- `select(2)`、`poll(2)`、`epoll_ctl(2)`、`epoll_wait(2)` 可通过本机 `man` 查阅。

## 二十二、总结

1. I/O 包含等待与复制两个阶段，就绪不等于业务消息完整。
2. 非阻塞 I/O 要与事件通知配合，不能依赖忙轮询。
3. `select` 和 `poll` 每轮传递并扫描关注集合，epoll 将关注关系保存在内核实例中并返回就绪项。
4. LT 只要状态持续就绪就继续通知；ET 必须用非阻塞 I/O 处理到 `EAGAIN`。
5. 高并发写操作必须维护输出缓冲区、部分写、`EPOLLOUT` 和背压。
6. Reactor 将就绪事件分派给连接处理器，但协议状态、线程安全和业务逻辑仍由应用设计。
7. 高性能来自正确的数据结构、状态机、负载模型和资源控制，而不是单独调用一次 epoll。
