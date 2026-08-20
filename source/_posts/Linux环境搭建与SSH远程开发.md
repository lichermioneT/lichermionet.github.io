---
title: Linux环境搭建与SSH远程开发：WSL、虚拟机与云服务器
date: 2026-08-20 13:00:00
categories:
  - Linux
tags:
  - Linux
  - 环境搭建
  - SSH
  - 云服务器
  - WSL
  - Ubuntu
  - CentOS
---

学习Linux首先要获得一个稳定、可重复、敢于实验的环境。环境选择并不存在唯一答案：WSL2启动快，虚拟机隔离完整，云服务器适合远程开发和项目部署，物理机则提供最直接的硬件体验。

本文从Linux、内核和发行版的关系讲起，对比常见搭建方式，给出云服务器初始化、普通用户与sudo、SSH密钥登录、客户端配置和安全检查流程，并提供一份无修改操作的环境自检脚本。

<!-- more -->

## 一、Linux、内核与发行版

### 1.1 严格意义上的Linux

严格来说，Linux主要指Linux内核。内核负责：

- 进程与线程调度；
- 虚拟内存与物理内存管理；
- 文件系统；
- 网络协议栈；
- 设备驱动；
- 系统调用接口；
- 权限和资源隔离。

普通用户不能直接靠内核完成全部工作，还需要Shell、GNU工具、软件包管理器、系统服务和应用程序。

### 1.2 Linux发行版

发行版把Linux内核与用户态工具、安装程序、软件仓库和维护策略组合起来。

常见发行版：

|发行版系列|代表|包管理工具|常见场景|
|---|---|---|---|
|Debian系|Ubuntu、Debian|`apt`、`dpkg`|桌面、服务器、开发环境|
|Red Hat系|RHEL、Rocky Linux、AlmaLinux|`dnf`、`rpm`|企业服务器|
|SUSE系|SUSE、openSUSE|`zypper`、`rpm`|企业与开发|
|Arch系|Arch Linux|`pacman`|滚动更新、深度定制|

课件常使用CentOS 7教学，但CentOS Linux 7已结束生命周期，不适合作为新公网服务器的长期选择。学习旧项目时仍可能遇到它；新环境可优先考虑受支持的Ubuntu LTS、Debian、Rocky Linux或AlmaLinux。

### 1.3 Linux与UNIX

Linux是类UNIX系统，继承了大量UNIX设计思想：

- 一切皆文件的统一接口思想；
- 小工具组合；
- 文本流与管道；
- 多用户与权限模型；
- 进程、文件描述符和Shell。

Linux并不是原始UNIX源码的简单复制。学习历史有助于理解设计来源，但实际开发更应关注POSIX接口、Linux特性和当前发行版行为。

## 二、为什么服务器通常使用命令行

服务器环境常不安装完整桌面，原因包括：

- 减少CPU、内存和磁盘占用；
- 减少软件包和攻击面；
- 便于SSH远程管理；
- 命令可记录、复制和自动化；
- 日志、部署和运维工具以命令行为基础；
- 无图形界面也能在云主机、容器和故障环境中工作。

这不等于Linux桌面“没有价值”。桌面Linux适合日常开发，服务器管理则更强调终端能力。

## 三、四种常见环境搭建方式

### 3.1 WSL2

Windows用户可以使用Windows Subsystem for Linux：

```powershell
wsl --install -d Ubuntu
```

适合：

- 学习Shell、编译器、Git和大部分用户态工具；
- Windows与Linux工具混合开发；
- 快速启动，不想维护完整虚拟机。

注意：

- WSL2使用虚拟化内核，但与标准独立Linux主机仍有集成差异；
- systemd、网络、USB、图形和文件性能要看具体配置；
- 把频繁编译的Linux项目放在WSL自己的Linux文件系统中，通常比跨`/mnt/c`访问更合适；
- 学习内核模块、启动流程或真实多机网络时，虚拟机或物理机更适合。

