---
title: Linux常用命令与权限详解：文件、查找、压缩与权限模型
date: 2026-08-20 13:10:00
categories:
  - Linux
tags:
  - Linux
  - Shell
  - Linux命令
  - 文件权限
  - chmod
  - find
  - grep
  - tar
---

Linux命令不是一组孤立的背诵题。`ls`、`find`、`grep`、重定向和管道共同构成数据处理流程；用户、组、文件权限和目录权限则决定这些流程能否访问目标对象。

本文从Shell、路径和目录树讲起，系统整理文件操作、查看、查找、压缩、系统信息与帮助命令，并深入解释`rwx`、八进制权限、`umask`、所有者、用户组、目录删除条件和粘滞位。所有危险命令都会明确边界，避免把教学示例直接复制到重要目录。

<!-- more -->0

## 一、Shell、终端与内核

### 1.1 三者的关系

- 终端：承载输入和输出的界面；
- Shell：读取命令、解析语法、展开参数并启动程序；
- 内核：通过系统调用管理进程、文件、网络和硬件资源。

```text
用户 -> 终端 -> Shell -> 程序/系统调用 -> Linux内核
```

常见Shell有Bash、Zsh、Fish等。下面示例主要以Bash兼容语法为基础。

### 1.2 命令的基本结构

```bash
command option argument
```

例如：

```bash
ls -lah /var/log
```

- `ls`是命令；
- `-l`、`-a`、`-h`是选项；
- `/var/log`是参数。

短选项常可合并，但并非所有程序都使用完全相同的解析规则，应查看对应帮助。

### 1.3 命令从哪里来

Shell命令可能是：

- Shell内建命令，如`cd`；
- 外部可执行程序，如`/usr/bin/ls`；
- 别名；
- Shell函数；
- 脚本。

检查：

```bash
type cd
type ls
command -v gcc
which gcc
```

`command -v`通常比`which`更适合判断Shell实际会执行什么，因为它也能识别内建命令和别名。

## 二、Linux目录树与路径

### 2.1 单一目录树

Linux文件系统从根目录`/`开始，不使用Windows式盘符作为顶层路径。不同磁盘和文件系统通过挂载进入同一目录树。

常见目录：

|目录|作用|
|---|---|
|`/`|根目录|
|`/bin`、`/usr/bin`|常用可执行程序；现代系统可能合并|
|`/sbin`、`/usr/sbin`|系统管理程序|
|`/etc`|系统级配置|
|`/home`|普通用户家目录|
|`/root`|root用户家目录|
|`/var`|日志、缓存、可变状态|
|`/tmp`|临时文件|
|`/dev`|设备文件|
|`/proc`|进程和内核信息的虚拟文件系统|
|`/sys`|设备与内核对象信息|
|`/run`|本次启动期间的运行时状态|
|`/opt`|可选第三方软件|

具体发行版可能使用符号链接或不同布局，不能仅凭路径名猜存储设备。

### 2.2 绝对路径与相对路径

```bash
/home/lic/project/main.c   # 绝对路径
project/main.c             # 相对当前目录
../project/main.c          # 从上级目录出发
```

特殊路径：

|写法|含义|
|---|---|
|`.`|当前目录|
|`..`|上级目录|
|`~`|当前用户家目录|
|`~alice`|用户alice的家目录|
|`-`|在`cd`中表示上一次目录|

### 2.3 文件名区分大小写

Linux常见文件系统中：

```text
Makefile
makefile
README.md
readme.md
```

通常是不同名称。跨Windows和Linux协作时要特别注意仅大小写不同的文件冲突。

## 三、pwd与cd

### 3.1 pwd

```bash
pwd
pwd -P
```

`pwd`显示当前工作目录；`-P`倾向显示解析符号链接后的物理路径。

### 3.2 cd

```bash
cd /var/log
cd ..
cd ~
cd -
```

`cd`必须改变当前Shell自身的工作目录，因此通常是Shell内建命令。如果它只是外部子进程，子进程退出后无法改变父Shell目录。

### 3.3 路径包含空格

```bash
cd "My Project"
cd My\ Project
```

变量展开时也要使用双引号：

```bash
target="My Project"
cd "$target"
```

不加引号会发生分词和通配符展开，是Shell脚本常见错误来源。

## 四、ls与文件元数据

