---
title: Linux 基础IO
date: 2026-07-29 20:00:00
updated: 2026-07-29 20:00:00
description: 基础IO
categories:
  - Linux
tags:
  - Linux
  - 基础IO
comments: false
---

# Linux 基础 I/O：文件描述符、重定向、缓冲区、文件系统与动静态库

Linux 的 I/O 学习可以沿着一条清晰的路径展开：

1. 应用程序通过 C 标准库或系统调用访问文件；
2. 内核通过文件描述符把进程与已打开文件连接起来；
3. `dup2()` 改变文件描述符的指向，从而实现重定向；
4. 用户态缓冲区、内核缓存和存储设备共同决定 I/O 的性能与持久性；
5. 文件系统使用 inode、目录项和数据块管理磁盘文件；
6. 静态库和动态库把可复用的目标代码交付给其他程序。

本文会把这些知识连接成一个整体，并通过可编译的示例说明常用接口、底层关系和易错点。



---

## 1. 重新认识文件与 I/O

### 1.1 文件由内容和属性组成

从使用者角度看，一个文件至少包含两类信息：

- **文件内容**：文本、图片、程序指令、结构化数据等；
- **文件属性**：类型、权限、大小、所有者、时间戳、链接数等元数据。

空文件虽然没有用户数据，也仍然需要保存 inode、目录项等元数据，因此不会完全“零成本”。具体占用空间取决于文件系统实现。

文件名和路径用于定位文件。相对路径从进程的当前工作目录开始解析，绝对路径则从根目录 `/` 开始解析。

### 1.2 文件操作的本质

磁盘文件本身不会执行代码。只有程序运行成进程，并实际调用 I/O 接口后，文件操作才会发生。

因此可以把文件操作理解为：

> 进程通过操作系统提供的接口，访问已打开的文件对象。

![进程与打开文件的关系](./picture/image-20260424095737096.png)

文件通常要先打开，再读写，最后关闭：

```text
路径名
  |
  | open / fopen
  v
打开文件对象
  |
  | read/write 或 fread/fwrite
  v
读取或修改内容
  |
  | close / fclose
  v
释放当前进程持有的引用   
```

“关闭文件”主要表示当前进程不再持有这次打开产生的引用，并不等同于删除磁盘上的文件。

### 1.3 C 标准库接口与系统调用接口

不同语言的文件接口各不相同，但最终都需要借助操作系统访问设备和文件系统。

![用户接口与系统接口](./picture/image-20260424100404488.png)

以 C 语言为例：

| 层次 | 常见对象 | 常见接口 | 主要特点 |
|---|---|---|---|
| C 标准库 | `FILE *` | `fopen`、`fgets`、`fprintf`、`fread`、`fclose` | 跨平台、带用户态缓冲、格式化能力丰富 |
| POSIX 系统接口 | 文件描述符 `int fd` | `open`、`read`、`write`、`lseek`、`close` | 更接近内核，适合系统编程 |

在 Linux 上，C 标准库文件函数通常会在内部使用 `open`、`read`、`write`、`close` 等系统接口，但两者不能简单视为一一对应：标准库还负责缓冲、格式转换、错误状态和流状态管理。

### 1.4 `fopen()` 的打开模式

```text
#include <stdio.h>

FILE *fopen(const char *pathname, const char *mode);
```

常用模式如下：

| 模式 | 可读 | 可写 | 文件不存在 | 文件已存在 | 写入位置 |
|---|---:|---:|---|---|---|
| `"r"` | 是 | 否 | 失败 | 保留原内容 | — |
| `"w"` | 否 | 是 | 创建 | 清空 | 从头写 |
| `"a"` | 否 | 是 | 创建 | 保留 | 每次写到末尾 |
| `"r+"` | 是 | 是 | 失败 | 保留原内容 | 从头开始，可定位 |
| `"w+"` | 是 | 是 | 创建 | 清空 | 从头写 |
| `"a+"` | 是 | 是 | 创建 | 保留 | 写操作追加到末尾 |

在 Windows 等平台，`b` 用于区分文本模式和二进制模式，例如 `"rb"`、`"wb"`。在 POSIX/Linux 上，文本模式与二进制模式通常没有这种换行转换差异，但为了可移植性，处理二进制文件时仍建议写明 `b`。

下面的程序写入并重新读取一个文本文件：

```c
#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <string.h>

int main(void)
{
    const char *filename = "log.txt";
    FILE *fp = fopen(filename, "w+");

    if (fp == NULL)
    {
        perror("fopen");
        return 1;
    }

    for (int i = 3; i >= 1; --i)
    {
        if (fprintf(fp, "hello Linux: %d\n", i) < 0)
        {
            perror("fprintf");
            fclose(fp);
            return 1;
        }
    }

    rewind(fp);

    char line[128];
    while (fgets(line, sizeof(line), fp) != NULL)
    {
        fputs(line, stdout);
    }

    if (ferror(fp))
    {
        perror("fgets");
        fclose(fp);
        return 1;
    }

    if (fclose(fp) == EOF)
    {
        perror("fclose");
        return 1;
    }

    return 0;
}
```

这里使用 `ferror()` 区分“正常读到文件末尾”和“读取失败”。仅凭 `fgets()` 返回 `NULL`，无法判断是哪一种情况。

### 1.5 C 标准 I/O 接口速查

| 需求 | 接口 | 关键点 |
|---|---|---|
| 读取一个字符 | `fgetc()` | 返回类型是 `int`，便于表示所有字节值和 `EOF` |
| 写入一个字符 | `fputc()` | 成功返回写入字符，失败返回 `EOF` |
| 读取一行/字符串 | `fgets()` | 最多读取 `size - 1` 个字符，保留可能读到的换行 |
| 写入字符串 | `fputs()` | 不自动添加换行 |
| 格式化读写 | `fscanf()`、`fprintf()` | 需要检查返回值，避免格式和参数不匹配 |
| 二进制块读写 | `fread()`、`fwrite()` | 返回成功处理的“元素个数”，类型是 `size_t` |
| 调整文件位置 | `fseek()`、`rewind()` | 文本流的可移植定位规则更受限制 |
| 刷新输出流 | `fflush()` | 把用户态输出缓冲提交给底层接口，不保证已落盘 |

`fread()` 返回的是实际读到的元素数，不会返回负数。返回值小于请求数量时，应结合 `feof()` 和 `ferror()` 判断原因。