### 3.2 虚拟机

可使用VMware、VirtualBox、Hyper-V等创建完整Linux虚拟机。

优势：

- 环境接近独立计算机；
- 可做快照和回滚；
- 可练习磁盘、网络、系统服务和多机通信；
- 与宿主系统隔离。

代价：

- 占用更多内存和磁盘；
- 需要理解NAT、桥接、仅主机网络；
- 虚拟化设置、增强工具和共享目录可能需要额外配置。

推荐至少分配：

- 2个虚拟CPU；
- 2到4 GB内存；
- 25 GB以上磁盘；
- NAT网络用于普通联网。

具体资源应根据宿主机能力和项目规模调整。

### 3.3 云服务器

云服务器提供公网或私网IP，可通过SSH远程使用。

优势：

- 不依赖本地电脑持续开机；
- 适合部署HTTP服务器、数据库和后端项目；
- 可以练习安全组、防火墙、域名和远程运维；
- 多台设备可访问同一开发环境。

代价与风险：

- 按时间、流量、磁盘等计费；
- 暴露公网后会持续受到扫描和登录尝试；
- 误配安全组或弱密码可能导致入侵；
- 删除实例、磁盘或欠费可能造成数据丢失。

### 3.4 物理机或双系统

直接安装能获得最完整的硬件访问和性能，适合：

- 需要GPU、USB、驱动或实时特性；
- 长期把Linux作为主力系统；
- 进行内核、机器人或嵌入式开发。

安装前必须：

- 备份重要文件；
- 确认UEFI和磁盘分区模式；
- 为恢复准备启动盘；
- 分清目标磁盘，避免覆盖原系统；
- 笔记本确认网卡、显卡和休眠兼容性。

## 四、如何选择

|学习目标|推荐环境|
|---|---|
|Linux命令、C/C++编译、Git|WSL2或虚拟机|
|系统服务、网络与多机实验|虚拟机|
|部署公网项目|云服务器|
|内核、驱动、机器人硬件|物理Linux|
|需要随时恢复实验环境|虚拟机快照|

对于C++后端学习，可采用组合方案：

1. 本地WSL2或Ubuntu负责写代码和快速编译；
2. 虚拟机练习系统配置与多机网络；
3. 小规格云服务器做最终部署与远程调试。

## 五、创建云服务器时的关键选择

云厂商页面会变化，但核心概念基本一致。

### 5.1 地域

地域应靠近主要用户或自己常用网络。地域影响：

- 网络延迟；
- 可用产品；
- 价格；
- 数据合规；
- 不同地域私网是否直接互通。

### 5.2 镜像

新学习环境可选择仍处于支持周期的稳定发行版，例如Ubuntu LTS或当前企业Linux兼容发行版。不要只因为旧课件截图而选择已经停止安全维护的镜像。

### 5.3 实例规格

纯命令和小型C/C++项目通常不需要高配置。数据库、容器、编译大型项目或运行SLAM会明显增加资源需求。

### 5.4 系统盘与数据盘

代码应提交到Git，重要数据应有独立备份。云磁盘不是备份，快照也要验证恢复流程。

### 5.5 网络与安全组

初始只开放必需端口：

|用途|默认端口|建议|
|---|---:|---|
|SSH|22/TCP|尽量限制来源IP，使用密钥|
|HTTP|80/TCP|部署网站时开放|
|HTTPS|443/TCP|部署TLS网站时开放|
|自定义服务|自定义|只在确实使用时开放|

数据库端口如3306、6379不应无条件暴露整个互联网。优先通过私网、SSH隧道或受控来源访问。

## 六、第一次登录后的初始化

### 6.1 确认系统信息

```bash
cat /etc/os-release
uname -a
uname -r
hostnamectl
```

`/etc/os-release`识别发行版；`uname -r`显示当前内核版本。不要用包管理器命令猜系统系列。

