---
title: Linux进程控制详解：fork、exit、wait与exec
date: 2026-08-20 13:30:00
categories:
  - Linux
tags:
  - Linux
  - 进程
  - fork
  - waitpid
  - exec
  - 僵尸进程
  - Shell
---

Linux进程控制可以概括为一条主线：父进程用`fork`创建子进程，子进程用`exec`装入新程序，进程用`exit`或`_exit`终止，父进程再用`wait/waitpid`回收退出状态。Shell启动外部命令、服务器派生工作进程和测试框架运行子任务，都建立在这条主线上。

本文系统解释`fork`的两次返回与写时拷贝、进程退出和标准I/O缓冲、僵尸进程、等待状态宏、阻塞与非阻塞等待、exec函数族、环境变量和简易Shell执行流程，并给出一份严格检查错误的完整示例。

<!-- more -->

## 一、进程控制的整体流程

典型父子进程关系：

```text
父进程
  |
  +-- fork() ------------------+
  |                            |
父进程分支                   子进程分支
  |                            |
waitpid()                  exec...()
  |                            |
获取退出原因               运行新程序
  |                            |
回收子进程                 exit/_exit
```

四类接口各有职责：

|接口|职责|
|---|---|
|`fork`|创建新的进程执行流|
|`exec`函数族|在当前进程中装入新程序|
|`exit/_exit`|终止当前进程|
|`wait/waitpid`|父进程等待并回收子进程|

`fork`和`exec`分离，使父进程能在两者之间完成重定向、管道、权限调整和文件描述符设置，这正是Shell构建命令执行环境的基础。

## 二、fork创建进程

### 2.1 函数原型

```c
#include <sys/types.h>
#include <unistd.h>

pid_t fork(void);
```

返回值：

- 父进程中返回子进程PID，大于0；
- 子进程中返回0；
- 创建失败返回`-1`，并设置`errno`。

### 2.2 为什么一次调用返回两次

调用前只有父进程；内核创建子进程后，父子都从`fork`返回点继续执行，但得到不同返回值：

```c
pid_t pid = fork();

if (pid == -1)
{
    perror("fork");
}
else if (pid == 0)
{
    printf("child: pid=%ld\n", (long)getpid());
}
else
{
    printf("parent: child=%ld\n", (long)pid);
}
```

输出先后不固定。父子谁先运行由调度器、系统负载和阻塞状态决定，不能依赖某次观察到的顺序。

### 2.3 fork前后代码

```c
printf("before\n");
pid_t pid = fork();
printf("after\n");
```

若输出已及时写到终端，`before`通常一次，`after`两次。若`before`留在用户态标准I/O缓冲区，`fork`会复制缓冲状态，父子后续都刷新时可能看到重复内容。

稳妥做法是在`fork`前：

```c
if (fflush(NULL) == EOF)
{
    // 处理刷新失败
}
```

或者让完整行在交互终端中刷新，但不能只依赖终端行缓冲，因为重定向后缓冲模式可能变化。

## 三、fork后父子拥有什么

### 3.1 虚拟地址空间

逻辑上，子进程获得父进程地址空间的快照，包括：

- 代码；
- 全局和静态数据；
- 堆；
- 栈；
- C库状态。

父子是独立进程，之后修改普通变量互不直接影响。

### 3.2 写时拷贝

现代系统不会在`fork`瞬间复制全部物理内存。父子页表先指向相同物理页，并把可写页标记为写时拷贝：

1. 只读期间共享物理页；
2. 一方写入触发缺页异常；
3. 内核复制相应页；
4. 写入方改自己的副本。

这降低了“fork后立即exec”场景的成本，但页表复制、内核对象和大进程的内存管理仍有开销，不能认为`fork`完全免费。

### 3.3 文件描述符

子进程继承父进程打开的文件描述符副本。父子描述符通常引用同一个内核打开文件描述，因而可能共享：

- 文件偏移；
- 文件状态标志；
- 管道或套接字端点。

描述符表项本身属于各自进程，关闭父进程的描述符不会直接删除子进程表项；只有最后一个引用关闭后，内核对象才真正释放。

