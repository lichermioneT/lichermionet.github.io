---
title: Linux基础开发工具详解：包管理、Vim、GCC、GDB、Make与Git
date: 2026-08-20 13:20:00
categories:
  - Linux
tags:
  - Linux
  - Vim
  - GCC
  - GDB
  - Makefile
  - Git
  - yum
---

Linux开发工具链不是若干彼此无关的命令：包管理器负责安装工具，Vim完成编辑，GCC把源代码变成程序，GDB观察运行状态，Make根据依赖关系组织构建，Git记录并协作代码变更。

本文以C/C++开发为主线，系统整理`apt/dnf/yum`、Vim、GCC/G++、GDB、Makefile和Git，并提供一个包含头文件、多个源文件、自动依赖和进度条的完整项目示例。

<!-- more -->

## 一、Linux软件包管理

### 1.1 为什么使用包管理器

软件包管理器不仅下载一个可执行文件，还负责：

- 从配置的软件仓库解析软件名称；
- 处理依赖关系；
- 校验包签名和完整性；
- 记录安装、升级与卸载状态；
- 安装程序、库、头文件、手册和服务文件；
- 在安全更新时统一升级。

它比在网上随机下载二进制文件更容易维护，但仓库来源本身仍必须可信。

### 1.2 Debian/Ubuntu：apt

```bash
sudo apt update
apt search gdb
apt show gdb
sudo apt install build-essential gdb make git vim
sudo apt remove package-name
sudo apt autoremove
```

- `apt update`刷新软件索引，不等于升级全部软件；
- `apt upgrade`升级已安装软件；
- `build-essential`通常包含GCC、G++、Make和基础开发文件。

### 1.3 RHEL、Rocky、Alma：dnf

```bash
dnf search gdb
dnf info gdb
sudo dnf install gcc gcc-c++ gdb make git vim-enhanced
sudo dnf remove package-name
sudo dnf upgrade
```

开发工具组：

```bash
sudo dnf group install "Development Tools"
```

### 1.4 yum

`yum`是老一代RHEL系常用包管理命令。某些新系统上`yum`可能是对`dnf`的兼容入口，旧CentOS 7则使用传统YUM：

```bash
yum search package-name
yum list installed
sudo yum install package-name
sudo yum remove package-name
```

新环境应根据`/etc/os-release`和发行版文档选择工具，不要盲目复制课件命令。

### 1.5 安装软件的安全原则

- 优先使用发行版官方仓库；
- 添加第三方仓库前确认维护者、签名和支持版本；
- 不要不经检查执行`curl URL | sudo bash`；
- 生产服务器升级前评估兼容性并准备回滚；
- 安装失败先读完整错误，不要随意删除包管理数据库或锁文件；
- 编译安装到`/usr/local`时记录来源、版本和卸载方式。

## 二、Vim的模式思想

### 2.1 为什么Vim有模式

Vim把“输入文本”和“执行编辑命令”分开。普通按键在不同模式中具有不同含义，因此可以用很少的按键组合完成移动、删除、复制和修改。

常用模式：

|模式|用途|进入方式|
|---|---|---|
|普通模式|移动、删除、复制、粘贴、命令组合|启动默认进入，或按`Esc`|
|插入模式|输入文本|`i`、`a`、`o`等|
|可视模式|选择文本|`v`、`V`、`Ctrl-V`|
|命令行模式|保存、退出、替换、设置|普通模式按`:`|
|搜索|查找文本|普通模式按`/`或`?`|

遇到“不知道自己在哪个模式”时，先按`Esc`回到普通模式。

### 2.2 打开文件

```bash
vim main.c
vim +42 main.c
vim +/keyword main.c
vim -O left.c right.c
```

## 三、Vim插入与移动

### 3.1 进入插入模式

|命令|作用|
|---|---|
|`i`|光标前插入|
|`I`|行首第一个非空字符前插入|
|`a`|光标后插入|
|`A`|行尾插入|
|`o`|下方新建一行|
|`O`|上方新建一行|
|`s`|删除当前字符并插入|
|`S`|删除当前行内容并插入|

### 3.2 基础移动

```text
h 左   j 下   k 上   l 右
w 下一个单词开头
b 上一个单词开头
e 当前/下一个单词结尾
0 行首
^ 行首第一个非空字符
$ 行尾
gg 文件开头
G 文件末尾
42G 第42行
% 匹配括号
```

数字可作为次数：

```text
5j   向下5行
3w   向前3个单词
```

## 四、Vim编辑命令

### 4.1 删除与修改