### 4.1 常用选项

```bash
ls
ls -l
ls -a
ls -lh
ls -ld directory
ls -li file
ls -lt
ls -R directory
```

|选项|作用|
|---|---|
|`-a`|显示点开头的隐藏项|
|`-l`|长格式|
|`-h`|与大小选项配合，使用易读单位|
|`-d`|显示目录本身，不列出其内容|
|`-i`|显示inode号|
|`-t`|按修改时间排序|
|`-r`|反向排序|
|`-R`|递归列出|

### 4.2 解析`ls -l`

示例：

```text
-rwxr-x--- 1 alice developers 18320 Aug 20 10:30 app
```

字段含义：

1. 文件类型和权限；
2. 硬链接计数；
3. 所有者；
4. 所属组；
5. 大小；
6. 时间；
7. 名称。

不要在脚本中解析`ls`输出处理任意文件名。文件名可以包含空格、换行和其他字符，脚本应使用`find -print0`、数组或语言级目录接口。

## 五、touch、mkdir与rmdir

### 5.1 touch

```bash
touch notes.txt
touch -a notes.txt
touch -m notes.txt
touch -c missing.txt
```

- 文件不存在时，普通`touch`可创建空文件；
- 文件存在时更新访问或修改时间；
- `-c`表示文件不存在时不创建；
- `-r reference target`复制参考文件的时间戳。

`touch`不是专用文本编辑器，它只保证文件存在或调整时间。

### 5.2 mkdir

```bash
mkdir project
mkdir -p project/src/include
mkdir -m 750 private-dir
```

`-p`创建缺失的父目录，并在目录已存在时避免普通错误。

### 5.3 rmdir

```bash
rmdir empty-directory
```

只删除空目录。它比递归删除更保守，适合明确知道目录应为空的场景。

## 六、rm：删除前必须确认边界

### 6.1 基本使用

```bash
rm file.txt
rm -i file.txt
rm -r directory
```

常见选项：

- `-i`：删除前询问；
- `-r`：递归删除目录树；
- `-f`：忽略不存在目标并减少提示；
- `--`：结束选项解析，保护以`-`开头的文件名。

```bash
rm -- -strange-name
```

### 6.2 `rm -rf`为什么危险

它组合了递归和强制，通常不进入桌面回收站。以下因素会把小错误放大：

- 当前目录判断错误；
- 变量为空；
- 通配符展开范围过大；
- 符号链接或挂载点认知错误；
- root权限扩大影响；
- 路径中空格未加引号。

真实操作前建议：

```bash
pwd
printf '<%s>\n' "$target"
ls -ld -- "$target"
```

脚本中还应验证目标非空、位于允许目录并避免`/`、家目录或工作区根目录等宽泛目标。

### 6.3 只读文件与删除权限

删除文件主要修改的是父目录中的目录项，因此关键是父目录的写权限和执行权限，而不是文件自身写权限。`rm`可能因只读文件提示确认，但权限模型不能简化为“文件不可写就不可删除”。

## 七、cp与mv

### 7.1 cp

```bash
cp source.txt destination.txt
cp -i source.txt destination.txt
cp -r source-directory destination-directory
cp -a source-directory backup-directory
```

`-a`归档模式会尽量保留权限、时间、符号链接等元数据，适合备份式复制，但跨文件系统或无权限时仍可能无法完整保留。

多个源目标时，最后一个参数必须是已存在目录：

```bash
cp file1 file2 destination-directory/
```

### 7.2 mv

```bash
mv old.txt new.txt
mv file.txt destination-directory/
mv -i source target
```

同一文件系统中的重命名通常只修改目录项，速度很快；跨文件系统移动可能退化为复制后删除，失败语义和耗时也不同。

### 7.3 覆盖保护

交互操作可以使用`-i`或某些工具提供的`-n`，但脚本不应依赖用户Shell中的别名。脚本要显式写出策略，并检查返回状态。

## 八、查看文件内容

### 8.1 cat

```bash
cat file.txt
cat -n file.txt
cat -b file.txt
cat -s file.txt
```

适合短文件、合并文件或把内容送入管道。大文件不适合直接刷满终端。

### 8.2 less

```bash
less -N file.log
```

常用交互：