这既支持重定向和管道，也可能造成：

- 多进程输出交错；
- 文件偏移竞争；
- 忘记关闭管道端点导致读端永远等不到EOF；
- 敏感描述符意外跨exec泄露。

### 3.4 继承与不继承

子进程会继承许多进程属性，但PID、父PID、部分计时和待处理信号等不同。具体规则应查看`man 2 fork`，不要只记“父进程完全复制了一份”。

## 四、fork失败

常见原因：

- 用户进程数达到`RLIMIT_NPROC`；
- 系统级线程或进程资源不足；
- PID相关资源耗尽；
- 内存不足以创建所需内核结构或页表；
- 容器、cgroup或服务管理器设置限制。

正确处理：

```c
pid_t pid = fork();
if (pid == -1)
{
    perror("fork");
    return 1;
}
```

不能在失败后继续把当前进程当作父进程分支执行。

## 五、多线程程序中的fork

多线程进程调用`fork`后，子进程中只保留调用`fork`的线程，其他线程消失，但它们可能在fork瞬间持有互斥锁。

从`fork`返回到`exec`之前，子进程可安全调用的函数受到严格限制，通常只能使用异步信号安全函数。`malloc`、`printf`、C++流和许多库函数可能遇到继承来的锁状态。

工程建议：

- 多线程程序优先使用成熟进程启动封装或`posix_spawn`；
- 必须fork时，子进程尽快exec；
- 用`pthread_atfork`只能处理一部分已知锁，不能轻易修复全部第三方库状态；
- exec失败路径使用`write`和`_exit`等谨慎接口。

## 六、vfork为什么要谨慎

`vfork`历史上为“子进程立即exec或_exit”优化。子进程在此期间可能与父进程共享地址空间，并暂停父进程。

子进程若：

- 修改普通变量；
- 从调用`vfork`的函数返回；
- 调用不安全库函数；
- 执行除exec或`_exit`之外的复杂逻辑

可能产生未定义行为或严重错误。现代程序通常使用`fork`、`posix_spawn`或更高层API，不应只因“更快”就替换为`vfork`。

## 七、进程终止

### 7.1 三类结果

进程结束可能是：

1. 正常执行并返回成功状态；
2. 正常执行完成，但返回业务失败状态；
3. 被信号或故障异常终止。

“正常退出”只表示通过返回或退出函数结束，不等于业务一定成功。

### 7.2 从main返回

```c
int main(void)
{
    return 0;
}
```

从`main`返回会经过C运行时，效果类似调用`exit(status)`。

### 7.3 exit

```c
#include <stdlib.h>

exit(EXIT_SUCCESS);
exit(EXIT_FAILURE);
```

`exit`会执行正常进程终止处理，包括：

- 调用`atexit`注册函数；
- 刷新并关闭标准I/O流；
- 执行C运行时清理；
- 最终进入内核终止接口。

### 7.4 `_exit`与`_Exit`

```c
#include <unistd.h>
_exit(status);
```

```c
#include <stdlib.h>
_Exit(status);
```

它们不执行普通用户态流刷新和`atexit`处理，直接结束进程。fork后exec失败的子进程通常使用`_exit`，避免重复刷新父进程继承的缓冲区。

### 7.5 不要把`exit`写成`_exit`的简单包装理解

概念上`exit`完成用户态清理后终止进程，但具体C库实现不应简化成固定源码调用链。学习重点是可观察语义：是否刷新标准I/O、是否执行退出处理函数。

## 八、退出码

### 8.1 Shell查看

```bash
./app
echo $?
```

`$?`是最近一条前台管道或命令的状态，不会长期保存。执行其他命令后它会被覆盖。

### 8.2 范围

Unix等待接口通常向父进程提供退出状态的低8位，因此可观察退出码范围通常是0到255：

```c
exit(257); // 常见观察结果为1
```

约定：

- `0`通常表示成功；
- 非零表示不同失败；
- 具体含义由程序定义；
- Shell常用128加信号编号表示被信号终止，但这是Shell编码约定，不等于进程调用`exit`返回了该值。

使用`EXIT_SUCCESS`与`EXIT_FAILURE`表达通用成功或失败更清晰。

