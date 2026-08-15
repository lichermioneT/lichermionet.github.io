---
title: C++异常处理详解：从throw、栈展开到RAII与异常安全
date: 2026-08-15 11:00:00
categories:
  - C++
tags:
  - C++
  - 异常处理
  - RAII
  - 异常安全
  - noexcept
  - C++11
---

C++ 异常是一套用于报告和处理运行期错误的机制。它把“发现错误”与“处理错误”分离：底层函数负责发现问题并抛出异常，上层调用者根据异常类型决定如何恢复、记录或终止操作。

异常本身并不复杂，真正需要掌握的是异常传播、栈展开、资源释放、异常安全保证以及工程中的使用边界。本文从传统错误处理方式讲起，系统梳理 `throw`、`try`、`catch`、重新抛出、自定义异常、标准异常体系与 `noexcept`，并结合 RAII 给出可直接复用的工程写法。

<!-- more -->

## 一、为什么需要错误处理

程序运行期间可能遇到很多无法通过正常返回值表达的情况，例如：

- 内存申请失败；
- 文件不存在或没有访问权限；
- 网络连接断开；
- 参数不满足业务约束；
- 容器访问越界；
- 数据库连接失败；
- 配置文件格式错误。

这些情况不一定都是程序 Bug。例如，用户输入错误、网络波动和磁盘空间不足，都属于程序需要面对的外部异常情况。

错误处理机制需要回答三个问题：

1. 错误由谁发现？
2. 错误信息如何向上传递？
3. 传播过程中已经获得的资源如何正确释放？

异常机制主要解决后两个问题。

## 二、C 语言常见的错误处理方式

### 2.1 直接终止程序

典型方式是使用 `assert`：

```cpp
#include <cassert>

int divide(int left, int right)
{
    assert(right != 0);
    return left / right;
}
```

`assert` 更适合检查程序员必须保证的不变量，而不适合处理可预期的运行期错误。

例如，用户输入的除数为零不应该让整个服务直接崩溃；但内部数据结构被破坏，可能说明程序已经无法安全继续运行，此时断言更合适。

还要注意：定义 `NDEBUG` 后，标准 `assert` 会被禁用，因此不能在断言表达式中放置必须执行的业务逻辑。

### 2.2 返回错误码

C 接口经常通过返回值和 `errno` 报告错误：

```c
#include <errno.h>
#include <stdio.h>

FILE* file = fopen("config.txt", "r");

if (file == NULL)
{
    perror("fopen");
}
```

返回错误码的优点是控制流显式、跨语言容易、没有异常运行时依赖；缺点是调用者可能忘记检查，而且深层错误往往需要逐层返回。

```cpp
int connect_database();

int start_server()
{
    const int result = connect_database();

    if (result != 0)
    {
        return result;
    }

    // 继续启动服务器
    return 0;
}

int main()
{
    const int result = start_server();

    if (result != 0)
    {
        // 在最外层处理错误
    }
}
```

调用链越深，错误码的透传代码越多。

### 2.3 `setjmp` 与 `longjmp`

C 标准库还提供 `setjmp` 和 `longjmp`，它们能够进行非局部跳转。不过，这种方式不会执行 C++ 局部对象的析构函数，不能替代 C++ 异常。

在包含 RAII 对象的 C++ 代码中跨越对象生命周期使用 `longjmp`，会破坏正常资源管理，应当避免。

### 2.4 三种方式的比较

| 方式 | 适用场景 | 主要问题 |
| --- | --- | --- |
| 断言或终止 | 不变量被破坏、程序无法安全继续 | 无法恢复，用户体验差 |
| 错误码 | C 接口、系统调用、高频可预期失败 | 容易漏检，需要逐层传播 |
| C++ 异常 | 构造失败、深层调用错误、无法用返回值自然表达的失败 | 需要严格管理资源与异常边界 |

异常不是错误码的完全替代品。工程中通常根据失败是否常见、是否可恢复、接口边界以及性能要求共同选择。

## 三、C++异常的基本模型

异常处理由三个关键字组成：

- `throw`：抛出异常；
- `try`：标记可能产生异常的受保护代码；
- `catch`：捕获并处理匹配的异常。

基本结构如下：

```cpp
try
{
    // 可能抛出异常的代码
}
catch (const SomeError& error)
{
    // 处理 SomeError
}
catch (const std::exception& error)
{
    // 处理其他标准异常
}
catch (...)
{
    // 处理未知类型异常
}
```

执行过程可以概括为：

```text
执行 try 中的代码
        |
        +-- 没有异常 --> 跳过所有 catch，继续执行
        |
        +-- 抛出异常 --> 查找第一个匹配的 catch
                              |
                              +-- 找到 --> 执行处理代码
                              |
                              +-- 未找到 --> 沿调用链继续查找
```

### 3.1 第一个完整示例

