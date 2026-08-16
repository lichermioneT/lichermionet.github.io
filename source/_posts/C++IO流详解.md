---
title: C++ IO流详解：标准输入输出、文件流与stringstream
date: 2026-08-15 23:10:00
categories:
  - C++
tags:
  - C++
  - IO流
  - cin
  - cout
  - fstream
  - stringstream
  - 文件操作
---

C++把输入输出抽象为“流”：程序按照顺序从流中提取数据，或把数据插入流。键盘、终端、文件和内存字符串虽然介质不同，却可以使用相似的状态、格式和运算符接口。

本文从流与缓冲区讲起，系统整理`cin`、`cout`、`cerr`、`clog`、文件流和字符串流，并重点解释输入失败后的状态恢复、`>>`与`getline`混用、文本和二进制文件差异，以及原始结构体二进制写入的可移植性问题。

<!-- more -->

## 一、从C语言输入输出说起

C语言常用：

```c
scanf("%d", &value);
printf("value = %d\n", value);
```

以及文件接口：

```c
FILE* file = fopen("data.txt", "r");
fscanf(file, "%d", &value);
fclose(file);
```

它们依赖格式字符串描述类型。如果格式说明与实参类型不匹配，可能产生错误甚至未定义行为。

C++流通过运算符重载和类型系统表达输入输出：

```cpp
int value = 0;
std::cin >> value;
std::cout << "value = " << value << '\n';
```

两套设施都可使用，选择应结合接口、性能、格式控制和现有代码。不要为了“C++代码”机械排斥成熟的C格式化接口，也不要在同一程序中无规则混用导致同步和缓冲问题。

## 二、什么是流

流是有序、连续、具有方向性的数据序列抽象。

- 输入流：数据从外部进入程序；
- 输出流：数据从程序流向外部；
- 输入输出流：同时支持两个方向。

流把两类问题分离：

1. 数据来自哪里或写向哪里；
2. 数据如何格式化、解析和检测状态。

因此相似代码可以用于终端、文件和内存字符串。

## 三、缓冲区的作用

程序通常不会为每个字符都直接执行一次系统调用，而是先在用户态缓冲区积累或读取一批数据。

缓冲带来的价值：

- 减少昂贵的系统调用次数；
- 屏蔽部分设备和操作系统差异；
- 支持按行、按词和按格式解析；
- 提高顺序读写效率。

输出何时真正送往设备，可能受以下因素影响：

- 缓冲区已满；
- 显式`flush()`；
- 使用`std::endl`；
- 流被销毁或关闭；
- 关联流在输入前被刷新；
- 程序正常结束。

异常终止时缓冲数据不一定来得及写出，因此关键日志要设计适当刷新和持久化策略。

## 四、C++流类体系概览

常用头文件与类：

|头文件|主要类或对象|用途|
|---|---|---|
|`<iostream>`|`std::cin`、`std::cout`、`std::cerr`、`std::clog`|标准输入输出|
|`<fstream>`|`std::ifstream`、`std::ofstream`、`std::fstream`|文件输入输出|
|`<sstream>`|`std::istringstream`、`std::ostringstream`、`std::stringstream`|内存字符串流|
|`<iomanip>`|`setw`、`setprecision`等|格式控制|

这些类基于`basic_istream`、`basic_ostream`、`basic_iostream`和流缓冲区体系构建。普通窄字符版本以`char`为字符类型，宽字符版本包括`wcin`、`wcout`等。

## 五、四个标准流对象

### 5.1 cin

`std::cin`是标准输入流，通常连接终端输入：

```cpp
int age = 0;
std::string name;
std::cin >> age >> name;
```

格式化提取默认跳过前导空白，并按目标类型解析。

### 5.2 cout

`std::cout`是标准输出流：

```cpp
std::cout << "age: " << age << '\n';
```

### 5.3 cerr

`std::cerr`用于错误信息。标准初始化时通常设置`unitbuf`，使每次输出操作后刷新，并与`cout`存在关联，适合及时显示诊断信息。

```cpp
std::cerr << "failed to open file\n";
```

### 5.4 clog

`std::clog`用于日志输出，通常带缓冲，更适合非紧急诊断：

```cpp
std::clog << "request completed\n";
```

它们默认可能连接相同的标准错误设备，但语义和缓冲行为不同。日志系统仍应根据级别、文件轮转、线程和持久化需求单独设计。

## 六、格式化输入

### 6.1 连续提取

```cpp
int id = 0;
double score = 0.0;

if (std::cin >> id >> score)
{
    // 两项都解析成功
}
```

提取表达式返回流引用，可转换为布尔状态，因此适合直接判断。

### 6.2 循环读取到结束或错误

```cpp
int value = 0;
while (std::cin >> value)
{
    std::cout << value << '\n';
}
```

