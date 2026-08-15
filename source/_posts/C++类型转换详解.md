---
title: C++类型转换详解：隐式转换、四种命名转换、explicit与RTTI
date: 2026-08-15 14:00:00
categories:
  - C++
tags:
  - C++
  - 类型转换
  - static_cast
  - dynamic_cast
  - const_cast
  - reinterpret_cast
  - RTTI
---

类型转换决定了一个值如何以另一种类型参与计算、传参、返回或对象访问。看似简单的 `double` 转 `int`、基类指针转派生类指针、去除 `const`，背后分别涉及精度丢失、对象真实类型、访问权限、内存模型和未定义行为。

C++ 保留了 C 风格转换，同时提供 `static_cast`、`dynamic_cast`、`const_cast` 和 `reinterpret_cast` 四种命名转换。命名转换不是为了让代码更长，而是把不同风险拆开，让编译器和代码审查者看见程序员到底想做什么。

本文从隐式转换讲起，系统分析四种 C++ 转换、`explicit`、RTTI、指针转换、严格别名规则与工程实践。

<!-- more -->

## 一、什么是类型转换

当源表达式类型与目标类型不同，程序可能需要把源值转换成目标类型。

常见位置包括：

- 变量初始化和赋值；
- 函数实参与形参匹配；
- 函数返回值与返回类型匹配；
- 算术表达式中的操作数统一；
- 基类与派生类指针转换；
- C 接口中的 `void*`；
- 用户自定义类型的构造与转换运算符。

```cpp
int integer = 10;
double floating = integer;
```

这里 `integer` 自动转换为 `double`，属于隐式转换。

```cpp
double value = 12.75;
int integer = static_cast<int>(value);
```

这里程序员明确要求把 `double` 转成 `int`，属于显式转换。

## 二、隐式转换与显式转换

### 2.1 隐式转换

隐式转换由编译器根据语言规则自动插入：

```cpp
void print(double value);

int number = 42;
print(number);
```

它能够减少样板代码，但也可能隐藏风险：

```cpp
double price = 19.99;
int truncated = price;  // 得到 19，丢失小数部分
```

### 2.2 显式转换

```cpp
int truncated = static_cast<int>(price);
```

显式写出转换不会让不安全操作自动变安全，但能表达“这里的类型变化是有意的”，方便编译器诊断和人工审查。

### 2.3 编译成功不等于数值正确

```cpp
long long large = 5000000000LL;
int small = static_cast<int>(large);
```

转换能够通过编译，但目标 `int` 无法表示原值。转换结果取决于具体规则和实现，不能继续假设数值保持不变。

类型可转换回答的是“语法是否允许”，业务正确性还要回答“目标类型能否表示这个值”。

## 三、标准隐式转换概览

C++ 的隐式转换包含多种规则。

### 3.1 整型提升

`bool`、`char`、`signed char`、`unsigned char`、`short` 等较小整型在表达式中经常先提升为 `int` 或 `unsigned int`。

```cpp
char left = 10;
char right = 20;

auto result = left + right;
```

`result` 通常不是 `char`，而是提升后的 `int`。

### 3.2 浮点提升

`float` 可以提升为 `double`，例如变参函数和某些表达式规则中会发生这种转换。

### 3.3 数值类型转换

```cpp
int integer = 10;
double floating = integer;

double precise = 3.99;
int truncated = precise;
```

整数转浮点可能在数值过大时失去精确表示；浮点转整数会截去小数部分，并且超出目标整型可表示范围时不能认为结果可靠。

### 3.4 数组和函数退化

```cpp
int values[4] = {1, 2, 3, 4};
int* pointer = values;
```

大多数表达式中，数组会转换成指向首元素的指针。数组大小信息不会随裸指针一起传递。

函数名也经常转换为函数指针：

```cpp
void execute();
void (*function)() = execute;
```

### 3.5 派生类向基类转换

```cpp
class Base {};
class Derived : public Base {};

Derived object;
Base* base = &object;
```

公有且无歧义的派生类到基类转换属于安全的向上转型，编译器会调整指针到对应基类子对象。

### 3.6 空指针转换

C++11 应使用 `nullptr`：

```cpp
int* pointer = nullptr;
```

`nullptr` 的类型是 `std::nullptr_t`，可以转换成任意对象指针或成员指针类型，不会像整数 `0` 那样干扰函数重载。

## 四、常规算术转换

不同算术类型共同参与表达式时，编译器会寻找公共计算类型。

```cpp
int count = 3;
double unit_price = 2.5;

double total = count * unit_price;
```

`count` 会转换为 `double` 后参与乘法。

### 4.1 有符号与无符号混算

