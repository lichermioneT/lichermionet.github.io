---
title: Linux进程信号详解：产生、阻塞、捕获与安全处理
date: 2026-08-20 15:20:00
categories:
  - Linux
tags:
  - Linux
  - 进程信号
  - sigaction
  - sigprocmask
  - SIGCHLD
---

Linux 信号是一种异步事件通知机制。内核、终端或其他进程可以向目标进程发送信号，目标进程再按照默认动作、忽略规则或自定义处理器作出响应。

信号适合表达“发生了某件事”，不适合直接传输大量业务数据。真正掌握信号，需要理解信号的产生、未决、阻塞、递达、捕获，以及处理器中的异步安全约束。

<!-- more -->

## 一、信号是什么

信号可以理解为发送给进程或线程的一个编号。它的特点是：

- **异步**：信号可能在程序执行到几乎任何位置时到达；
- **信息量有限**：普通信号主要表达事件类型；
- **由内核参与递送**：发送者不能直接跳进目标进程执行函数；
- **有预设动作**：终止、生成 core、停止、继续或忽略；
- **可以阻塞**：暂时不递达，先保持为 pending 状态。

常见信号如下：

| 信号 | 常见来源 | 默认动作 |
| --- | --- | --- |
| `SIGINT` | 终端 `Ctrl-C` | 终止进程 |
| `SIGQUIT` | 终端 `Ctrl-\` | 终止并可能生成 core |
| `SIGTERM` | `kill PID` 的默认信号 | 终止进程 |
| `SIGKILL` | 强制终止 | 终止，不能捕获或忽略 |
| `SIGSTOP` | 强制暂停 | 停止，不能捕获或忽略 |
| `SIGCONT` | 恢复已停止进程 | 继续运行 |
| `SIGALRM` | 定时器到期 | 终止进程 |
| `SIGPIPE` | 向无读者的管道或已关闭连接写入 | 终止进程 |
| `SIGCHLD` | 子进程停止、继续或退出 | 默认忽略，但仍涉及子进程回收语义 |
| `SIGSEGV` | 非法内存访问 | 终止并可能生成 core |

查看当前系统定义的信号：

```bash
kill -l
man 7 signal
```

不要把不同 Unix 系统上的具体信号编号写死。代码中应使用 `SIGINT`、`SIGTERM` 等宏。

## 二、信号如何产生

### 2.1 终端按键

Shell 会管理前台进程组。常见控制键：

- `Ctrl-C`：向前台进程组发送 `SIGINT`；
- `Ctrl-\`：向前台进程组发送 `SIGQUIT`；
- `Ctrl-Z`：向前台进程组发送 `SIGTSTP`。

信号通常发送给整个前台进程组，而不只是某一个进程。

### 2.2 `kill` 命令

```bash
kill -TERM 1234
kill -INT 1234
kill -KILL 1234
```

`kill` 的名字容易误导：它的本质是发送信号，不一定终止进程。

应优先发送 `SIGTERM`，让程序有机会完成清理；只有目标无法正常退出时才考虑 `SIGKILL`。

### 2.3 `kill`、`raise` 与 `abort`

```c
#include <signal.h>
#include <stdlib.h>