循环结束可能因为：

- 正常到达文件末尾；
- 输入类型不匹配；
- 底层I/O错误。

不能仅凭循环退出就断定一定是EOF，应检查流状态。

### 6.3 字符串提取遇空白停止

```cpp
std::string word;
std::cin >> word;
```

输入`hello world`只会得到`hello`。读取整行应使用`std::getline`。

## 七、getline与输入混用

### 7.1 读取整行

```cpp
std::string line;
while (std::getline(std::cin, line))
{
    // 处理line
}
```

默认以换行符为分隔符，换行符被取走但不放入`line`。

也可以指定分隔符：

```cpp
std::getline(stream, field, ',');
```

### 7.2 `>>`留下的换行

```cpp
int age = 0;
std::string name;

std::cin >> age;
std::getline(std::cin, name); // 可能立刻读取剩余换行，得到空串
```

一种处理方式：

```cpp
std::getline(std::cin >> std::ws, name);
```

`std::ws`会吞掉所有前导空白。如果姓名开头空格具有业务意义，应只忽略到当前行末：

```cpp
std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
std::getline(std::cin, name);
```

## 八、流状态

流内部维护状态位：

|状态|含义|
|---|---|
|`goodbit`|没有错误|
|`eofbit`|到达输入序列末尾|
|`failbit`|格式化解析失败等可恢复错误|
|`badbit`|底层严重I/O错误|

常用查询：

```cpp
stream.good();
stream.eof();
stream.fail();
stream.bad();
```

流的布尔判断相当于检查是否没有失败状态：

```cpp
if (stream) {}
if (!stream) {}
```

### 8.1 输入失败后的恢复

```cpp
int value = 0;
if (!(std::cin >> value))
{
    std::cin.clear();
    std::cin.ignore(
        std::numeric_limits<std::streamsize>::max(), '\n');
}
```

两步缺一不可：

1. `clear()`重置状态位；
2. `ignore()`丢弃导致失败的错误输入。

只调用`clear()`，错误字符仍留在缓冲区，下一次读取会再次失败。

### 8.2 exceptions

可以要求流在指定状态发生时抛出异常：

```cpp
stream.exceptions(std::ios::failbit | std::ios::badbit);
```

这会改变错误处理模型，需要在接口边界统一设计，不能一边假设布尔检查、一边遗漏异常。

## 九、输出与格式控制

### 9.1 换行与刷新

```cpp
std::cout << "hello" << '\n';       // 换行，通常不强制刷新
std::cout << "hello" << std::endl;  // 换行并刷新
std::cout << std::flush;             // 只刷新
```

普通循环输出优先使用`'\n'`，避免无意义的频繁刷新。交互式提示或关键诊断可能需要显式刷新。

### 9.2 数值格式

```cpp
#include <iomanip>

std::cout << std::fixed
          << std::setprecision(2)
          << 3.14159; // 3.14
```

常用操纵器：

- `std::hex`、`std::dec`、`std::oct`；
- `std::fixed`、`std::scientific`；
- `std::setprecision`；
- `std::setw`；
- `std::setfill`；
- `std::left`、`std::right`；
- `std::boolalpha`。

部分格式标志会持续影响后续输出，`setw`通常只作用于下一项。库函数若临时修改调用者的流格式，最好保存并恢复原状态。

## 十、为自定义类型重载输入输出

```cpp
struct Point
{
    int x;
    int y;
};

std::ostream& operator<<(std::ostream& output, const Point& point)
{
    output << '(' << point.x << ", " << point.y << ')';
    return output;
}

std::istream& operator>>(std::istream& input, Point& point)
{
    input >> point.x >> point.y;
    return input;
}
```

必须返回流引用，才能链式调用：

```cpp
std::cout << firstPoint << secondPoint;
std::cin >> firstPoint >> secondPoint;
```

输出参数通常是`const T&`；输入需要修改对象，因此是`T&`。复杂格式解析最好先读入临时对象，全部成功后再提交给目标，避免半更新状态。

## 十一、文件流

### 11.1 三个主要类

- `std::ifstream`：文件输入；
- `std::ofstream`：文件输出；
- `std::fstream`：同时输入输出。

### 11.2 RAII打开文件

```cpp
#include <fstream>

std::ifstream input("config.txt");
if (!input)
{
    throw std::runtime_error("cannot open config.txt");
}
```

构造时打开，析构时自动关闭。通常不需要手动`close()`，除非要提前关闭、检查关闭错误或复用流对象打开其他文件。

### 11.3 打开模式

|模式|含义|
|---|---|
|`std::ios::in`|读取|
|`std::ios::out`|写入|
|`std::ios::app`|每次写入定位到末尾|
|`std::ios::ate`|打开后初始定位到末尾|
|`std::ios::trunc`|打开时截断原内容|
|`std::ios::binary`|二进制模式|