|命令|作用|
|---|---|
|`x`|删除当前字符|
|`dd`|删除当前行|
|`5dd`|删除5行|
|`dw`|删除到下一个单词位置|
|`d$`|删除到行尾|
|`cc`|修改整行|
|`cw`|修改单词|
|`rX`|把当前字符替换为X|
|`J`|连接下一行|

Vim常以“操作符+动作”组合：

```text
d + w = 删除一个单词范围
c + $ = 修改到行尾
y + } = 复制到下一段
```

### 4.2 复制、粘贴和撤销

```text
yy       复制当前行
5yy      复制5行
yw       复制单词
p        在后面/下方粘贴
P        在前面/上方粘贴
u        撤销
Ctrl-R   重做
.        重复上一次修改
```

删除操作也会把内容放入寄存器，因此`dd`后可以`p`移动一行。

### 4.3 大小写与缩进

```text
~        切换当前字符大小写
guw      单词转小写
gUw      单词转大写
>>       当前行右缩进
<<       当前行左缩进
=G       从当前位置自动缩进到文件末尾
gg=G     全文件重新缩进
```

## 五、搜索、替换与命令行模式

### 5.1 搜索

```text
/pattern   向下搜索
?pattern   向上搜索
n          同方向下一个
N          反方向下一个
*          搜索光标下单词
#          反向搜索光标下单词
```

### 5.2 保存和退出

```vim
:w
:q
:wq
:x
:q!
:w new-name.c
```

`q!`丢弃未保存修改，执行前要确认内容确实不要。

### 5.3 替换

```vim
:s/old/new/
:s/old/new/g
:%s/old/new/g
:%s/old/new/gc
:10,20s/old/new/g
```

- `%`表示整个文件；
- `g`表示一行内所有匹配；
- `c`逐项确认。

### 5.4 其他常用命令

```vim
:set number
:set nonumber
:set paste
:set nopaste
:42
:!make
:r other.txt
```

## 六、Vim窗口与缓冲区

```vim
:split file.c
:vsplit file.h
```

窗口切换：

```text
Ctrl-W h/j/k/l
Ctrl-W w
Ctrl-W q
```

缓冲区是已打开文件的内存表示，窗口是查看缓冲区的视图。关闭窗口不一定等于从Vim中彻底卸载缓冲区。

### 6.1 简洁配置

`~/.vimrc`可从小配置开始：

```vim
set number
set ruler
set showcmd
set wildmenu
set expandtab
set shiftwidth=4
set softtabstop=4
set tabstop=4
set autoindent
set smartindent
syntax on
filetype plugin indent on
```

不要一开始复制数千行陌生配置。先理解每个选项，再逐步加入插件和语言服务。

## 七、GCC与G++

### 7.1 两个驱动程序

- `gcc`通常用于C源文件；
- `g++`通常用于C++源文件，并自动链接C++标准库。

```bash
gcc main.c -o app
g++ main.cpp -o app
```

`gcc`也能编译C++，但链接阶段需要手工处理C++运行库，因此普通C++项目直接使用`g++`更合适。

### 7.2 常用编译选项

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic -g main.c -o app
g++ -std=c++17 -Wall -Wextra -Wpedantic -g main.cpp -o app
```

|选项|作用|
|---|---|
|`-o file`|指定输出|
|`-g`|生成调试信息|
|`-O0/-O2/-O3`|优化级别|
|`-Wall -Wextra -Wpedantic`|启用常见警告|
|`-Werror`|把警告视为错误，适合受控CI|
|`-std=c11`、`-std=c++17`|选择语言标准|
|`-Ipath`|头文件搜索路径|
|`-Lpath`|库搜索路径|
|`-lname`|链接`libname.so`或静态库|
|`-DNAME=value`|定义预处理宏|
|`-pthread`|编译并链接POSIX线程支持|

`-pthread`不只是`-lpthread`的简单别名，它还可能影响编译期宏和ABI设置，线程程序应在编译和链接阶段都使用。

## 八、编译的四个阶段

### 8.1 预处理

处理`#include`、宏和条件编译：

```bash
gcc -E main.c -o main.i
```

输出仍是高级语言文本，但头文件已展开、宏已替换。

### 8.2 编译

把预处理结果转换为汇编：

```bash
gcc -S main.i -o main.s
```

实际驱动可直接从源文件完成：

```bash
gcc -S main.c -o main.s
```

### 8.3 汇编

生成可重定位目标文件：

```bash
gcc -c main.s -o main.o
```

通常直接：

```bash
gcc -c main.c -o main.o
```

