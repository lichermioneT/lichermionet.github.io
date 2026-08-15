---
title: C++智能指针详解：unique_ptr、shared_ptr、weak_ptr与RAII
date: 2026-08-15 12:00:00
categories:
  - C++
tags:
  - C++
  - 智能指针
  - RAII
  - unique_ptr
  - shared_ptr
  - weak_ptr
  - 内存管理
---

C++ 允许程序员直接管理内存，这带来了精确控制能力，也带来了内存泄漏、重复释放、悬空指针和异常安全等问题。智能指针的核心价值，不是把裸指针换一个名字，而是用对象生命周期表达资源所有权，并通过 RAII 自动完成释放。

本文从内存泄漏与 RAII 出发，系统讲解 `std::unique_ptr`、`std::shared_ptr`、`std::weak_ptr` 的使用方式、实现原理、线程安全、循环引用、自定义删除器和工程设计原则，并纠正常见示例中资源申请与释放不匹配等问题。

<!-- more -->

## 一、为什么需要智能指针

先看一段使用动态辅助数组的归并排序框架：

```cpp
void merge_sort(int* data, int size)
{
    int* temporary = new int[size];

    merge_sort_impl(data, 0, size - 1, temporary);

    // 其他可能抛异常的逻辑
    do_more_work();

    delete[] temporary;
}
```

这段代码至少有两个风险：

1. 程序员可能忘记执行 `delete[]`；
2. `merge_sort_impl` 或 `do_more_work` 抛异常时，控制流会跳过 `delete[]`。

即使在正常路径上写了释放代码，也不代表代码具有异常安全性。

使用标准容器后，资源会自动释放：

```cpp
#include <vector>

void merge_sort(int* data, int size)
{
    std::vector<int> temporary(size);

    merge_sort_impl(
        data,
        0,
        size - 1,
        temporary.data());

    do_more_work();
}
```

当函数正常返回或因异常退出时，`temporary` 的析构函数都会释放内部内存。

智能指针把同样的思想应用到需要动态创建的单个对象、数组或其他资源上。

## 二、什么是内存泄漏

内存泄漏是指程序已经不再需要某块动态内存，却没有释放它，或者失去了能够释放它的有效地址。

```cpp
void leak()
{
    int* value = new int(10);
    value = nullptr;  // 原地址丢失，无法再 delete
}
```

“泄漏”不代表物理内存消失，而是这块内存在进程生命周期内无法再被程序正常利用。

### 2.1 内存泄漏的危害

短时运行的小程序发生少量泄漏，进程退出后操作系统通常会回收其虚拟地址空间。但这不意味着泄漏无害。

对长期运行的服务器而言，持续泄漏可能导致：

- 进程内存不断增长；
- 缓存命中率下降；
- 频繁换页，响应变慢；
- 内存分配失败；
- 被操作系统 OOM 机制终止；
- 整台机器上的其他服务受到影响。

### 2.2 不只有堆内存会泄漏

资源泄漏还包括：

- 文件描述符没有关闭；
- Socket 没有关闭；
- 互斥锁没有解锁；
- 数据库连接没有归还；
- 线程没有 `join` 或 `detach`；
- 图形、设备或系统句柄没有释放。

因此，RAII 管理的是广义资源，而不只是 `new` 出来的内存。

### 2.3 常见内存错误

```cpp
// 1. 忘记释放
int* first = new int(1);

// 2. 重复释放
int* second = new int(2);
delete second;
delete second;

// 3. 释放后继续访问
int* third = new int(3);
delete third;
std::cout << *third << '\n';

// 4. 申请与释放方式不匹配
int* fourth = static_cast<int*>(std::malloc(sizeof(int)));
delete fourth;
```

这些行为都可能触发未定义行为。最后一个例子尤其重要：

| 申请方式 | 对应释放方式 |
| --- | --- |
| `new T` | `delete ptr` |
| `new T[n]` | `delete[] ptr` |
| `malloc/calloc/realloc` | `free(ptr)` |

默认智能指针删除器使用 `delete` 或 `delete[]`。如果资源来自 `malloc`、`fopen`、`open` 等接口，必须提供匹配的自定义释放策略。

## 三、如何发现内存问题

### 3.1 AddressSanitizer

GCC 或 Clang 可以使用 AddressSanitizer：

```bash
g++ -std=c++11 -g \
    -fsanitize=address \
    -fno-omit-frame-pointer \
    main.cpp -o main

./main
```

它擅长发现：

- 堆越界和栈越界；
- use-after-free；
- 重复释放；
- 部分内存泄漏。

### 3.2 LeakSanitizer

在支持的平台上可以单独启用泄漏检测：

```bash
g++ -std=c++11 -g \
    -fsanitize=leak \
    main.cpp -o main
```

### 3.3 Valgrind

Linux 上还可以使用：

```bash
valgrind \
    --leak-check=full \
    --show-leak-kinds=all \
    ./main
```

检测工具属于事后发现手段，RAII 与清晰的所有权设计属于事前预防手段。两者应该同时使用。