### 1.6 本节小结

- 文件由内容与元数据组成；
- 文件操作发生在运行中的进程里；
- C 标准库使用 `FILE *`，POSIX 系统接口使用文件描述符；
- 标准库提供缓冲和格式化，系统接口更接近内核；
- 读取接口返回不足时，要区分 EOF 与错误。

---

## 2. 系统调用与文件描述符

### 2.1 位图式标志参数

`open()` 的第二个参数使用多个比特位组合选项。每个宏占据互不冲突的位，使用按位或 `|` 组合，使用按位与 `&` 检查。

![标志位组合](./picture/image-20251119142757461.png)

例如：

```text
O_WRONLY | O_CREAT | O_TRUNC
```

表示“只写；不存在则创建；存在则清空”。

访问模式 `O_RDONLY`、`O_WRONLY`、`O_RDWR` 应通过 `O_ACCMODE` 解析。尤其在 Linux 中 `O_RDONLY` 的值通常是 0，因此不能使用 `flags & O_RDONLY` 判断是否只读。

### 2.2 `open()`：打开或创建文件

```text
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>

int open(const char *pathname, int flags, ...);
```

常用标志：

| 标志 | 含义 |
|---|---|
| `O_RDONLY` | 只读 |
| `O_WRONLY` | 只写 |
| `O_RDWR` | 读写 |
| `O_CREAT` | 文件不存在时创建 |
| `O_EXCL` | 与 `O_CREAT` 搭配，要求文件必须原先不存在 |
| `O_TRUNC` | 以可写方式打开时把普通文件长度截断为 0 |
| `O_APPEND` | 每次写入前把位置移动到文件末尾，保证追加定位的原子性 |
| `O_NONBLOCK` | 对支持该语义的对象启用非阻塞模式 |
| `O_CLOEXEC` | 成功执行 `exec` 时自动关闭该描述符 |

当指定 `O_CREAT` 时，需要额外传入创建权限，例如：

```text
open("log.txt", O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0666)
```

最终权限不是简单等于 `0666`，而是：

```text
最终权限 = mode & ~umask
```

普通文件常以 `0666` 作为申请权限，目录常以 `0777` 作为申请权限，再由进程的 `umask` 屏蔽部分权限。`umask` 不应在通用库代码中随意全局修改，因为它属于进程级状态。

### 2.3 `read()`、`write()` 与 `close()`

```text
#include <unistd.h>

ssize_t read(int fd, void *buf, size_t count);
ssize_t write(int fd, const void *buf, size_t count);
int close(int fd);
```

`read()` 返回值：

| 返回值 | 含义 |
|---:|---|
| `> 0` | 实际读取的字节数 |
| `0` | 到达文件末尾；对管道/套接字也可能表示对端已关闭写方向 |
| `-1` | 失败，检查 `errno` |

`write()` 成功时返回实际写入的字节数。即使没有报错，也可能小于请求长度，因此稳健程序需要处理“部分写入”。

`read()` 和 `write()` 都可能被信号中断并返回 `-1`、设置 `errno = EINTR`。对非阻塞对象，还可能出现 `EAGAIN` 或 `EWOULDBLOCK`。

### 2.4 一个可靠的文件复制示例

下面的程序使用系统接口复制文件，并正确处理 `EINTR` 和部分写入：

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

static int write_all(int fd, const char *buf, size_t size)
{
    size_t written = 0;

    while (written < size)
    {
        ssize_t n = write(fd, buf + written, size - written);

        if (n > 0)
        {
            written += (size_t)n;
            continue;
        }

        if (n < 0 && errno == EINTR)
        {
            continue;
        }

        if (n == 0)
        {
            errno = EIO;
        }

        return -1;
    }

    return 0;
}

int main(int argc, char *argv[])
{
    if (argc != 3)
    {
        fprintf(stderr, "usage: %s SOURCE DESTINATION\n", argv[0]);
        return 1;
    }

    int input = open(argv[1], O_RDONLY | O_CLOEXEC);
    if (input < 0)
    {
        perror("open source");
        return 1;
    }

    int output = open(argv[2],
                      O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC,
                      0666);
    if (output < 0)
    {
        perror("open destination");
        close(input);
        return 1;
    }

    char buffer[4096];
    int result = 0;

    for (;;)
    {
        ssize_t n = read(input, buffer, sizeof(buffer));

        if (n > 0)
        {
            if (write_all(output, buffer, (size_t)n) < 0)
            {
                perror("write");
                result = 1;
                break;
            }
            continue;
        }

        if (n == 0)
        {
            break;
        }

        if (errno == EINTR)
        {
            continue;
        }

        perror("read");
        result = 1;
        break;
    }

    if (close(input) < 0)
    {
        perror("close source");
        result = 1;
    }

    if (close(output) < 0)
    {
        perror("close destination");
        result = 1;
    }

    return result;
}
```

编译运行：

```bash
$ gcc -std=c11 -Wall -Wextra copy.c -o copy
$ ./copy source.txt destination.txt
```

这段代码保证数据已交给内核，但并不保证已经写入非易失存储。如果业务要求断电后也必须保留数据，还需要根据场景使用 `fsync()`、目录同步和更完整的原子更新方案。

### 2.5 `lseek()`：调整文件偏移量

```text
#include <unistd.h>

off_t lseek(int fd, off_t offset, int whence);
```

`whence` 常见取值：

- `SEEK_SET`：相对于文件开头；
- `SEEK_CUR`：相对于当前位置；
- `SEEK_END`：相对于文件末尾。

普通磁盘文件通常可以定位；管道、FIFO 和多数套接字不能使用 `lseek()`，会返回 `-1` 并设置 `errno = ESPIPE`。

文件偏移量通常属于“打开文件描述”而不是描述符数字本身。通过 `dup()` 复制的描述符、以及 `fork()` 后父子进程继承的描述符，可能共享同一个文件偏移量。

### 2.6 文件描述符为什么通常从 3 开始

POSIX 约定进程启动时通常已经打开三个标准描述符：

| 描述符 | 宏 | 默认用途 |
|---:|---|---|
| `0` | `STDIN_FILENO` | 标准输入 |
| `1` | `STDOUT_FILENO` | 标准输出 |
| `2` | `STDERR_FILENO` | 标准错误 |

![标准文件描述符](./picture/image-20251119151723854.png)

内核通常分配当前进程中最小的可用描述符。因此，在 0、1、2 都被占用时，第一次 `open()` 常返回 3；如果先关闭 1，下一次 `open()` 可能返回 1。

这只是分配规则，不应把“普通文件描述符一定从 3 开始”写死。程序启动方式、重定向和显式关闭都可能改变结果。

下面用标准接口 `fileno()` 观察 `FILE *` 对应的描述符：

```c
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>