### 8.4 链接

把目标文件和库解析成可执行文件：

```bash
gcc main.o utility.o -o app
```

链接器解决符号引用、重定位地址并组织可执行文件。编译成功但链接失败，常见原因是：

- 函数只有声明没有定义；
- 漏掉目标文件或库；
- C/C++名称修饰不匹配；
- 库顺序不正确；
- 定义重复。

## 九、静态库与动态库

### 9.1 静态库

```bash
ar rcs libmathutil.a add.o sub.o
gcc main.o -L. -lmathutil -o app
```

链接时把需要的目标代码复制进可执行文件。优点是部署依赖少，代价是二进制可能更大，库更新需要重新链接。

### 9.2 动态库

```bash
gcc -fPIC -c add.c -o add.o
gcc -shared add.o -o libmathutil.so
gcc main.o -L. -lmathutil -o app
```

运行时动态装载共享库。检查依赖：

```bash
ldd ./app
```

不要通过全局设置不可信`LD_LIBRARY_PATH`解决所有问题。生产部署应设计明确的系统库路径、rpath或包管理方案。

## 十、调试构建与发布构建

典型调试构建：

```bash
gcc -O0 -g3 -Wall -Wextra -Wpedantic main.c -o app
```

典型发布构建：

```bash
gcc -O2 -DNDEBUG main.c -o app
```

不能简单说GCC默认产生“release模式”。不写`-g`只是缺少调试信息，不写`-O`通常相当于较低优化；Debug/Release是构建配置概念，由项目选项共同决定。

优化会让变量消失、指令重排和内联，调试体验不同。排错时可先使用`-O0 -g`，性能问题则要在接近发布配置下测量。

### 10.1 Sanitizer

```bash
gcc -g -O1 -fsanitize=address,undefined \
    -fno-omit-frame-pointer main.c -o app
```

- AddressSanitizer检测常见越界、释放后使用等内存错误；
- UndefinedBehaviorSanitizer检测部分未定义行为；
- ThreadSanitizer用于数据竞争，但通常不能与ASan同时使用。

Sanitizer是测试工具，不替代代码审查、静态分析和边界设计。

## 十一、GDB基础流程

### 11.1 准备程序

```bash
gcc -g -O0 main.c -o app
gdb ./app
```

### 11.2 常用命令

|命令|缩写|作用|
|---|---|---|
|`break main`|`b main`|设置断点|
|`run`|`r`|启动程序|
|`next`|`n`|单步但不进入函数|
|`step`|`s`|单步进入函数|
|`finish`|无|运行到当前函数返回|
|`continue`|`c`|继续到下一断点|
|`print expr`|`p expr`|打印表达式|
|`display expr`|无|每次暂停自动显示|
|`backtrace`|`bt`|调用栈|
|`frame n`|`f n`|切换栈帧|
|`info locals`|无|局部变量|
|`info args`|无|函数参数|
|`watch expr`|无|值发生变化时暂停|
|`delete`|`d`|删除断点|
|`quit`|`q`|退出|

### 11.3 给程序传参数

```gdb
set args input.txt 42
show args
run
```

或者：

```bash
gdb --args ./app input.txt 42
```

### 11.4 条件断点

```gdb
break process if index == 100
condition 1 count > 10
ignore 1 5
```

### 11.5 查看内存

```gdb
x/16xb buffer
x/8wd numbers
x/s pointer
```

格式`x/nfu address`中，`n`是数量、`f`是格式、`u`是单位。

### 11.6 多线程

```gdb
info threads
thread 3
thread apply all bt
```

调试并发程序时，暂停和单步会改变线程时序，不能因GDB下“不复现”就认定没有竞争。

## 十二、Core Dump

允许当前Shell生成core：

```bash
ulimit -c unlimited
```

崩溃后分析：

```bash
gdb ./app core-file
```

然后：

```gdb
bt
info registers
frame 0
list
```

现代systemd系统可能由`systemd-coredump`集中保存：

```bash
coredumpctl list
coredumpctl gdb executable-name
```

Core可能包含密码、令牌和用户数据，传输与保存必须按敏感文件处理。

## 十三、Make与Makefile

### 13.1 解决什么问题

项目有多个源文件时，不希望每次全部重新编译。Make读取依赖关系，并根据目标与依赖文件的时间戳决定哪些命令需要执行。

基本规则：

```make
target: prerequisites
	recipe
```

传统Make要求配方行以Tab开头，不是普通空格。

### 13.2 最小示例