## 四、RAII：智能指针的基础

RAII 是 Resource Acquisition Is Initialization 的缩写，通常翻译为“资源获取即初始化”。

基本思想是：

1. 构造对象时获取资源；
2. 对象存活期间资源保持有效；
3. 对象析构时自动释放资源；
4. 禁止或明确规定资源管理对象的复制和移动语义。

```text
进入作用域 -> 构造 RAII 对象 -> 获得资源
                                  |
正常返回或异常退出                |
                                  v
离开作用域 <- 调用析构函数 <- 释放资源
```

### 4.1 一个最小的独占智能指针

下面的实现只用于理解原理，生产代码应使用标准库的 `std::unique_ptr`：

```cpp
template <class T>
class SimpleUniquePtr
{
public:
    explicit SimpleUniquePtr(T* pointer = nullptr) noexcept
        : pointer_(pointer)
    {
    }

    ~SimpleUniquePtr()
    {
        delete pointer_;
    }

    SimpleUniquePtr(const SimpleUniquePtr&) = delete;
    SimpleUniquePtr& operator=(const SimpleUniquePtr&) = delete;

    SimpleUniquePtr(SimpleUniquePtr&& other) noexcept
        : pointer_(other.pointer_)
    {
        other.pointer_ = nullptr;
    }

    SimpleUniquePtr& operator=(SimpleUniquePtr&& other) noexcept
    {
        if (this != &other)
        {
            delete pointer_;
            pointer_ = other.pointer_;
            other.pointer_ = nullptr;
        }

        return *this;
    }

    T& operator*() const
    {
        return *pointer_;
    }

    T* operator->() const noexcept
    {
        return pointer_;
    }

    T* get() const noexcept
    {
        return pointer_;
    }

private:
    T* pointer_;
};
```

一个智能指针通常具有两组能力：

- 所有权语义：何时释放资源、能否复制、能否移动；
- 指针式访问：`operator*`、`operator->`、`get()` 和布尔判断。

真正决定智能指针类型差异的是所有权模型，而不只是重载了 `*` 和 `->`。

## 五、三种标准智能指针概览

C++11 在 `<memory>` 中提供三种核心智能指针：

| 类型 | 所有权模型 | 能否复制 | 典型用途 |
| --- | --- | --- | --- |
| `std::unique_ptr<T>` | 独占所有权 | 不能，可移动 | 默认选择、工厂返回值、PImpl |
| `std::shared_ptr<T>` | 共享所有权 | 可以 | 多个对象确实共同决定资源寿命 |
| `std::weak_ptr<T>` | 非拥有观察 | 可以 | 打破循环引用、安全观察共享对象 |

优先级通常是：

```text
值对象或标准容器
    > unique_ptr
        > shared_ptr + weak_ptr
            > 手工 new/delete
```

不是所有动态对象都需要智能指针。如果对象可以直接作为局部变量、成员对象或容器元素，就优先使用值语义。

## 六、`std::unique_ptr`：独占所有权

`std::unique_ptr` 表示同一时间只有一个智能指针拥有资源。

```cpp
#include <memory>

class Task
{
public:
    void run();
};

int main()
{
    std::unique_ptr<Task> task(new Task);
    task->run();
}
```

离开作用域时，`task` 自动删除 `Task` 对象。

### 6.1 C++14 的 `std::make_unique`

```cpp
auto task = std::make_unique<Task>();
```

`std::make_unique` 是 C++14 才加入标准库的，不属于 C++11。

如果项目严格使用 C++11，需要写：

```cpp
std::unique_ptr<Task> task(new Task);
```

或自行提供简单工厂：

```cpp
#include <memory>
#include <utility>

template <class T, class... Args>
std::unique_ptr<T> make_unique_cpp11(Args&&... args)
{
    return std::unique_ptr<T>(
        new T(std::forward<Args>(args)...));
}
```

### 6.2 禁止复制

```cpp
std::unique_ptr<Task> first(new Task);
std::unique_ptr<Task> second(first);  // 编译失败
```

如果复制成功，就会出现两个独占指针同时认为自己应该删除同一个对象。

### 6.3 支持移动

`unique_ptr` 不是完全“不能传递”，而是必须显式移动所有权：

```cpp
std::unique_ptr<Task> first(new Task);
std::unique_ptr<Task> second(std::move(first));
```

移动后：

- `second` 获得资源；
- `first` 变为空指针；
- 对空 `unique_ptr` 析构是安全的。

```cpp
if (!first)
{
    std::cout << "ownership moved\n";
}
```

### 6.4 作为函数参数

按值接收表示函数取得所有权：

```cpp
void consume(std::unique_ptr<Task> task)
{
    task->run();
}

std::unique_ptr<Task> task(new Task);
consume(std::move(task));
```

按引用接收通常表示只操作智能指针本身：

```cpp
void reset_task(std::unique_ptr<Task>& task)
{
    task.reset(new Task);
}
```

如果函数只使用 `Task`，并不关心所有权，优先传 `Task&`、`const Task&`、`Task*` 或 `const Task*`：