int kill(pid_t pid, int sig);
int raise(int sig);
void abort(void);
```

- `kill`：按 PID 或进程组发送信号；
- `raise`：向当前执行流所属进程发送信号；
- `abort`：触发异常终止，通常产生 `SIGABRT`。

`kill` 的 `pid` 参数含义：

| `pid` | 目标 |
| --- | --- |
| `> 0` | 指定 PID |
| `0` | 调用者所在进程组 |
| `-1` | 有权限发送的广泛进程集合，具体受系统规则限制 |
| `< -1` | 进程组 ID 为 `-pid` 的进程组 |

发送信号需要权限。普通用户通常只能向自己拥有的进程发送信号。

### 2.4 软件条件与硬件异常

常见例子：

- `alarm` 到期产生 `SIGALRM`；
- 向无读者管道写数据产生 `SIGPIPE`；
- 子进程状态变化产生 `SIGCHLD`；
- 非法地址访问产生 `SIGSEGV`；
- 除零等异常可能产生 `SIGFPE`。

不要把 `SIGSEGV` 当作可以可靠恢复的普通业务通知。发生内存破坏后，进程状态可能已经不可信。

## 三、默认处理、忽略和捕获

一个可捕获信号通常有三种处置方式：

1. 执行默认动作 `SIG_DFL`；
2. 忽略信号 `SIG_IGN`；
3. 调用用户注册的信号处理函数。

`SIGKILL` 和 `SIGSTOP` 不能被捕获、阻塞或忽略，这是内核保留的最终控制手段。

## 四、Core Dump

某些致命信号的默认动作会终止进程并生成 core 文件。core 是进程崩溃时的内存与寄存器快照，可用于 GDB 分析。

查看或调整当前 Shell 的 core 大小限制：

```bash
ulimit -c
ulimit -c unlimited
```

调试：

```bash
gcc -g -O0 crash.c -o crash
gdb ./crash core
```

现代发行版可能由 systemd-coredump、Apport 或其他服务集中管理 core，因此文件不一定直接出现在当前目录。

生产环境的 core 可能包含密钥、口令和用户数据，应严格控制存储权限与保留周期。

## 五、信号的阻塞、未决与递达

理解三个术语：

- **产生（generation）**：某个事件使信号出现；
- **未决（pending）**：信号已经产生，但尚未递达；
- **递达（delivery）**：内核真正执行该信号的处置动作。

阻塞不是忽略：

- 阻塞信号时，信号可以进入未决状态；
- 解除阻塞后，未决信号才有机会递达；
- 忽略则是该信号的处置方式。

### 5.1 普通信号与实时信号

传统普通信号通常不会为同一信号编号累计任意多个实例：阻塞期间重复产生，解除阻塞后可能只观察到一次。

实时信号位于 `SIGRTMIN` 到 `SIGRTMAX`，支持排队，并可携带有限数据。实时信号的具体可用范围可能被线程库占用，不应假设固定编号。

### 5.2 `sigset_t` 信号集

```c
#include <signal.h>

int sigemptyset(sigset_t *set);
int sigfillset(sigset_t *set);
int sigaddset(sigset_t *set, int signum);
int sigdelset(sigset_t *set, int signum);
int sigismember(const sigset_t *set, int signum);
```

不要直接假设 `sigset_t` 的内部布局，必须通过这些接口操作。

### 5.3 `sigprocmask`

```c
int sigprocmask(int how, const sigset_t *set, sigset_t *oldset);
```

`how` 常见取值：

| 取值 | 效果 |
| --- | --- |
| `SIG_BLOCK` | 把 `set` 中的信号加入阻塞集 |
| `SIG_UNBLOCK` | 从阻塞集中移除 |
| `SIG_SETMASK` | 直接替换阻塞集 |

单线程程序可使用 `sigprocmask`。多线程程序中，每个线程拥有自己的信号掩码，应使用 `pthread_sigmask` 明确管理。

### 5.4 查看未决信号

```c
sigset_t pending;
if (sigpending(&pending) == -1) {
    perror("sigpending");
}
```

## 六、使用 `sigaction` 捕获信号

相比历史接口 `signal`，新代码更推荐 `sigaction`，因为它能明确指定处理器执行期间的屏蔽集和行为标志。

```c
#include <signal.h>

int sigaction(int signum,
              const struct sigaction *act,
              struct sigaction *oldact);
```

常用字段：

```c
struct sigaction action;
action.sa_handler = handler;
sigemptyset(&action.sa_mask);
action.sa_flags = 0;
```

### 6.1 一个安全的退出标志示例

```c
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

static volatile sig_atomic_t stop_requested = 0;

static void handle_stop(int signum)
{
    (void)signum;
    stop_requested = 1;
}