|按键|作用|
|---|---|
|`Space`、`PageDown`|向下翻页|
|`b`、`PageUp`|向上翻页|
|`/pattern`|向下搜索|
|`?pattern`|向上搜索|
|`n`|重复搜索|
|`N`|反向重复|
|`g`、`G`|文件开头、末尾|
|`q`|退出|

`less`通常按需读取，适合大文本和日志。

### 8.3 head与tail

```bash
head -n 20 file.txt
tail -n 20 file.txt
tail -f application.log
```

`tail -f`持续跟踪文件增长，常用于日志。日志轮转场景可了解`tail -F`的重试与按名称跟踪差异。

获取第50行：

```bash
sed -n '50p' file.txt
```

也可组合：

```bash
head -n 50 file.txt | tail -n 1
```

## 九、重定向与管道

### 9.1 标准文件描述符

|编号|名称|默认位置|
|---:|---|---|
|0|标准输入stdin|键盘/终端|
|1|标准输出stdout|终端|
|2|标准错误stderr|终端|

### 9.2 输出重定向

```bash
command > output.txt       # 覆盖标准输出
command >> output.txt      # 追加标准输出
command 2> error.txt       # 覆盖标准错误
command > all.txt 2>&1     # 二者进入同一文件
```

重定向顺序有意义：

```bash
command 2>&1 > output.txt
```

这里标准错误先复制当时的标准输出，随后只有标准输出改到文件，结果与上一条不同。

### 9.3 输入重定向

```bash
sort < names.txt
```

### 9.4 管道

```bash
producer | consumer
```

Shell把左侧标准输出连接到右侧标准输入：

```bash
ps -ef | grep '[s]shd'
find . -type f | wc -l
```

默认管道通常只传递标准输出，标准错误仍显示在终端。需要合并时应明确重定向。

## 十、man、help与info

### 10.1 man

```bash
man ls
man 2 open
man 3 printf
man 5 passwd
man -k socket
```

常见手册章节：

|章节|内容|
|---:|---|
|1|普通用户命令|
|2|系统调用|
|3|库函数|
|4|设备与特殊文件|
|5|文件格式和配置|
|6|游戏|
|7|约定、协议和杂项|
|8|系统管理命令|

`man 2 printf`和`man 3 printf`可能指向不同接口，章节号能消除同名歧义。

### 10.2 内建命令帮助

```bash
help cd
help printf
```

### 10.3 程序自身帮助

```bash
grep --help
git help commit
```

学习重点不是记住所有选项，而是知道如何定位准确文档。

## 十一、find：按文件元数据查找

### 11.1 基本语法

```bash
find search_path expression
```

示例：

```bash
find . -name '*.cpp'
find . -iname '*.jpg'
find . -type f
find . -type d
find . -size +10M
find . -mtime -7
find . -maxdepth 2 -type f
```

通配符应加引号，让`find`而不是当前Shell展开：

```bash
find . -name '*.log'
```

### 11.2 组合条件

```bash
find . -type f \( -name '*.c' -o -name '*.cpp' \)
find . -type f ! -name '*.md'
```

### 11.3 对结果执行命令

```bash
find . -type f -name '*.tmp' -print
```

在确认结果前不要直接改为删除。若要安全传给其他程序，应使用：

```bash
find . -type f -print0 | xargs -0 command
```

或者`-exec ... {} +`，从而正确处理空格和换行文件名。

## 十二、grep：按内容搜索

```bash
grep 'error' app.log
grep -n 'error' app.log
grep -i 'error' app.log
grep -v '^#' config.conf
grep -r --include='*.cpp' 'TODO' src/
grep -E 'warn|error' app.log
grep -F 'a.b[c]' file.txt
```

|选项|作用|
|---|---|
|`-n`|显示行号|
|`-i`|忽略大小写|
|`-v`|反向匹配|
|`-r`|递归搜索|
|`-E`|扩展正则表达式|
|`-F`|固定字符串，不解释正则元字符|
|`-w`|匹配完整单词|
|`-C n`|显示前后上下文|

查文件名使用`find`，查文件内容使用`grep`；大多数实际任务会组合二者或使用`rg`等更快的代码搜索工具。

## 十三、时间与日历

```bash
date
date '+%Y-%m-%d %H:%M:%S'
date +%s
date -d '@1508749502'
cal
cal -3
```

Unix时间戳通常表示从1970-01-01 00:00:00 UTC开始经过的秒数，不编码本地时区。展示时间时要明确时区。

