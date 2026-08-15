---
title: C++特殊类设计详解：堆对象、栈对象、禁止拷贝、final与单例模式
date: 2026-08-15 13:00:00
categories:
  - C++
tags:
  - C++
  - 类和对象
  - 特殊类设计
  - 单例模式
  - final
  - C++11
---

所谓“特殊类”，通常是指对对象创建位置、复制能力、继承关系或实例数量施加约束的类。例如：只能通过工厂创建、禁止复制、禁止继承，或者整个进程只允许存在一个实例。

这些设计题看起来是在考构造函数、`operator new`、`= delete`、`final` 和静态成员，实质上考查的是对象生命周期、访问控制、所有权、并发安全与接口约束。本文按照常见面试题逐一分析，并说明哪些限制可以严格保证，哪些只能做到接口层面的约束。

<!-- more -->

## 一、特殊类设计到底在限制什么

设计一个受限类之前，需要先明确约束目标：

| 需求 | 需要控制的语言机制 |
| --- | --- |
| 只能通过工厂创建 | 构造函数访问权限 |
| 禁止普通 `new` | 类专属 `operator new` |
| 禁止复制 | 拷贝构造与拷贝赋值 |
| 禁止移动 | 移动构造与移动赋值 |
| 禁止继承 | `final` 或构造函数访问权限 |
| 只能有一个实例 | 私有构造、统一访问点、线程安全初始化 |
| 自动管理资源 | RAII、析构函数、移动语义 |

类的限制最好直接体现在编译期接口中。能够让错误代码编译失败，就不要等到运行期再检查。

## 二、对象通常可以在哪里创建

讨论“堆上对象”和“栈上对象”之前，先区分对象的存储期。

### 2.1 自动存储期

```cpp
void function()
{
    Widget object;
}
```

`object` 通常位于线程栈中，离开作用域时自动析构。标准更准确的说法是“自动存储期对象”，因为 C++ 语言规范关心的是存储期，而不是必须由某种物理栈实现。

### 2.2 动态存储期

```cpp
Widget* object = new Widget;
delete object;
```

对象由 `new` 表达式创建，需要由 `delete` 或 RAII 所有者负责释放。

### 2.3 静态存储期

```cpp
Widget global_object;

void function()
{
    static Widget local_static;
}
```

这些对象通常贯穿程序的大部分生命周期。

### 2.4 子对象

```cpp
struct Server
{
    Widget widget;
};
```

`widget` 是 `Server` 的成员子对象。它最终位于哪里，取决于外层 `Server` 对象位于哪里。

这说明“某个类型的对象只能在物理栈上”很难由类自身绝对保证：对象还可能是全局对象、静态对象、成员子对象或通过自定义内存创建的对象。

## 三、设计只能在堆上创建的类

### 3.1 基本思路

如果构造函数是公有的，调用者就可以直接创建自动对象：

```cpp
HeapOnly object;
```

因此可以把构造函数设为私有，再提供静态工厂函数，在类内部执行 `new`。

```cpp
#include <memory>

class HeapOnly
{
public:
    static std::unique_ptr<HeapOnly> create()
    {
        return std::unique_ptr<HeapOnly>(
            new HeapOnly());
    }

    ~HeapOnly() = default;

    HeapOnly(const HeapOnly&) = delete;
    HeapOnly& operator=(const HeapOnly&) = delete;

private:
    HeapOnly() = default;
};
```

调用方式：

```cpp
std::unique_ptr<HeapOnly> object = HeapOnly::create();
```

下面的代码无法编译：

```cpp
HeapOnly object;
```

因为类外无法访问私有构造函数。

### 3.2 为什么工厂返回 `unique_ptr`

讲解原理时常见的写法是：

```cpp
static HeapOnly* create()
{
    return new HeapOnly;
}
```

它确实能创建动态对象，但把释放责任交给了调用者：

```cpp
HeapOnly* object = HeapOnly::create();
delete object;
```

只要调用者忘记 `delete`，就会泄漏。返回 `std::unique_ptr` 可以直接表达独占所有权，并在异常或提前返回时自动释放。

### 3.3 析构函数为什么通常要公有

`std::unique_ptr<HeapOnly>` 的默认删除器需要在类外调用：

```cpp
delete pointer;
```

如果析构函数也是私有的，默认删除器将没有访问权限。

最简单的设计是保持析构函数公有，但保持构造函数私有。这样调用者不能自行创建对象，却可以通过标准 RAII 类型正常销毁对象。

### 3.4 私有析构函数与自定义删除器

如果希望销毁动作也只能由类控制，可以提供嵌套删除器：