### 6.2 更新软件索引与补丁

Ubuntu/Debian：

```bash
sudo apt update
sudo apt upgrade
```

Rocky/Alma/RHEL新版本：

```bash
sudo dnf upgrade
```

旧CentOS项目可能使用：

```bash
sudo yum update
```

更新生产服务器前应阅读变更、做好快照或备份，并评估是否需要重启，不能把教学命令直接当作无风险生产流程。

### 6.3 创建普通管理用户

以Ubuntu为例：

```bash
sudo adduser developer
sudo usermod -aG sudo developer
```

RHEL系管理员组通常是`wheel`：

```bash
sudo useradd -m developer
sudo passwd developer
sudo usermod -aG wheel developer
```

先在新的终端验证普通用户能够登录并使用`sudo`，再考虑限制root远程登录。不要在唯一管理会话中直接修改SSH策略并断开连接。

### 6.4 安装基础工具

Ubuntu/Debian：

```bash
sudo apt install build-essential gdb git make vim curl wget
```

RHEL系：

```bash
sudo dnf group install "Development Tools"
sudo dnf install gdb git vim-enhanced curl wget
```

不同发行版包名可能不同，安装前可用包管理器搜索。

## 七、SSH远程登录

### 7.1 SSH基本形式

```bash
ssh username@server_ip
```

非默认端口：

```bash
ssh -p 2222 username@server_ip
```

第一次连接会显示服务器主机密钥指纹。应与控制台或可信渠道提供的指纹核对，而不是无条件输入`yes`。

### 7.2 客户端选择

Windows可使用：

- Windows Terminal和系统自带OpenSSH；
- PowerShell；
- XShell；
- MobaXterm；
- VS Code Remote SSH。

Linux与macOS通常直接使用系统`ssh`命令。

工具只是客户端，底层仍是SSH协议。掌握命令行后，更容易在IDE和自动化环境中排错。

### 7.3 密码登录的风险

公网服务器的SSH端口会持续遭受自动扫描。弱密码、重复密码和root密码直登风险较高。短期初始化可以使用临时密码，但应尽快改为密钥认证。

## 八、配置SSH密钥

### 8.1 在客户端生成密钥

```bash
ssh-keygen -t ed25519 -C "developer-key"
```

建议为私钥设置口令。私钥留在客户端，不能上传到服务器或提交到Git。

生成的常见文件：

```text
~/.ssh/id_ed25519      私钥
~/.ssh/id_ed25519.pub  公钥
```

### 8.2 安装公钥

Linux/macOS有`ssh-copy-id`时：

```bash
ssh-copy-id developer@server_ip
```

也可以把公钥内容追加到服务器：

```text
~/.ssh/authorized_keys
```

服务器端典型权限：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

目录和文件所有者必须是当前用户。权限过宽或所有者错误会导致SSH拒绝使用公钥。

### 8.3 测试密钥登录

```bash
ssh -i ~/.ssh/id_ed25519 developer@server_ip
```

先保持原会话不退出，在新窗口验证成功。确认无误后，再按安全需求调整服务器配置。

### 8.4 SSH客户端配置

客户端`~/.ssh/config`：

```sshconfig
Host study-linux
    HostName 203.0.113.10
    User developer
    Port 22
    IdentityFile ~/.ssh/id_ed25519
    ServerAliveInterval 60
```

之后可以：

```bash
ssh study-linux
scp local.txt study-linux:~/
```

示例IP属于文档保留地址，实际使用时替换为自己的服务器地址。

## 九、加固SSH服务

服务器配置通常位于：

```text
/etc/ssh/sshd_config
```

可评估的设置：

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

操作顺序必须安全：

1. 创建普通sudo用户；
2. 安装并测试公钥；
3. 保持已登录会话；
4. 修改配置；
5. 检查语法；
6. 平滑重载服务；
7. 新窗口再次验证。