设置系统时间需要管理权限，并且现代系统常由NTP或systemd-timesyncd自动同步。随意手工改时间可能影响日志、TLS、数据库和分布式系统。

## 十四、压缩与归档

### 14.1 zip与unzip

```bash
zip -r project.zip project/
unzip -l project.zip
unzip project.zip -d destination/
```

`zip`兼容性好，适合跨平台分发。

### 14.2 tar

`tar`首先是归档工具，可配合压缩算法：

```bash
tar -cf project.tar project/
tar -czf project.tar.gz project/
tar -cJf project.tar.xz project/
tar -tf project.tar.gz
tar -xzf project.tar.gz -C destination/
```

常见含义：

|选项|作用|
|---|---|
|`-c`|创建归档|
|`-x`|解包|
|`-t`|列出内容|
|`-f`|指定归档文件|
|`-z`|gzip|
|`-j`|bzip2|
|`-J`|xz|
|`-C`|切换目标目录|
|`-v`|显示详细过程|

解压不可信归档前先列出内容，防止绝对路径、`..`路径穿越或覆盖已有文件。最好解压到新建空目录并检查结果。

## 十五、系统信息与快捷键

```bash
uname -a
uname -r
uname -m
cat /etc/os-release
hostnamectl
id
whoami
```

网络信息优先使用现代`ip`命令：

```bash
ip address
ip route
```

常用终端控制：

|按键|作用|
|---|---|
|`Tab`|补全|
|`Ctrl-C`|向前台进程组发送中断信号|
|`Ctrl-D`|在空输入处表示EOF，不等于发送信号|
|`Ctrl-Z`|挂起前台任务|
|`Ctrl-L`|清屏|
|`Ctrl-R`|搜索历史|

`Ctrl-C`不是“复制”，它通常终止当前前台任务；终端复制快捷键由客户端决定。

## 十六、用户与用户组

### 16.1 身份

```bash
id
id alice
whoami
groups
```

内核主要使用数字UID和GID；用户名、组名是便于人类使用的映射。

### 16.2 root与普通用户

root的UID通常为0，拥有广泛管理能力。普通用户受文件权限、能力、资源限制和安全策略约束。

root也不是可以绕过一切：只读文件系统、Linux capabilities、SELinux/AppArmor、不可变属性、容器和外部存储策略都可能限制操作。

日常使用普通账户，需要管理时通过`sudo`执行最小范围命令，避免长期停留在root Shell。

### 16.3 创建和管理用户

不同发行版工具略有差异：

```bash
sudo useradd -m alice
sudo passwd alice
sudo usermod -aG developers alice
```

`usermod -aG`中的`-a`非常重要；省略时可能把用户从其他附加组移除。组成员变更通常要重新登录后生效。

## 十七、文件类型

`ls -l`第一列的首字符表示类型：

|字符|类型|
|---|---|
|`-`|普通文件|
|`d`|目录|
|`l`|符号链接|
|`c`|字符设备|
|`b`|块设备|
|`p`|命名管道FIFO|
|`s`|套接字|

Linux通常不依赖扩展名判断可执行性或文件类型。可使用：

```bash
file executable
stat file.txt
```

`file`检查内容特征，`stat`显示inode、大小、权限和时间等元数据。

## 十八、rwx权限模型

### 18.1 三类访问者

每个传统Unix权限对象分为：

- `u`：user，所有者；
- `g`：group，所属组；
- `o`：others，其他用户。

```text
-rwxr-x---
 ||| ||| |||
  u   g   o
```

内核通常按顺序选择一组适用权限：如果进程有效UID等于文件所有者，使用owner位；否则若匹配组，使用group位；否则使用other位。它不是把三组权限简单相加。

### 18.2 普通文件的rwx

|权限|对普通文件的含义|
|---|---|
|`r`|读取文件内容|
|`w`|修改或截断内容|
|`x`|把文件作为程序执行|

拥有文件写权限不代表能删除文件；删除取决于父目录。

脚本有`x`权限还不够，解释器路径、文件系统挂载选项和上级目录权限也会影响执行。

### 18.3 目录的rwx

|权限|对目录的含义|
|---|---|
|`r`|列出目录项名称|
|`w`|创建、删除、重命名目录项|
|`x`|进入/遍历目录，并按已知名称访问对象|