```cpp
#include <memory>

class HeapOnly
{
public:
    struct Deleter
    {
        void operator()(HeapOnly* pointer) const noexcept
        {
            delete pointer;
        }
    };

    using Pointer = std::unique_ptr<HeapOnly, Deleter>;

    static Pointer create()
    {
        return Pointer(new HeapOnly);
    }

    HeapOnly(const HeapOnly&) = delete;
    HeapOnly& operator=(const HeapOnly&) = delete;

private:
    HeapOnly() = default;
    ~HeapOnly() = default;
};
```

这时必须通过 `HeapOnly::Pointer` 持有对象。

### 3.5 为什么不能直接使用 `make_unique`

即使项目使用 C++14，下面的实现通常也不能访问私有构造函数：

```cpp
static std::unique_ptr<HeapOnly> create()
{
    return std::make_unique<HeapOnly>();
}
```

因为真正执行 `new HeapOnly` 的代码位于标准库模板 `make_unique` 内部，模板本身不是 `HeapOnly` 的成员或友元。

类成员中直接写 `new HeapOnly` 可以通过访问检查：

```cpp
return std::unique_ptr<HeapOnly>(new HeapOnly);
```

### 3.6 还需要禁止复制吗

需要。只把构造函数设为私有还不够：

```cpp
std::unique_ptr<HeapOnly> heap = HeapOnly::create();
HeapOnly local(*heap);  // 如果拷贝构造公有，仍可在局部创建副本
```

因此应删除拷贝构造和拷贝赋值。是否允许移动，要根据业务语义决定。

### 3.7 这种需求是否合理

“只能堆上创建”通常应该有明确原因，例如：

- 对象必须由异步框架共享生命周期；
- 对象尺寸巨大，不希望作为局部对象；
- 必须由工厂执行校验或注册；
- 对象需要统一放入对象池；
- 只能通过某种句柄对外暴露。

如果只是因为“堆更高级”或“对象很重要”，通常没有必要。自动对象更简单，也更容易保证资源安全。

## 四、设计只能在栈上创建的类

这道题的常见答案是屏蔽类专属 `operator new`，但需要准确理解它能保证到什么程度。

### 4.1 删除普通 `operator new`

```cpp
#include <cstddef>

class StackOnly
{
public:
    StackOnly() = default;

    StackOnly(const StackOnly&) = default;
    StackOnly& operator=(const StackOnly&) = default;

private:
    static void* operator new(std::size_t) = delete;
    static void* operator new[](std::size_t) = delete;
};
```

允许：

```cpp
StackOnly object;
```

禁止：

```cpp
StackOnly* object = new StackOnly;
```

类作用域中找到了已删除的分配函数，因此普通 `new StackOnly` 编译失败。

### 4.2 是否需要删除 `operator delete`

限制普通 `new` 的关键是删除 `operator new`。为了让意图更完整，也可以显式删除配对的类专属释放函数：

```cpp
static void operator delete(void*) = delete;
static void operator delete[](void*) = delete;
```

但这可能影响某些析构或继承场景，设计前应确认用途。面试时最重要的是说明：`new` 表达式包含“分配内存”和“在内存上构造对象”两个阶段，类专属 `operator new` 只控制分配阶段。

### 4.3 定位 `new`

定位 `new` 在调用者提供的地址上构造对象：

```cpp
void* memory = obtain_memory();
StackOnly* object = new (memory) StackOnly;
```

如果希望限制这种语法，可以声明相应类专属重载为删除：

```cpp
static void* operator new(
    std::size_t,
    void*) = delete;
```

不过，这仍然不能形成绝对保证。

### 4.4 为什么无法绝对保证“物理栈上”

调用者可以显式使用全局分配函数：

```cpp
StackOnly* object = ::new StackOnly;
```

`::new` 会跳过类专属 `operator new` 的查找。

对象还可能作为成员存在于动态对象内部：

```cpp
struct Wrapper
{
    StackOnly member;
};

Wrapper* wrapper = new Wrapper;
```

此时 `StackOnly` 子对象事实上跟随 `Wrapper` 位于动态存储中，却没有直接调用 `StackOnly::operator new`。

所以这类设计更准确的描述是：

```text
禁止调用者直接使用普通 new T 创建该类型的完整对象。
```

它不能从语言层面证明对象一定位于物理栈上。

### 4.5 私有构造 + 返回值工厂并不等于栈专用

另一种常见写法是：

```cpp
class StackOnly
{
public:
    static StackOnly create()
    {
        return StackOnly();
    }

private:
    StackOnly() = default;
};
```

它限制的是“只能通过工厂构造”，并不能保证返回对象位于栈中。返回值可以成为静态对象、成员子对象，甚至被放入动态分配的外层对象。

因此应根据真实需求命名为 `FactoryCreated` 或“受控构造类”，而不是把它当成严格栈专用方案。