```cpp
#include <iostream>
#include <stdexcept>

double divide(double left, double right)
{
    if (right == 0.0)
    {
        throw std::invalid_argument("divisor must not be zero");
    }

    return left / right;
}

int main()
{
    try
    {
        std::cout << divide(10.0, 0.0) << '\n';
    }
    catch (const std::invalid_argument& error)
    {
        std::cerr << "invalid argument: "
                  << error.what()
                  << '\n';
    }
}
```

这里由 `divide` 发现错误，但由 `main` 决定如何展示和处理错误。

## 四、`throw`：异常是如何抛出的

### 4.1 可以抛出什么

C++ 从语法上允许抛出几乎任意可复制或可移动的对象：

```cpp
throw 42;
throw "connection failed";
throw std::string("connection failed");
throw std::runtime_error("connection failed");
```

但工程中不建议随意抛出整数、字符串字面量等互不相关的类型。更合理的做法是抛出继承自 `std::exception` 的对象，从而形成统一的异常体系。

### 4.2 `throw` 表达式会创建异常对象

```cpp
throw std::runtime_error("read failed");
```

运行时会创建一个异常对象，它的生命周期由异常处理机制管理。即使 `throw` 后离开了当前函数，异常对象依然存在，直到匹配的处理器结束。

现代编译器可以消除不必要的复制。因此，与其机械地理解为“必定复制一次”，不如记住：抛出的表达式用于初始化一个独立的异常对象。

### 4.3 推荐按值抛出

推荐规则是：

```text
按值抛出，按 const 引用捕获。
```

```cpp
throw std::runtime_error("database disconnected");

try
{
    // ...
}
catch (const std::runtime_error& error)
{
    std::cerr << error.what() << '\n';
}
```

不要抛出指向局部对象的指针：

```cpp
std::runtime_error error("failed");
throw &error;  // 错误设计：离开作用域后指针悬空
```

## 五、`catch` 的类型匹配规则

异常匹配主要依赖类型，而不是错误文本。

### 5.1 精确类型匹配

```cpp
try
{
    throw 10;
}
catch (int value)
{
    std::cout << value << '\n';
}
```

异常处理不会像普通函数调用那样进行广泛的隐式类型转换。例如，抛出 `int` 通常不会由 `catch (double)` 捕获。

### 5.2 基类可以捕获派生类异常

```cpp
#include <stdexcept>

try
{
    throw std::out_of_range("index out of range");
}
catch (const std::exception& error)
{
    // std::out_of_range 派生自 std::exception
}
```

这也是异常体系使用继承的核心价值：调用者可以精确捕获某个派生类，也可以统一捕获公共基类。

### 5.3 派生类处理器必须写在基类前面

`catch` 按书写顺序匹配，找到第一个可处理该异常的分支后就停止。

正确顺序：

```cpp
try
{
    // ...
}
catch (const std::out_of_range& error)
{
    // 精确处理越界
}
catch (const std::exception& error)
{
    // 兜底处理其他标准异常
}
```

如果把 `std::exception` 放在前面，后面的 `std::out_of_range` 分支永远不会被选中。

### 5.4 为什么要按 `const` 引用捕获

```cpp
catch (const std::exception& error)
```

这样写有三个优点：

1. 避免额外复制；
2. 保留动态类型，避免对象切片；
3. 允许捕获临时异常对象，同时保证处理器不会修改它。

按值捕获基类可能发生切片：

```cpp
catch (std::exception error)  // 不推荐
{
    // 派生类特有部分已经丢失
}
```

### 5.5 `catch (...)` 能做什么

```cpp
catch (...)
{
    std::cerr << "unknown exception\n";
}
```

`catch (...)` 可以捕获任意 C++ 异常，但无法直接访问异常对象。

它适合：

- 程序或线程入口处的最后防线；
- 清理或记录后重新抛出；
- 不允许异常穿越的 ABI、线程、回调边界。

不建议在所有函数中机械添加 `catch (...)`。如果捕获后什么都不做，会隐藏真正错误。

## 六、异常传播与栈展开

### 6.1 沿调用链寻找处理器

假设调用关系为：

```text
main -> start_server -> load_config -> parse_port
```

如果 `parse_port` 抛出异常，当前函数没有匹配的 `catch`，运行时就会依次退出：

```text
parse_port
    -> load_config
        -> start_server
            -> main 中匹配的 catch
```

这个沿调用链退出函数并查找处理器的过程称为栈展开（stack unwinding）。

### 6.2 栈展开会销毁已经构造完成的局部对象

```cpp
#include <iostream>
#include <stdexcept>

class Trace
{
public:
    explicit Trace(const char* name)
        : name_(name)
    {
        std::cout << "construct " << name_ << '\n';
    }

    ~Trace()
    {
        std::cout << "destroy " << name_ << '\n';
    }

private:
    const char* name_;
};

void work()
{
    Trace first("first");
    Trace second("second");
    throw std::runtime_error("work failed");
}
```

异常离开 `work` 时，`second` 和 `first` 会按照构造的逆序析构。

这正是 RAII 能保证异常安全的基础。