int main(void)
{
    sigset_t blocked;
    sigset_t old_mask;
    sigemptyset(&blocked);
    sigaddset(&blocked, SIGINT);
    sigaddset(&blocked, SIGTERM);

    if (sigprocmask(SIG_BLOCK, &blocked, &old_mask) == -1) {
        perror("sigprocmask block");
        return EXIT_FAILURE;
    }

    struct sigaction action;
    action.sa_handler = handle_stop;
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;

    if (sigaction(SIGINT, &action, NULL) == -1 ||
        sigaction(SIGTERM, &action, NULL) == -1) {
        perror("sigaction");
        return EXIT_FAILURE;
    }

    puts("running; press Ctrl-C to stop");

    while (!stop_requested) {
        errno = 0;
        if (sigsuspend(&old_mask) == -1 && errno != EINTR) {
            perror("sigsuspend");
            return EXIT_FAILURE;
        }
    }

    if (sigprocmask(SIG_SETMASK, &old_mask, NULL) == -1) {
        perror("sigprocmask restore");
        return EXIT_FAILURE;
    }

    puts("stop requested; clean up in normal control flow");
    return EXIT_SUCCESS;
}
```

编译：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic signal_flag.c -o signal_flag
```

这里先阻塞目标信号，再使用 `sigsuspend` 原子地解除阻塞并等待，避免“检查标志后、进入休眠前”丢失唤醒。处理器只给 `volatile sig_atomic_t` 赋值，把日志、资源释放和复杂业务留在正常控制流中执行。

### 6.2 为什么不能用普通 `int`

`sig_atomic_t` 是 C 标准保证可被信号处理器以不可分割方式访问的整数类型。`volatile` 告诉编译器每次都实际读取或写入该对象。

但要注意：

- `volatile` **不是线程同步工具**；
- 它不提供 C11 原子变量那样的跨线程内存序；
- 它也不能让任意复杂操作在信号处理器中变安全。

## 七、信号处理器中的异步信号安全

信号可能打断主程序正在执行的库函数。如果处理器再次调用同一个不可重入函数，内部状态可能被破坏。

因此处理器中不能随意调用：

- `printf`、`fprintf`；
- `malloc`、`free`；
- 大部分 C++ 标准库；
- 普通互斥锁；
- 自己编写但未证明可重入的复杂函数。

POSIX 规定了一组 async-signal-safe 函数，例如 `_exit`、`write`、`kill` 等。完整列表应查阅：

```bash
man 7 signal-safety
```

即便 `write` 是异步信号安全的，也要避免多个执行流同时写复杂日志导致内容交错。

### 7.1 `SA_RESTART`

某些阻塞系统调用被信号打断后会返回 `-1/EINTR`。设置 `SA_RESTART` 后，内核或 C 库可以自动重启部分接口：

```c
action.sa_flags = SA_RESTART;
```

但不是所有接口都会重启。可靠代码仍应理解每个系统调用的 `EINTR` 语义。

### 7.2 `SA_SIGINFO`

需要获得发送者 PID、UID 或故障地址等信息时，可以使用三参数处理器：

```c
static void handler(int sig, siginfo_t *info, void *context);

struct sigaction action;
action.sa_sigaction = handler;
sigemptyset(&action.sa_mask);
action.sa_flags = SA_SIGINFO;
```

这不会放宽异步信号安全限制。

## 八、避免“检查后再休眠”的竞态

下面的逻辑存在竞态：

```c
if (!event_arrived) {
    pause();
}
```

信号可能恰好在检查之后、`pause` 之前递达，随后程序进入永久休眠。

一种经典解决方案是：

1. 先阻塞目标信号；
2. 检查条件；
3. 使用 `sigsuspend` 原子地临时替换掩码并休眠；
4. 被信号唤醒后恢复原掩码。

```c
int sigsuspend(const sigset_t *mask);
```

“修改屏蔽集 + 进入等待”必须是原子步骤，这和条件变量解决丢失唤醒的思想相似。

## 九、回收子进程与 `SIGCHLD`

子进程退出后，父进程需要调用 `wait` 或 `waitpid` 读取状态，否则子进程可能成为僵尸进程。

一个 `SIGCHLD` 可能对应多个已退出子进程，而且普通信号可能合并，因此处理逻辑必须循环回收：

```c
#include <errno.h>
#include <sys/wait.h>

static void reap_children(int signum)
{
    int saved_errno = errno;
    (void)signum;

    while (waitpid(-1, NULL, WNOHANG) > 0) {
    }

    errno = saved_errno;
}
```

注册时常见配置：

```c
struct sigaction action;
action.sa_handler = reap_children;
sigemptyset(&action.sa_mask);
action.sa_flags = SA_RESTART | SA_NOCLDSTOP;
sigaction(SIGCHLD, &action, NULL);
```