### 4.6 更合理的工程替代

如果真正目标是短生命周期或作用域退出自动清理，直接使用 RAII 即可，不必强行禁止 `new`。

如果目标是防止对象逃逸，可以：

- 不公开具体类型；
- 只在函数内部创建；
- 向回调传短期引用；
- 使用作用域守卫；
- 通过代码审查和接口结构限制持久化。

## 五、设计不能被拷贝的类

复制对象主要涉及：

- 拷贝构造函数；
- 拷贝赋值运算符。

### 5.1 C++98 写法

```cpp
class NonCopyable
{
private:
    NonCopyable(const NonCopyable&);
    NonCopyable& operator=(const NonCopyable&);
};
```

把函数声明为私有可以阻止类外调用，只声明不定义还可以防止成员函数或友元真正完成复制。

缺点是错误信息不够直接：某些错误只有在链接阶段才暴露。

### 5.2 C++11 的 `= delete`

```cpp
class NonCopyable
{
public:
    NonCopyable() = default;

    NonCopyable(const NonCopyable&) = delete;
    NonCopyable& operator=(const NonCopyable&) = delete;
};
```

`= delete` 的优点是：

- 意图清晰；
- 编译期直接报错；
- 无论类外、成员还是友元都不能调用；
- 可以删除普通成员函数，不限于特殊成员函数。

### 5.3 `delete` 不是释放内存的那个 `delete`

这两种写法含义不同：

```cpp
delete pointer;  // delete 表达式，释放动态对象

Function(const Function&) = delete;  // 删除函数，不允许调用
```

`= delete` 表示该函数参与名字查找和重载决议，但一旦被选中，程序就是病式的，编译失败。

### 5.4 禁止复制后能否移动

如果只写：

```cpp
class Resource
{
public:
    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;
};
```

用户声明了拷贝操作后，编译器通常不会再隐式生成移动操作。因此这个类往往既不可复制，也不可移动。

如果需要“不可复制但可移动”，必须显式声明：

```cpp
class Resource
{
public:
    Resource() = default;

    Resource(const Resource&) = delete;
    Resource& operator=(const Resource&) = delete;

    Resource(Resource&&) noexcept = default;
    Resource& operator=(Resource&&) noexcept = default;
};
```

不过，只有所有成员都支持移动时，默认移动函数才能正常生成。

### 5.5 哪些类通常禁止复制

- 互斥锁；
- 线程对象；
- Socket、文件描述符等独占句柄；
- `unique_ptr` 风格所有者；
- 单例对象；
- 与操作系统注册状态绑定的对象；
- 复制成本极高且语义不清的对象。

### 5.6 使用公共基类复用限制

```cpp
class NonCopyable
{
protected:
    NonCopyable() = default;
    ~NonCopyable() = default;

    NonCopyable(const NonCopyable&) = delete;
    NonCopyable& operator=(const NonCopyable&) = delete;
};

class Socket : private NonCopyable
{
public:
    Socket() = default;
};
```

现代 C++ 中，直接在具体类里写两个 `= delete` 往往更清楚。公共基类适合大量类型都遵循相同约束的旧代码或框架代码。

## 六、设计不能被移动的类

有些对象不仅不能复制，也不能改变地址或转移内部状态，例如：

- 内部保存指向自身成员的地址；
- 已向外部系统注册对象地址；
- 包含不可移动成员；
- 代表进程级固定设施。

```cpp
class Immovable
{
public:
    Immovable() = default;

    Immovable(const Immovable&) = delete;
    Immovable& operator=(const Immovable&) = delete;

    Immovable(Immovable&&) = delete;
    Immovable& operator=(Immovable&&) = delete;
};
```

禁止移动会限制容器使用。例如，许多容器操作要求元素可移动或可复制。必要时可以在容器中存放 `std::unique_ptr<Immovable>`。

## 七、设计不能被继承的类

### 7.1 C++11 的 `final`

```cpp
class ProtocolParser final
{
public:
    void parse();
};
```

下面的代码会编译失败：

```cpp
class CustomParser : public ProtocolParser
{
};
```

`final` 直接表达“该类型不能作为基类”，是现代 C++ 的标准写法。

### 7.2 `final` 也能修饰虚函数

```cpp
class Base
{
public:
    virtual void run();
};

class Derived : public Base
{
public:
    void run() final;
};
```

`Derived` 仍然可以被继承，但更下层的派生类不能继续重写 `run()`。

### 7.3 C++98 的私有构造技巧

没有 `final` 时，可以通过私有构造函数阻止派生类构造基类部分：

```cpp
class NonInheritable
{
public:
    static NonInheritable create()
    {
        return NonInheritable();
    }

private:
    NonInheritable() = default;
};
```