int main(void)
{
    printf("stdin=%d, stdout=%d, stderr=%d\n",
           fileno(stdin), fileno(stdout), fileno(stderr));

    int first = open("one.txt", O_WRONLY | O_CREAT | O_TRUNC, 0666);
    int second = open("two.txt", O_WRONLY | O_CREAT | O_TRUNC, 0666);

    if (first < 0 || second < 0)
    {
        perror("open");
        if (first >= 0)
        {
            close(first);
        }
        if (second >= 0)
        {
            close(second);
        }
        return 1;
    }

    printf("first=%d, second=%d\n", first, second);
    close(first);
    close(second);
    return 0;
}
```

不要直接访问 `FILE` 结构体的私有字段，例如某些实现中的 `_fileno`。这些字段不是可移植接口，应使用 `fileno()`。

### 2.7 进程的文件描述符表

一个进程可以同时打开多个文件。内核需要管理系统中所有已打开对象，因此采用“先描述、后组织”的方式建立相关结构。

![进程与打开文件对象](./picture/image-20260424145646438.png)

可以用三个层次理解：

| 层次 | 主要内容 |
|---|---|
| 进程文件描述符表 | `fd` 到打开文件描述的引用，以及 `FD_CLOEXEC` 等描述符级标志 |
| 打开文件描述 | 当前偏移量、文件状态标志、对底层文件对象的引用 |
| inode/文件对象 | 文件类型、权限、大小及具体操作方法等信息 |

![文件描述符的内核关系](./picture/image-20251119145854786.png)

同一个底层文件可以被多次打开，形成不同的打开文件描述和独立偏移量；也可以通过 `dup()`、`dup2()` 或 `fork()` 让多个描述符引用同一个打开文件描述，从而共享偏移量和文件状态标志。

### 2.8 `dup()` 与 `dup2()`

```text
#include <unistd.h>

int dup(int oldfd);
int dup2(int oldfd, int newfd);
```

- `dup(oldfd)`：返回最小可用的新描述符；
- `dup2(oldfd, newfd)`：让 `newfd` 引用与 `oldfd` 相同的打开文件描述；
- 如果 `oldfd != newfd`，`dup2()` 会在需要时原子地关闭原来的 `newfd`；
- 如果二者相等且 `oldfd` 有效，`dup2()` 直接返回 `newfd`。

重定向的本质不是改变 `printf()` 使用的数字 1，而是让描述符 1 在内核中指向新的打开文件描述。

![重定向的文件表变化](./picture/image-20251119214727715.png)

### 2.9 输出、追加与输入重定向

| Shell 语法 | 打开方式 | `dup2()` 目标 |
|---|---|---:|
| `command > file` | `O_WRONLY | O_CREAT | O_TRUNC` | `STDOUT_FILENO` |
| `command >> file` | `O_WRONLY | O_CREAT | O_APPEND` | `STDOUT_FILENO` |
| `command < file` | `O_RDONLY` | `STDIN_FILENO` |
| `command 2> file` | 写入并截断 | `STDERR_FILENO` |

![重定向](./picture/image-20260425090448302.png)

一个最小的输出重定向示例：

```c
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <stdio.h>
#include <unistd.h>