## 九、僵尸进程

### 9.1 什么是僵尸

子进程终止后，大部分资源已经释放，但内核仍保留少量信息：

- PID；
- 退出原因；
- 资源使用统计。

父进程尚未调用等待接口取走这些信息时，子进程处于僵尸状态，`ps`中常显示`Z`。

### 9.2 为什么kill -9无效

僵尸进程已经停止执行，没有可接收信号的用户代码或运行实体。需要父进程调用`wait/waitpid`回收，或者父进程结束后由系统中的收养者处理。

### 9.3 僵尸是不是普通内存泄漏

僵尸主要占用进程表项、PID和退出状态等内核资源，不是子进程完整地址空间仍然存在。大量僵尸会耗尽进程资源，因此仍是严重生命周期错误。

## 十、孤儿进程

父进程先退出，而子进程仍运行时，子进程成为孤儿并被PID 1或配置的subreaper收养。收养者负责最终回收。

孤儿与僵尸不同：

- 孤儿可能仍在正常运行；
- 僵尸已经退出但尚未被等待；
- 一个进程可以先成为孤儿，退出后再由收养者回收。

现代服务管理中，systemd、容器运行时和subreaper会影响实际父子关系，不应只背“永远由init收养”这一种描述。

## 十一、wait

### 11.1 原型

```c
#include <sys/types.h>
#include <sys/wait.h>

pid_t wait(int *status);
```

它等待任意一个可等待子进程：

- 成功返回被回收子进程PID；
- 失败返回`-1`并设置`errno`；
- `status == NULL`表示不关心退出信息。

如果子进程仍运行，`wait`通常阻塞；已有僵尸子进程时立即返回；没有可等待子进程时返回失败，常见`errno == ECHILD`。

## 十二、waitpid

```c
pid_t waitpid(pid_t pid, int *status, int options);
```

### 12.1 pid参数

|pid值|含义|
|---:|---|
|`> 0`|等待指定PID子进程|
|`-1`|等待任意子进程，类似`wait`|
|`0`|等待与调用者同进程组的子进程|
|`< -1`|等待指定进程组中的子进程|

### 12.2 options

常用：

- `0`：阻塞等待；
- `WNOHANG`：没有子进程状态变化时立即返回0；
- `WUNTRACED`：报告已停止子进程；
- `WCONTINUED`：报告被继续的子进程。

### 12.3 返回值

- `> 0`：返回状态变化的子进程PID；
- `0`：使用`WNOHANG`且当前没有可报告状态；
- `-1`：出错。

系统调用可能被信号中断并返回`EINTR`，阻塞等待应在策略允许时重试。

## 十三、不要手工解析status位图

等待状态使用标准宏：

```c
if (WIFEXITED(status))
{
    int code = WEXITSTATUS(status);
}
else if (WIFSIGNALED(status))
{
    int signalNumber = WTERMSIG(status);
}
else if (WIFSTOPPED(status))
{
    int stopSignal = WSTOPSIG(status);
}
```

其他宏：

- `WCOREDUMP(status)`：部分系统提供，使用前可条件编译；
- `WIFCONTINUED(status)`：子进程被继续。

不要依赖`(status >> 8) & 0xff`等实现细节。宏更清晰、可移植，也能正确区分信号终止与正常退出。

## 十四、阻塞等待

```c
int status = 0;
pid_t result;

do
{
    result = waitpid(childPid, &status, 0);
} while (result == -1 && errno == EINTR);
```

阻塞等待适合父进程当前没有其他工作，或明确需要子任务完成后再继续的场景。

## 十五、非阻塞等待

```c
pid_t result = waitpid(childPid, &status, WNOHANG);

if (result == 0)
{
    // 子进程仍运行，父进程继续其他工作
}
```

不能在紧密循环中不断调用形成忙等待：

```c
// 错误思想：持续占满CPU
// while (waitpid(pid, &status, WNOHANG) == 0) {}
```

可以：

- 在事件循环中定期检查；
- 使用SIGCHLD通知并在安全位置回收；
- 使用信号文件描述符等Linux事件机制；
- 暂时休眠，但要接受响应延迟；
- 交给成熟进程管理框架。