派生类构造函数无法访问基类私有构造函数，因此通常无法生成有效派生对象。

这种方案同时改变了对象创建方式，表达不如 `final` 直接。现代代码优先使用 `final`。

### 7.4 为什么要禁止继承

合理原因包括：

- 类没有为继承设计，缺少受保护扩展点；
- 必须维护严格不变量；
- 对象布局或 ABI 需要稳定；
- 安全模型不允许通过重写绕过检查；
- 单例不允许派生类形成额外实例；
- 值类型不希望引入切片和多态语义。

但不要仅为了“可能优化”就给所有类加 `final`。设计意图应当优先于微小且不确定的优化收益。

## 八、单例模式的目标

单例模式要求：

1. 类只能创建一个实例；
2. 实例由类自身管理；
3. 提供全局访问点。

常见候选包括：

- 进程级配置快照；
- 全局注册表；
- 进程级硬件或系统资源入口；
- 必须唯一的运行时管理器。

不过，单例本质上是一种受控的全局状态，容易产生隐藏依赖、测试困难和初始化顺序问题。能通过依赖注入传递普通对象时，不必强行使用单例。

## 九、饿汉式单例

饿汉式在程序启动阶段初始化静态实例。

```cpp
class EagerSingleton final
{
public:
    static EagerSingleton& instance() noexcept
    {
        return instance_;
    }

    EagerSingleton(const EagerSingleton&) = delete;
    EagerSingleton& operator=(const EagerSingleton&) = delete;

private:
    EagerSingleton() = default;

    static EagerSingleton instance_;
};

EagerSingleton EagerSingleton::instance_;
```

### 9.1 优点

- 实现简单；
- 首次调用没有初始化锁竞争；
- 实例在正常使用前已经构造完成。

### 9.2 缺点

- 即使程序从未使用，也可能执行构造；
- 构造昂贵时会增加启动时间；
- 不同翻译单元中的静态对象初始化顺序不确定；
- 不同静态对象在析构阶段也可能产生顺序依赖。

### 9.3 静态初始化顺序问题

如果一个源文件中的全局对象在构造时访问另一个源文件的单例静态成员，而后者尚未完成动态初始化，就可能出现“静态初始化顺序灾难”。

这也是函数局部静态单例更常用的原因之一。

## 十、懒汉式单例与错误的双重检查锁

懒汉式直到第一次访问时才创建实例，适合构造昂贵或可能永远不会使用的对象。

### 10.1 朴素加锁

```cpp
class Singleton
{
public:
    static Singleton* instance()
    {
        std::lock_guard<std::mutex> guard(mutex_);

        if (instance_ == nullptr)
        {
            instance_ = new Singleton;
        }

        return instance_;
    }

private:
    static Singleton* instance_;
    static std::mutex mutex_;
};
```

每次访问都加锁，容易理解，但热路径上有不必要的同步开销，还需要正确处理释放和静态对象顺序。

### 10.2 普通指针双重检查为什么有问题

常见旧代码如下：

```cpp
if (instance_ == nullptr)
{
    mutex_.lock();

    if (instance_ == nullptr)
    {
        instance_ = new Singleton;
    }

    mutex_.unlock();
}
```

外层第一次读取 `instance_` 没有和锁内写入建立同步关系。如果 `instance_` 是普通指针，一个线程读取、另一个线程写入会产生数据竞争，行为未定义。

此外，对象内存分配、构造和指针发布之间还涉及内存可见性与重排序问题。仅仅“再判断一次”并不能自动满足 C++ 内存模型。

如果一定要实现双重检查，需要使用原子指针以及正确的 acquire/release 内存序，但复杂度和出错概率都很高，通常没有必要。

## 十一、推荐写法：Meyers Singleton

C++11 保证函数局部静态变量的初始化是线程安全的。

```cpp
class Singleton final
{
public:
    static Singleton& instance()
    {
        static Singleton object;
        return object;
    }

    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;
    Singleton(Singleton&&) = delete;
    Singleton& operator=(Singleton&&) = delete;

private:
    Singleton() = default;
    ~Singleton() = default;
};
```

这个方案具备：

- 第一次使用时初始化；
- C++11 起初始化线程安全；
- 无需手写互斥锁；
- 无需裸指针和手动 `delete`；
- 语法简洁，异常时可在以后再次尝试初始化。

### 11.1 为什么返回引用

```cpp
static Singleton& instance();
```

返回引用表示调用者不获得所有权，不能 `delete`，同时避免空指针语义。

相比之下，返回裸指针容易让人误以为可能为空或需要释放。

### 11.2 析构时机

函数局部静态对象通常在程序正常退出时析构，顺序与构造完成顺序相反。