```cpp
void inspect(const Task& task);

inspect(*task);
```

这样接口表达的是“借用对象”，而不是“参与所有权管理”。

### 6.5 作为函数返回值

```cpp
std::unique_ptr<Task> create_task()
{
    return std::unique_ptr<Task>(new Task);
}
```

`unique_ptr` 非常适合工厂函数返回值。返回时会发生移动或复制消除，不需要调用者手动释放。

### 6.6 管理动态数组

```cpp
std::unique_ptr<int[]> values(new int[100]);
values[0] = 10;
```

`std::unique_ptr<T[]>` 会使用 `delete[]`，并提供 `operator[]`。

如果长度需要动态变化，通常 `std::vector<T>` 更合适，因为它还保存元素数量并提供完整容器接口。

### 6.7 常用成员函数

```cpp
std::unique_ptr<Task> task(new Task);

Task* raw = task.get();       // 观察，不转移所有权
task.reset(new Task);         // 删除旧对象，接管新对象
task.reset();                 // 删除对象并置空
Task* released = task.release(); // 放弃所有权，不删除对象
```

`release()` 很容易造成泄漏：

```cpp
Task* raw = task.release();
delete raw;  // 现在释放责任转移给调用者
```

只有把资源交给另一个明确接管所有权的接口时，才应该使用 `release()`。

### 6.8 `get()` 不转移所有权

```cpp
legacy_api(task.get());
```

调用者必须确认 `legacy_api` 只借用指针。如果该接口会执行 `delete` 或把指针长期保存，就不能直接传 `get()`。

## 七、`unique_ptr` 的自定义删除器

默认删除器只适用于 `new` 或 `new[]` 对应的对象。其他资源必须使用匹配的删除器。

### 7.1 管理 `FILE*`

```cpp
#include <cstdio>
#include <memory>

struct FileCloser
{
    void operator()(std::FILE* file) const noexcept
    {
        if (file != nullptr)
        {
            std::fclose(file);
        }
    }
};

using FilePtr = std::unique_ptr<std::FILE, FileCloser>;

FilePtr open_file(const char* path)
{
    return FilePtr(std::fopen(path, "r"));
}
```

### 7.2 管理 `malloc` 内存

```cpp
#include <cstdlib>
#include <memory>

struct FreeDeleter
{
    void operator()(void* pointer) const noexcept
    {
        std::free(pointer);
    }
};

std::unique_ptr<void, FreeDeleter> buffer(
    std::malloc(1024));
```

绝不能把 `malloc` 返回的指针直接交给默认 `unique_ptr<int>`，因为默认删除器会调用 `delete`，与 `malloc` 不匹配。

### 7.3 删除器是类型的一部分

```cpp
std::unique_ptr<std::FILE, FileCloser>
```

对于 `unique_ptr`，删除器类型是智能指针类型的一部分。这有利于编译器内联无状态删除器，但不同删除器的 `unique_ptr` 类型也不同。

## 八、`std::shared_ptr`：共享所有权

当多个独立对象确实需要共同决定一个资源的生命周期时，可以使用 `std::shared_ptr`。

```cpp
#include <iostream>
#include <memory>

struct Task
{
    ~Task()
    {
        std::cout << "destroy task\n";
    }
};

int main()
{
    std::shared_ptr<Task> first =
        std::make_shared<Task>();

    std::shared_ptr<Task> second = first;

    std::cout << first.use_count() << '\n';
}
```

复制 `shared_ptr` 会增加共享拥有者数量，拥有者全部销毁或重置后，所管理对象才会被释放。

### 8.1 控制块

典型 `shared_ptr` 实现包含两部分：

```text
shared_ptr 对象
├── 指向所管理对象的指针
└── 指向控制块的指针

控制块
├── 强引用计数
├── 弱引用计数
├── 删除器
├── 分配器信息
└── 其他实现数据
```

强引用计数降为零时：

- 所管理对象被销毁；
- 如果仍有 `weak_ptr`，控制块可能继续存在；
- 弱引用也全部消失后，控制块才被释放。

### 8.2 推荐使用 `std::make_shared`

```cpp
auto task = std::make_shared<Task>(constructor_argument);
```

与直接写 `std::shared_ptr<Task>(new Task(...))` 相比，`make_shared` 通常有这些优点：

- 对象和控制块通常一次分配完成；
- 代码更简洁；
- 在复杂表达式中更容易保证异常安全；
- 通常具有更好的局部性。

但一次分配也有权衡：对象析构后，如果仍有长期存活的 `weak_ptr`，合并分配的整块存储通常要等控制块释放后才能归还。

### 8.3 `use_count()` 只适合观察和调试

```cpp
std::cout << pointer.use_count() << '\n';
```

不要依赖 `use_count() == 1` 实现并发同步或关键业务判断，因为计数可能在检查后立即变化。

所有权正确性应该来自程序结构，而不是反复读取计数进行猜测。

### 8.4 赋值与重置

```cpp
std::shared_ptr<Task> first = std::make_shared<Task>();
std::shared_ptr<Task> second = std::make_shared<Task>();

first = second;
```