```cpp
int signed_value = -1;
unsigned int unsigned_value = 1;

if (signed_value < unsigned_value)
{
    // 结果可能与直觉不同
}
```

比较前，`signed_value` 可能转换成无符号类型，负数变成一个很大的无符号值。

工程建议：

- 避免把负数与无符号数直接比较；
- 循环下标和容器 `size()` 比较时注意类型；
- 必要时先验证取值范围，再显式转换；
- 开启 `-Wsign-conversion` 等警告。

### 4.2 `bool` 转换

指针、整数和浮点数都可在条件上下文中转换为 `bool`：

```cpp
if (pointer)
{
    // pointer 不为空
}
```

这类条件转换具有专门规则，不应该机械地理解成普通整数转换。

## 五、列表初始化与窄化转换

C++11 的花括号初始化会拒绝许多潜在窄化：

```cpp
double value = 3.14;

int first = value;   // 允许，但可能警告
int second{value};   // 编译失败：窄化转换
```

```cpp
int too_large{5000000000LL};  // 编译失败
```

列表初始化是减少意外精度丢失的重要工具。

不过，显式转换仍能表达“我已经确认”：

```cpp
int result{static_cast<int>(value)};
```

此时责任回到程序员，需要确保截断符合业务语义。

## 六、C风格类型转换

C 风格转换写作：

```cpp
double value = 12.34;
int integer = (int)value;
```

C++ 还支持函数式写法：

```cpp
int integer = int(value);
```

### 6.1 C风格转换的问题

同样的语法可能表达完全不同的意图：

```cpp
(int)floating_value;      // 数值转换
(Derived*)base_pointer;   // 类层次转换
(char*)object_pointer;    // 重新解释地址
(int*)const_pointer;      // 去除 const
```

代码审查者看见 `(Target)value` 时，不容易立即判断它相当于 `static_cast`、`const_cast`、`reinterpret_cast`，还是它们的组合。

C 风格转换还可能完成某些单独命名转换不允许直接完成的组合操作，容易无意中绕过类型系统。

### 6.2 为什么命名转换更好

```cpp
int integer = static_cast<int>(value);
```

优点包括：

- 转换意图明确；
- 关键字容易搜索；
- 编译器能实施更精确的限制；
- 代码审查可以针对不同风险分类；
- 不会把“去除常量性”和“重解释内存”隐藏在同一语法中。

## 七、四种C++命名转换总览

| 转换 | 主要用途 | 是否运行期检查 | 主要风险 |
| --- | --- | --- | --- |
| `static_cast` | 数值转换、相关类型转换、显式调用转换规则 | 否 | 范围丢失、错误向下转型 |
| `dynamic_cast` | 多态类层次中的安全向下或横向转换 | 是 | 依赖 RTTI，有运行期检查 |
| `const_cast` | 增加或去除 `const/volatile` | 否 | 修改真正只读对象是未定义行为 |
| `reinterpret_cast` | 指针、整数及底层表示相关转换 | 否 | 可移植性差，极易触发未定义行为 |

选择关键不是“哪个能让代码通过编译”，而是“哪个最准确地表达语义，并满足对象模型前提”。

## 八、`static_cast`

`static_cast` 适合具有明确语言关系、能够在编译期检查的转换。

### 8.1 数值类型转换

```cpp
double value = 12.75;
int integer = static_cast<int>(value);
```

结果为 `12`，因为浮点转整数会向零截断小数部分。

注意：如果浮点值截断后的整数部分无法由目标整型表示，行为未定义；NaN 和无穷大同样不能直接转换成普通整数。该转换不会自动饱和或环绕，必须先验证范围和特殊值。

```cpp
#include <limits>
#include <stdexcept>

int checked_to_int(double value)
{
    if (value < static_cast<double>(
                    std::numeric_limits<int>::min()) ||
        value > static_cast<double>(
                    std::numeric_limits<int>::max()))
    {
        throw std::out_of_range("value does not fit in int");
    }

    return static_cast<int>(value);
}
```

生产代码还应根据需求处理 NaN 和无穷大。

### 8.2 枚举转换

```cpp
enum class Status
{
    idle = 0,
    running = 1,
    stopped = 2
};

int value = static_cast<int>(Status::running);
```

强类型枚举不会隐式转换成整数，需要显式转换。

整数转枚举在语法上也可显式完成，但目标值不一定对应某个命名枚举项：

```cpp
Status status = static_cast<Status>(100);
```

业务代码仍需校验数值是否属于允许集合。

### 8.3 `void*` 与对象指针

```cpp
int value = 10;
void* raw = &value;
int* restored = static_cast<int*>(raw);
```

