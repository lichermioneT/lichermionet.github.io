---
title: Linux进程间通信详解：管道、FIFO与System V共享内存
date: 2026-08-20 15:10:00
categories:
  - Linux
tags:
  - Linux
  - 进程间通信
  - 管道
  - FIFO
  - 共享内存
  - IPC
---

进程具有独立的虚拟地址空间，一个进程通常不能直接访问另一个进程的变量。为了让多个进程交换数据、同步状态或传递事件，操作系统提供了进程间通信机制，即 IPC（Inter-Process Communication）。

本文从匿名管道开始，依次介绍命名管道、System V 共享内存、消息队列和信号量，并给出可以直接编译运行的示例。

<!-- more -->

## 一、为什么需要进程间通信

进程间通信常见目标如下：

1. **数据传输**：一个进程将数据交给另一个进程。
2. **资源共享**：多个进程访问同一份数据或设备。
3. **事件通知**：某个进程发生状态变化后通知其他进程。
4. **进程控制**：一个进程启动、停止或监控另一个进程。
5. **模块解耦**：把大型程序拆分为多个相互协作的进程。

常见 IPC 机制可以这样比较：

| 机制 | 数据形态 | 是否适合无亲缘进程 | 是否自带同步 | 典型特点 |
| --- | --- | --- | --- | --- |
| 匿名管道 | 字节流 | 通常不适合 | 内核保证单次读写的基本并发语义 | 简单，常用于父子进程 |
| FIFO | 字节流 | 适合 | 与管道类似 | 通过文件名连接无亲缘进程 |
| 消息队列 | 有边界的消息 | 适合 | 内核管理队列 | 可按消息类型收发 |
| 共享内存 | 共享字节区域 | 适合 | **不自带** | 数据少一次内核中转，速度快 |
| 信号量 | 计数器 | 适合 | 本身就是同步工具 | 不用于传输大块业务数据 |
| Unix 域套接字 | 字节流或数据报 | 适合 | 由应用设计 | 本机客户端/服务器通信常用 |

## 二、匿名管道

### 2.1 管道的本质

管道是内核维护的一段缓冲区。进程通过两个文件描述符访问它：

- `fd[0]`：读端；
- `fd[1]`：写端。

创建接口如下：

```c
#include <unistd.h>

int pipe(int pipefd[2]);
```

成功返回 `0`，失败返回 `-1` 并设置 `errno`。

管道遵循“Linux 一切皆文件”的接口思想，可以使用 `read`、`write` 和 `close` 操作，但它不是磁盘文件，也不能使用 `lseek` 随意定位。

### 2.2 为什么常在 `fork` 前创建管道

`fork` 会复制父进程的文件描述符表，因此在 `fork` 前创建管道，父子进程就能持有指向同一个内核管道对象的描述符。

```text
父进程创建 pipe
        |
      fork
     /    \
父进程    子进程
fd[0/1]  fd[0/1]
     \    /
      同一管道
```

通信时应关闭不需要的一端。例如“父写子读”：

- 父进程关闭 `fd[0]`；
- 子进程关闭 `fd[1]`。

如果某个进程忘记关闭不使用的写端，读进程可能一直等不到 EOF。

### 2.3 父进程向子进程发送数据