int main(void)
{
    int fd = open("log.txt",
                  O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC,
                  0666);
    if (fd < 0)
    {
        perror("open");
        return 1;
    }

    if (dup2(fd, STDOUT_FILENO) < 0)
    {
        perror("dup2");
        close(fd);
        return 1;
    }

    close(fd);

    printf("this line goes to log.txt\n");
    if (fflush(stdout) == EOF)
    {
        perror("fflush");
        return 1;
    }

    return 0;
}
```

`dup2()` 完成后，可以关闭原始 `fd`，因为描述符 1 已经持有相应引用。这里的 `O_CLOEXEC` 只设置在原始 `fd` 上；`dup2()` 产生的标准输出描述符不会自动继承该描述符标志，这正符合后续 `exec` 仍需保留标准输出的需求。

### 2.10 Shell 如何实现重定向

Shell 一般在子进程中完成以下动作：

1. `fork()` 创建子进程；
2. 子进程根据重定向类型 `open()` 文件；
3. 子进程使用 `dup2()` 修改标准描述符；
4. 关闭不再需要的原始描述符；
5. 调用 `execvp()` 执行外部命令；
6. 父进程的文件描述符不受影响，并负责 `waitpid()`。

![Shell 重定向流程](./picture/image-20260425095204053.png)

下面给出一个教学版实现。为突出 I/O 主线，它只支持一个重定向，并要求操作符两侧有空格，例如 `ls -l > out.txt`。

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#define LINE_SIZE 1024
#define ARG_SIZE  64

enum redirect_type
{
    REDIRECT_NONE,
    REDIRECT_INPUT,
    REDIRECT_OUTPUT,
    REDIRECT_APPEND
};

struct redirect_info
{
    enum redirect_type type;
    char *path;
};

static int parse_line(char *line,
                      char *argv[],
                      int capacity,
                      struct redirect_info *redirect)
{
    int argc = 0;
    char *token = strtok(line, " \t");

    redirect->type = REDIRECT_NONE;
    redirect->path = NULL;

    while (token != NULL)
    {
        enum redirect_type type = REDIRECT_NONE;

        if (strcmp(token, "<") == 0)
        {
            type = REDIRECT_INPUT;
        }
        else if (strcmp(token, ">") == 0)
        {
            type = REDIRECT_OUTPUT;
        }
        else if (strcmp(token, ">>") == 0)
        {
            type = REDIRECT_APPEND;
        }

        if (type != REDIRECT_NONE)
        {
            if (redirect->type != REDIRECT_NONE)
            {
                fprintf(stderr, "only one redirection is supported\n");
                return -1;
            }

            token = strtok(NULL, " \t");
            if (token == NULL)
            {
                fprintf(stderr, "redirection target is missing\n");
                return -1;
            }

            redirect->type = type;
            redirect->path = token;
            token = strtok(NULL, " \t");

            if (token != NULL)
            {
                fprintf(stderr, "redirection must be placed at the end\n");
                return -1;
            }
            break;
        }

        if (argc >= capacity - 1)
        {
            fprintf(stderr, "too many arguments\n");
            return -1;
        }

        argv[argc++] = token;
        token = strtok(NULL, " \t");
    }

    argv[argc] = NULL;
    return argc;
}

static int apply_redirection(const struct redirect_info *redirect)
{
    if (redirect->type == REDIRECT_NONE)
    {
        return 0;
    }

    int fd;
    int target;

    if (redirect->type == REDIRECT_INPUT)
    {
        fd = open(redirect->path, O_RDONLY | O_CLOEXEC);
        target = STDIN_FILENO;
    }
    else
    {
        int flags = O_WRONLY | O_CREAT | O_CLOEXEC;
        flags |= redirect->type == REDIRECT_APPEND ? O_APPEND : O_TRUNC;
        fd = open(redirect->path, flags, 0666);
        target = STDOUT_FILENO;
    }

    if (fd < 0)
    {
        perror(redirect->path);
        return -1;
    }

    if (dup2(fd, target) < 0)
    {
        perror("dup2");
        close(fd);
        return -1;
    }

    close(fd);
    return 0;
}

static int decode_status(int status)
{
    if (WIFEXITED(status))
    {
        return WEXITSTATUS(status);
    }

    if (WIFSIGNALED(status))
    {
        return 128 + WTERMSIG(status);
    }

    return 1;
}

static int run_external(char *argv[],
                        const struct redirect_info *redirect)
{
    pid_t id = fork();
    if (id < 0)
    {
        perror("fork");
        return 1;
    }

    if (id == 0)
    {
        if (apply_redirection(redirect) < 0)
        {
            _exit(126);
        }

        execvp(argv[0], argv);
        perror(argv[0]);
        _exit(127);
    }

    int status = 0;
    pid_t ret;

    do
    {
        ret = waitpid(id, &status, 0);
    } while (ret < 0 && errno == EINTR);

    if (ret < 0)
    {
        perror("waitpid");
        return 1;
    }

    return decode_status(status);
}

int main(void)
{
    char line[LINE_SIZE];
    char *argv[ARG_SIZE];
    int last_status = 0;

    for (;;)
    {
        printf("io-shell$ ");
        fflush(stdout);

        if (fgets(line, sizeof(line), stdin) == NULL)
        {
            putchar('\n');
            break;
        }

        if (strchr(line, '\n') == NULL)
        {
            int ch;
            while ((ch = getchar()) != '\n' && ch != EOF)
            {
                /* 丢弃过长命令的剩余内容。 */
            }
            fprintf(stderr, "command line is too long\n");
            last_status = 1;
            continue;
        }

        line[strcspn(line, "\n")] = '\0';

        struct redirect_info redirect;
        int argc = parse_line(line, argv, ARG_SIZE, &redirect);
        if (argc < 0)
        {
            last_status = 2;
            continue;
        }

        if (argc == 0)
        {
            continue;
        }

        if (strcmp(argv[0], "exit") == 0)
        {
            return argc >= 2 ? atoi(argv[1]) : last_status;
        }

        if (strcmp(argv[0], "cd") == 0)
        {
            if (redirect.type != REDIRECT_NONE)
            {
                fprintf(stderr, "redirection for built-ins is not supported\n");
                last_status = 2;
                continue;
            }

            const char *target = argc >= 2 ? argv[1] : getenv("HOME");
            if (target == NULL)
            {
                fprintf(stderr, "cd: HOME is not set\n");
                last_status = 1;
            }
            else if (chdir(target) < 0)
            {
                perror("cd");
                last_status = 1;
            }
            else
            {
                last_status = 0;
            }
            continue;
        }

        if (argc == 2 &&
            strcmp(argv[0], "echo") == 0 &&
            strcmp(argv[1], "$?") == 0 &&
            redirect.type == REDIRECT_NONE)
        {
            printf("%d\n", last_status);
            last_status = 0;
            continue;
        }

        last_status = run_external(argv, &redirect);
    }

    return last_status;
}
```

这仍然不是完整 Shell：它不解析引号、转义、无空格重定向、多重重定向、管道、后台任务和作业控制。完整解析不能仅靠 `strtok()`，通常需要词法和语法分析。

### 2.11 本节小结

- `open()` 返回当前进程可用的文件描述符；
- `read()` 读到 0 表示 EOF，`write()` 必须考虑部分写入；
- 文件描述符表、打开文件描述和 inode 属于不同层次；
- `dup2(oldfd, newfd)` 让 `newfd` 指向 `oldfd` 的打开文件描述；
- Shell 在子进程中先重定向，再 `exec`，不会改变父进程的标准输入输出。

---

## 3. Linux“一切皆文件”

### 3.1 统一接口的意义

“一切皆文件”强调的是：Linux 尽量使用文件描述符和统一的 I/O 接口操作多种资源。

可以通过 `read()`、`write()`、`close()` 等接口访问：

- 普通文件和目录；
- 终端和设备文件；
- 管道与 FIFO；
- 套接字；
- `eventfd`、`timerfd`、`signalfd` 等内核对象。

![Linux 一切皆文件](./picture/image-20260425100309735.png)

统一接口带来可组合性。例如，Shell 可以把文件、管道和终端都连接到进程的标准输入输出，而程序本身仍然只读取 0、写入 1 和 2。

### 3.2 统一不等于完全相同

不同对象支持的能力并不相同：

- 普通文件通常支持随机定位，管道不支持 `lseek()`；
- 目录不能像普通文件一样直接用 `read()` 解析，应用应使用 `readdir()`；
- `fsync()` 对不同设备和文件系统的保证可能不同；
- 非阻塞、追加、锁等标志并非适用于所有对象。

因此，“一切皆文件”更准确的理解是：

> 许多资源共享文件描述符模型和一组通用操作，但具体语义由对象类型决定。

在内核实现中，不同文件类型可以提供不同的操作函数，从而通过统一入口表现出不同的行为，这是一种接口层面的多态。

### 3.3 本节小结