如果 `raw` 原本确实指向合适的 `int` 对象，转换回来后可以访问。

如果实际对象类型不匹配，即使强转成功，解引用也会产生未定义行为。

### 8.4 向上转型

```cpp
Derived* derived = obtain_derived();
Base* base = static_cast<Base*>(derived);
```

公有、无歧义继承的向上转型通常可以直接隐式完成：

```cpp
Base* base = derived;
```

### 8.5 向下转型

```cpp
Base* base = obtain_base();
Derived* derived = static_cast<Derived*>(base);
```

`static_cast` 不检查 `base` 在运行时是否真的指向 `Derived` 对象。只有程序员能够通过其他不变量严格证明真实类型时，这种向下转换才成立。

如果 `base` 实际指向一个纯 `Base` 对象，再把它当作 `Derived` 使用会产生未定义行为。

多态层次中类型不确定时，应使用 `dynamic_cast`。

### 8.6 显式调用转换构造或转换运算符

```cpp
class Port
{
public:
    explicit Port(int value)
        : value_(value)
    {
    }

private:
    int value_;
};

Port port = static_cast<Port>(8080);
```

### 8.7 转为 `void`

```cpp
static_cast<void>(expression);
```

这可以明确表示忽略表达式结果，某些情况下也用于消除未使用结果警告。它不应该被用来忽略必须检查的错误。

### 8.8 `static_cast` 不能做什么

它不能直接：

- 去除底层 `const` 或 `volatile`；
- 在任意无关对象指针间转换；
- 安全确认多态对象的运行时派生类型；
- 把任意位模式变成语义有效的目标对象。

## 九、`dynamic_cast`

`dynamic_cast` 用于多态类层次中的运行期安全转换。

### 9.1 前提：源类型具有多态性

通常源类至少要包含一个虚函数：

```cpp
class Message
{
public:
    virtual ~Message() = default;
};

class TextMessage : public Message
{
};
```

虚析构函数既使基类成为多态类型，也保证通过基类指针删除派生对象是安全的。

### 9.2 指针向下转换

```cpp
void handle(Message* message)
{
    TextMessage* text =
        dynamic_cast<TextMessage*>(message);

    if (text != nullptr)
    {
        // message 的动态类型兼容 TextMessage
    }
}
```

转换失败时返回 `nullptr`，不会得到一个伪造的派生类指针。

如果源指针本身为空，目标指针也为空。

### 9.3 引用向下转换

```cpp
#include <typeinfo>

void handle(Message& message)
{
    try
    {
        TextMessage& text =
            dynamic_cast<TextMessage&>(message);
    }
    catch (const std::bad_cast& error)
    {
        // 引用转换失败
    }
}
```

引用没有空值，所以失败时抛出 `std::bad_cast`。

### 9.4 向上转型通常不需要 `dynamic_cast`

```cpp
TextMessage text;
Message* message = &text;
```

派生类到可访问且无歧义基类的转换是安全的标准转换。

### 9.5 横向转换

在多重继承结构中，`dynamic_cast` 还能根据最派生对象进行横向转换：

```cpp
class InterfaceA
{
public:
    virtual ~InterfaceA() = default;
};

class InterfaceB
{
public:
    virtual ~InterfaceB() = default;
};

class Implementation
    : public InterfaceA,
      public InterfaceB
{
};

InterfaceA* first = new Implementation;
InterfaceB* second = dynamic_cast<InterfaceB*>(first);
delete first;
```

转换会根据运行时最派生类型调整到正确的 `InterfaceB` 子对象地址。

### 9.6 转换为 `void*`

对多态对象使用：

```cpp
void* complete = dynamic_cast<void*>(base_pointer);
```

可以得到指向最派生对象起始位置的指针。这是较少见的底层用途。

### 9.7 `dynamic_cast` 的代价

它需要 RTTI 元数据和运行期类层次检查，通常比简单指针转换昂贵。但是否构成性能问题要通过真实热点测量。

如果代码频繁通过大量 `dynamic_cast` 判断具体类型，可能说明多态接口设计不足。可以考虑：

- 添加合适的虚函数；
- 使用访问者模式；
- 使用明确的消息分发；
- C++17 的 `std::variant`；
- 在确有需要时保留动态转换。

## 十、`const_cast`

`const_cast` 专门改变指针或引用的 `const`、`volatile` 限定。

### 10.1 安全情况：原对象本来可修改

```cpp
int value = 10;
const int* observer = &value;

int* writable = const_cast<int*>(observer);
*writable = 20;
```

这里原对象 `value` 不是常量，只是通过 `const int*` 观察，因此去掉访问路径上的 `const` 后修改是允许的。