赋值过程大致是：

1. `first` 放弃原来的共享所有权；
2. 原控制块强计数减一；
3. `first` 加入 `second` 的共享所有权；
4. 新控制块强计数加一；
5. 某个强计数降为零时销毁对应对象。

实际标准库实现还要处理异常安全、自赋值、线程安全和别名指针等细节，不应把教学版计数器直接用于生产环境。

## 九、不能用两个控制块管理同一个裸指针

下面的代码是严重错误：

```cpp
Task* raw = new Task;

std::shared_ptr<Task> first(raw);
std::shared_ptr<Task> second(raw);
```

`first` 和 `second` 各自创建独立控制块，都认为自己是唯一的初始拥有者，最终会对同一地址执行两次 `delete`。

正确方式是复制已经存在的 `shared_ptr`：

```cpp
std::shared_ptr<Task> first = std::make_shared<Task>();
std::shared_ptr<Task> second = first;
```

核心原则：

```text
同一个资源只能被一个 shared_ptr 控制块接管一次。
```

## 十、`enable_shared_from_this`

成员函数有时需要取得“与当前对象共享同一控制块”的 `shared_ptr`。

错误写法：

```cpp
std::shared_ptr<Session> Session::self()
{
    return std::shared_ptr<Session>(this);
}
```

这会为 `this` 创建新的控制块，导致重复释放。

正确方式是继承 `std::enable_shared_from_this`：

```cpp
#include <memory>

class Session
    : public std::enable_shared_from_this<Session>
{
public:
    std::shared_ptr<Session> self()
    {
        return shared_from_this();
    }
};

int main()
{
    std::shared_ptr<Session> session =
        std::make_shared<Session>();

    std::shared_ptr<Session> same = session->self();
}
```

使用条件：对象必须已经由某个 `shared_ptr` 正确管理。在尚未建立共享所有权时调用 `shared_from_this()` 会失败。

`weak_from_this()` 是 C++17 才加入的接口，不属于 C++11。

## 十一、`shared_ptr` 的自定义删除器

### 11.1 管理动态数组

C++11 中可以显式提供数组删除器：

```cpp
std::shared_ptr<int> values(
    new int[100],
    std::default_delete<int[]>());
```

注意：`std::shared_ptr<T[]>` 的数组特化是 C++17 才加入标准库的。C++11 中更推荐直接使用 `std::vector<T>`，除非确实需要共享一段数组。

### 11.2 管理 `malloc` 内存

```cpp
struct FreeDeleter
{
    void operator()(void* pointer) const noexcept
    {
        std::free(pointer);
    }
};

std::shared_ptr<void> buffer(
    std::malloc(1024),
    FreeDeleter());
```

### 11.3 管理文件

```cpp
std::shared_ptr<std::FILE> file(
    std::fopen("data.txt", "r"),
    [](std::FILE* pointer)
    {
        if (pointer != nullptr)
        {
            std::fclose(pointer);
        }
    });
```

对于 `shared_ptr`，删除器被类型擦除后存放在控制块中，因此删除器类型通常不会出现在 `shared_ptr<T>` 的类型参数里。

## 十二、`std::weak_ptr`：不拥有对象的观察者

`weak_ptr` 只能观察由 `shared_ptr` 管理的对象，不增加强引用计数。

```cpp
std::shared_ptr<Task> owner = std::make_shared<Task>();
std::weak_ptr<Task> observer = owner;
```

`observer` 不会延长 `Task` 的生命周期。

### 12.1 `expired()`

```cpp
if (observer.expired())
{
    std::cout << "object has been destroyed\n";
}
```

但不要先调用 `expired()` 再单独使用对象，因为在多线程环境中，对象可能在两次操作之间被销毁。

### 12.2 使用 `lock()` 安全访问

```cpp
if (std::shared_ptr<Task> task = observer.lock())
{
    task->run();
}
else
{
    std::cout << "task no longer exists\n";
}
```

`lock()` 会原子地尝试获得一个临时 `shared_ptr`：

- 对象仍存在时，返回非空 `shared_ptr`；
- 对象已经销毁时，返回空 `shared_ptr`；
- 临时 `shared_ptr` 存活期间，对象不会被其他拥有者提前销毁。

### 12.3 `weak_ptr` 不是普通裸指针

`weak_ptr` 不能直接使用 `*` 或 `->`，因为它不保证对象仍然存在。必须先通过 `lock()` 获得共享所有权。

## 十三、循环引用问题

### 13.1 为什么会泄漏

```cpp
#include <memory>

struct Node
{
    std::shared_ptr<Node> previous;
    std::shared_ptr<Node> next;
};

int main()
{
    std::shared_ptr<Node> first =
        std::make_shared<Node>();

    std::shared_ptr<Node> second =
        std::make_shared<Node>();

    first->next = second;
    second->previous = first;
}
```

作用域结束时，局部变量 `first` 和 `second` 被销毁，但两个节点仍通过成员 `shared_ptr` 互相拥有：