模式可用位或组合：

```cpp
std::ofstream output(
    "data.bin",
    std::ios::out | std::ios::binary | std::ios::trunc);
```

`app`与`ate`不同：`ate`只是初始位置在末尾，之后可以定位；`app`要求每次写入都在末尾。

### 11.4 文本文件

```cpp
std::ofstream output("server.conf");
output << "127.0.0.1" << '\n' << 8080 << '\n';
```

读取：

```cpp
std::ifstream input("server.conf");
std::string ip;
int port = 0;

if (!(input >> ip >> port))
{
    throw std::runtime_error("invalid configuration");
}
```

文本格式可读、易调试，但需要定义转义、分隔符、编码和错误处理规则。

### 11.5 二进制文件

```cpp
std::uint32_t value = 42;
output.write(reinterpret_cast<const char*>(&value), sizeof(value));
```

读取：

```cpp
input.read(reinterpret_cast<char*>(&value), sizeof(value));
```

`write`和`read`按字节数量操作。读取后要检查是否确实得到预期字节数：

```cpp
if (!input.read(buffer, count))
{
    // 截断、EOF或I/O错误
}
```

## 十二、不要随意把结构体原样写入文件

课件和入门代码常见：

```cpp
output.write(reinterpret_cast<const char*>(&info), sizeof(info));
```

这只适合非常受控的临时场景，并不等于可靠序列化。风险包括：

- 结构体填充字节；
- 字节序差异；
- 整数宽度差异；
- 编译器与ABI布局差异；
- 版本升级后字段变化；
- 指针写入后在另一次运行中毫无意义；
- `std::string`、`std::vector`等非平凡对象不能按对象字节持久化。

可靠二进制格式应显式规定：

1. 魔数与版本号；
2. 每个字段的固定宽度；
3. 字节序；
4. 字符串长度与编码；
5. 边界和校验；
6. 向前、向后兼容策略。

跨程序或网络传输可考虑成熟序列化格式，而不是直接保存内存镜像。

## 十三、文件位置

常用接口：

```cpp
input.seekg(offset, std::ios::beg);
std::streampos position = input.tellg();

output.seekp(offset, std::ios::beg);
std::streampos writtenPosition = output.tellp();
```

- `g`表示get位置，用于读取；
- `p`表示put位置，用于写入；
- 基准可为`beg`、`cur`、`end`。

文本模式下由于换行转换等原因，任意字节偏移不一定具有可移植意义。精确字节定位通常使用二进制模式。

## 十四、stringstream

### 14.1 三种字符串流

- `std::istringstream`：从字符串读取；
- `std::ostringstream`：向字符串写入；
- `std::stringstream`：同时读写。

### 14.2 格式化为字符串

```cpp
std::ostringstream output;
output << "id=" << 42 << ", score=" << 98.5;
std::string result = output.str();
```

C++11也提供`std::to_string`处理常见数值，但字符串流在组合格式、精度和多字段输出时更灵活。

### 14.3 从字符串解析

```cpp
std::istringstream input("127.0.0.1 8080");
std::string ip;
int port = 0;

if (input >> ip >> port)
{
    // 解析成功
}
```

若要求输入完全消费，还应检查剩余非空白字符。

### 14.4 clear与str不是一回事

```cpp
std::stringstream stream;
stream << 123;

stream.clear(); // 清状态位，不清底层字符串
stream.str(""); // 替换底层字符串，不等价于清状态位
```

复用字符串流时通常同时重置：

```cpp
stream.str("");
stream.clear();
```

一次提取读到末尾时常设置`eofbit`，格式失败会设置`failbit`；不能笼统地说字符串流每次转换结束必然设置`badbit`。

### 14.5 性能考虑

字符串流接口统一、类型安全、表达方便，但格式化开销不一定最低。高性能解析应测量需求，并考虑`std::to_chars`、`std::from_chars`等后续标准工具或专用解析器。

## 十五、在线评测中的I/O

### 15.1 循环读取

```cpp
int left = 0;
int right = 0;

while (std::cin >> left >> right)
{
    std::cout << left + right << '\n';
}
```

### 15.2 加速常见设置

```cpp
std::ios::sync_with_stdio(false);
std::cin.tie(nullptr);
```

- 关闭C与C++标准流同步可能提高性能；
- 解除`cin`与`cout`关联可减少输入前自动刷新；
- 此后不要无规则混用`scanf/printf`与`cin/cout`；
- 交互式题目仍需在合适时机刷新输出。

### 15.3 输出必须严格

在线评测通常逐字符比较输出，多余提示文字、空格、换行都可能导致错误。调试信息应写到`cerr`，提交前也应移除不必要输出。