目录权限最容易混淆：

- 有`r`无`x`：可能看到名字，但无法正常获取对象元数据或进入；
- 有`x`无`r`：知道准确名称时可能访问，但不能列出全部名称；
- 删除文件通常需要父目录`w+x`；
- 还要满足路径上每一级目录的`x`权限。

## 十九、chmod

### 19.1 符号形式

```bash
chmod u+x script.sh
chmod g-w file.txt
chmod o= file.txt
chmod u=rw,g=r,o= report.txt
chmod a+r README.md
```

操作符：

- `+`增加权限；
- `-`移除权限；
- `=`精确设置该类权限。

### 19.2 八进制形式

```text
r = 4
w = 2
x = 1
```

每组三位相加：

|数字|权限|
|---:|---|
|0|`---`|
|1|`--x`|
|2|`-w-`|
|3|`-wx`|
|4|`r--`|
|5|`r-x`|
|6|`rw-`|
|7|`rwx`|

示例：

```bash
chmod 644 file.txt
chmod 755 script.sh
chmod 750 private-tool
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### 19.3 递归修改

```bash
chmod -R 755 directory
```

不能无脑对目录树使用同一数值：普通文件通常不需要执行位，而目录需要`x`才能遍历。更精确的做法：

```bash
find directory -type d -exec chmod 755 {} +
find directory -type f -exec chmod 644 {} +
```

执行前先用`-print`检查目标范围。

## 二十、chown与chgrp

```bash
sudo chown alice file.txt
sudo chgrp developers file.txt
sudo chown alice:developers file.txt
```

递归：

```bash
sudo chown -R alice:developers project/
```

递归所有权修改影响大，应先确认路径和符号链接处理策略。普通用户通常不能把文件所有权随意转给其他用户。

## 二十一、umask

`umask`控制新对象创建时要屏蔽的权限位：

```bash
umask
umask 022
```

典型基准：

- 普通文件从`666`考虑，因为默认不赋执行位；
- 目录从`777`考虑。

当`umask`为`022`时，常见结果：

```text
文件：666 & ~022 = 644
目录：777 & ~022 = 755
```

它是按位屏蔽，不应在复杂权限值上只做普通十进制减法。

创建程序传入的mode、进程umask、默认ACL和文件系统策略都会共同影响最终权限。

## 二十二、特殊权限

### 22.1 setuid

可执行文件设置setuid后，执行进程的有效用户身份可能变为文件所有者：

```text
-rwsr-xr-x
```

它具有较高安全风险，脚本上的行为也不按普通二进制程序简单处理。不要为解决普通权限问题随意设置setuid。

### 22.2 setgid

目录设置setgid后，新建对象通常继承目录所属组，适合协作目录：

```bash
chmod g+s shared-directory
```

仍需配合组写权限、umask或ACL。

### 22.3 sticky bit

公共可写目录如`/tmp`通常为：

```text
drwxrwxrwt
```

粘滞位限制普通用户只能删除或重命名自己拥有的文件，或由目录所有者、特权用户操作。它解决“目录可写导致任意用户删除他人文件”的问题。

```bash
chmod +t shared-directory
chmod 1777 shared-directory
```

### 22.4 ACL

传统owner/group/other不够时，可使用访问控制列表：

```bash
getfacl file.txt
setfacl -m u:bob:r-- file.txt
```

`ls -l`权限后出现`+`通常表示存在扩展ACL。实际有效权限还受mask条目影响。

## 二十三、谁能删除文件

在普通目录中，删除一个文件主要要求：

1. 对父目录具有写权限；
2. 对父目录具有执行权限；
3. 路径上的上级目录可遍历；
4. 没有被粘滞位、ACL、不可变属性、只读挂载等额外机制阻止。

文件所有者身份和文件自身`w`位不是通用删除条件。

在设置sticky bit的公共目录中，删除通常还要求操作者是：

- 文件所有者；
- 目录所有者；
- 具备相应特权的用户。

这是理解`/tmp`权限的关键。

## 二十四、完整安全实验脚本

下面脚本只在`mktemp`创建的独立临时目录中实验文件、查找、内容搜索、权限和归档，退出时验证路径后清理。

```bash
#!/usr/bin/env bash

set -euo pipefail