```text
first node --shared_ptr--> second node
     ^                         |
     |------shared_ptr---------|
```

两个强引用计数都无法降为零，因此对象不会析构。

### 13.2 用一侧弱引用打破环

双向链表常见设计是：

```cpp
struct Node
{
    int value = 0;
    std::weak_ptr<Node> previous;
    std::shared_ptr<Node> next;
};
```

所有权关系可以理解为：

- `next` 拥有后继节点，维持链表主生命周期；
- `previous` 只观察前驱节点，不参与生命周期；
- 外部头节点拥有整个链表入口。

不是简单把所有链接全部替换为 `weak_ptr`。如果前后链接都是弱引用且没有其他强拥有者，节点可能立即销毁。必须先设计清楚谁拥有谁，再决定哪条边使用弱引用。

### 13.3 父子对象的常见规则

树形结构中通常使用：

```text
父节点 --shared_ptr--> 子节点
子节点 --weak_ptr----> 父节点
```

父节点拥有子节点，子节点只需要访问父节点，不应该反过来决定父节点的生命周期。

## 十四、`shared_ptr` 的线程安全

“`shared_ptr` 是线程安全的”是一句容易误导的话，必须拆成三个层次理解。

### 14.1 不同智能指针对象共享同一控制块

如果多个线程操作的是不同的 `shared_ptr` 对象，即使它们共享同一控制块，引用计数的增加和减少是安全的：

```cpp
std::shared_ptr<Task> source = std::make_shared<Task>();

std::thread first([source]
{
    std::shared_ptr<Task> local = source;
});

std::thread second([source]
{
    std::shared_ptr<Task> local = source;
});
```

每个线程拥有自己的 `shared_ptr` 副本，标准库会正确同步控制块的所有权计数。

### 14.2 同一个 `shared_ptr` 对象

如果多个线程同时对同一个 `shared_ptr` 变量执行 `reset`、赋值等非只读操作，会产生数据竞争：

```cpp
std::shared_ptr<Task> global_task;

// 一个线程 global_task.reset(...)
// 另一个线程同时 global_task = ...
```

C++11 提供针对 `shared_ptr` 的原子自由函数，例如 `std::atomic_load` 和 `std::atomic_store`。`std::atomic<std::shared_ptr<T>>` 是 C++20 的形式。

也可以使用互斥锁保护同一个共享指针变量。

### 14.3 所管理的对象

控制块线程安全不代表 `Task` 对象本身线程安全：

```cpp
struct Counter
{
    int value = 0;
};

std::shared_ptr<Counter> counter =
    std::make_shared<Counter>();

// 两个线程同时执行 ++counter->value 仍然是数据竞争
```

对象内部共享数据仍然需要互斥锁、原子类型或其他同步方案。

### 14.4 一句话总结

```text
shared_ptr 保护的是共享所有权控制块，
不会自动保护同一个 shared_ptr 变量，
也不会自动保护它所指向的业务对象。
```

## 十五、类型转换

不要从 `shared_ptr` 中取出裸指针后再手工转换并创建新控制块。标准库提供了保持控制块共享关系的转换函数：

```cpp
std::shared_ptr<Base> base =
    std::make_shared<Derived>();

std::shared_ptr<Derived> derived =
    std::dynamic_pointer_cast<Derived>(base);
```

常见函数包括：

- `std::static_pointer_cast`；
- `std::dynamic_pointer_cast`；
- `std::const_pointer_cast`。

`std::reinterpret_pointer_cast` 是 C++17 才加入的，不属于 C++11。

## 十六、别名构造与“所拥有对象”和“保存指针”

`shared_ptr` 可以拥有一个对象，却保存指向其子对象的指针：

```cpp
struct Packet
{
    int header;
    int body;
};

std::shared_ptr<Packet> packet =
    std::make_shared<Packet>();

std::shared_ptr<int> body(packet, &packet->body);
```

`body` 解引用时得到 `Packet::body`，但它与 `packet` 共享控制块，因此整个 `Packet` 会一直存活到最后一个相关拥有者消失。

这叫别名构造。它也说明 `shared_ptr` 内部“用于访问的指针”和“控制块所管理的对象”不一定是同一个地址。

## 十七、`std::auto_ptr` 为什么被淘汰

C++98 的 `std::auto_ptr` 试图通过复制操作转移所有权：

```cpp
std::auto_ptr<Task> first(new Task);
std::auto_ptr<Task> second(first);

// first 已经失去对象
```

这种“复制后源对象突然变空”的语义违背普通复制直觉，也无法正常满足标准容器对元素类型的要求。

版本演进：

- C++98：提供 `auto_ptr`；
- Boost：发展出 `scoped_ptr`、`shared_ptr`、`weak_ptr` 等方案；
- C++11：引入移动语义以及 `unique_ptr`、`shared_ptr`、`weak_ptr`，同时弃用 `auto_ptr`；
- C++17：移除 `auto_ptr`。

现代代码应使用 `unique_ptr` 替代 `auto_ptr`。

## 十八、如何选择智能指针