检查配置：

```bash
sudo sshd -t
```

服务名在发行版中可能是`ssh`或`sshd`：

```bash
sudo systemctl reload ssh
sudo systemctl reload sshd
```

只执行当前系统存在的服务。若密钥登录尚未验证，不要关闭密码登录，否则可能把自己锁在服务器外。

## 十、主机防火墙与云安全组

云安全组和系统防火墙是两个不同层次，二者都要允许流量，连接才能成功。

Ubuntu常见UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw status verbose
```

RHEL系常见firewalld：

```bash
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --list-all
```

修改防火墙前，应先明确SSH端口和现有规则。远程执行错误的默认拒绝策略可能立即断开管理通道。

## 十一、文件传输

### 11.1 scp

上传文件：

```bash
scp app.cpp developer@server_ip:~/project/
```

下载文件：

```bash
scp developer@server_ip:~/project/result.log ./
```

递归目录：

```bash
scp -r project developer@server_ip:~/
```

### 11.2 sftp

```bash
sftp developer@server_ip
```

适合交互式浏览和传输。

### 11.3 rsync

```bash
rsync -av --progress project/ developer@server_ip:~/project/
```

`rsync`适合增量同步，但末尾斜杠会影响“复制目录本身”还是“复制目录内容”，执行前应先用测试目录确认语义。

## 十二、远程开发

### 12.1 Git工作流

最稳妥的代码同步方式通常是Git：

```bash
git clone repository_url
git pull --rebase
git status
```

不要把服务器当作唯一代码副本。源码进入版本库，密钥、密码和大型构建产物不应提交。

### 12.2 VS Code Remote SSH

Remote SSH能够在本地界面中编辑远程文件，但扩展的远程服务端对glibc、libstdc++和系统版本有要求。旧CentOS 7可能因运行库过旧无法支持新版本远程组件。

排错顺序：

1. 命令行`ssh`能否正常连接；
2. 用户家目录是否可写；
3. 远程磁盘是否已满；
4. `glibc`和`libstdc++`是否满足要求；
5. Shell启动脚本是否输出额外文本；
6. 代理和防火墙是否阻断下载。

### 12.3 tmux

远程连接可能中断，`tmux`能让编译和服务继续运行：

```bash
tmux new -s work
tmux attach -t work
tmux list-sessions
```

它不能替代进程管理器。长期服务应使用systemd、容器编排或专用守护机制。

## 十三、常见连接故障

### 13.1 Connection timed out

常见原因：

- IP写错；
- 实例未启动；
- 云安全组未允许SSH；
- 系统防火墙阻断；
- 本地网络限制；
- 路由或公网IP发生变化。

### 13.2 Connection refused

说明目标地址可达，但对应端口没有服务监听或被主动拒绝。检查：

```bash
sudo systemctl status sshd
sudo ss -lntp
```

Ubuntu服务名可能为`ssh`。

### 13.3 Permission denied

检查：

- 用户名是否正确；
- 密钥文件是否正确；
- 私钥权限；
- 服务端`authorized_keys`权限和所有者；
- 服务器是否允许该认证方式；
- 是否把公钥与私钥弄反。

调试连接：

```bash
ssh -vvv developer@server_ip
```

日志可能包含用户名、主机和路径信息，公开粘贴前应脱敏。

### 13.4 主机密钥发生变化

服务器重装后可能出现警告，也可能是中间人攻击。先通过可信控制台核对新指纹，确认确实重装后再删除对应旧记录，不能看到警告就盲目清理整个`known_hosts`。

## 十四、环境自检脚本

下面脚本只读取信息，不修改系统：

```bash
#!/usr/bin/env bash

set -u

section() {
    printf '\n[%s]\n' "$1"
}

section "user"
printf 'user: %s\n' "$(id -un)"
printf 'uid/gid: %s\n' "$(id)"
printf 'home: %s\n' "${HOME:-unknown}"
printf 'shell: %s\n' "${SHELL:-unknown}"