### 6.3 哪些对象不会自动释放资源

局部对象会析构，但裸指针本身的析构不会执行 `delete`：

```cpp
void unsafe_work()
{
    int* data = new int[100];
    throw std::runtime_error("failed");
    delete[] data;  // 永远执行不到
}
```

指针变量会离开作用域，但它指向的动态内存不会自动释放，因此发生内存泄漏。

使用 RAII 容器即可解决：

```cpp
#include <stdexcept>
#include <vector>

void safe_work()
{
    std::vector<int> data(100);
    throw std::runtime_error("failed");
}
```

栈展开时 `data` 的析构函数自动释放内存。

### 6.4 未捕获异常会发生什么

如果异常一直传播到最外层仍未被捕获，程序会调用 `std::terminate()`，默认行为通常是终止程序。

因此，服务主入口和工作线程入口通常需要设置明确的异常边界。不过，兜底捕获的目标是记录、转换或安全终止当前任务，不是无声吞掉错误。

## 七、异常的重新抛出

有时当前层只能完成部分处理，例如记录日志、回滚局部状态，然后仍需让上层决定最终策略。

### 7.1 使用不带操作数的 `throw;`

```cpp
try
{
    perform_request();
}
catch (const std::exception& error)
{
    log_error(error.what());
    throw;
}
```

`throw;` 会重新抛出当前正在处理的原异常，并保留其动态类型。

### 7.2 不要用 `throw error;` 代替

```cpp
catch (const std::exception& error)
{
    throw error;  // 不推荐：会创建新异常，可能发生切片
}
```

如果原异常是 `std::out_of_range`，变量 `error` 的静态类型是 `std::exception`，`throw error;` 可能把异常切片成基类对象。

结论：

```text
保留原异常：throw;
抛出新异常：throw NewError(...);
```

### 7.3 在 `catch` 外使用 `throw;`

不带操作数的 `throw;` 只能在当前存在活动异常的上下文中使用。如果没有正在处理的异常，会调用 `std::terminate()`。

## 八、RAII：异常安全的核心

RAII 的含义是“资源获取即初始化”：把资源绑定到对象生命周期中，在构造时获得资源，在析构时释放资源。

常见 RAII 类型包括：

- `std::vector`、`std::string`；
- `std::unique_ptr`、`std::shared_ptr`；
- `std::lock_guard`、`std::unique_lock`；
- `std::fstream`；
- 自定义文件、Socket、数据库连接封装。

### 8.1 智能指针保护动态内存

```cpp
#include <memory>
#include <stdexcept>

void process()
{
    std::unique_ptr<int[]> data(new int[100]);

    // 后续代码抛出异常时，data 仍会自动释放数组
    throw std::runtime_error("process failed");
}
```

### 8.2 锁守卫避免死锁

错误写法：

```cpp
mutex.lock();
update_data();  // 如果这里抛异常，unlock 不会执行
mutex.unlock();
```

正确写法：

```cpp
#include <mutex>

void update()
{
    std::lock_guard<std::mutex> guard(mutex_);
    update_data();
}
```

无论函数正常返回还是因异常退出，`guard` 都会在离开作用域时解锁。

### 8.3 自定义资源封装

```cpp
#include <cstdio>
#include <stdexcept>

class File
{
public:
    explicit File(const char* path)
        : file_(std::fopen(path, "r"))
    {
        if (file_ == NULL)
        {
            throw std::runtime_error("cannot open file");
        }
    }

    ~File()
    {
        if (file_ != NULL)
        {
            std::fclose(file_);
        }
    }

    File(const File&) = delete;
    File& operator=(const File&) = delete;

private:
    std::FILE* file_;
};
```

使用者不需要手动编写异常清理分支，资源会随对象自动释放。

## 九、异常安全的三个常见等级

“代码使用了 RAII”只是异常安全的基础。还需要明确一个操作失败后，对程序状态提供怎样的保证。

### 9.1 基本保证

异常发生后：

- 不泄漏资源；
- 对象仍然满足基本不变量；
- 但对象内容可能已经发生部分变化。

例如，批量插入十个元素时，第六次插入失败，容器仍然有效，但前五个元素可能已经插入。

### 9.2 强保证

异常发生后，操作对外表现为“完全没有发生”，也叫提交或回滚语义。

常见实现方式是先在临时对象上完成操作，成功后再进行不抛异常的交换：

```cpp
class Config
{
public:
    void replace_rules(const std::vector<std::string>& rules)
    {
        std::vector<std::string> temporary(rules);
        rules_.swap(temporary);
    }

private:
    std::vector<std::string> rules_;
};
```

如果复制 `rules` 失败，原来的 `rules_` 不变；复制成功后，`swap` 完成提交。

### 9.3 不抛异常保证

操作承诺不会抛出异常，常用 `noexcept` 表达：

```cpp
void swap(Buffer& other) noexcept;
```

析构、资源释放、移动操作和交换操作尤其适合提供不抛异常保证。

### 9.4 保证等级对比