- 文件描述符是一种统一的资源句柄；
- 普通文件、设备、管道和套接字可以共享部分 I/O 接口；
- 统一接口使重定向、管道和事件驱动编程成为可能；
- 不同对象的具体语义和支持能力仍然不同。

---

## 4. 缓冲区与数据落盘

### 4.1 为什么需要缓冲

系统调用、设备访问和持久化操作都比普通内存访问昂贵。如果每产生少量数据就执行一次底层 I/O，调用次数和设备开销都会很高。

缓冲区通过暂存数据、批量传输来减少频繁 I/O：

- 写入方先把数据放入内存；
- 达到某种条件后批量提交；
- 用额外内存换取更少的调用和更高的吞吐量。

### 4.2 三个容易混淆的层次

讨论“缓冲区”时，必须先说明处于哪一层。

| 层次 | 典型对象 | 负责者 | 常见控制接口 |
|---|---|---|---|
| 用户态标准 I/O 缓冲 | `FILE *` 对应的流缓冲 | C 标准库 | `fflush()`、`setvbuf()`、`fclose()` |
| 内核缓存 | 页缓存、设备队列等 | 操作系统 | `fsync()`、`fdatasync()`、同步挂载策略 |
| 存储设备缓存 | 磁盘/控制器内部缓存 | 硬件与驱动 | 由内核和设备协议协调 |

![用户态与内核 I/O 层次](./picture/image-20251121101629204.png)

调用 `write()` 后，数据已经从用户缓冲区提交给内核，但可能仍停留在页缓存中。`write()` 成功不等于数据已经安全写入磁盘。

### 4.3 标准 I/O 的常见缓冲策略

标准流常见三种策略：

| 策略 | 含义 | 常见场景 |
|---|---|---|
| 无缓冲 | 尽快提交每次操作 | 标准错误常采用类似策略 |
| 行缓冲 | 遇到换行等条件时刷新 | 连接交互式终端的标准输出 |
| 全缓冲 | 缓冲区满或显式刷新时提交 | 普通文件输出、重定向后的标准输出 |

![缓冲刷新策略](./picture/image-20260426075252533.png)

具体策略由实现和运行环境决定。不能简单断言 `stdout` 永远行缓冲：当它连接终端时通常行缓冲，重定向到普通文件时通常全缓冲。

常见刷新时机包括：

- 缓冲区已满；
- 行缓冲流遇到换行并满足实现条件；
- 程序调用 `fflush()`；
- 程序调用 `fclose()`；
- 进程通过 `exit()` 正常退出。

`_exit()` 不会刷新 C 标准 I/O 缓冲区。

### 4.4 `fork()` 为什么可能造成重复输出

`fork()` 会复制进程的用户态状态，其中也包括尚未刷新的标准 I/O 缓冲内容。

![fork 与标准 I/O 缓冲](./picture/image-20260425103814960.png)

下面的程序中，`fputs()` 产生的数据在 `fork()` 前仍留在用户态缓冲区；父子进程正常退出时都会刷新各自的副本，因此可能出现两份。`write()` 已在 `fork()` 前提交给内核，不会因为 `fork()` 自动重复执行。

```c
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void)
{
    fputs("stdio buffered; ", stdout);

    const char direct[] = "write once\n";
    ssize_t n;
    do
    {
        n = write(STDOUT_FILENO, direct, sizeof(direct) - 1);
    } while (n < 0 && errno == EINTR);

    if (n < 0)
    {
        perror("write");
        return 1;
    }

    pid_t id = fork();
    if (id < 0)
    {
        perror("fork");
        return 1;
    }

    if (id == 0)
    {
        exit(0);
    }

    if (waitpid(id, NULL, 0) < 0)
    {
        perror("waitpid");
        return 1;
    }

    return 0;
}
```

避免方法：

- 在 `fork()` 前调用 `fflush(NULL)` 或刷新需要的输出流；
- 子进程 `exec` 失败后使用 `_exit()`；
- 避免在 `fork()` 前保留不必要的待刷新数据。

重复输出的直接原因是父子进程各自持有一份待刷新缓冲，不是写时拷贝“主动写了两次”。写时拷贝只是复制进程地址空间的实现优化。

### 4.5 `fflush()`、`fsync()` 与 `close()`

三个接口处于不同层次：

| 接口 | 主要作用 | 是否保证落盘 |
|---|---|---:|
| `fflush(FILE *)` | 把 C 库输出缓冲提交给底层文件描述符 | 否 |
| `fsync(fd)` | 请求把文件数据及保证恢复所需的元数据同步到存储设备 | 面向持久化，但保证受系统和硬件语义影响 |
| `close(fd)` | 释放当前进程持有的描述符引用 | 通常不等价于 `fsync()` |

如果通过 `FILE *` 写入并要求持久化，常见顺序是：

```text
fflush(stream)
fileno(stream)
fsync(fd)
fclose(stream)
```

对于“安全替换配置文件”一类需求，仅同步文件内容还不一定够。通常要写临时文件、同步临时文件、原子 `rename()`，并同步所在目录，以确保目录项更新具备所需的崩溃一致性。

### 4.6 标准库缓冲的概念模型

`FILE *` 是不透明类型，其内部布局由 C 库实现决定。概念上，它通常需要维护：

- 底层文件描述符；
- 缓冲区地址、容量和当前使用量；
- 读写位置和流状态；
- EOF 与错误标志；
- 并发访问所需的锁等信息。

![标准 I/O 缓冲位置](./picture/image-20260426075652171.png)

一个简化的写路径可以表示为：

```text
fprintf/fwrite
    |
    | 拷贝或格式化
    v
用户态 FILE 缓冲区
    |
    | 缓冲满、换行或 fflush
    v
write 系统调用
    |
    v
内核页缓存/设备队列
    |
    | 回写或 fsync
    v
持久化存储
```

教学中可以模拟一个简易缓冲器，但不能据此假设真实 `FILE` 的字段布局，也不能忽略短写、错误状态、线程安全、读写切换和字符编码等复杂问题。

### 4.7 本节小结

- 缓冲通过批量提交减少 I/O 次数；
- C 标准 I/O 缓冲位于用户态，内核还存在页缓存等机制；
- `stdout` 的缓冲策略与它连接的目标有关；
- `fork()` 会复制未刷新的用户态缓冲，可能导致重复输出；
- `fflush()` 不等于 `fsync()`，`close()` 也不自动等于持久化保证。