如果其他静态对象的析构函数继续访问已经销毁的单例，仍可能产生生命周期问题。可选策略包括：

- 避免静态析构阶段相互调用；
- 显式管理应用上下文生命周期；
- 将依赖对象组合到同一个顶层对象中；
- 对极少数进程级对象有意不析构，但必须明确接受资源检查与测试方面的代价。

## 十二、使用 `std::call_once` 初始化

如果单例必须是动态对象，或者初始化动作与对象构造分离，可以使用 C++11 的 `std::once_flag` 和 `std::call_once`：

```cpp
#include <memory>
#include <mutex>

class Singleton final
{
public:
    static Singleton& instance()
    {
        std::call_once(flag_, []
        {
            instance_.reset(new Singleton);
        });

        return *instance_;
    }

    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;

private:
    Singleton() = default;

    static std::once_flag flag_;
    static std::unique_ptr<Singleton> instance_;
};

std::once_flag Singleton::flag_;
std::unique_ptr<Singleton> Singleton::instance_;
```

`call_once` 保证初始化函数在多个并发调用中成功执行一次。如果初始化抛异常，本次调用不算成功，后续调用仍可重试。

相比手写双重检查锁，`call_once` 的意图和同步语义更明确。

## 十三、单例的构造、复制和继承限制

一个完整的单例通常需要：

```cpp
class Singleton final
{
public:
    static Singleton& instance();

    Singleton(const Singleton&) = delete;
    Singleton& operator=(const Singleton&) = delete;
    Singleton(Singleton&&) = delete;
    Singleton& operator=(Singleton&&) = delete;

private:
    Singleton() = default;
};
```

逐项作用如下：

- 私有构造函数：禁止类外创建普通实例；
- 删除拷贝：不能复制出第二个实例；
- 删除移动：不能把唯一对象的状态转移到另一个对象；
- `final`：禁止派生类形成新的实例体系；
- 静态访问函数：提供唯一访问点。

### 13.1 反射、序列化和恶意内存操作

普通 C++ 代码可以通过访问控制和删除函数建立可靠约束，但语言无法阻止所有刻意破坏行为，例如错误使用未定义行为、直接改写内存或某些特殊反序列化框架。

设计目标应是让正常、合法的 C++ 使用方式不能破坏约束，而不是抵御任意未定义行为。

## 十四、单例中的线程安全要分层讨论

Meyers Singleton 只保证：

```text
唯一对象的初始化过程是线程安全的。
```

它不保证单例的成员函数自动线程安全。

```cpp
class CounterSingleton
{
public:
    static CounterSingleton& instance()
    {
        static CounterSingleton object;
        return object;
    }

    void increment()
    {
        ++count_;  // 多线程同时调用时仍有数据竞争
    }

private:
    CounterSingleton() : count_(0) {}
    int count_;
};
```

必须根据成员数据选择同步方式：

```cpp
#include <atomic>

class CounterSingleton
{
public:
    void increment() noexcept
    {
        count_.fetch_add(1, std::memory_order_relaxed);
    }

private:
    std::atomic<int> count_{0};
};
```

或者使用互斥锁保护复合不变量。

## 十五、单例的优点与缺点

### 15.1 优点

- 可以保证正常接口下只有一个实例；
- 提供统一访问入口；
- 延迟初始化可以避免无用资源消耗；
- 对确实唯一的系统资源表达直观。

### 15.2 缺点

- 本质上是全局状态；
- 依赖关系隐藏在函数内部；
- 单元测试难以替换实现或隔离状态；
- 测试之间可能相互污染；
- 并发访问需要额外同步；
- 构造和析构顺序可能复杂；
- 让模块耦合到具体实现；
- 容易被滥用成“方便访问的全局变量”。

### 15.3 依赖注入通常更清晰

单例写法：

```cpp
void Service::run()
{
    Config& config = Config::instance();
    // 隐藏依赖
}
```

依赖注入写法：

```cpp
class Service
{
public:
    explicit Service(const Config& config)
        : config_(config)
    {
    }

private:
    const Config& config_;
};
```

后者让依赖出现在构造函数中，测试时可以传入专用配置，不必修改全局状态。

## 十六、单例适合与不适合的场景

### 16.1 相对适合

- 硬件或系统确实只有一个对应资源；
- 进程级只读配置，并且初始化完成后不再修改；
- 全局类型注册表；
- 代码规模较小，依赖注入成本明显高于收益。

### 16.2 不太适合

- 普通业务服务对象；
- 数据库连接本身，通常应该使用连接池；
- 每个测试需要不同配置的对象；
- 生命周期需要精确提前结束；
- 多租户或多实例程序；
- 需要热更新并保持多版本状态；
- 为了避免传参而随意全局访问的对象。

## 十七、工厂构造类