## 十六、回收多个子进程

SIGCHLD可能合并，不能假设一个信号只对应一个子进程。常见回收循环：

```c
for (;;)
{
    pid_t result = waitpid(-1, &status, WNOHANG);
    if (result > 0)
    {
        // 处理一个子进程
        continue;
    }
    if (result == 0)
    {
        break;
    }
    if (errno == EINTR)
    {
        continue;
    }
    if (errno == ECHILD)
    {
        break;
    }
    // 其他错误
    break;
}
```

信号处理函数中只能调用异步信号安全函数。复杂日志、内存分配和容器操作应转移到主循环。

## 十七、exec程序替换

### 17.1 核心语义

exec函数成功后：

- 当前进程用户空间代码和数据被新程序替换；
- 从新程序入口开始运行；
- PID不变；
- 不会返回原调用点；
- 未设置close-on-exec的文件描述符通常继续存在。

exec不创建新进程。创建新进程的是`fork`；exec替换当前进程映像。

### 17.2 失败语义

exec失败返回`-1`并设置`errno`：

```c
execvp(argv[0], argv);
perror("execvp");
_exit(127);
```

exec成功后，后面的代码永远不会执行。因此只有失败路径需要写返回后的处理。

## 十八、exec函数族

```c
#include <unistd.h>

int execl(const char *path, const char *arg0, ...);
int execlp(const char *file, const char *arg0, ...);
int execle(const char *path, const char *arg0, ..., char *const envp[]);
int execv(const char *path, char *const argv[]);
int execvp(const char *file, char *const argv[]);
int execve(const char *path, char *const argv[], char *const envp[]);
```

命名规则：

|字母|含义|
|---|---|
|`l`|参数逐个列出，list|
|`v`|参数放在指针数组，vector|
|`p`|若文件名不含斜杠，按`PATH`搜索|
|`e`|显式提供环境变量数组|

### 18.1 l形式

```c
execl("/bin/ls", "ls", "-l", (char *)NULL);
```

可变参数必须以空指针结束，并注意在可变参数中传递正确指针类型。

### 18.2 v形式

```c
char *const args[] = {"ls", "-l", NULL};
execv("/bin/ls", args);
```

适合参数数量运行时确定的Shell和进程管理器。

### 18.3 p形式

```c
char *const args[] = {"ls", "-l", NULL};
execvp("ls", args);
```

它使用`PATH`搜索。安全敏感程序不应盲目信任可被攻击者控制的`PATH`，可使用绝对路径和受控环境。

### 18.4 e形式

```c
char *const args[] = {"env", NULL};
char *const environment[] = {
    "PATH=/usr/bin:/bin",
    "APP_MODE=test",
    NULL
};

execve("/usr/bin/env", args, environment);
```

`execle`和`execve`显式传环境；没有`e`的版本通常继承当前进程环境。

### 18.5 argv[0]

惯例上`argv[0]`是程序显示名称，但内核/exec接口并不会替你自动填成路径。调用者应提供合理值，新程序也不应把`argv[0]`当作可信安全信息。

## 十九、环境变量

### 19.1 查看和修改

```bash
printenv PATH
env
export APP_MODE=development
unset APP_MODE
```

C接口：

```c
#include <stdlib.h>

const char *value = getenv("PATH");
setenv("APP_MODE", "test", 1);
unsetenv("APP_MODE");
```

环境由父进程传给新程序，子进程修改自己的环境不会反向修改父进程。

### 19.2 安全

环境变量可能影响：

- 可执行程序搜索；
- 动态库装载；
- 语言运行时；
- 代理；
- 配置路径。

高权限进程启动子程序时应使用受控环境，并避免泄露令牌。`/proc/PID/environ`、core dump和日志都可能暴露敏感值。

## 二十、文件描述符与exec

默认情况下，打开的文件描述符可跨exec继承。若不希望泄露，应设置close-on-exec：

```c
int flags = fcntl(fd, F_GETFD);
fcntl(fd, F_SETFD, flags | FD_CLOEXEC);
```