```c
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/wait.h>
#include <unistd.h>

static void die(const char *message)
{
    perror(message);
    exit(EXIT_FAILURE);
}

static void write_all(int fd, const void *buffer, size_t length)
{
    const unsigned char *p = buffer;

    while (length > 0) {
        ssize_t n = write(fd, p, length);
        if (n > 0) {
            p += (size_t)n;
            length -= (size_t)n;
            continue;
        }
        if (n < 0 && errno == EINTR) {
            continue;
        }
        die("write");
    }
}

int main(void)
{
    int pipefd[2];
    if (pipe(pipefd) == -1) {
        die("pipe");
    }

    pid_t pid = fork();
    if (pid == -1) {
        die("fork");
    }

    if (pid == 0) {
        if (close(pipefd[1]) == -1) {
            _exit(120);
        }

        char buffer[128];
        for (;;) {
            ssize_t n = read(pipefd[0], buffer, sizeof(buffer));
            if (n > 0) {
                write_all(STDOUT_FILENO, buffer, (size_t)n);
                continue;
            }
            if (n == 0) {
                break;
            }
            if (errno == EINTR) {
                continue;
            }
            _exit(121);
        }

        close(pipefd[0]);
        _exit(EXIT_SUCCESS);
    }

    if (close(pipefd[0]) == -1) {
        die("close read end");
    }

    const char message[] = "message from parent\n";
    write_all(pipefd[1], message, sizeof(message) - 1);

    if (close(pipefd[1]) == -1) {
        die("close write end");
    }

    int status = 0;
    while (waitpid(pid, &status, 0) == -1) {
        if (errno != EINTR) {
            die("waitpid");
        }
    }

    return WIFEXITED(status) && WEXITSTATUS(status) == 0
               ? EXIT_SUCCESS
               : EXIT_FAILURE;
}
```

编译运行：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic pipe_demo.c -o pipe_demo
./pipe_demo
```

### 2.4 管道的读写规则

#### 有写端存在，但暂时没有数据

- 阻塞读：`read` 等待数据；
- 非阻塞读：`read` 返回 `-1`，`errno` 为 `EAGAIN` 或 `EWOULDBLOCK`。

#### 所有写端都已关闭

管道数据读完后，`read` 返回 `0`，表示 EOF。

#### 有读端存在，但缓冲区已满

- 阻塞写：等待缓冲区出现空间；
- 非阻塞写：可能返回 `-1`，`errno` 为 `EAGAIN` 或 `EWOULDBLOCK`。

#### 所有读端都已关闭

写入会触发 `SIGPIPE`；如果该信号被忽略或捕获，`write` 返回 `-1`，`errno` 为 `EPIPE`。

### 2.5 `PIPE_BUF` 与原子写

多个进程同时写同一个管道时，并不能认为每次 `write` 的数据都永远不会交错。

POSIX 保证：当单次写入长度不超过该管道的 `PIPE_BUF` 时，写入对于其他写者是原子的。可以查询：

```c
long pipe_buf = fpathconf(pipefd[1], _PC_PIPE_BUF);
```

注意：原子写只解决“数据是否交错”，不等于业务协议已经完整。应用仍然需要设计消息长度、分隔符或固定格式。

### 2.6 `pipe2`

Linux 提供 `pipe2`，可以在创建时原子设置标志：

```c
#define _GNU_SOURCE
#include <fcntl.h>
#include <unistd.h>

int pipefd[2];
pipe2(pipefd, O_CLOEXEC | O_NONBLOCK);
```

- `O_CLOEXEC`：执行 `exec` 时自动关闭描述符，避免泄漏给新程序；
- `O_NONBLOCK`：把读写端设置为非阻塞。

## 三、使用管道连接多个程序

Shell 中的：

```bash
ps aux | grep nginx | wc -l
```

本质上是创建多个进程，再使用管道连接前一个进程的标准输出和后一个进程的标准输入。

核心步骤是：

1. 为相邻命令创建管道；
2. `fork` 子进程；
3. 使用 `dup2` 将管道端复制到 `STDIN_FILENO` 或 `STDOUT_FILENO`；
4. 关闭所有不再使用的原始描述符；
5. 调用 `execvp` 执行命令；
6. 父进程关闭管道并等待子进程。

例如把一个子进程的标准输出接入管道：

```c
if (dup2(pipefd[1], STDOUT_FILENO) == -1) {
    _exit(126);
}
close(pipefd[0]);
close(pipefd[1]);
execlp("ls", "ls", "-l", (char *)NULL);
_exit(127);
```

`dup2` 后一定要关闭原描述符，否则容易出现描述符泄漏或 EOF 无法到达。

## 四、命名管道 FIFO

匿名管道依赖继承得到的文件描述符，通常用于亲缘进程。FIFO 在文件系统中有名字，因此无亲缘关系的进程也能通过同一路径打开它。

### 4.1 创建 FIFO

命令方式：

```bash
mkfifo /tmp/demo.fifo
ls -l /tmp/demo.fifo
```

C 接口：

```c
#include <sys/stat.h>