### 18.1 默认选择 `unique_ptr`

如果一个资源有明确唯一拥有者，使用 `unique_ptr`：

```cpp
class Server
{
private:
    std::unique_ptr<Reactor> reactor_;
};
```

优点是所有权清晰、对象体积通常较小、没有共享计数维护成本。

### 18.2 确实需要共同拥有时才用 `shared_ptr`

例如，一个异步任务必须保证会话在任务执行期间仍然存在：

```cpp
void Session::start()
{
    std::shared_ptr<Session> self = shared_from_this();

    executor.post([self]
    {
        self->process();
    });
}
```

这里回调拥有 `self`，从而保证异步执行前对象不会被销毁。

但也要警惕回调被对象长期保存后形成环：

```text
Session -> callback -> shared_ptr<Session>
```

这种情况可以让回调捕获 `weak_ptr`，执行时调用 `lock()`。

### 18.3 只观察时使用 `weak_ptr`

缓存、观察者、父指针和异步回调经常只需要判断对象是否仍然存在，不应该延长对象寿命。

### 18.4 不需要所有权时不要传智能指针

```cpp
void draw(const Image& image);       // 借用且不能为空
void draw(const Image* image);       // 借用且允许为空
void take(std::unique_ptr<Image>);    // 转移所有权
void share(std::shared_ptr<Image>);   // 共享所有权
```

函数签名本身应该直接表达所有权意图。

## 十九、智能指针与容器

### 19.1 多态对象集合

```cpp
std::vector<std::unique_ptr<Base>> objects;

objects.push_back(
    std::unique_ptr<Base>(new Derived));
```

容器独占所有元素，非常适合对象池之外的普通多态集合。

### 19.2 `unique_ptr` 放入容器需要移动

```cpp
std::unique_ptr<Task> task(new Task);
tasks.push_back(std::move(task));
```

移动后原变量为空。

### 19.3 能直接存值就不要存指针

```cpp
std::vector<Task> tasks;
```

如果不需要多态、稳定地址或特殊生命周期，值容器通常更简单，内存局部性也更好。

## 二十、智能指针与 PImpl

`unique_ptr` 常用于 PImpl 模式，把实现细节放到源文件中：

```cpp
// Widget.h
class Widget
{
public:
    Widget();
    ~Widget();

private:
    class Impl;
    std::unique_ptr<Impl> impl_;
};
```

```cpp
// Widget.cpp
class Widget::Impl
{
public:
    void work();
};

Widget::Widget()
    : impl_(new Impl)
{
}

Widget::~Widget() = default;
```

析构函数通常需要在 `Impl` 已经是完整类型的源文件中定义。

## 二十一、RAII 不等于智能指针

智能指针只是 RAII 的一种应用。

### 21.1 互斥锁守卫

```cpp
#include <mutex>

std::mutex mutex;
int count = 0;

void increment()
{
    std::lock_guard<std::mutex> guard(mutex);
    ++count;
}
```

无论函数正常返回还是抛异常，`guard` 都会自动解锁。

### 21.2 文件描述符封装

```cpp
#include <unistd.h>

class FileDescriptor
{
public:
    explicit FileDescriptor(int descriptor = -1) noexcept
        : descriptor_(descriptor)
    {
    }

    ~FileDescriptor() noexcept
    {
        if (descriptor_ >= 0)
        {
            ::close(descriptor_);
        }
    }

    FileDescriptor(const FileDescriptor&) = delete;
    FileDescriptor& operator=(const FileDescriptor&) = delete;

    FileDescriptor(FileDescriptor&& other) noexcept
        : descriptor_(other.descriptor_)
    {
        other.descriptor_ = -1;
    }

private:
    int descriptor_;
};
```

### 21.3 范围守卫思想

任何“离开作用域时必须执行”的操作都可以封装为守卫对象，例如：

- 回滚数据库事务；
- 恢复临时修改的配置；
- 归还连接池对象；
- 删除临时文件；
- 注销回调或事件。

## 二十二、综合示例

下面的程序综合演示：

- `unique_ptr` 的独占所有权与移动；
- `shared_ptr` 的共享所有权；
- `weak_ptr` 打破双向关系中的循环引用；
- `weak_ptr::lock()`；
- RAII 自动析构；
- 多线程共享对象时对业务数据使用原子类型。