### 10.2 危险情况：原对象真正是常量

```cpp
const int value = 10;
int* writable = const_cast<int*>(&value);
*writable = 20;  // 未定义行为
```

`const_cast` 只改变表达式类型，不会把实际只读对象变成可写对象。编译成功不代表修改合法。

编译器可能：

- 把常量放入只读存储区；
- 把读取直接替换成常量值；
- 基于“不被修改”的假设进行优化。

因此可能出现写入崩溃、读到旧值或其他任意结果。

### 10.3 增加 `const` 通常不需要强转

```cpp
int* writable = &value;
const int* readonly = writable;
```

增加限制通常可以隐式完成；危险的是去除限制后尝试修改。

### 10.4 兼容旧 C 接口

旧接口可能错误地没有把只读参数声明为 `const`：

```cpp
void legacy_print(char* text);

void wrapper(const char* text)
{
    legacy_print(const_cast<char*>(text));
}
```

只有当 `legacy_print` 确实不会修改字符时，这种适配才可能成立。如果它会写入，而调用者传来字符串字面量或真正只读数据，行为仍然未定义。

更好的做法是修复接口签名，或复制到可修改缓冲区。

### 10.5 `mutable` 可能比 `const_cast` 更准确

如果 `const` 成员函数需要更新不影响对象逻辑状态的缓存或互斥量，可以使用 `mutable`：

```cpp
class Cache
{
public:
    int value() const
    {
        if (!ready_)
        {
            cached_ = compute();
            ready_ = true;
        }

        return cached_;
    }

private:
    int compute() const;

    mutable bool ready_ = false;
    mutable int cached_ = 0;
};
```

需要多线程访问时，还必须同步这些可变成员。

## 十一、`reinterpret_cast`

`reinterpret_cast` 表达低层次的类型重解释。它通常不执行语义层面的数值转换，也不验证目标对象是否真实存在。

### 11.1 对象指针之间转换

```cpp
struct Header {};
struct Payload {};

Header* header = obtain_header();
Payload* payload =
    reinterpret_cast<Payload*>(header);
```

转换语法可能成立，但这并不表示 `header` 指向的内存中存在一个合法 `Payload` 对象。解引用 `payload` 可能违反对象生命周期、对齐和严格别名规则。

### 11.2 指针与整数

```cpp
#include <cstdint>

void* pointer = obtain_pointer();

std::uintptr_t address =
    reinterpret_cast<std::uintptr_t>(pointer);

void* restored =
    reinterpret_cast<void*>(address);
```

如果实现提供 `std::uintptr_t`，它是能够保存转换后对象指针表示的无符号整数类型。

不要把指针转换为 `int`：

```cpp
int address = reinterpret_cast<int>(pointer); // 常见平台无法编译或会截断
```

在 64 位系统上，指针通常比 32 位 `int` 更宽。

即使使用 `uintptr_t`，也不应对地址整数进行随意算术后再假设它仍指向合法对象。

### 11.3 正确打印指针

C 接口 `printf` 应使用 `%p`，并传 `void*`：

```cpp
#include <cstdio>

int value = 10;
int* pointer = &value;

std::printf("%p\n", static_cast<void*>(pointer));
```

不能使用 `%x` 直接打印指针。格式说明符与实参类型不匹配会导致未定义行为。

C++ 流可以直接输出普通对象指针：

```cpp
std::cout << static_cast<void*>(pointer) << '\n';
```

### 11.4 函数指针转换

```cpp
using Function = void (*)();

int calculate(int value);

Function function =
    reinterpret_cast<Function>(calculate);
```

把函数指针转换成不兼容类型后再调用，通常不满足调用兼容要求，可能导致参数、返回值和调用约定错乱，行为未定义。

某些平台 API 明确规定了特定转换方式时，应严格遵守平台文档，并把转换封装在很小的边界内。

### 11.5 不要用它做通用序列化

直接把对象内存当作字节发送：

```cpp
send(socket,
     reinterpret_cast<const char*>(&object),
     sizeof(object),
     0);
```

可能包含：

- 填充字节；
- 平台字节序；
- 指针值；
- 虚表指针；
- 不同编译器 ABI 差异；
- 非平凡对象内部状态。

网络协议应显式编码字段、长度和字节序，而不是直接发送 C++ 对象布局。

## 十二、严格别名与类型双关

下面的代码很常见，但可能违反严格别名规则：

```cpp
float value = 1.0F;
std::uint32_t bits =
    *reinterpret_cast<std::uint32_t*>(&value);
```

优化器可以假设不相关类型的左值不会指向同一对象。通过错误类型解引用可能产生未定义行为。