| 等级 | 异常后的状态 |
| --- | --- |
| 无保证 | 对象状态可能损坏，甚至资源泄漏 |
| 基本保证 | 无泄漏，对象仍有效，但内容可能改变 |
| 强保证 | 状态回滚，效果等同于操作未发生 |
| 不抛异常保证 | 操作保证成功完成且不抛异常 |

不是所有函数都必须提供强保证。接口文档应该明确它能提供哪一级保证。

## 十、构造函数与异常

### 10.1 构造函数可以而且经常应该抛异常

构造函数没有返回值。当对象无法建立有效不变量时，抛异常是自然的报告方式。

```cpp
#include <stdexcept>

class Port
{
public:
    explicit Port(int value)
        : value_(value)
    {
        if (value < 1 || value > 65535)
        {
            throw std::out_of_range("port must be in [1, 65535]");
        }
    }

private:
    int value_;
};
```

如果构造函数抛异常：

- 当前对象没有构造完成，因此不会调用当前类的析构函数；
- 已经构造完成的基类子对象和成员对象会自动析构；
- 构造函数体中手动申请、尚未交给 RAII 对象管理的资源可能泄漏。

因此，正确结论不是“构造函数不要抛异常”，而是“构造过程必须使用 RAII，保证失败时已经获得的资源能够自动释放”。

### 10.2 使用成员对象管理资源

```cpp
class Session
{
public:
    Session()
        : buffer_(4096),
          socket_(open_socket())
    {
        authenticate();  // 可以抛异常
    }

private:
    std::vector<char> buffer_;
    Socket socket_;  // Socket 的析构函数负责关闭句柄
};
```

即使 `authenticate()` 抛异常，已经构造完成的 `socket_` 和 `buffer_` 也会正确析构。

## 十一、析构函数为什么不能让异常逃出

析构函数往往会在栈展开期间执行。如果此时又有另一个异常从析构函数逃出，系统同时处理两个异常，程序会调用 `std::terminate()`。

因此，析构函数通常应当是 `noexcept`，并在内部处理可能失败的清理操作：

```cpp
class Logger
{
public:
    ~Logger() noexcept
    {
        try
        {
            flush();
        }
        catch (...)
        {
            // 记录到不会再抛异常的后备通道，或放弃本次刷新
        }
    }

private:
    void flush();
};
```

多数析构函数会隐式获得 `noexcept(true)`。如果异常从这样的析构函数中逃出，程序会直接终止。

如果清理操作确实可能失败并且调用者必须得知，不要只依赖析构函数，可额外提供显式的 `close()`、`commit()` 或 `flush()` 接口。

## 十二、从动态异常规范到 `noexcept`

### 12.1 旧式动态异常规范

旧代码中可能看到：

```cpp
void load() throw(FileError, ParseError);
void cleanup() throw();
```

第一行表示函数只允许抛出列出的类型，第二行表示不抛异常。

这种动态异常规范存在组合困难、运行期检查复杂等问题：

- C++11 已将 `throw(Type...)` 标记为弃用；
- C++17 移除了动态异常规范；
- 现代 C++ 不应继续编写这种接口。

### 12.2 C++11 的 `noexcept`

```cpp
void cleanup() noexcept;
```

`noexcept` 表示函数承诺不让异常逃出。如果违反承诺，程序会调用 `std::terminate()`，调用者不能在外层正常捕获该异常。

```cpp
void cleanup() noexcept
{
    throw std::runtime_error("failed");  // 最终调用 terminate
}
```

因此，`noexcept` 不是“自动吞掉异常”，而是一份需要遵守的接口契约。

### 12.3 条件 `noexcept`

模板代码可以根据内部操作是否抛异常来决定自身规范：

```cpp
template <class T>
void exchange(T& left, T& right)
    noexcept(noexcept(T(std::move(left))) &&
             noexcept(left = std::move(right)))
{
    T temporary(std::move(left));
    left = std::move(right);
    right = std::move(temporary);
}
```

`noexcept(expression)` 是编译期运算符，不会真正执行表达式，只判断该表达式是否承诺不抛异常。

### 12.4 移动构造为什么常写 `noexcept`

标准容器扩容时需要把旧元素迁移到新内存。如果类型的移动构造可能抛异常，而复制构造可用，容器为了维持强异常保证，可能选择复制而不是移动。

```cpp
class Buffer
{
public:
    Buffer(Buffer&& other) noexcept;
    Buffer& operator=(Buffer&& other) noexcept;
};
```

正确标记 `noexcept` 不只是文档，也可能影响标准容器的策略与性能。但只有函数确实不会让异常逃出时才能标记。

## 十三、自定义异常体系

大型项目通常需要统一异常基类和错误分类。一个良好的异常对象应包含：

- 稳定的错误类型；
- 可读的错误信息；
- 必要的错误码；
- 业务上下文，例如请求 ID、文件名或服务器地址；
- 必要时保存底层异常原因。

### 13.1 基于标准异常设计