```cpp
#include <atomic>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <utility>
#include <vector>

class Job
{
public:
    explicit Job(std::string name)
        : name_(std::move(name))
    {
        std::cout << "create job: " << name_ << '\n';
    }

    ~Job()
    {
        std::cout << "destroy job: " << name_ << '\n';
    }

    void run() const
    {
        std::cout << "run job: " << name_ << '\n';
    }

private:
    std::string name_;
};

void consume_job(std::unique_ptr<Job> job)
{
    job->run();
}

class Session
{
public:
    explicit Session(std::string name)
        : name_(std::move(name)),
          requests_(0)
    {
        std::cout << "open session: " << name_ << '\n';
    }

    ~Session()
    {
        std::cout << "close session: " << name_ << '\n';
    }

    void set_peer(const std::shared_ptr<Session>& peer)
    {
        peer_ = peer;
    }

    void visit()
    {
        requests_.fetch_add(1, std::memory_order_relaxed);
    }

    int request_count() const
    {
        return requests_.load(std::memory_order_relaxed);
    }

    void print_peer() const
    {
        if (std::shared_ptr<Session> peer = peer_.lock())
        {
            std::cout << name_
                      << " -> "
                      << peer->name_
                      << '\n';
        }
        else
        {
            std::cout << name_ << " has no peer\n";
        }
    }

private:
    std::string name_;
    std::weak_ptr<Session> peer_;
    std::atomic<int> requests_;
};

int main()
{
    std::unique_ptr<Job> job(new Job("compile"));
    consume_job(std::move(job));

    if (!job)
    {
        std::cout << "job ownership moved\n";
    }

    std::shared_ptr<Session> first =
        std::make_shared<Session>("client");
    std::shared_ptr<Session> second =
        std::make_shared<Session>("server");

    first->set_peer(second);
    second->set_peer(first);

    first->print_peer();
    second->print_peer();

    const int visits_per_thread = 50000;

    std::thread left([first, visits_per_thread]
    {
        for (int i = 0; i < visits_per_thread; ++i)
        {
            first->visit();
        }
    });

    std::thread right([first, visits_per_thread]
    {
        for (int i = 0; i < visits_per_thread; ++i)
        {
            first->visit();
        }
    });

    left.join();
    right.join();

    std::cout << "requests: "
              << first->request_count()
              << '\n';

    std::weak_ptr<Session> observer = second;
    second.reset();

    if (observer.expired())
    {
        std::cout << "server session expired\n";
    }

    return 0;
}
```

使用 C++11 编译：

```bash
g++ -std=c++11 \
    -Wall -Wextra -Wpedantic \
    main.cpp -pthread -o main
```

预期输出类似：

```text
create job: compile
run job: compile
destroy job: compile
job ownership moved
open session: client
open session: server
client -> server
server -> client
requests: 100000
close session: server
server session expired
close session: client
```

两个 `Session` 通过 `weak_ptr` 互相观察，因此不会形成强引用环。`second.reset()` 后，如果没有其他强拥有者，`server` 会立即析构。

## 二十三、常见错误

### 23.1 把 `malloc` 指针交给默认删除器

```cpp
std::unique_ptr<int> pointer(
    static_cast<int*>(std::malloc(sizeof(int))));
```

问题：析构时调用 `delete`，与 `malloc` 不匹配。

修正：使用调用 `free` 的自定义删除器。

### 23.2 用普通 `unique_ptr<T>` 管理数组

```cpp
std::unique_ptr<int> values(new int[10]);
```

问题：默认调用 `delete`，而数组需要 `delete[]`。

修正：

```cpp
std::unique_ptr<int[]> values(new int[10]);
```

### 23.3 尝试复制 `unique_ptr`

问题：独占所有权不能复制。

修正：确实要转移所有权时使用 `std::move`。

### 23.4 移动后继续解引用

```cpp
std::unique_ptr<Task> target = std::move(source);
source->run();
```

问题：标准 `unique_ptr` 移动后 `source` 为空，解引用空指针产生未定义行为。

修正：检查状态，或直接不再使用源指针访问对象。

### 23.5 对同一个裸指针构造多个 `shared_ptr`

问题：生成多个控制块，最终重复释放。

修正：只接管一次，后续复制现有 `shared_ptr`。

### 23.6 在成员函数中返回 `shared_ptr(this)`

问题：创建独立控制块，可能重复释放。

修正：继承 `enable_shared_from_this` 并调用 `shared_from_this()`。

### 23.7 双向关系全部使用 `shared_ptr`

问题：形成强引用环，引用计数无法归零。

修正：根据所有权方向把回边改成 `weak_ptr`。

### 23.8 认为 `shared_ptr` 自动保护对象内容

问题：引用计数安全不代表业务对象的读写安全。

修正：对象数据仍需使用互斥锁、原子变量或单线程所有权模型。

### 23.9 用 `use_count()` 做同步判断

问题：并发环境下计数随时可能改变。

修正：只把它用于诊断，不用作并发协议。

### 23.10 先 `expired()` 再访问

问题：检查与使用之间存在竞态窗口。

修正：直接调用 `lock()`，并在返回的 `shared_ptr` 生命周期内访问。

### 23.11 随处传递 `shared_ptr`

问题：所有权不清晰、增加计数维护、容易把临时借用变成长期拥有。

修正：只有需要共享寿命时才传 `shared_ptr`；普通借用传引用或裸指针。

### 23.12 滥用 `release()`

问题：智能指针放弃所有权后不会释放资源，很容易泄漏。

修正：仅在明确把资源交给另一个所有者时使用，并记录接管契约。

### 23.13 误认为智能指针可以修复所有悬空访问

智能指针只能管理其所有权范围。通过 `get()` 保存的裸指针、对象内部指针、引用和迭代器仍可能在对象销毁后悬空。