创建时原子设置更能避免多线程竞态，例如：

```c
open(path, O_RDONLY | O_CLOEXEC);
pipe2(pipefd, O_CLOEXEC);
```

具体接口的可用性和特性宏要按系统处理。

Shell在exec前利用`dup2`实现重定向：

```c
dup2(outputFd, STDOUT_FILENO);
```

之后新程序对标准输出的写入就进入目标文件或管道。

## 二十一、Shell如何启动命令

外部命令基本流程：

1. Shell读取命令行；
2. 进行词法解析、引用、展开和重定向分析；
3. `fork`创建子进程；
4. 子进程配置管道、文件描述符、进程组和信号；
5. 子进程调用`execvp`或类似接口；
6. 父Shell等待前台任务，或记录后台任务；
7. 读取下一条命令。

### 21.1 为什么cd必须是Shell内建命令

若子进程执行`chdir`，只改变子进程工作目录，退出后父Shell目录不变。因此`cd`必须由Shell自己执行。

同理，`export`、`umask`等需要改变Shell自身状态的命令也通常是内建命令。

### 21.2 一个真正Shell还需要什么

课件中的空格切分只能演示主流程。实际Shell还要正确处理：

- 单引号、双引号和反斜杠；
- 变量、命令和通配符展开；
- 管道；
- 输入输出重定向；
- 前后台任务和进程组；
- 信号与终端控制；
- 内建命令；
- `&&`、`||`、`;`；
- 语法错误和退出状态。

不要把用户命令拼接给`system()`或`sh -c`处理不可信输入，这会产生命令注入风险。

## 二十二、完整fork-exec-wait示例

程序默认让子进程执行一段确定的Shell命令并退出7；也可以把命令及参数传给程序，由子进程直接`execvp`。

```c
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

static void report_status(pid_t child, int status)
{
    if (WIFEXITED(status))
    {
        printf("child %ld exited with code %d\n",
               (long)child,
               WEXITSTATUS(status));
    }
    else if (WIFSIGNALED(status))
    {
        printf("child %ld terminated by signal %d\n",
               (long)child,
               WTERMSIG(status));
    }
    else if (WIFSTOPPED(status))
    {
        printf("child %ld stopped by signal %d\n",
               (long)child,
               WSTOPSIG(status));
    }
    else
    {
        printf("child %ld changed state\n", (long)child);
    }
}

int main(int argc, char *argv[])
{
    if (fflush(NULL) == EOF)
    {
        perror("fflush");
        return EXIT_FAILURE;
    }

    pid_t child = fork();
    if (child == -1)
    {
        perror("fork");
        return EXIT_FAILURE;
    }

    if (child == 0)
    {
        if (argc > 1)
        {
            execvp(argv[1], &argv[1]);
        }
        else
        {
            char *const childArguments[] = {
                "sh",
                "-c",
                "printf 'child program: pid=%s\\n' \"$$\"; exit 7",
                NULL
            };
            execvp(childArguments[0], childArguments);
        }

        const int savedError = errno;
        fprintf(stderr,
                "execvp failed: %s\n",
                strerror(savedError));
        _exit(savedError == ENOENT ? 127 : 126);
    }

    printf("parent %ld created child %ld\n",
           (long)getpid(),
           (long)child);

    int status = 0;
    pid_t result = -1;

    do
    {
        result = waitpid(child, &status, 0);
    } while (result == -1 && errno == EINTR);

    if (result == -1)
    {
        perror("waitpid");
        return EXIT_FAILURE;
    }

    report_status(result, status);
    return EXIT_SUCCESS;
}
```

编译：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic -Wconversion \
    -g process_demo.c -o process_demo