## 十六、完整示例：配置文件与字符串解析

```cpp
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>

struct ServerInfo
{
    std::string ip;
    unsigned int port;
    bool tls;
};

std::ostream& operator<<(std::ostream& output, const ServerInfo& info)
{
    output << info.ip << ' '
           << info.port << ' '
           << std::boolalpha << info.tls;
    return output;
}

std::istream& operator>>(std::istream& input, ServerInfo& info)
{
    ServerInfo temporary{"", 0U, false};
    if (input >> temporary.ip
              >> temporary.port
              >> std::boolalpha
              >> temporary.tls)
    {
        info = temporary;
    }
    return input;
}

void save(const std::string& fileName, const ServerInfo& info)
{
    std::ofstream output(fileName.c_str(), std::ios::trunc);
    if (!output)
    {
        throw std::runtime_error("cannot open output file");
    }

    output << info << '\n';
    if (!output)
    {
        throw std::runtime_error("cannot write configuration");
    }
}

ServerInfo load(const std::string& fileName)
{
    std::ifstream input(fileName.c_str());
    if (!input)
    {
        throw std::runtime_error("cannot open input file");
    }

    ServerInfo info;
    if (!(input >> info))
    {
        throw std::runtime_error("invalid configuration");
    }

    return info;
}

int main()
{
    const std::string fileName = "server_demo.conf";
    const ServerInfo original{"127.0.0.1", 8080U, true};

    save(fileName, original);
    const ServerInfo restored = load(fileName);
    std::cout << "file: " << restored << '\n';

    std::istringstream line("10.0.0.8 443 false");
    ServerInfo parsed;
    if (!(line >> parsed))
    {
        throw std::runtime_error("cannot parse line");
    }
    std::cout << "memory: " << parsed << '\n';

    std::ostringstream message;
    message << parsed.ip << ':' << parsed.port
            << " tls=" << std::boolalpha << parsed.tls;
    std::cout << message.str() << '\n';

    return 0;
}
```

输出：

```text
file: 127.0.0.1 8080 true
memory: 10.0.0.8 443 false
10.0.0.8:443 tls=false
```

输入运算符先写入临时对象，只有全部字段解析成功才更新目标，避免配置只更新一半。

## 十七、常见错误

### 17.1 不检查文件是否打开

构造文件流后应立即判断状态，不能假设路径、权限和磁盘总是正常。

### 17.2 输入失败后直接重试

失败状态和错误字符仍存在，会形成死循环。应`clear()`状态并丢弃或修正错误输入。

### 17.3 `>>`后直接getline

前一次提取留下的换行可能让`getline`立即返回空行，需要根据输入协议处理剩余分隔符。

### 17.4 过度使用endl

`std::endl`除了换行还刷新，循环中频繁使用可能显著降低输出性能。

### 17.5 原样持久化复杂对象

包含指针、`std::string`、虚函数或非平凡资源的对象不能通过写入`sizeof(object)`字节完成可靠序列化。

### 17.6 认为clear会清字符串流内容

`clear()`清状态；`str("")`替换缓冲字符串。复用时通常二者都要处理。

## 十八、面试常见问题

### 18.1 cerr与clog有什么区别

二者通常都连接标准错误，但`cerr`默认更强调立即输出，通常设置自动刷新；`clog`通常带缓冲，适合普通日志。

### 18.2 `\n`和endl有什么区别

`'\n'`只插入换行字符；`std::endl`插入换行并刷新流。

### 18.3 failbit和badbit有什么区别

`failbit`常表示格式解析失败等逻辑错误，可能恢复；`badbit`表示更严重的底层I/O错误。

### 18.4 文本文件与二进制文件有什么区别

文本文件按字符格式表示字段，易读但需要解析；二进制按字节协议表示，紧凑但必须显式解决布局、字节序、版本和边界问题。

### 18.5 stringstream的clear会清空内容吗

不会。`clear()`重置状态位，`str("")`才把底层字符串替换为空串。

## 十九、总结

1. 流是有序、连续、具有方向性的数据序列抽象。
2. `cin`负责标准输入，`cout`负责标准输出，`cerr`与`clog`用于不同语义的诊断输出。
3. 格式化提取可直接作为循环条件，但循环退出后要区分EOF、解析失败和底层错误。
4. 混用`operator>>`与`getline`时要处理缓冲区中剩余的分隔符。
5. `clear()`重置流状态，`ignore()`丢弃错误输入，两者解决不同问题。
6. 文件流遵循RAII，打开后必须检查状态，读写后也应验证是否成功。
7. 原始结构体内存镜像不是可移植序列化格式。
8. `stringstream`在内存字符串上提供统一流接口，`clear()`不清其底层内容。
9. 性能敏感场景可以关闭同步和解绑流，但要遵守混用与刷新规则。