section "system"
if [[ -r /etc/os-release ]]; then
    grep -E '^(NAME|VERSION|ID)=' /etc/os-release
fi
printf 'kernel: %s\n' "$(uname -r)"
printf 'architecture: %s\n' "$(uname -m)"
printf 'hostname: %s\n' "$(hostname)"

section "resources"
command -v nproc >/dev/null 2>&1 && printf 'cpus: %s\n' "$(nproc)"
command -v free >/dev/null 2>&1 && free -h
df -h .

section "development tools"
for tool in cc c++ gcc g++ make gdb git vim ssh; do
    if command -v "$tool" >/dev/null 2>&1; then
        printf '%-6s %s\n' "$tool" "$(command -v "$tool")"
    else
        printf '%-6s missing\n' "$tool"
    fi
done

section "network listeners"
if command -v ss >/dev/null 2>&1; then
    if ! ss -lnt; then
        printf 'unable to query listening sockets in this environment\n'
    fi
else
    printf 'ss command is unavailable\n'
fi
```

保存后执行：

```bash
chmod u+x linux-env-check.sh
./linux-env-check.sh
```

脚本显示监听端口时不包含进程信息，因此普通用户也可运行；若使用`ss -lntp`，能否看到所有进程取决于权限。

## 十五、安全与成本检查清单

### 15.1 安全

- 使用受支持的发行版；
- 及时安装安全更新；
- 普通用户配合sudo管理；
- SSH优先使用密钥和私钥口令；
- 验证密钥后再限制root和密码登录；
- 安全组只开放必需端口和来源；
- 数据库不直接暴露公网；
- 密钥、令牌和`.env`不进入Git；
- 定期检查登录日志和监听端口；
- 准备独立备份和恢复演练。

### 15.2 成本

- 检查按量实例是否仍在运行；
- 了解停止实例后磁盘、公网IP是否继续计费；
- 设置预算告警；
- 清理不用的快照、镜像和数据盘；
- 不把共享root密码作为多人协作方式；
- 每人使用独立账户和密钥，便于撤销与审计。

## 十六、常见误区

### 16.1 “学Linux必须购买云服务器”

不必。基础命令和开发工具用WSL2或虚拟机就能完成。需要公网部署时再购买云资源。

### 16.2 “服务器账户固定是root”

不同镜像默认用户可能是`ubuntu`、`debian`、`ec2-user`、`rocky`或其他名称。应查看云平台镜像说明。

### 16.3 “改掉SSH端口就安全了”

更换端口只能减少低质量扫描日志，不能替代密钥认证、更新、最小权限和防火墙。

### 16.4 “云服务器磁盘就是备份”

误删除、文件损坏、账号问题和区域故障都可能影响数据。备份必须是独立、可恢复且经过验证的副本。

### 16.5 “图形界面没有任何价值”

服务器管理以命令行为主，但桌面环境在图形应用、浏览器、IDE和科研可视化中仍然有价值。应根据任务选择，而不是绝对化。

## 十七、总结

1. Linux内核负责底层资源管理，发行版把内核、工具和软件仓库组合成完整系统。
2. WSL2适合快速开发，虚拟机适合完整实验，云服务器适合公网部署，物理机适合硬件与内核任务。
3. 新环境应选择仍受安全维护的发行版，不要机械沿用旧课件中的CentOS 7镜像。
4. 公网服务器应使用普通sudo用户、SSH密钥和最小端口开放。
5. 修改SSH认证策略前，必须先在新窗口验证密钥登录，避免把自己锁在服务器外。
6. 云安全组与主机防火墙是两个控制层，连接故障要分别检查。
7. 代码进入Git，重要数据独立备份，远程长任务可借助tmux保持会话。
8. 环境搭建的目标不是“能登录一次”，而是安全、稳定、可恢复、可重复。