C++11 中可使用 `std::memcpy` 复制对象表示：

```cpp
#include <cstdint>
#include <cstring>
#include <type_traits>

float value = 1.0F;
std::uint32_t bits = 0;

static_assert(sizeof(bits) == sizeof(value),
              "unexpected float size");
static_assert(std::is_trivially_copyable<float>::value,
              "float must be trivially copyable");

std::memcpy(&bits, &value, sizeof(bits));
```

现代编译器通常能把固定大小的 `memcpy` 优化成普通寄存器操作。

`std::bit_cast` 是 C++20 才加入的工具，不属于 C++11。

### 12.1 字符类型观察对象表示

C++ 允许通过 `char`、`unsigned char` 等字符类型的指针观察对象的字节表示：

```cpp
const unsigned char* bytes =
    reinterpret_cast<const unsigned char*>(&value);
```

这允许读取表示字节，但不意味着可以随意构造出任何目标类型或忽略对象生命周期规则。

## 十三、`explicit` 与用户自定义转换

`explicit` 不是四种强制转换之一，它用于阻止某些用户自定义隐式转换。

### 13.1 转换构造函数

能够用一个实参调用的构造函数可能参与隐式转换：

```cpp
class Distance
{
public:
    Distance(double meters)
        : meters_(meters)
    {
    }

private:
    double meters_;
};

void travel(Distance distance);

travel(100.0);  // double 隐式构造成 Distance
```

如果这种转换容易隐藏单位错误，应添加 `explicit`：

```cpp
class Distance
{
public:
    explicit Distance(double meters)
        : meters_(meters)
    {
    }

private:
    double meters_;
};
```

现在必须明确构造：

```cpp
travel(Distance(100.0));
```

### 13.2 不只是单参数构造函数

“转换构造函数就是只有一个参数的构造函数”并不完整。只要一个构造函数可以用一个实参调用，包括其他参数具有默认值的情况，也可能参与转换。

```cpp
class Buffer
{
public:
    explicit Buffer(
        std::size_t size,
        int fill = 0);
};
```

### 13.3 转换运算符

```cpp
class FileHandle
{
public:
    explicit operator bool() const noexcept
    {
        return descriptor_ >= 0;
    }

private:
    int descriptor_ = -1;
};
```

C++11 允许给转换运算符添加 `explicit`。

```cpp
FileHandle file;

if (file)
{
    // explicit operator bool 可用于布尔条件上下文
}
```

它不会随意参与普通整数算术，避免早期“安全布尔”设计中的问题。

### 13.4 什么时候不加 `explicit`

如果转换天然、无损且不会引起歧义，可以允许隐式转换。例如，字符串视图类从字符串引用构造可能被设计为隐式，但仍要结合生命周期风险判断。

默认经验是：单实参构造函数优先写 `explicit`，只有明确希望形成隐式转换时再移除。

## 十四、RTTI

RTTI 是 Run-Time Type Information，也常解释为运行时类型识别。

C++ 的主要 RTTI 设施包括：

- `dynamic_cast`；
- `typeid`；
- `std::type_info`。

## 十五、`typeid`

### 15.1 非多态表达式

```cpp
#include <typeinfo>

Base object;
const std::type_info& information = typeid(object);
```

对非多态类型，`typeid(expression)` 通常反映表达式的静态类型，并且某些情况下表达式不会为了确定类型而求值。

### 15.2 多态表达式

```cpp
Derived derived;
Base& base = derived;

if (typeid(base) == typeid(Derived))
{
    // base 当前引用的最派生对象是 Derived
}
```

当表达式是多态类型的左值时，`typeid` 会得到动态类型信息。

### 15.3 `type_info::name()`

```cpp
std::cout << typeid(base).name() << '\n';
```

`name()` 返回的文本由实现决定，可能是压缩或修饰后的名称，不适合作为稳定协议、持久化字段或业务判断依据。

### 15.4 空指针解引用表达式

```cpp
Base* pointer = nullptr;
typeid(*pointer);
```

如果 `Base` 是多态类型，需要求动态类型，而指针为空，会抛出 `std::bad_typeid`。

不要把这个机制当成普通空指针检测；访问前直接检查指针更清楚。

### 15.5 RTTI开关

部分项目会用编译器选项关闭 RTTI，例如 GCC/Clang 的 `-fno-rtti`。这会限制依赖运行时类型信息的 `dynamic_cast` 和 `typeid` 用法。

是否关闭 RTTI 是项目级架构决定，不能在普通业务代码中假设所有构建都关闭或开启。

## 十六、`static_cast` 与 `dynamic_cast` 对比

假设有：