---

## 5. 文件系统、inode 与链接

### 5.1 从块设备到文件系统

传统机械硬盘通过盘面、磁道和扇区组织介质，并可使用柱面、磁头、扇区等物理概念描述位置。现代操作系统主要通过逻辑块地址（LBA）访问块设备，SSD 也对外提供类似的逻辑块接口。

![磁盘物理结构](./picture/image-20260426093805785.png)

设备的逻辑扇区可能是 512 字节，也可能是 4 KiB；文件系统又会选择自己的块大小。很多 Linux 环境常见 4 KiB 文件系统块和 4 KiB 内存页，但这些数值不是所有系统的硬性规定。

![逻辑块建模](./picture/image-20260426163513469.png)

批量按块访问利用了空间局部性，也减少了设备 I/O 次数和元数据管理成本。

### 5.2 分区、块组和核心结构

以 ext 系列文件系统的概念模型为例，分区可以划分为多个块组。每个块组管理一部分 inode 和数据块，从而避免所有元数据集中在单一位置。

![文件系统块组](./picture/image-20260426170413679.png)

常见结构：

| 结构 | 作用 |
|---|---|
| Superblock | 保存文件系统整体信息，例如块大小、总块数、inode 数和状态 |
| Group Descriptor Table | 描述各块组中位图、inode 表和空闲数量等信息 |
| Block Bitmap | 标记数据块是否已分配 |
| Inode Bitmap | 标记 inode 是否已分配 |
| Inode Table | 保存 inode 元数据 |
| Data Blocks | 保存普通文件内容、目录项或文件系统内部数据 |

具体布局、备份策略和寻址方式取决于文件系统版本与配置，不能把概念图中的顺序理解为所有文件系统都完全一致。

### 5.3 inode 保存什么

inode 是文件系统中的元数据对象，通常包含：

- 文件类型与权限；
- 所有者 UID 和组 GID；
- 文件大小；
- 时间戳；
- 硬链接计数；
- 指向数据块或 extent 的索引信息。

文件名通常不保存在文件自己的 inode 中。目录的数据块保存“文件名 → inode 编号”的目录项映射。

![inode 与数据块](./picture/image-20260426173727336.png)

因此，路径解析大致是：

1. 从起点目录 inode 开始；
2. 在目录项中查找下一段文件名；
3. 得到对应 inode 编号；
4. 继续处理下一段路径；
5. 最终定位目标 inode，再访问文件内容或属性。

### 5.4 删除文件到底发生了什么

`unlink()` 删除的首先是某个目录中的名字，而不是立刻把所有数据块清零。

典型过程：

1. 删除“文件名 → inode”目录项；
2. inode 的硬链接计数减 1；
3. 当硬链接计数为 0，并且也没有进程继续打开该文件时，文件系统才可以回收 inode 和数据块。

因此，一个文件被 `unlink()` 后，如果某个进程仍持有打开描述符，它通常仍可继续读写该文件，直到最后一个打开引用被关闭。

```c
#define _POSIX_C_SOURCE 200809L
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void)
{
    const char *path = "temporary.txt";
    int fd = open(path, O_RDWR | O_CREAT | O_TRUNC, 0600);
    if (fd < 0)
    {
        perror("open");
        return 1;
    }

    const char message[] = "still available through fd\n";
    if (write(fd, message, sizeof(message) - 1) !=
        (ssize_t)(sizeof(message) - 1))
    {
        perror("write");
        close(fd);
        return 1;
    }

    if (unlink(path) < 0)
    {
        perror("unlink");
        close(fd);
        return 1;
    }

    if (lseek(fd, 0, SEEK_SET) < 0)
    {
        perror("lseek");
        close(fd);
        return 1;
    }

    char buffer[128];
    ssize_t n = read(fd, buffer, sizeof(buffer) - 1);
    if (n < 0)
    {
        perror("read");
        close(fd);
        return 1;
    }

    buffer[n] = '\0';
    fputs(buffer, stdout);
    close(fd);
    return 0;
}
```

这种“名字消失、打开对象仍存在”的语义可用于安全临时文件等场景。

### 5.5 硬链接

创建硬链接：

```bash
$ ln original.txt another-name.txt
```

硬链接的本质是在目录中增加一个新的名字，让它指向同一个 inode。

![硬链接与 inode](./picture/image-20251122151005195.png)

特点：

- 两个名字地位对等，通常无法区分谁是“原文件”；
- 删除其中一个名字，不影响通过另一个名字访问数据；
- inode 的硬链接计数会增加；
- 通常不能跨文件系统创建，因为 inode 编号只在对应文件系统内有意义；
- 普通用户通常不能为目录创建硬链接，以避免目录树出现复杂环路。

硬链接不是独立备份：多个名字指向的是同一份文件内容，修改任意一个名字看到的内容，其他名字也会看到变化。

### 5.6 符号链接（软链接）

创建符号链接：

```bash
$ ln -s original.txt shortcut.txt
```

符号链接是独立的文件，有自己的 inode。它的内容是一个目标路径字符串。

![软链接与硬链接](./picture/image-20260427100451473.png)

特点：

- 可以跨文件系统；
- 可以指向目录；
- 目标被移动或删除后，链接可能悬空；
- 相对符号链接的目标路径相对于“符号链接所在目录”解析，而不是相对于创建命令时的当前目录；
- 访问符号链接时，内核继续解析它保存的目标路径。

### 5.7 软链接与硬链接对比

| 对比项 | 硬链接 | 符号链接 |
|---|---|---|
| inode | 与目标共享同一个 inode | 拥有独立 inode |
| 保存内容 | 新目录项指向同一 inode | 保存目标路径字符串 |
| 跨文件系统 | 通常不可以 | 可以 |
| 指向目录 | 普通用户通常不可以 | 可以 |
| 目标名字删除后 | 只要仍有其他硬链接，内容仍可访问 | 可能成为悬空链接 |
| 是否独立备份 | 否 | 否 |

### 5.8 常用观察命令

```bash
# 查看 inode 编号和详细属性
ls -li file
stat file

# 创建硬链接与符号链接
ln source hard-link
ln -s source symbolic-link

# 查看文件系统与块设备
df -T
lsblk -f

# 查看文件占用的数据块
du -h file
```