有些类并不要求“只能在堆上”，只是希望构造过程经过校验。

```cpp
#include <stdexcept>

class Port
{
public:
    static Port create(int value)
    {
        if (value < 1 || value > 65535)
        {
            throw std::out_of_range(
                "port must be in [1, 65535]");
        }

        return Port(value);
    }

    int value() const noexcept
    {
        return value_;
    }

private:
    explicit Port(int value) noexcept
        : value_(value)
    {
    }

    int value_;
};
```

工厂函数可以：

- 校验输入；
- 根据参数返回不同派生类型；
- 返回错误结果或抛异常；
- 复用缓存对象；
- 统一记录与注册。

这种设计限制的是构造入口，而不是对象存储位置。

## 十八、纯工具类型是否应该写成类

有些代码把所有函数都写成静态成员：

```cpp
class StringUtil
{
public:
    static std::string trim(const std::string& text);

private:
    StringUtil() = delete;
};
```

这可以阻止实例化，但在 C++ 中，命名空间通常更自然：

```cpp
namespace string_util
{
    std::string trim(const std::string& text);
}
```

命名空间不会被实例化，也不会暗示对象状态。如果需要模板参数、策略类型或访问控制，再考虑工具类。

## 十九、接口类与抽象基类

另一类特殊设计是不能直接实例化、只能作为接口使用的类：

```cpp
class Handler
{
public:
    virtual ~Handler() = default;
    virtual void handle() = 0;
};
```

纯虚函数使 `Handler` 成为抽象类：

```cpp
Handler object;  // 编译失败
```

但派生类可以实现接口并创建对象。

抽象基类需要公有虚析构函数，否则通过基类指针删除派生对象会产生未定义行为。

## 二十、不可变类设计

不可变对象构造后不允许改变可观察状态，天然更容易并发共享。

```cpp
#include <string>

class Endpoint
{
public:
    Endpoint(std::string host, int port)
        : host_(std::move(host)),
          port_(port)
    {
    }

    const std::string& host() const noexcept
    {
        return host_;
    }

    int port() const noexcept
    {
        return port_;
    }

private:
    std::string host_;
    int port_;
};
```

不可变类通常具有：

- 构造时建立完整不变量；
- 成员为私有；
- 不提供修改接口；
- 查询函数为 `const`；
- 不泄漏可以修改内部状态的引用或指针。

`const` 成员并不是实现不可变类的唯一方式，而且大量 `const` 数据成员会让赋值操作变得困难。更常见的做法是私有数据加只读接口。

## 二十一、RAII独占句柄类

资源句柄类通常不可复制但可以移动：

```cpp
#include <unistd.h>

class FileDescriptor final
{
public:
    explicit FileDescriptor(int descriptor = -1) noexcept
        : descriptor_(descriptor)
    {
    }

    ~FileDescriptor() noexcept
    {
        reset();
    }

    FileDescriptor(const FileDescriptor&) = delete;
    FileDescriptor& operator=(const FileDescriptor&) = delete;

    FileDescriptor(FileDescriptor&& other) noexcept
        : descriptor_(other.release())
    {
    }

    FileDescriptor& operator=(FileDescriptor&& other) noexcept
    {
        if (this != &other)
        {
            reset(other.release());
        }

        return *this;
    }

    int get() const noexcept
    {
        return descriptor_;
    }

    int release() noexcept
    {
        const int result = descriptor_;
        descriptor_ = -1;
        return result;
    }

    void reset(int descriptor = -1) noexcept
    {
        if (descriptor_ >= 0)
        {
            ::close(descriptor_);
        }

        descriptor_ = descriptor;
    }

private:
    int descriptor_;
};
```

这类设计综合使用：

- 析构函数自动释放；
- 删除拷贝，防止重复关闭；
- 支持移动，允许所有权转移；
- `release` 显式放弃所有权；
- `reset` 替换资源。

它与 `std::unique_ptr` 的所有权模型非常相似。

## 二十二、综合示例

下面的程序综合演示：

- 私有构造与堆对象工厂；
- 禁止复制；
- `final` 禁止继承；
- C++11 线程安全的函数局部静态单例；
- 单例业务状态使用原子类型保护；
- 多线程访问唯一实例。