```cpp
#include <stdexcept>
#include <string>

enum class ErrorCode
{
    invalid_config,
    database_failure,
    cache_failure,
    network_failure
};

class AppError : public std::runtime_error
{
public:
    AppError(ErrorCode code, const std::string& message)
        : std::runtime_error(message),
          code_(code)
    {
    }

    ErrorCode code() const noexcept
    {
        return code_;
    }

private:
    ErrorCode code_;
};

class DatabaseError : public AppError
{
public:
    explicit DatabaseError(const std::string& message)
        : AppError(ErrorCode::database_failure, message)
    {
    }
};

class NetworkError : public AppError
{
public:
    explicit NetworkError(const std::string& message)
        : AppError(ErrorCode::network_failure, message)
    {
    }
};
```

这里直接复用 `std::runtime_error` 的消息存储和 `what()`，避免重复实现容易出错的异常文本生命周期管理。

### 13.2 分层捕获

```cpp
try
{
    start_server();
}
catch (const DatabaseError& error)
{
    // 数据库错误可以执行特定降级策略
}
catch (const AppError& error)
{
    // 统一处理项目异常
}
catch (const std::exception& error)
{
    // 处理标准库或第三方库异常
}
catch (...)
{
    // 未知异常，记录后安全终止当前任务
}
```

捕获顺序始终从具体到一般。

### 13.3 是否必须自建一套完全独立的基类

通常没有必要。继承 `std::exception` 或其常用派生类有两个好处：

1. 外层可以通过 `catch (const std::exception&)` 统一兜底；
2. 能直接复用 `what()` 生态，与标准库和第三方库更容易协作。

只有在明确的框架约束、跨模块 ABI 或错误元数据需求下，才有必要设计更复杂的基类。

## 十四、C++标准异常体系

多数标准异常可以通过 `<exception>`、`<stdexcept>`、`<new>`、`<typeinfo>` 等头文件获得。

### 14.1 主要继承关系

```text
std::exception
├── std::logic_error
│   ├── std::domain_error
│   ├── std::invalid_argument
│   ├── std::length_error
│   └── std::out_of_range
├── std::runtime_error
│   ├── std::range_error
│   ├── std::overflow_error
│   ├── std::underflow_error
│   └── std::system_error
├── std::bad_alloc
├── std::bad_cast
├── std::bad_typeid
└── 其他标准组件定义的异常
```

这是一张便于理解的简化图，不代表标准库中所有异常类型。

### 14.2 常见标准异常

| 异常 | 常见含义或来源 |
| --- | --- |
| `std::exception` | 标准异常的公共基类 |
| `std::invalid_argument` | 参数值不满足接口要求 |
| `std::out_of_range` | 下标或数值超出允许范围，如 `vector::at` |
| `std::length_error` | 请求长度超过容器或字符串能够支持的范围 |
| `std::domain_error` | 数学定义域错误，由库接口按约定使用 |
| `std::runtime_error` | 只能在运行期确定的一般错误 |
| `std::system_error` | 携带 `std::error_code` 的系统级错误 |
| `std::overflow_error` | 算术溢出，由库接口按约定使用 |
| `std::underflow_error` | 算术下溢，由库接口按约定使用 |
| `std::bad_alloc` | 动态内存分配失败 |
| `std::bad_cast` | 引用形式的 `dynamic_cast` 失败 |
| `std::bad_typeid` | 对特定空多态指针执行 `typeid(*ptr)` |

标准库不会对所有内置算术错误自动抛出异常。例如，普通整数加法溢出不会自动抛出 `std::overflow_error`。

### 14.3 `what()`

`std::exception` 提供虚函数：

```cpp
virtual const char* what() const noexcept;
```

典型处理方式：

```cpp
try
{
    std::vector<int> values(10, 5);
    values.at(10) = 100;
}
catch (const std::exception& error)
{
    std::cerr << error.what() << '\n';
}
```

`what()` 返回适合诊断的文本，但程序逻辑不应依赖不同实现生成的具体英文内容。业务分支应依据异常类型或稳定错误码。

### 14.4 `std::system_error` 与 `std::error_code`

C++11 引入的 `std::system_error` 可以同时携带错误码和说明文本：

```cpp
#include <cerrno>
#include <system_error>

void open_resource()
{
    if (/* 系统调用失败 */ false)
    {
        throw std::system_error(
            errno,
            std::generic_category(),
            "open resource");
    }
}
```

`std::error_code` 适合不使用异常的接口，`std::system_error` 则能把相同错误信息放入异常传播机制中。

## 十五、异常与多线程

### 15.1 异常不会自动跨线程传播

如果线程入口函数中的异常逃出，程序会调用 `std::terminate()`：

```cpp
std::thread worker([]
{
    throw std::runtime_error("worker failed");
});
```

主线程中的 `try/catch` 不能直接捕获工作线程抛出的异常，因为两个线程拥有独立的调用栈。

### 15.2 使用 `std::exception_ptr` 传递异常