### 5.9 本节小结

- 块设备提供逻辑块，文件系统在其上组织文件与目录；
- inode 保存大部分元数据，但通常不保存文件名；
- 目录项负责把文件名映射到 inode；
- `unlink()` 删除目录项，真正回收还要等待链接计数和打开引用满足条件；
- 硬链接共享 inode，符号链接保存目标路径。

---

## 6. 静态库与动态库

### 6.1 从源文件到可执行文件

典型构建流程可以分为：

1. 预处理：展开头文件、宏和条件编译；
2. 编译：把预处理结果转换为汇编；
3. 汇编：生成可重定位目标文件 `.o`；
4. 链接：解析符号和重定位，生成可执行文件或共享库。

```bash
# 只编译并汇编，不进行最终链接
$ gcc -Wall -Wextra -c add.c -o add.o
```

![目标文件的生成](./picture/image-20260427150234686.png)

头文件主要提供函数声明、类型和宏；目标文件提供已编译的实现。库把一组可复用目标代码组织起来，便于交付和链接。

### 6.2 静态库

Linux 静态库通常命名为 `libname.a`，本质上是多个目标文件组成的归档。

![静态库与动态库](./picture/image-20260427143539820.png)

创建静态库：

```bash
$ gcc -Wall -Wextra -c add.c sub.c
$ ar rcs libmymath.a add.o sub.o
```

使用静态库：

```bash
$ gcc main.c -I./mylib/include -L./mylib/lib -lmymath -o math_app
```

选项含义：

| 选项 | 含义 |
|---|---|
| `-I DIR` | 添加头文件搜索目录 |
| `-L DIR` | 添加链接阶段的库搜索目录 |
| `-l NAME` | 链接 `libNAME.so` 或 `libNAME.a` |

`-lmymath` 会去掉文件名的前缀 `lib` 和后缀 `.a`/`.so`。链接器通常按命令行从左到右处理输入，因此依赖某个库的目标文件或源文件一般应放在对应 `-l` 选项之前。

静态链接时，链接器从归档中取出解决未定义符号所需的目标模块，并把相应代码并入最终程序，不一定复制整个静态库。

优点：

- 部署时不依赖目标机器存在对应 `.so`；
- 运行环境更容易固定。

代价：

- 可执行文件通常更大；
- 多个进程可能各自包含相同库代码；
- 修复库问题后通常需要重新链接和发布程序；
- 某些系统功能仍可能依赖运行时组件，并非使用 `-static` 就能在所有环境完全独立。

### 6.3 动态库

Linux 共享库通常命名为 `libname.so`。创建共享库时，目标文件一般要使用位置无关代码：

```bash
$ gcc -Wall -Wextra -fPIC -c add.c sub.c
$ gcc -shared -o libmymath.so add.o sub.o
```

链接应用：

```bash
$ gcc main.c -I./mylib/include -L./mylib/lib -lmymath -o math_app
```

链接阶段只解决“需要哪个共享库和哪些符号”。运行时，动态加载器还必须能找到 `libmymath.so`。

![库的交付与使用](./picture/image-20260427152305035.png)

动态库的特点：

- 可执行文件中不直接包含所有库实现；
- 启动或首次调用相关符号时由动态链接机制完成加载与解析；
- 只读代码页可被多个进程共享；
- 库可以独立升级，但必须考虑 ABI 兼容和版本管理；
- 程序运行依赖正确的库搜索路径和版本。

### 6.4 运行时如何找到动态库

常见方式按适用场景划分：

| 方式 | 适合场景 | 注意点 |
|---|---|---|
| 系统标准目录 | 系统级已安装库 | 由发行版和包管理器维护 |
| `ldconfig` 配置 | 管理员安装的系统共享库 | 在 `/etc/ld.so.conf` 或其包含目录配置后更新缓存 |
| `RUNPATH`/`RPATH` | 随应用部署的私有库 | 可在链接时写入，常配合 `$ORIGIN` 使用 |
| `LD_LIBRARY_PATH` | 临时测试和开发 | 会影响当前环境的加载顺序，不宜作为通用生产部署方案 |

例如，把库放在可执行文件旁的 `lib` 目录：

```bash
$ gcc main.c -L./lib -lmymath \
      -Wl,-rpath,'$ORIGIN/lib' \
      -o math_app
```

`$ORIGIN` 由动态加载器解释为可执行文件所在目录。外层使用单引号，避免 Shell 提前展开 `$ORIGIN`。

仅创建符号链接并不能自动增加新的搜索目录。符号链接只有位于动态加载器已经搜索的目录中，或者被已有搜索路径引用时才有效。

### 6.5 动态库排查命令

```bash
# 查看程序依赖的共享库及解析结果
ldd ./math_app

# 查看 ELF 动态段，包括 NEEDED、RPATH、RUNPATH
readelf -d ./math_app

# 查看动态符号
nm -D ./libmymath.so

# 临时增加运行时搜索目录
LD_LIBRARY_PATH=./mylib/lib ./math_app
```

安全场景中要谨慎使用 `ldd` 检查不可信可执行文件；可以优先通过 `readelf` 等静态分析工具查看依赖信息。

### 6.6 静态库与动态库对比

| 对比项 | 静态库 `.a` | 动态库 `.so` |
|---|---|---|
| 链接结果 | 所需目标代码并入可执行文件 | 可执行文件记录共享库依赖 |
| 运行时是否需要库文件 | 通常不需要对应 `.a` | 需要找到兼容的 `.so` |
| 可执行文件大小 | 通常较大 | 通常较小 |
| 代码页共享 | 不同程序通常各有副本 | 可在进程间共享只读映射 |
| 库升级 | 通常重新链接应用 | ABI 兼容时可独立升级 |
| 部署复杂度 | 依赖更少 | 需要管理搜索路径与版本 |

![动静态库加载对比](./picture/image-20260427170515239.png)

实际使用哪个方案，需要综合部署环境、ABI 稳定性、文件大小、安全更新和许可证要求，而不是简单判断哪一种“绝对更好”。

### 6.7 常见错误