```make
app: main.o utility.o
	$(CC) main.o utility.o -o app

main.o: main.c utility.h
	$(CC) $(CFLAGS) -c main.c -o main.o

utility.o: utility.c utility.h
	$(CC) $(CFLAGS) -c utility.c -o utility.o
```

### 13.3 变量

```make
CC := gcc
CFLAGS := -std=c11 -Wall -Wextra -Wpedantic -g
CPPFLAGS := -Iinclude
LDFLAGS :=
LDLIBS :=
```

惯例：

- `CPPFLAGS`放预处理选项；
- `CFLAGS`放C编译选项；
- `CXXFLAGS`放C++编译选项；
- `LDFLAGS`放链接器选项；
- `LDLIBS`放库。

### 13.4 自动变量

|变量|含义|
|---|---|
|`$@`|当前目标|
|`$<`|第一个依赖|
|`$^`|全部依赖，去重|
|`$?`|比目标新的依赖|

模式规则：

```make
build/%.o: src/%.c
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@
```

### 13.5 伪目标

```make
.PHONY: all clean test

all: app

clean:
	$(RM) -r build app
```

`.PHONY`避免目录中恰好存在名为`clean`的文件导致清理规则被误判为最新。

### 13.6 自动头文件依赖

```make
CFLAGS += -MMD -MP

-include $(OBJECTS:.o=.d)
```

编译器生成`.d`文件，头文件变化后相关源文件会自动重编译。手工维护大型依赖列表容易漏项。

### 13.7 并行构建

```bash
make -j"$(nproc)"
```

只有依赖关系正确时并行构建才可靠。偶发的并行失败常暴露Makefile漏依赖，而不是简单把`-j`去掉就算修复。

## 十四、进度条与输出缓冲

### 14.1 `\r`与`\n`

- `\r`回车：光标回到当前行开头；
- `\n`换行：进入下一行；
- 终端中用`\r`可以反复覆盖同一行显示进度。

### 14.2 缓冲现象

```c
printf("hello");
sleep(3);
```

标准输出连接终端时常使用行缓冲，没有换行时内容可能留在用户态缓冲区。可显式：

```c
fflush(stdout);
```

输出重定向到文件后，缓冲策略可能变化。不能把某一次终端观察结果当成所有环境的保证。

### 14.3 进度条设计注意

- 每次更新后刷新标准输出；
- 结束时输出换行；
- 非交互输出被重定向时，考虑关闭动画；
- 多线程同时写终端要同步；
- 不要让进度显示污染机器可解析日志。

## 十五、Git基础工作流

### 15.1 配置身份

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

查看来源：

```bash
git config --list --show-origin
```

### 15.2 创建或克隆仓库

```bash
git init
git clone repository_url
```

### 15.3 日常状态与提交

```bash
git status
git diff
git diff --staged
git add main.c Makefile
git commit -m "Add progress demo"
git log --oneline --graph --decorate -10
```

`git commit .`不是推荐的通用“三板斧”。应先用`git status`确认暂存区，再提交明确的一组逻辑变更。

### 15.4 远端

```bash
git remote -v
git remote add origin repository_url
git fetch origin
git pull --rebase origin main
git push -u origin main
```

现代托管平台的HTTPS通常使用个人访问令牌而不是账户密码，也可以使用SSH密钥。不要在脚本和命令历史中写入明文令牌。

### 15.5 `.gitignore`

```gitignore
build/
*.o
*.d
app
.vscode/
```

`.gitignore`只影响尚未被跟踪的文件。已提交文件要先从索引中移除，但操作前要理解`--cached`与工作区的区别。

## 十六、完整多文件项目

目录结构：

```text
progress-demo/
├── include/
│   └── progress.h
├── src/
│   ├── main.c
│   └── progress.c
└── Makefile
```

### 16.1 `include/progress.h`

```c
#ifndef PROGRESS_H
#define PROGRESS_H

void show_progress(unsigned int percent);

#endif
```

### 16.2 `src/progress.c`

```c
#include "progress.h"

#include <stdio.h>

void show_progress(unsigned int percent)
{
    enum { BAR_WIDTH = 40 };
    const unsigned int bounded = percent > 100U ? 100U : percent;
    const unsigned int completed =
        bounded * (unsigned int)BAR_WIDTH / 100U;
    unsigned int index = 0U;

    putchar('[');
    for (index = 0U; index < (unsigned int)BAR_WIDTH; ++index)
    {
        putchar(index < completed ? '#' : '-');
    }

    printf("] %3u%%\r", bounded);
    fflush(stdout);

    if (bounded == 100U)
    {
        putchar('\n');
    }
}
```