```cpp
#include <exception>
#include <iostream>
#include <stdexcept>
#include <thread>

int main()
{
    std::exception_ptr worker_error;

    std::thread worker([&worker_error]
    {
        try
        {
            throw std::runtime_error("worker failed");
        }
        catch (...)
        {
            worker_error = std::current_exception();
        }
    });

    worker.join();

    if (worker_error)
    {
        try
        {
            std::rethrow_exception(worker_error);
        }
        catch (const std::exception& error)
        {
            std::cerr << error.what() << '\n';
        }
    }
}
```

`std::async` 与 `std::future` 也能保存任务异常，调用 `future::get()` 时重新抛出。

## 十六、保留异常原因与嵌套异常

在分层系统中，上层可能需要添加业务上下文，同时保留底层异常原因。

C++11 提供 `std::throw_with_nested` 和 `std::rethrow_if_nested`：

```cpp
#include <exception>
#include <stdexcept>

void load_application()
{
    try
    {
        load_config_file();
    }
    catch (...)
    {
        std::throw_with_nested(
            std::runtime_error("application initialization failed"));
    }
}
```

这样能够表达：应用初始化失败，根本原因是配置加载失败。

工程中也可以使用异常对象字段、日志追踪 ID 或现代错误链库保存上下文。关键是不要只用一条模糊的新消息覆盖根本原因。

## 十七、什么时候应该使用异常

适合使用异常的情况：

- 构造函数无法建立有效对象；
- 深层调用遇到当前层无法处理的失败；
- 错误很少发生，且正常返回值需要保持简洁；
- 标准库或第三方库已经使用异常；
- 需要跨多层调用传播丰富错误信息。

更适合错误码、状态值或结果类型的情况：

- 失败属于正常、高频分支，例如非阻塞 `recv` 返回 `EAGAIN`；
- 极端低延迟或实时路径不允许不可预测的展开成本；
- C ABI、系统调用或跨语言接口；
- 项目明确禁用异常；
- 调用者通常能立即处理失败。

以网络服务器为例：

- 客户端暂时没有数据可读，是正常事件状态，不适合抛异常；
- 配置文件无法解析，导致服务器无法启动，可以抛异常到启动入口统一报告；
- 某个连接被对端关闭，通常是正常连接生命周期，不应作为全局异常；
- 内部对象不变量被破坏，可能应记录严重错误并终止相关任务。

## 十八、异常的性能应该怎样理解

常见实现采用“正常路径低成本”的异常机制：没有异常发生时，`try` 往往不会产生逐条检查的明显运行时成本。

但真正抛出异常时需要：

- 创建异常对象；
- 查找匹配的处理器；
- 展开调用栈；
- 执行沿途对象的析构函数；
- 可能生成或记录诊断信息。

因此，抛异常通常明显慢于普通分支，不应该用于循环中的常规控制流程。

```cpp
// 不推荐：用异常判断每个输入是否有效
for (const std::string& text : inputs)
{
    try
    {
        consume(parse(text));
    }
    catch (...)
    {
        // 高频失败
    }
}
```

性能结论应通过具体编译器、构建选项、目标平台和工作负载测量，不能简单概括为“完全没有开销”或“一定很慢”。

## 十九、异常边界的工程设计

异常最适合在明确的边界被统一捕获：

### 19.1 程序主入口

```cpp
int main()
{
    try
    {
        return run_application();
    }
    catch (const AppError& error)
    {
        log_fatal(error.what());
        return 1;
    }
    catch (const std::exception& error)
    {
        log_fatal(error.what());
        return 2;
    }
    catch (...)
    {
        log_fatal("unknown exception");
        return 3;
    }
}
```

### 19.2 工作线程入口

在线程入口捕获异常，将它转换成任务失败状态、`exception_ptr` 或日志，不能让它逃出线程函数。

### 19.3 C 接口和动态库边界

不要让 C++ 异常越过不支持异常的 C ABI：

```cpp
extern "C" int start_service() noexcept
{
    try
    {
        start_service_impl();
        return 0;
    }
    catch (const std::exception& error)
    {
        save_last_error(error.what());
        return -1;
    }
    catch (...)
    {
        save_last_error("unknown error");
        return -2;
    }
}
```

### 19.4 事件循环与回调边界

Reactor 服务器调用用户回调时，应该明确异常策略：

- 捕获异常并关闭当前连接；
- 记录连接 ID 和回调类型；
- 保证异常不会直接终止整个事件循环；
- 不要把不可恢复的进程级错误伪装成普通连接错误。

## 二十、综合示例：服务器启动异常体系

下面的程序综合演示：

- 自定义异常基类；
- 派生异常；
- 按值抛出、按 `const` 引用捕获；
- 栈展开与 RAII；
- 添加上下文后重新抛出新异常；
- 从具体类型到公共基类的分层捕获；
- `noexcept` 资源释放。