```cpp
class Animal
{
public:
    virtual ~Animal() = default;
};

class Dog : public Animal
{
public:
    void bark();
};
```

### 16.1 可以证明真实类型

```cpp
Animal* animal = obtain_known_dog();
Dog* dog = static_cast<Dog*>(animal);
```

这依赖外部不变量。一旦调用约束被破坏，类型系统无法保护代码。

### 16.2 不能证明真实类型

```cpp
if (Dog* dog = dynamic_cast<Dog*>(animal))
{
    dog->bark();
}
```

运行时检查失败会得到空指针，适合动态来源对象。

### 16.3 更好的多态接口

如果所有动物都需要发声，最好让基类提供虚函数：

```cpp
class Animal
{
public:
    virtual ~Animal() = default;
    virtual void speak() const = 0;
};
```

调用者直接写：

```cpp
animal->speak();
```

不必先判断每个具体派生类型。

## 十七、智能指针的类型转换

对 `shared_ptr` 不要先取裸指针再创建新智能指针，否则会产生独立控制块和重复释放。

```cpp
std::shared_ptr<Base> base =
    std::make_shared<Derived>();

std::shared_ptr<Derived> derived =
    std::dynamic_pointer_cast<Derived>(base);
```

C++11 提供：

- `std::static_pointer_cast`；
- `std::dynamic_pointer_cast`；
- `std::const_pointer_cast`。

它们在转换保存指针的同时保持原控制块共享关系。

`std::reinterpret_pointer_cast` 是 C++17 才加入标准库的。

## 十八、指针转换的所有权问题

类型转换不会转移或创建所有权。

```cpp
Base* base = derived_pointer;
```

只改变访问类型，不代表 `base` 应该负责 `delete`。

特别是：

```cpp
void* context = object_pointer;
```

把指针存入 `void*` 回调上下文后，仍然必须在接口文档中说明：

- 谁拥有对象；
- 对象至少存活到什么时候；
- 回调是否可能跨线程；
- 如何恢复正确类型；
- 谁负责最终释放。

类型转换解决不了生命周期问题。

## 十九、转换选择流程

遇到类型不匹配时，可以按以下顺序判断：

```text
是否可以修改接口或数据模型，避免转换？
    |
    +-- 可以 --> 优先修改设计
    |
    +-- 不可以
          |
          +-- 数值、枚举、相关类型、void* 恢复？
          |       -> static_cast
          |
          +-- 多态类层次且运行时类型不确定？
          |       -> dynamic_cast
          |
          +-- 只改变 const/volatile？
          |       -> const_cast
          |
          +-- 平台接口或底层表示转换？
                  -> reinterpret_cast，并严格验证前提
```

如果一次操作似乎需要组合多个危险转换，通常应该重新检查接口设计。

## 二十、综合示例

下面的程序综合演示：

- `static_cast` 数值转换；
- `explicit` 构造函数；
- 多态向上转换；
- `dynamic_cast` 指针成功和失败；
- `dynamic_cast` 引用失败抛出 `std::bad_cast`；
- `const_cast` 的合法使用条件；
- `reinterpret_cast` 把对象指针转换为 `uintptr_t`；
- `typeid` 比较动态类型。

```cpp
#include <cstdint>
#include <iostream>
#include <memory>
#include <string>
#include <typeinfo>
#include <utility>
#include <vector>

class Port
{
public:
    explicit Port(int value)
        : value_(value)
    {
    }

    int value() const noexcept
    {
        return value_;
    }

private:
    int value_;
};

class Message
{
public:
    virtual ~Message() = default;
    virtual void print() const = 0;
};

class TextMessage final : public Message
{
public:
    explicit TextMessage(std::string text)
        : text_(std::move(text))
    {
    }

    void print() const override
    {
        std::cout << "text: " << text_ << '\n';
    }

    std::size_t size() const noexcept
    {
        return text_.size();
    }

private:
    std::string text_;
};

class NumberMessage final : public Message
{
public:
    explicit NumberMessage(int value)
        : value_(value)
    {
    }

    void print() const override
    {
        std::cout << "number: " << value_ << '\n';
    }

private:
    int value_;
};

void inspect(Message& message)
{
    message.print();

    if (TextMessage* text =
            dynamic_cast<TextMessage*>(&message))
    {
        std::cout << "text size: "
                  << text->size()
                  << '\n';
    }
    else
    {
        std::cout << "not a text message\n";
    }
}

int main()
{
    const double floating = 42.75;
    const int integer = static_cast<int>(floating);
    std::cout << "integer: " << integer << '\n';

    const Port port(8080);
    std::cout << "port: " << port.value() << '\n';

    std::vector<std::unique_ptr<Message>> messages;
    messages.emplace_back(
        new TextMessage("hello"));
    messages.emplace_back(
        new NumberMessage(7));

    for (const std::unique_ptr<Message>& message : messages)
    {
        inspect(*message);
    }

    try
    {
        NumberMessage& number =
            dynamic_cast<NumberMessage&>(*messages[0]);
        number.print();
    }
    catch (const std::bad_cast&)
    {
        std::cout << "reference cast failed\n";
    }

    int modifiable = 10;
    const int* readonly = &modifiable;
    int* writable = const_cast<int*>(readonly);
    *writable = 20;
    std::cout << "modifiable: " << modifiable << '\n';

    const std::uintptr_t address =
        reinterpret_cast<std::uintptr_t>(
            messages[0].get());
    std::cout << "nonzero address: "
              << std::boolalpha
              << (address != 0)
              << '\n';

    std::cout << "dynamic type is TextMessage: "
              << (typeid(*messages[0]) ==
                  typeid(TextMessage))
              << '\n';

    return 0;
}
```