### 16.3 `src/main.c`

```c
#define _POSIX_C_SOURCE 200809L

#include "progress.h"

#include <errno.h>
#include <stdio.h>
#include <time.h>

static int sleep_milliseconds(long milliseconds)
{
    struct timespec request;
    request.tv_sec = milliseconds / 1000L;
    request.tv_nsec = (milliseconds % 1000L) * 1000000L;

    while (nanosleep(&request, &request) == -1)
    {
        if (errno != EINTR)
        {
            return -1;
        }
    }
    return 0;
}

int main(void)
{
    unsigned int percent = 0U;

    for (percent = 0U; percent <= 100U; percent += 5U)
    {
        show_progress(percent);
        if (sleep_milliseconds(20L) == -1)
        {
            perror("nanosleep");
            return 1;
        }
    }

    return 0;
}
```

### 16.4 `Makefile`

```make
CC := gcc
CPPFLAGS := -Iinclude
CFLAGS := -std=c11 -Wall -Wextra -Wpedantic -Wconversion -g -MMD -MP
TARGET := progress-demo
SOURCES := src/main.c src/progress.c
OBJECTS := $(SOURCES:src/%.c=build/%.o)
DEPENDS := $(OBJECTS:.o=.d)

.PHONY: all clean run

all: $(TARGET)

$(TARGET): $(OBJECTS)
	$(CC) $(OBJECTS) -o $@

build/%.o: src/%.c
	@mkdir -p $(@D)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@

run: $(TARGET)
	./$(TARGET)

clean:
	$(RM) -r build $(TARGET)

-include $(DEPENDS)
```

构建和运行：

```bash
make
make run
make clean
```

调试：

```bash
gdb ./progress-demo
```

在GDB中：

```gdb
break show_progress
run
print percent
continue
```

## 十七、常见错误

### 17.1 Makefile配方使用空格

经典Make要求配方行以Tab开头。编辑器可显示不可见字符，避免Tab被自动替换。

### 17.2 只给GCC加`-g`就认为没有优化

`-g`控制调试信息，`-O`控制优化，两者可以同时存在。要明确写出构建配置。

### 17.3 C++用gcc链接后找不到标准库符号

普通C++项目使用`g++`完成最终链接，或明确添加所需C++运行库。

### 17.4 GDB看不到变量

可能是缺少`-g`，也可能被优化掉、内联或作用域不可见。调试构建可用`-O0 -g3`。

### 17.5 Git直接`add . && commit && push`

先检查`git status`和`git diff`，避免把密钥、日志、二进制和无关改动一起提交。

### 17.6 为安装方便执行未知脚本

下载内容应先保存、阅读并验证来源，尤其不能把不可信网络内容直接交给root Shell。

## 十八、面试常见问题

### 18.1 GCC编译分为哪几个阶段

预处理、编译、汇编和链接。对应可使用`-E`、`-S`、`-c`观察中间产物。

### 18.2 静态库和动态库有什么区别

静态库所需代码在链接时进入可执行文件；动态库在装载或运行时解析，可共享和独立更新，但部署需要正确找到兼容库。

### 18.3 Make如何判断目标是否重建

目标不存在，或某个依赖文件修改时间比目标新时，执行对应配方；伪目标则按规则总是执行。

### 18.4 `next`和`step`有什么区别

二者都执行下一源代码步骤，`next`通常不进入被调用函数，`step`会进入有调试信息的函数。

### 18.5 为什么进度条需要fflush

输出没有换行，可能停留在标准输出缓冲区；`fflush(stdout)`使本次更新及时显示。

## 十九、总结

1. 包管理器负责仓库、依赖、签名和升级，应优先使用可信发行版仓库。
2. Vim通过模式和“操作符+动作”组合实现高效编辑，先掌握基础再扩展配置。
3. GCC驱动预处理、编译、汇编和链接；C++最终链接通常使用G++。
4. `-g`和优化级别是独立选项，Debug/Release不是由单个开关决定。
5. GDB应配合`-g`使用，断点、单步、栈帧和数据观察构成基础调试流程。
6. Make根据目标和依赖时间戳决定重建，配方缩进、伪目标和头文件依赖是重点。
7. `\r`用于覆盖当前行，进度输出没有换行时需要显式刷新。
8. Git提交前先检查工作区和暂存区，认证使用SSH密钥或令牌，不保存明文凭据。
9. 工具链的真正价值是形成“编辑、构建、调试、测试、版本管理”的闭环。