```cpp
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

enum class ErrorCode
{
    invalid_config,
    database_failure,
    server_failure
};

class AppError : public std::runtime_error
{
public:
    AppError(ErrorCode code, const std::string& message)
        : std::runtime_error(message),
          code_(code)
    {
    }

    ErrorCode code() const noexcept
    {
        return code_;
    }

private:
    ErrorCode code_;
};

class ConfigError : public AppError
{
public:
    explicit ConfigError(const std::string& message)
        : AppError(ErrorCode::invalid_config, message)
    {
    }
};

class DatabaseError : public AppError
{
public:
    explicit DatabaseError(const std::string& message)
        : AppError(ErrorCode::database_failure, message)
    {
    }
};

class Connection
{
public:
    explicit Connection(std::string endpoint)
        : endpoint_(std::move(endpoint))
    {
        std::cout << "connect: " << endpoint_ << '\n';

        if (endpoint_.empty())
        {
            throw DatabaseError("database endpoint is empty");
        }
    }

    ~Connection() noexcept
    {
        std::cout << "disconnect: " << endpoint_ << '\n';
    }

    Connection(const Connection&) = delete;
    Connection& operator=(const Connection&) = delete;

private:
    std::string endpoint_;
};

struct Config
{
    int port;
    std::string database_endpoint;
};

Config load_config(int port,
                   const std::string& database_endpoint)
{
    if (port < 1 || port > 65535)
    {
        throw ConfigError("port must be in [1, 65535]");
    }

    return Config{port, database_endpoint};
}

void initialize_database(const Config& config)
{
    Connection connection(config.database_endpoint);
    std::vector<int> startup_buffer(1024, 0);

    if (startup_buffer.empty())
    {
        throw DatabaseError("cannot allocate startup buffer");
    }

    std::cout << "database initialized\n";
}

void start_server(int port,
                  const std::string& database_endpoint)
{
    try
    {
        const Config config =
            load_config(port, database_endpoint);

        initialize_database(config);

        std::cout << "server listening on port "
                  << config.port
                  << '\n';
    }
    catch (const ConfigError&)
    {
        throw;
    }
    catch (const DatabaseError& error)
    {
        throw AppError(
            ErrorCode::server_failure,
            std::string("server startup failed: ") + error.what());
    }
}

int main()
{
    try
    {
        start_server(8080, "127.0.0.1:3306");
        start_server(70000, "127.0.0.1:3306");
    }
    catch (const ConfigError& error)
    {
        std::cout.flush();
        std::cerr << "config error: "
                  << error.what()
                  << '\n';
        return 1;
    }
    catch (const AppError& error)
    {
        std::cout.flush();
        std::cerr << "application error: "
                  << error.what()
                  << '\n';
        return 2;
    }
    catch (const std::exception& error)
    {
        std::cout.flush();
        std::cerr << "standard exception: "
                  << error.what()
                  << '\n';
        return 3;
    }
    catch (...)
    {
        std::cout.flush();
        std::cerr << "unknown exception\n";
        return 4;
    }

    return 0;
}
```

使用 C++11 编译：

```bash
g++ -std=c++11 -Wall -Wextra -Wpedantic main.cpp -o main
```

程序第一次启动成功，`Connection` 离开作用域时自动断开；第二次启动因端口越界抛出 `ConfigError`，最终由最具体的处理器捕获。

预期输出类似：

```text
connect: 127.0.0.1:3306
database initialized
disconnect: 127.0.0.1:3306
server listening on port 8080
config error: port must be in [1, 65535]
```

## 二十一、常见错误与修正

### 21.1 抛出互不相关的基础类型

```cpp
throw 1;
throw "failed";
```

问题：外层必须猜测并枚举各种类型，无法建立统一处理策略。

修正：抛出统一异常基类的派生对象。

### 21.2 按值捕获异常

```cpp
catch (std::exception error)
```

问题：发生复制，并可能造成对象切片。

修正：

```cpp
catch (const std::exception& error)
```

### 21.3 把基类处理器放在前面

```cpp
catch (const std::exception& error) {}
catch (const std::out_of_range& error) {}
```

问题：第二个处理器无法被匹配。

修正：派生类在前，基类在后。

### 21.4 使用 `throw error;` 重新抛出

问题：创建新异常并可能发生切片。

修正：使用 `throw;` 保留原异常。

### 21.5 捕获后完全忽略

```cpp
try
{
    save();
}
catch (...)
{
}
```

问题：错误被隐藏，程序可能带着错误状态继续运行。

修正：真正恢复、转换为明确状态、记录后重新抛出，或在异常边界安全终止当前任务。

### 21.6 用裸资源配合手工清理

```cpp
int* data = new int[100];
work();
delete[] data;
```

问题：`work()` 抛异常时发生泄漏。

修正：使用 `std::vector` 或 `std::unique_ptr`。

### 21.7 让异常逃出析构函数

问题：栈展开期间出现第二个异常会终止程序。

修正：析构函数保持 `noexcept`，内部消化清理失败；需要反馈时提供显式关闭接口。

### 21.8 滥用 `noexcept`