使用 C++11 编译：

```bash
g++ -std=c++11 \
    -Wall -Wextra -Wpedantic \
    main.cpp -o main
```

预期输出：

```text
integer: 42
port: 8080
text: hello
text size: 5
number: 7
not a text message
reference cast failed
modifiable: 20
nonzero address: true
dynamic type is TextMessage: true
```

## 二十一、常见错误

### 21.1 把指针转换成 `int`

问题：目标整数可能无法容纳指针表示，64 位平台上尤其危险。

修正：如果只是打印，直接输出指针或使用 `%p`；确需整数表示时，使用实现提供的 `std::uintptr_t` 并限制用途。

### 21.2 使用 `%x` 打印指针

问题：格式说明符与指针实参类型不匹配，属于未定义行为。

修正：

```cpp
std::printf("%p", static_cast<void*>(pointer));
```

### 21.3 修改真正的常量对象

```cpp
const int value = 10;
*const_cast<int*>(&value) = 20;
```

问题：未定义行为。

修正：不要修改；如果业务上需要改变，就不要把原对象定义为 `const`。

### 21.4 用 `static_cast` 盲目向下转型

问题：不验证动态类型，错误对象被当成派生类使用时产生未定义行为。

修正：不能严格证明类型时使用 `dynamic_cast` 或重新设计虚接口。

### 21.5 忘记检查 `dynamic_cast` 指针结果

```cpp
Derived* derived = dynamic_cast<Derived*>(base);
derived->run();
```

问题：转换失败后 `derived` 为空。

修正：先判断结果是否为 `nullptr`。

### 21.6 认为引用转换失败会返回空引用

引用没有空值。`dynamic_cast<Derived&>` 失败会抛出 `std::bad_cast`。

### 21.7 在非多态基类上进行运行期向下转换

问题：缺少运行时类型信息，`dynamic_cast` 不能完成常规多态向下转换。

修正：需要多态删除和识别时，为基类设计虚析构函数或其他虚函数。

### 21.8 通过 `reinterpret_cast` 后直接解引用无关类型

问题：可能违反对齐、对象生命周期和严格别名规则。

修正：明确对象真实类型；读取平凡对象表示时使用字符视图或 `memcpy`。

### 21.9 用对象内存布局作为网络协议

问题：填充、字节序、ABI 和非平凡成员导致不可移植。

修正：逐字段序列化并明确协议宽度、符号和网络字节序。

### 21.10 依赖 `type_info::name()` 文本

问题：返回内容由实现决定，可能经过名称修饰。

修正：程序逻辑使用类型比较、虚函数或稳定业务标识。

### 21.11 滥用隐式单参数构造

问题：参数类型错误时编译器可能悄悄创建临时对象。

修正：默认给单实参构造函数添加 `explicit`，除非隐式转换确实自然。

### 21.12 以为显式转换会检查数值范围

问题：`static_cast<int>(large_value)` 不会自动抛异常或进行饱和转换。

修正：转换前显式检查范围和特殊浮点值。

## 二十二、编译器警告与检查工具

GCC/Clang 可以启用：

```bash
g++ -std=c++11 \
    -Wall -Wextra -Wpedantic \
    -Wconversion \
    -Wsign-conversion \
    -Wold-style-cast \
    main.cpp -o main
```

常用作用：

- `-Wconversion`：提示可能改变值的隐式转换；
- `-Wsign-conversion`：提示有符号与无符号转换；
- `-Wold-style-cast`：提示 C 风格强制转换；
- `-Wfloat-conversion`：更聚焦浮点相关转换，具体支持取决于编译器。

警告数量可能较多，旧项目可以逐模块启用，不应该简单地整体关闭。