int mkfifo(const char *pathname, mode_t mode);
```

FIFO 是特殊文件，磁盘目录项只保存其名字和元数据，业务数据仍在内核缓冲区中流动。

### 4.2 打开规则

| 打开方式 | 阻塞模式 | 非阻塞模式 |
| --- | --- | --- |
| `O_RDONLY` | 等待写者打开 | 立即成功；暂无写者时读取行为需结合状态判断 |
| `O_WRONLY` | 等待读者打开 | 无读者时失败，`errno=ENXIO` |

为了简化实验，可以先在两个终端中执行：

终端一：

```bash
cat < /tmp/demo.fifo
```

终端二：

```bash
printf 'hello fifo\n' > /tmp/demo.fifo
```

实验结束：

```bash
rm -f /tmp/demo.fifo
```

不要让多个互不信任的用户共用一个权限宽松、路径可预测的 FIFO。程序创建 FIFO 时还应考虑 `umask`、路径所有者和符号链接攻击。

## 五、System V 共享内存

### 5.1 工作原理

共享内存允许多个进程把同一个物理内存对象映射到各自的虚拟地址空间。建立映射后，进程可直接读写共享区域，不必像管道那样让每次业务数据都经过一次系统调用中转。

因此共享内存适合传输大量数据，但它只解决“共享”，**不自动解决互斥、同步、消息边界和数据一致性**。

### 5.2 主要接口

```c
#include <sys/ipc.h>
#include <sys/shm.h>

int shmget(key_t key, size_t size, int shmflg);
void *shmat(int shmid, const void *shmaddr, int shmflg);
int shmdt(const void *shmaddr);
int shmctl(int shmid, int cmd, struct shmid_ds *buf);
```

职责如下：

| 接口 | 作用 |
| --- | --- |
| `shmget` | 创建或取得共享内存段 |
| `shmat` | 把共享内存附加到当前进程地址空间 |
| `shmdt` | 解除当前进程的映射 |
| `shmctl(..., IPC_RMID, ...)` | 标记共享内存段待删除 |

`shmdt` 只是解除当前进程映射，不等于删除内核中的共享内存对象。

### 5.3 `ftok` 不是强唯一标识

```c
key_t key = ftok("/some/existing/path", 0x42);
```

`ftok` 方便多个进程生成相同 `key_t`，但可能发生碰撞。安全敏感或大型系统不应把“`ftok` 结果绝不重复”当作设计前提。

### 5.4 创建与清理

```c
key_t key = ftok("/tmp", 0x42);
if (key == (key_t)-1) {
    perror("ftok");
    return 1;
}

int shmid = shmget(key, 4096, IPC_CREAT | IPC_EXCL | 0600);
if (shmid == -1) {
    perror("shmget");
    return 1;
}

void *address = shmat(shmid, NULL, 0);
if (address == (void *)-1) {
    perror("shmat");
    shmctl(shmid, IPC_RMID, NULL);
    return 1;
}

/* 使用共享内存 */

shmdt(address);
shmctl(shmid, IPC_RMID, NULL);
```

`IPC_RMID` 会把对象标记为删除；通常要等最后一个附加进程脱离后，内核才真正释放它。

### 5.5 查看 System V IPC 对象

```bash
ipcs -m
ipcs -q
ipcs -s
```

删除指定对象：

```bash
ipcrm -m SHMID
ipcrm -q MSQID
ipcrm -s SEMID
```

不要在不了解对象归属时批量删除 IPC 资源。

### 5.6 如何同步共享内存

共享内存中的生产者和消费者至少要解决：

- 数据是否已经写完；
- 读者能否看到完整结果；
- 多个写者是否会同时覆盖；
- 进程异常退出后如何恢复。

可选方案包括：

1. System V 信号量；
2. POSIX 命名信号量；
3. 放在共享内存中的进程共享互斥锁与条件变量；
4. 使用原子变量和明确的内存序；
5. 通过管道或 `eventfd` 传递“数据已就绪”通知。

跨进程使用 pthread 互斥锁时，必须设置 `PTHREAD_PROCESS_SHARED` 属性；需要容忍持锁进程崩溃时，还应研究 robust mutex。

## 六、System V 消息队列

消息队列由内核保存一组带类型的离散消息，常用接口如下：

```c
#include <sys/msg.h>