lab_dir="$(mktemp -d -t linux-command-lab.XXXXXX)"

cleanup() {
    if [[ -n "${lab_dir:-}" &&
          -d "$lab_dir" &&
          "$lab_dir" == /tmp/linux-command-lab.* ]]; then
        rm -rf -- "$lab_dir"
    fi
}

trap cleanup EXIT

printf 'lab directory: %s\n' "$lab_dir"

mkdir -p "$lab_dir/project/src" "$lab_dir/project/log"
printf '%s\n' 'int main(void) { return 0; }' \
    > "$lab_dir/project/src/main.c"
printf '%s\n' 'INFO start' 'ERROR connection failed' 'INFO stop' \
    > "$lab_dir/project/log/app.log"

printf '\n[C source files]\n'
find "$lab_dir/project" -type f -name '*.c' -print

printf '\n[error lines]\n'
grep -n 'ERROR' "$lab_dir/project/log/app.log"

chmod 750 "$lab_dir/project"
chmod 640 "$lab_dir/project/log/app.log"

printf '\n[permissions]\n'
stat -c '%A %a %n' \
    "$lab_dir/project" \
    "$lab_dir/project/log/app.log"

tar -czf "$lab_dir/project.tar.gz" -C "$lab_dir" project

printf '\n[archive contents]\n'
tar -tzf "$lab_dir/project.tar.gz"
```

在macOS或BSD系统中，`stat`参数与GNU/Linux不同；这份脚本面向GNU/Linux环境。

## 二十五、常见错误

### 25.1 变量未加引号

```bash
rm $target
```

可能发生空白分词和通配符展开。一般应写：

```bash
rm -- "$target"
```

但引号只能解决分词，不能证明目标范围安全，仍需验证路径。

### 25.2 把文件权限当作删除权限

删除修改父目录项，关键是父目录`w+x`和额外安全机制。

### 25.3 递归chmod 777解决一切

它扩大读取、写入和执行权限，掩盖所有权与组设计问题，可能制造严重安全漏洞。应根据文件和目录用途设置最小权限。

### 25.4 用`find`后直接删除

先`-print`核对结果，再在隔离测试目录验证表达式。搜索路径、括号和引号错误都可能扩大范围。

### 25.5 解压不可信归档到重要目录

先用`tar -tf`或`unzip -l`检查，在新建空目录解压，并关注路径穿越和覆盖。

## 二十六、面试常见问题

### 26.1 `rwx`对文件和目录分别是什么含义

文件的`r/w/x`对应读内容、写内容、执行；目录的`r/w/x`对应列名字、修改目录项、遍历并访问已知名称。

### 26.2 为什么有文件写权限却不能删除

删除由父目录控制，需要父目录写和执行权限，还可能受sticky bit等机制限制。

### 26.3 `chmod 755`表示什么

所有者`rwx`，所属组`r-x`，其他用户`r-x`。

### 26.4 `find`与`grep`的区别

`find`主要根据文件名、类型、大小、时间等元数据寻找文件；`grep`在文本内容中匹配行。

### 26.5 `>`与`>>`的区别

`>`先截断目标再写入，`>>`追加到文件末尾。目标不存在时通常都会创建，但还受目录权限和umask影响。

### 26.6 `Ctrl-D`与`Ctrl-C`有什么区别

`Ctrl-C`通常向前台进程组发送SIGINT；`Ctrl-D`在终端输入缓冲为空时表示EOF，不是信号。

## 二十七、总结

1. Shell负责解析命令并启动程序，内核通过系统调用执行资源操作。
2. Linux使用从`/`开始的统一目录树，路径和文件名通常区分大小写。
3. 删除、覆盖和递归命令必须先验证当前目录、变量和目标范围。
4. `find`按元数据查文件，`grep`按内容查文本，管道负责组合工具。
5. `tar`负责归档并可配合压缩算法，不可信归档应先查看再隔离解压。
6. 权限分为所有者、所属组和其他用户，`rwx`在普通文件与目录上含义不同。
7. 文件删除主要由父目录`w+x`控制，不由文件自身写权限简单决定。
8. `chmod`可用符号或八进制形式，`umask`按位屏蔽默认权限。
9. sticky bit保护公共可写目录中的文件，setgid目录便于团队组继承。
10. 熟练使用帮助系统和安全实验，比机械背诵命令选项更重要。