运行期还可结合：

```bash
-fsanitize=undefined
-fsanitize=address
```

它们可以发现部分无效向下转型、越界、对齐和内存访问错误，但不能证明所有转换都正确。

## 二十三、面试常见问题

### 23.1 C++有哪四种命名类型转换

`static_cast`、`dynamic_cast`、`const_cast` 和 `reinterpret_cast`。

### 23.2 为什么不推荐 C 风格转换

它把数值转换、层次转换、去除常量性和底层重解释混在同一种语法里，意图不清晰，还可能组合完成更危险的操作。

### 23.3 `static_cast` 的典型用途是什么

数值类型转换、枚举转换、相关类层次的编译期转换、`void*` 恢复原对象指针以及显式调用用户定义转换。

### 23.4 `dynamic_cast` 的使用条件是什么

多态运行期向下或横向转换通常要求源类具有虚函数。继承关系还必须满足可访问性和无歧义等要求。

### 23.5 `dynamic_cast` 失败会怎样

目标为指针时返回 `nullptr`；目标为引用时抛出 `std::bad_cast`。

### 23.6 `static_cast` 向下转型和 `dynamic_cast` 有什么区别

`static_cast` 不检查运行时真实类型，依赖程序员保证；`dynamic_cast` 使用 RTTI 验证多态对象类型，失败时给出空指针或异常。

### 23.7 `const_cast` 后一定能修改对象吗

不能。如果原对象本来就是 `const`，通过去除限定后的指针或引用写入属于未定义行为。只有原对象本来可修改时，才可能安全写入。

### 23.8 `reinterpret_cast` 会创建新的目标对象吗

不会。它通常只改变编译器看待某个值或地址的方式，不会在该内存上自动构造一个合法目标对象。

### 23.9 如何安全查看浮点数位表示

C++11 对平凡可复制类型使用 `std::memcpy`；C++20 可以使用 `std::bit_cast`。不要通过无关类型指针直接解引用。

### 23.10 RTTI包含什么

主要包括 `dynamic_cast`、`typeid` 和 `std::type_info`。

### 23.11 `typeid` 得到静态类型还是动态类型

对多态类型的合适左值表达式，会反映动态类型；对非多态表达式通常反映静态类型。

### 23.12 `explicit` 有什么作用

它阻止构造函数或转换运算符参与不期望的隐式转换，但仍允许显式构造或显式转换。

### 23.13 为什么 `explicit operator bool` 还能用于 `if`

布尔条件属于上下文布尔转换，语言允许显式布尔转换运算符在这些位置使用，同时避免它继续隐式转换成整数参与算术。

### 23.14 类型转换会改变对象所有权吗

不会。转换只改变类型或访问方式，资源由谁释放、对象活多久仍由原所有权协议决定。

## 二十四、实践建议

1. 优先修改接口和数据模型，减少不必要的转换；
2. 使用花括号初始化阻止意外窄化；
3. 单实参构造函数默认考虑 `explicit`；
4. 数值转换前检查范围、符号和特殊浮点值；
5. 多态向下转换不能证明真实类型时使用 `dynamic_cast`；
6. 优先设计虚接口，避免到处判断派生类型；
7. 只用 `const_cast` 适配受控接口，不修改真正常量对象；
8. 把 `reinterpret_cast` 限制在平台边界和极小作用域；
9. 不要把指针保存到 `int` 中；
10. `printf` 打印指针使用 `%p`；
11. 不通过无关类型指针解引用实现类型双关；
12. 不把 C++ 对象内存布局直接作为网络或文件协议；
13. `shared_ptr` 转换使用对应的 `pointer_cast` 函数；
14. 类型转换不负责对象生命周期和所有权；
15. 开启转换警告和 Sanitizer，并认真处理诊断。

## 二十五、总结

C++ 类型转换的重点是选择正确语义并满足转换前提：

- 隐式转换简洁，但可能隐藏精度、符号和生命周期风险；
- `static_cast` 处理编译期可验证的相关转换，不提供运行期类型保证；
- `dynamic_cast` 在多态类层次中检查动态类型；
- `const_cast` 只改变限定，不能把真正常量对象变成可写对象；
- `reinterpret_cast` 面向底层表示，不会自动创造合法目标对象；
- `explicit` 阻止不期望的用户定义隐式转换；
- `typeid` 和 `dynamic_cast` 构成主要 RTTI 设施；
- 命名转换提升的是意图可见性，不是把危险操作自动变安全。

可以把使用原则概括为：

```text
能不转就不转；
必须转换时，用语义最窄的命名转换；
转换前证明前提，转换后限制作用域。
```