问题：函数实际会抛异常，却错误声明 `noexcept`，最终无法在调用方恢复，只能终止程序。

修正：只为确实不抛异常的操作声明 `noexcept`。

### 21.9 把异常用于正常控制流

问题：可读性差，频繁抛出成本高。

修正：高频、可预期状态使用普通分支、错误码或结果类型。

### 21.10 继续编写 `throw(Type)`

问题：动态异常规范已经过时，现代标准中被移除。

修正：使用 `noexcept` 表达“不抛异常”；可能抛出的具体类型通过接口文档说明。

### 21.11 认为外层能捕获工作线程的异常

问题：异常不会自动跨越线程调用栈，逃出线程函数会触发 `std::terminate()`。

修正：在线程内部捕获，并通过 `std::exception_ptr`、`future` 或任务状态传递。

### 21.12 在 `what()` 文本上写业务判断

问题：文本可能因标准库实现、版本或语言环境变化。

修正：依据异常类型、`std::error_code` 或自定义稳定错误码判断。

## 二十二、面试常见问题

### 22.1 `throw`、`try` 和 `catch` 分别做什么

`throw` 创建并抛出异常对象；`try` 标记需要监控异常的代码区域；`catch` 按类型匹配并处理异常。

### 22.2 什么是栈展开

异常传播时，程序沿调用链退出函数，并按逆序析构已经构造完成的自动对象，直到找到匹配处理器。这个过程叫栈展开。

### 22.3 为什么异常要按 `const` 引用捕获

为了避免复制、保留动态类型、防止对象切片，并允许统一捕获派生异常。

### 22.4 `throw;` 与 `throw error;` 有什么区别

`throw;` 重新抛出当前原异常并保留动态类型；`throw error;` 根据表达式创建一个新异常，可能切片。

### 22.5 构造函数可以抛异常吗

可以。当对象无法建立有效状态时，抛异常是合理做法。已经构造完成的成员和基类会被析构，但构造函数体中未被 RAII 管理的资源可能泄漏。

### 22.6 为什么析构函数通常不能抛异常

析构函数可能在栈展开期间执行。如果第二个异常逃出，程序会调用 `std::terminate()`。因此资源释放路径通常应提供不抛异常保证。

### 22.7 `noexcept` 有什么作用

它声明函数不允许异常逃出，能够表达接口契约，并可能让标准容器更积极地使用移动操作。违反 `noexcept` 会调用 `std::terminate()`。

### 22.8 什么是基本保证、强保证和不抛保证

- 基本保证：失败后无泄漏，对象仍有效；
- 强保证：失败后状态不变；
- 不抛保证：操作不会抛异常。

### 22.9 RAII 为什么能解决异常安全问题

栈展开会调用局部对象的析构函数。只要资源由对象持有，异常离开作用域时资源就会自动释放。

### 22.10 异常可以跨线程传播吗

不能直接传播。需要在线程内捕获，再使用 `std::exception_ptr`、`std::promise/std::future` 或任务框架把失败传给其他线程。

### 22.11 `catch (...)` 是否应该到处使用

不应该。它适合线程入口、程序入口、C ABI、事件循环等明确边界。普通业务函数若无法处理异常，通常应该让它继续传播。

### 22.12 异常和错误码如何选择

低频、无法就地处理、需要跨层传播的失败适合异常；高频可预期状态、实时路径、C 接口和调用者可立即恢复的失败更适合错误码或结果类型。

## 二十三、实践建议

1. 按值抛出，按 `const` 引用捕获；
2. 自定义异常尽量继承 `std::exception` 的合适派生类；
3. `catch` 从最具体的派生类写到最一般的基类；
4. 重新抛出原异常使用 `throw;`；
5. 所有资源都交给 RAII 对象管理；
6. 析构函数、释放函数和移动操作尽量提供不抛保证；
7. 不要把异常当成普通循环或分支工具；
8. 在线程、事件循环、动态库和程序入口建立异常边界；
9. 记录错误时补充上下文，但不要丢失根本原因；
10. 接口文档说明可能的失败、异常类型和异常安全等级；
11. 不要继续使用已经过时的动态异常规范；
12. 对关键异常路径编写单元测试，而不只测试成功路径。

## 二十四、总结

C++ 异常的核心不是三个关键字，而是一套完整的错误传播与资源管理模型：

- `throw` 把错误封装为具有类型的信息；
- `catch` 让合适的上层统一处理；
- 栈展开负责退出调用链并析构局部对象；
- RAII 保证资源在正常返回和异常退出时都能释放；
- 异常安全等级描述失败后对象状态；
- `noexcept` 表达现代 C++ 的不抛异常契约；
- 自定义异常体系让大型项目拥有统一的错误分类；
- 明确的异常边界防止单个任务错误扩散到整个服务。

最值得记住的工程原则是：

```text
按值抛出，按 const 引用捕获；
资源交给对象，清理依靠析构；
只在能够处理或转换错误的边界捕获异常。
```