注意：处理器只能做少量异步安全操作。需要记录详细退出状态时，更易维护的方式是让专门线程使用 `sigwaitinfo`，或通过 self-pipe 把事件转交主事件循环。

## 十、多线程程序中的信号

多线程使信号语义更复杂：

- 每个线程有自己的信号掩码；
- 信号处置方式通常是进程级共享的；
- 进程定向信号可递送给任意一个未阻塞该信号的线程；
- 同步硬件异常通常递送给触发异常的线程；
- `pthread_kill` 可以向指定线程发送信号。

推荐模式：

1. 主线程在创建其他线程前阻塞一组业务信号；
2. 新线程继承该掩码；
3. 创建一个信号线程；
4. 信号线程用 `sigwait`、`sigwaitinfo` 或 `sigtimedwait` 同步等待；
5. 在线程正常上下文中处理事件。

这种模式比异步处理器更容易使用锁、日志和 C++ 对象。

示意代码：

```c
sigset_t set;
sigemptyset(&set);
sigaddset(&set, SIGINT);
sigaddset(&set, SIGTERM);

pthread_sigmask(SIG_BLOCK, &set, NULL);

int received = 0;
sigwait(&set, &received);
```

## 十一、将信号接入 I/O 事件循环

### 11.1 Self-pipe 技巧

处理器只向非阻塞管道写入一个字节，主循环通过 `select`、`poll` 或 `epoll` 监控管道读端，再在正常上下文处理事件。

需要处理：

- 写端设置非阻塞，防止处理器因管道满而阻塞；
- 只写固定小消息；
- 正确处理 `EAGAIN`；
- 主循环一次性排空管道；
- 业务状态仍需避免事件合并造成的信息丢失。

### 11.2 `signalfd`

Linux 还提供 `signalfd`，把已阻塞信号转换为文件描述符事件，可直接接入 `epoll`。

它是 Linux 专有接口，不属于 POSIX，但在 Linux 服务器事件循环中很实用。

## 十二、信号与定时器

`alarm` 以秒为单位安排一次 `SIGALRM`：

```c
unsigned int alarm(unsigned int seconds);
```

更现代的定时需求可考虑：

- POSIX timers；
- `timerfd`；
- 事件循环自身的最小堆或时间轮；
- C++ `std::chrono` 配合线程/事件系统。

服务器中使用 `timerfd` 可以把定时事件和 I/O 一起交给 `epoll`，通常比复杂的异步信号处理更清晰。

## 十三、常见误区

### 13.1 在处理器中打印日志

`printf` 不是异步信号安全函数。处理器中应只设置标志或调用经过允许的低级接口。

### 13.2 用 `volatile` 解决线程安全

`volatile sig_atomic_t` 适用于处理器与正常控制流之间的简单标志，不等于通用线程同步。

### 13.3 捕获 `SIGSEGV` 后继续工作

致命内存错误发生后，程序状态可能损坏。处理器最多进行极少量诊断或恢复到预先设计的安全边界，不应继续普通业务。

### 13.4 一个 `SIGCHLD` 只调用一次 `waitpid`

多个子进程可能同时退出，应循环执行 `waitpid(-1, ..., WNOHANG)` 直到没有可回收子进程。

### 13.5 认为阻塞等于丢弃

阻塞信号会延迟递达；忽略信号才是处置方式。普通信号在阻塞期间可能合并。

### 13.6 用 `SIGKILL` 做正常停止流程

`SIGKILL` 不允许程序清理资源。正常运维应先使用 `SIGTERM`，设置合理超时后再升级为强制终止。

## 十四、总结

1. 信号是由内核递送的异步事件通知，不适合传输大块数据。
2. 信号经历产生、未决、阻塞和递达几个关键状态。
3. 新代码优先使用 `sigaction`，而不是只依赖历史 `signal` 接口。
4. 信号处理器必须遵守异步信号安全规则。
5. `volatile sig_atomic_t` 适合简单标志，但不是通用并发同步方案。
6. `SIGCHLD` 处理必须循环回收所有已退出子进程。
7. 多线程服务器更适合用 `sigwait`、self-pipe 或 `signalfd` 集中处理信号。