```cpp
#include <atomic>
#include <iostream>
#include <memory>
#include <string>
#include <thread>
#include <utility>
#include <vector>

class HeapTask final
{
public:
    static std::unique_ptr<HeapTask>
    create(std::string name)
    {
        return std::unique_ptr<HeapTask>(
            new HeapTask(std::move(name)));
    }

    ~HeapTask()
    {
        std::cout << "destroy task: "
                  << name_
                  << '\n';
    }

    HeapTask(const HeapTask&) = delete;
    HeapTask& operator=(const HeapTask&) = delete;

    void run() const
    {
        std::cout << "run task: "
                  << name_
                  << '\n';
    }

private:
    explicit HeapTask(std::string name)
        : name_(std::move(name))
    {
        std::cout << "create task: "
                  << name_
                  << '\n';
    }

    std::string name_;
};

class RequestStatistics final
{
public:
    static RequestStatistics& instance()
    {
        static RequestStatistics object;
        return object;
    }

    RequestStatistics(const RequestStatistics&) = delete;
    RequestStatistics& operator=(
        const RequestStatistics&) = delete;
    RequestStatistics(RequestStatistics&&) = delete;
    RequestStatistics& operator=(
        RequestStatistics&&) = delete;

    void record() noexcept
    {
        count_.fetch_add(1, std::memory_order_relaxed);
    }

    int count() const noexcept
    {
        return count_.load(std::memory_order_relaxed);
    }

private:
    RequestStatistics()
        : count_(0)
    {
        std::cout << "statistics initialized\n";
    }

    ~RequestStatistics()
    {
        std::cout << "statistics destroyed\n";
    }

    std::atomic<int> count_;
};

void simulate_requests(int request_count)
{
    RequestStatistics& statistics =
        RequestStatistics::instance();

    for (int index = 0;
         index < request_count;
         ++index)
    {
        statistics.record();
    }
}

int main()
{
    std::unique_ptr<HeapTask> task =
        HeapTask::create("network-event");
    task->run();

    const int requests_per_thread = 50000;

    std::vector<std::thread> workers;
    workers.emplace_back(
        simulate_requests,
        requests_per_thread);
    workers.emplace_back(
        simulate_requests,
        requests_per_thread);

    for (std::thread& worker : workers)
    {
        worker.join();
    }

    std::cout << "same singleton: "
              << std::boolalpha
              << (&RequestStatistics::instance() ==
                  &RequestStatistics::instance())
              << '\n';

    std::cout << "request count: "
              << RequestStatistics::instance().count()
              << '\n';

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
create task: network-event
run task: network-event
statistics initialized
same singleton: true
request count: 100000
destroy task: network-event
statistics destroyed
```

`RequestStatistics` 的初始化由 C++11 保证线程安全，但成员计数仍然显式使用 `std::atomic<int>`，这体现了“初始化安全”和“对象业务操作安全”是两个不同问题。

## 二十三、常见错误

### 23.1 工厂返回裸指针却不说明所有权

```cpp
static HeapOnly* create();
```

问题：调用者不知道是否需要 `delete`，异常路径容易泄漏。

修正：优先返回 `std::unique_ptr`，或返回明确的非拥有句柄。

### 23.2 私有构造函数却保留公有拷贝

问题：调用者可以从已有对象复制出局部实例，破坏“只能通过工厂创建”的约束。

修正：删除拷贝操作，并明确移动策略。

### 23.3 私有析构函数配默认 `unique_ptr`

问题：`std::default_delete` 无法访问析构函数，代码不能编译。

修正：析构函数公有，或者提供拥有访问权限的自定义删除器。

### 23.4 在私有构造工厂里直接调用 `make_unique`

问题：访问检查发生在 `make_unique` 模板内部，它不是类的成员。

修正：在工厂函数中直接构造 `unique_ptr<T>(new T(...))`，或设计专用友元方案。

### 23.5 认为删除类专属 `operator new` 能绝对限制物理位置

问题：`::new`、成员子对象和自定义存储仍可能绕过该限制。

修正：准确描述为“禁止普通类专属动态分配入口”，不要做超出语言能力的保证。

### 23.6 只删除拷贝构造，不删除拷贝赋值

```cpp
Type(const Type&) = delete;
```

问题：已有对象之间仍可能执行赋值。

修正：拷贝构造和拷贝赋值一起处理。

### 23.7 忘记决定移动语义

问题：用户声明拷贝函数会影响隐式移动函数生成，类可能意外变得不可移动。

修正：明确写出移动操作是 `= default` 还是 `= delete`。

### 23.8 用私有构造技巧代替 `final`

问题：同时限制普通对象构造，表达不直接。

修正：C++11 以后用 `final` 表示禁止继承。

### 23.9 普通指针实现双重检查锁

问题：无锁读取和锁内写入之间存在数据竞争，行为未定义。

修正：使用函数局部静态对象或 `std::call_once`。

### 23.10 手工 `new` 单例配“垃圾回收类”

问题：代码复杂，容易出现静态定义错误、重复释放和析构顺序问题。

修正：优先采用 Meyers Singleton，让语言和运行时管理生命周期。

### 23.11 认为单例初始化安全就等于整个类线程安全