## 二十四、面试常见问题

### 24.1 智能指针为什么能防止内存泄漏

智能指针把资源绑定到对象生命周期。局部智能指针离开作用域时析构，无论正常返回还是异常退出，都会执行相应删除器。

### 24.2 `unique_ptr` 和 `shared_ptr` 的区别

`unique_ptr` 表示独占所有权，不能复制但能移动；`shared_ptr` 通过控制块和引用计数表达共享所有权，可以复制，但有额外空间、原子计数和间接访问成本。

### 24.3 `weak_ptr` 有什么作用

它不增加强引用计数，用于观察共享对象、打破循环引用，并通过 `lock()` 安全尝试获得临时共享所有权。

### 24.4 `shared_ptr` 引用计数为零后发生什么

强计数为零时销毁所管理对象；如果还有弱引用，控制块继续存在；弱引用也全部消失后释放控制块。

### 24.5 `make_shared` 有什么优点

通常把对象和控制块合并分配，减少分配次数、增强局部性、代码更简洁，并避免复杂表达式中的部分异常安全问题。

### 24.6 `make_shared` 有什么权衡

对象与控制块合并分配时，长期存活的 `weak_ptr` 可能让整块存储延迟释放；此外，自定义删除方式或特殊分配策略可能需要直接构造 `shared_ptr`。

### 24.7 `shared_ptr` 是否线程安全

不同 `shared_ptr` 对象共享同一控制块时，引用计数管理是安全的；同一个 `shared_ptr` 变量的并发修改以及所管理对象的并发读写，不会因此自动安全。

### 24.8 为什么会出现循环引用

两个或多个对象通过 `shared_ptr` 形成强所有权闭环，外部指针销毁后环内强计数仍不为零，对象无法析构。

### 24.9 为什么不能 `shared_ptr(this)`

它通常会创建新的控制块，与外部已有控制块无关，最后对同一对象重复释放。应使用 `enable_shared_from_this`。

### 24.10 自定义删除器有什么用途

用于管理不是由普通 `new T` 创建的资源，例如数组、`malloc` 内存、`FILE*`、Socket、操作系统句柄和第三方库对象。

### 24.11 `get()` 和 `release()` 有什么区别

`get()` 只返回裸指针，智能指针仍保留所有权；`release()` 仅属于 `unique_ptr`，它返回裸指针并放弃所有权，之后不会自动删除资源。

### 24.12 `auto_ptr` 为什么被废弃

它通过复制操作转移所有权，复制后源对象变空，违反正常复制语义，也不适合标准容器。C++11 用移动语义明确表达所有权转移。

### 24.13 `unique_ptr` 的大小一定等于裸指针吗

不一定。无状态删除器常能通过空基类优化使其接近裸指针大小；有状态删除器或函数指针删除器会增加对象大小，具体由实现和删除器类型决定。

### 24.14 引用计数为什么不能解决所有生命周期问题

引用计数无法自动识别强引用环，也不能表达复杂的逻辑所有权关系。必须配合 `weak_ptr` 和清晰的所有权图设计。

## 二十五、实践建议

1. 首先考虑值对象和标准容器；
2. 需要动态多态或动态寿命时，默认选择 `unique_ptr`；
3. 只有多个独立实体确实共同拥有资源时才用 `shared_ptr`；
4. 观察关系、父指针和可能形成回环的边使用 `weak_ptr`；
5. 优先使用 `make_shared`，C++14 以后优先使用 `make_unique`；
6. C++11 项目不要误用尚未加入标准的 `make_unique`；
7. 资源申请方式必须和删除器严格匹配；
8. 不要从同一个裸指针创建多个控制块；
9. 不要使用 `shared_ptr(this)`；
10. `use_count()` 只用于观察，不用于同步；
11. 智能指针保证生命周期，不保证对象内容线程安全；
12. API 参数要区分转移、共享、借用和观察四种语义；
13. 避免无目的地调用 `get()` 和 `release()`；
14. 使用 AddressSanitizer、LeakSanitizer 或 Valgrind 验证关键路径；
15. 对拥有关系画图，检查是否存在强引用闭环。

## 二十六、总结

智能指针的本质是所有权，而不仅是一个能够自动 `delete` 的包装类：

- `unique_ptr` 表达唯一拥有者，所有权通过移动显式转移；
- `shared_ptr` 通过控制块表达多个拥有者共同管理寿命；
- `weak_ptr` 不拥有对象，用于安全观察和打破强引用环；
- 自定义删除器让智能指针能够管理内存之外的资源；
- RAII 保证正常返回和异常退出都执行资源释放；
- 线程安全必须区分控制块、智能指针变量和所管理对象；
- 清晰的所有权关系比盲目使用 `shared_ptr` 更重要。

可以把核心选择原则概括为：

```text
能直接存对象，就不要动态分配；
需要动态分配，优先 unique_ptr；
确实共同拥有，才使用 shared_ptr；
只需观察或需要破环，使用 weak_ptr。
```