1. **把头文件当作实现**：头文件通常只有声明，链接仍需要目标文件或库；
2. **只设置 `-L`，忘记 `-l`**：前者增加目录，后者指定具体库；
3. **把链接路径和运行路径混为一谈**：链接器能找到 `.so`，不代表运行时加载器也能找到；
4. **共享库忘记 `-fPIC`**：某些平台可能链接失败或产生不理想的重定位；
5. **库参数顺序错误**：静态链接时尤其容易出现未定义引用；
6. **随意修改系统库或全局搜索路径**：可能影响其他程序，应优先采用包管理或应用私有路径；
7. **认为硬链接或软链接就是备份**：它们都不能替代独立副本和可靠备份策略。

### 6.8 本节小结

- `.o` 是可重定位目标文件，库是可复用目标代码的组织方式；
- 静态库把所需代码并入最终程序；
- 动态库在运行时由动态加载器定位和映射；
- `-I` 管头文件，`-L` 管链接搜索目录，`-l` 指定库；
- 链接时能找到动态库，不等于运行时也能找到；
- 动态库部署需要管理搜索路径、ABI 和版本。

---

## 7. 全文总结

### 7.1 基础 I/O 的完整主线

```text
应用程序
  |
  | C 标准 I/O：FILE *、缓冲、格式化
  | POSIX I/O：fd、read/write、dup2
  v
进程文件描述符表
  |
  v
打开文件描述：偏移量、状态标志
  |
  v
inode/具体文件对象
  |
  v
文件系统与内核缓存
  |
  v
块设备与持久化存储
```

上层接口可以变化，但所有真实设备和磁盘访问最终都要由操作系统协调。

### 7.2 核心接口速查

| 接口 | 作用 | 成功结果 | 易错点 |
|---|---|---|---|
| `fopen()` | 打开标准 I/O 流 | 返回 `FILE *` | `w` 会清空，`a` 强制追加 |
| `fread()` | 按元素读取 | 返回元素数 | 返回值是 `size_t`，不会小于 0 |
| `fflush()` | 刷新用户态输出缓冲 | 返回 0 | 不保证数据已经落盘 |
| `open()` | 打开/创建文件 | 返回 fd | `O_CREAT` 时要传 mode，权限还受 `umask` 影响 |
| `read()` | 从 fd 读取 | 返回字节数 | 0 表示 EOF，-1 才是错误 |
| `write()` | 向 fd 写入 | 返回字节数 | 必须处理部分写入和 `EINTR` |
| `lseek()` | 调整文件偏移 | 返回新偏移 | 管道、套接字通常不可定位 |
| `dup2()` | 复制描述符到指定编号 | 返回 `newfd` | 参数顺序是 `oldfd, newfd` |
| `fsync()` | 请求同步文件持久化状态 | 返回 0 | 与 `fflush()` 分属不同层次 |
| `unlink()` | 删除目录项 | 返回 0 | 已打开文件可能仍然可访问 |

### 7.3 五组最容易混淆的概念

#### `FILE *` 与文件描述符

- `FILE *`：C 标准库流，带缓冲和流状态；
- `fd`：进程文件描述符表中的整数索引；
- 可以通过 `fileno(stream)` 获取流的底层描述符，但不要绕过标准库随意混合读写而忽略缓冲同步规则。

#### 文件描述符与打开文件描述

- 文件描述符是进程中的整数槽位；
- 打开文件描述保存偏移量和文件状态标志；
- 多个 fd 可以引用同一个打开文件描述。

#### `fflush()` 与 `fsync()`

- `fflush()`：用户态标准 I/O 缓冲 → 内核；
- `fsync()`：内核 → 持久化设备语义；
- 只调用其中一个不能替代另一个。

#### 硬链接与符号链接

- 硬链接：新的目录项指向同一个 inode；
- 符号链接：独立文件，保存目标路径；
- 两者都不等于独立备份。

#### 链接阶段与运行阶段

- `-L` 和 `-l` 解决构建时的库查找和符号解析；
- 动态加载器的搜索规则解决程序运行时如何找到 `.so`；
- 两个阶段的搜索路径并不自动相同。

### 7.4 常用命令清单

```bash
# 文件属性、inode 和打开描述符
stat file
ls -li file
ls -l /proc/<pid>/fd

# 跟踪系统调用
strace -e trace=openat,read,write,close,dup2 ./program

# 查看进程打开的文件
lsof -p <pid>

# 文件系统和块设备
df -T
lsblk -f

# 目标文件、静态库和 ELF 依赖
file app libmymath.a libmymath.so
ar t libmymath.a
nm libmymath.a
readelf -d app
ldd app
```

### 7.5 编程检查清单

编写 I/O 程序时，可以逐项检查：

- 是否检查了 `fopen()`、`open()`、`read()`、`write()`、`dup2()` 的返回值；
- 是否区分了 EOF、部分成功和真正错误；
- 是否处理 `EINTR`，非阻塞场景是否处理 `EAGAIN`；
- 是否在 `O_CREAT` 时提供合理的 mode，并理解 `umask`；
- 是否在所有错误路径关闭不再需要的描述符；
- 是否为不应跨 `exec` 继承的描述符设置 `O_CLOEXEC` 或 `FD_CLOEXEC`；
- 是否正确理解 `dup2(oldfd, newfd)` 的参数方向；
- `fork()` 前是否存在尚未刷新的标准 I/O 缓冲；
- 业务需要的是“提交给内核”还是“断电后可恢复”；
- 删除文件时是否考虑硬链接和仍然打开的引用；
- 动态库的构建路径与运行时搜索路径是否都已配置；
- 是否把符号链接或硬链接误当成独立备份。

### 7.6 最终结论

Linux 基础 I/O 可以归纳为四层关系：

1. **接口层**：`FILE *` 提供标准 I/O，fd 提供系统级统一接口；
2. **进程层**：文件描述符表把整数 fd 映射到打开文件描述，`dup2()` 通过修改映射实现重定向；
3. **文件系统层**：目录项负责名字，inode 负责元数据，数据块负责内容；
4. **构建与运行层**：静态库在链接时合入代码，动态库在运行时被加载和解析。

真正掌握基础 I/O，不只是记住函数名称，而是能回答三个问题：数据当前在哪一层、哪个对象持有它、下一步操作改变的是描述符映射、内核缓存，还是磁盘上的文件系统结构。建立这套分层模型后，重定向、管道、Shell、日志系统、文件持久化和库加载都会更容易理解。

> 发布文章时，请确保 `picture` 目录与 Markdown 文件保持正确的相对路径，否则文中的配图可能无法显示。