```

默认运行的输出顺序可能不同，但内容类似：

```text
parent 1000 created child 1001
child program: pid=1001
child 1001 exited with code 7
```

执行外部命令：

```bash
./process_demo /bin/echo hello Linux
./process_demo sh -c 'exit 23'
```

第二种写法中的Shell代码是当前用户明确输入的命令；程序没有把不可信字符串自行拼接给Shell。

## 二十三、示例中的关键设计

### 23.1 fork前刷新

避免父进程尚未刷新的标准I/O缓冲区被子进程复制后重复输出。

### 23.2 子进程exec失败后使用`_exit`

避免执行父进程继承的`atexit`处理和再次刷新缓冲区。

### 23.3 保存errno

错误报告函数可能改变`errno`，因此先保存再决定退出码。

### 23.4 waitpid重试EINTR

阻塞等待可能被信号中断。只在`errno == EINTR`时重试，其他错误及时报告。

### 23.5 使用状态宏

不手工位运算解析退出状态，正确区分正常退出、信号终止和停止。

## 二十四、常见错误

### 24.1 假设父进程一定先执行

调度顺序不确定。需要顺序时使用管道、锁、信号量或等待等同步机制。

### 24.2 子进程exec失败后继续父流程

exec返回只表示失败，子进程必须报告并`_exit`，不能掉出分支后执行父进程逻辑。

### 24.3 父进程不wait

长期运行父进程会积累僵尸。必须建立明确回收策略。

### 24.4 先调用WEXITSTATUS

只有`WIFEXITED(status)`为真时才能使用`WEXITSTATUS(status)`。

### 24.5 WNOHANG忙轮询

返回0表示子进程仍未产生可报告状态，不应无休止占用CPU反复检查。

### 24.6 exec参数未以NULL结束

`l`形式可变参数和`v`形式数组都要有空指针终止标记，否则函数会越界读取参数。

### 24.7 把exec理解为创建新进程

exec替换当前进程映像，PID不变；fork才创建新的进程。

### 24.8 fork后父子同时使用缓冲流

缓冲区状态被复制，文件描述符又可能共享内核偏移，容易重复或交错输出。应在fork前刷新并设计明确写入者。

## 二十五、面试常见问题

### 25.1 fork为什么在父子进程返回不同值

父进程需要得到子PID以便管理和等待；子进程返回0便于进入子分支，同时其自身PID可通过`getpid()`获得。

### 25.2 fork后变量是否共享

逻辑上地址空间独立，初始内容相同；底层常使用写时拷贝共享物理页，任一方写入后获得私有副本。共享内存等显式IPC另当别论。

### 25.3 `exit`与`_exit`有什么区别

`exit`执行标准I/O刷新和退出处理函数；`_exit`直接终止，不做普通用户态清理。fork后exec失败常使用`_exit`。

### 25.4 僵尸进程为什么不能被kill

它已经终止，只剩等待父进程读取的内核状态，应该由父进程`wait`回收。

### 25.5 wait与waitpid有什么区别

`wait`等待任意子进程；`waitpid`可选择具体PID或进程组，并通过`WNOHANG`等选项支持非阻塞和更多状态。

### 25.6 exec成功后为什么不返回

原程序映像被新程序替换，原调用栈和返回地址已经不存在；只有装入失败才返回原代码。

### 25.7 Shell执行外部命令的流程

解析命令，fork子进程，在子进程设置重定向和管道并exec，父进程根据前后台策略wait，然后读取下一条命令。

## 二十六、总结

1. `fork`创建子进程，在父进程返回子PID，在子进程返回0，失败返回`-1`。
2. 父子初始地址空间内容相同，底层通常通过写时拷贝延迟物理页复制。
3. 文件描述符会被继承，并可能共享内核文件偏移，必须设计关闭与重定向规则。
4. `exit`执行用户态清理，`_exit`直接终止，fork后exec失败通常使用`_exit`。
5. 子进程退出后，父进程要用`wait/waitpid`回收，否则会形成僵尸。
6. 等待状态必须用`WIFEXITED`、`WEXITSTATUS`和`WIFSIGNALED`等宏解析。
7. `WNOHANG`返回0表示当前无可报告状态，不应忙等待。
8. exec成功会替换当前程序且不返回，PID保持不变；带`p`版本按`PATH`搜索，带`e`版本显式传环境。
9. Shell的核心是解析、fork、设置文件描述符、exec和wait，内建命令则修改Shell自身状态。
10. 多线程进程fork后到exec前限制严格，复杂程序应评估`posix_spawn`或成熟进程管理封装。