问题：成员数据的并发修改仍然可能发生数据竞争。

修正：为业务状态使用互斥锁、原子变量或不可变设计。

### 23.12 为所有共享对象使用单例

问题：隐藏依赖、污染测试状态、阻止多实例部署。

修正：优先考虑普通对象、依赖注入和由应用顶层统一管理的上下文。

## 二十四、面试常见问题

### 24.1 如何设计只能在堆上创建的类

把构造函数设为私有，提供静态工厂在类内动态创建对象；删除复制操作，防止从已有对象复制出局部对象；工厂优先返回 `unique_ptr` 表达所有权。

### 24.2 如何设计只能在栈上创建的类

常见回答是删除类专属 `operator new` 和 `operator new[]`，从而禁止普通 `new T`。但要补充：C++ 无法由类自身绝对保证物理栈位置，`::new` 和子对象嵌入可以绕过，因此这只是接口层限制。

### 24.3 `new` 表达式做了什么

主要包含两个步骤：先调用合适的 `operator new` 分配原始内存，再在该内存上调用构造函数。构造失败时还会调用匹配的 `operator delete` 回收内存。

### 24.4 如何禁止复制

C++11 使用：

```cpp
Type(const Type&) = delete;
Type& operator=(const Type&) = delete;
```

### 24.5 禁止复制后类还能移动吗

不一定。用户声明拷贝操作通常会抑制隐式移动操作生成。如果需要移动，应该显式声明移动构造和移动赋值。

### 24.6 如何禁止继承

C++11 使用：

```cpp
class Type final
{
};
```

### 24.7 饿汉式和懒汉式有什么区别

饿汉式在程序启动阶段初始化，首次访问快但可能增加启动成本，并涉及跨翻译单元初始化顺序；懒汉式首次使用时初始化，避免无用构造，但必须正确处理并发初始化。

### 24.8 C++11 如何写线程安全单例

优先使用函数局部静态对象：

```cpp
static Singleton& instance()
{
    static Singleton object;
    return object;
}
```

C++11 保证局部静态对象的初始化线程安全。

### 24.9 双重检查锁为什么危险

普通指针的无锁读取与其他线程的写入会产生数据竞争，而且对象构造与指针发布涉及内存顺序。必须配合原子变量和正确内存序，不能只写两次空指针判断。

### 24.10 `std::call_once` 有什么作用

它保证多个线程竞争时，指定初始化函数成功执行一次；如果函数抛异常，本次不计为完成，后续调用可以重试。

### 24.11 Meyers Singleton 是否保证所有成员函数线程安全

不保证。它只保证实例初始化安全，业务状态仍需自行同步。

### 24.12 单例对象何时析构

函数局部静态单例通常在程序正常退出时析构。若其他静态对象在析构阶段仍访问它，可能出现静态析构顺序问题。

### 24.13 单例最大的设计问题是什么

它引入全局状态和隐藏依赖，使测试隔离、替换实现、并发控制和生命周期管理更困难。

### 24.14 什么情况下应该使用依赖注入

当组件需要替换实现、进行单元测试、支持多个配置实例或明确展示依赖时，构造函数依赖注入通常比单例更合适。

## 二十五、特殊类设计检查表

设计受限类时可以逐项检查：

1. 构造函数由谁调用，访问权限是否正确？
2. 析构函数由谁调用，默认删除器是否有权限？
3. 对象是否允许复制？
4. 对象是否允许移动？
5. 是否需要 `final`？
6. 工厂返回值是否清晰表达所有权？
7. 异常发生时资源是否自动释放？
8. 类专属 `operator new` 的限制能否被绕过？
9. 单例初始化是否符合 C++ 内存模型？
10. 单例成员操作是否另外保证线程安全？
11. 是否存在静态初始化或析构顺序依赖？
12. 依赖注入能否代替全局访问？
13. 限制是否来自真实业务需求，而不是为了炫技？
14. 错误用法能否在编译期被拒绝？

## 二十六、总结

特殊类设计的核心是把约束编码进类型系统：

- 私有构造函数控制对象创建入口；
- 工厂函数负责校验与所有权交付；
- `= delete` 精确禁止复制或移动；
- `final` 直接禁止类继承或虚函数继续重写；
- 删除类专属 `operator new` 可以阻止普通直接动态分配，但不能绝对保证物理栈位置；
- C++11 函数局部静态对象是实现线程安全懒汉单例的首选；
- 单例初始化线程安全不代表成员操作线程安全；
- 单例是受控全局状态，能使用依赖注入时应认真比较两者。

最值得记住的不是几段固定模板，而是这条设计原则：

```text
先明确对象的所有权、存储期和生命周期，
再用访问控制、删除函数和 RAII 把约束落实到编译期。
```