int msgget(key_t key, int msgflg);
int msgsnd(int msqid, const void *msgp, size_t msgsz, int msgflg);
ssize_t msgrcv(int msqid, void *msgp, size_t msgsz,
               long msgtyp, int msgflg);
int msgctl(int msqid, int cmd, struct msqid_ds *buf);
```

消息结构的第一个成员必须是正的 `long` 类型消息类型：

```c
struct message {
    long type;
    char data[256];
};
```

传给 `msgsnd` 和 `msgrcv` 的 `msgsz` **不包含** `long type` 的大小。

消息队列保留消息边界，比字节流管道更适合“命令 + 参数”式通信；但队列容量有限，对象还可能在进程退出后继续存在，需要显式管理生命周期。

## 七、System V 信号量

信号量维护的是计数状态，主要用于同步和互斥，而不是承载业务数据。

```c
#include <sys/sem.h>

int semget(key_t key, int nsems, int semflg);
int semop(int semid, struct sembuf *sops, size_t nsops);
int semctl(int semid, int semnum, int cmd, ...);
```

`semop` 可以把多个操作作为一个原子操作集合提交。常见思路：

- P 操作：计数不足时等待，满足后减一；
- V 操作：计数加一，唤醒可能等待的进程。

System V 信号量接口历史悠久但比较复杂。线程同步或新项目也可考虑 POSIX 信号量、pthread 同步原语、`eventfd` 等工具。

## 八、IPC 的选择建议

| 需求 | 优先考虑 |
| --- | --- |
| 父子进程传递少量字节流 | 匿名管道 |
| 两个无亲缘命令行程序简单通信 | FIFO |
| 本机客户端/服务器、需要双向通信 | Unix 域套接字 |
| 大块数据、高吞吐 | 共享内存 + 同步机制 |
| 离散命令、需要消息边界 | 消息队列或 Unix 域数据报套接字 |
| 只传递计数或唤醒事件 | 信号量、`eventfd` |

工程中还应同时考虑：

- 生命周期与异常清理；
- 权限和身份认证；
- 背压与容量限制；
- 阻塞、超时和取消；
- 数据协议的版本兼容；
- 进程崩溃后的恢复策略。

## 九、常见错误

### 9.1 忘记关闭无用的管道端

只要还有任意写端打开，读端就不会得到 EOF。

### 9.2 认为一次 `read` 对应一次 `write`

管道是字节流，一次写入可能被多次读取，多次写入也可能被一次读取。必须由应用层协议确定边界。

### 9.3 把共享内存当作天然线程安全

共享内存只提供共同地址区域，不提供自动互斥和可见性协议。

### 9.4 只 `shmdt`，不管理对象生命周期

System V IPC 对象具有内核持久性，创建者应明确谁负责执行 `IPC_RMID`。

### 9.5 忽略错误码和信号中断

`read`、`write`、`waitpid` 等接口可能因信号返回 `EINTR`。程序要区分可重试错误、暂时不可用和真正失败。

## 十、总结

1. 匿名管道是内核字节流，最常用于亲缘进程。
2. FIFO 通过路径让无亲缘进程建立管道式通信。
3. 管道通信要正确关闭无用描述符，并自行设计消息边界。
4. 共享内存吞吐高，但必须额外设计同步和生命周期管理。
5. 消息队列保留消息边界，信号量主要负责同步。
6. IPC 机制没有绝对优劣，应根据数据量、关系模型、可靠性和维护成本选择。

