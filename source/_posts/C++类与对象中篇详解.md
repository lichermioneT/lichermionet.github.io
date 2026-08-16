---
title: C++类与对象（中篇）：构造析构、深浅拷贝与运算符重载
date: 2026-08-15 19:00:00
categories:
  - C++
tags:
  - C++
  - 类与对象
  - 构造函数
  - 析构函数
  - 拷贝构造
  - 运算符重载
  - const成员函数
---

类定义了对象的数据和行为，而构造、析构与拷贝语义决定了对象如何出生、如何复制、如何赋值以及如何结束生命周期。

如果一个类只包含`int`等值类型，编译器生成的成员函数往往已经够用；一旦类直接管理堆内存、文件、锁或网络连接，错误的复制与释放就可能导致内存泄漏、重复释放和悬空指针。

本文系统讲解构造函数、析构函数、拷贝构造、赋值运算符、深浅拷贝、运算符重载、`const`成员函数和取地址运算符，并补充C++11的移动语义、Rule of Three、Rule of Five与Rule of Zero。

<!-- more -->

## 一、对象生命周期与特殊成员函数

### 1.1 一个对象会经历什么

一个普通类对象的生命周期可以概括为：

```text
获得存储
   ↓
构造并开始生命周期
   ↓
使用、复制或赋值
   ↓
析构并结束生命周期
   ↓
释放或回收存储
```

构造函数主要负责初始化对象，析构函数主要负责结束对象拥有资源的生命周期。

需要注意：

- 构造函数通常不负责决定对象存储来自栈还是堆；
- 析构函数负责清理对象管理的资源，但对象存储何时回收取决于存储期；
- `new`表达式包含分配存储和构造对象两个阶段；
- `delete`表达式包含调用析构函数和释放存储两个阶段。

### 1.2 传统“六个默认成员函数”的教学口径

一些入门资料把下面六项称为编译器提供的默认成员函数：

1. 默认构造函数；
2. 析构函数；
3. 拷贝构造函数；
4. 拷贝赋值运算符；
5. 普通对象取地址；
6. `const`对象取地址。

这种分类便于教学，但从现代C++标准术语看并不严谨。

### 1.3 现代C++中的特殊成员函数

C++11以后，通常把以下六个称为special member functions：

1. 默认构造函数；
2. 析构函数；
3. 拷贝构造函数；
4. 拷贝赋值运算符；
5. 移动构造函数；
6. 移动赋值运算符。

`operator&`并不是标准术语中的特殊成员函数。普通取地址行为来自内置运算符；只有显式声明`operator&`时，才形成用户定义的运算符重载。

### 1.4 “编译器生成”也有条件

并不是所有特殊成员函数都会无条件生成可用实现。更准确的过程包括：

- 隐式声明；
- 在实际需要时隐式定义；
- 因成员或基类限制而被定义为删除；
- 因用户声明了其他特殊成员函数而不再隐式声明某些移动操作。

因此，看到一个空类时，不能简单理解为编译器立即向类中塞入若干普通函数代码。

## 二、构造函数

### 2.1 为什么需要构造函数

如果创建对象后再手动调用初始化函数，调用者可能忘记初始化：

```cpp
class Date
{
public:
    void setDate(int year, int month, int day)
    {
        _year = year;
        _month = month;
        _day = day;
    }

private:
    int _year;
    int _month;
    int _day;
};
```

```cpp
Date date;
// 忘记调用date.setDate(...)
```

构造函数让对象在生命周期开始时自动完成初始化。

### 2.2 构造函数的基本特征

- 函数名与类名相同；
- 不写返回类型，连`void`也不能写；
- 创建对象时自动调用；
- 可以重载；
- 可以带默认参数；
- 可以使用成员初始化列表；
- 主要职责是建立有效对象状态。

```cpp
class Date
{
public:
    Date()
        : _year(1970), _month(1), _day(1)
    {}

    Date(int year, int month, int day)
        : _year(year), _month(month), _day(day)
    {}

private:
    int _year;
    int _month;
    int _day;
};
```

### 2.3 构造函数不是普通成员函数

下面的写法是错误的：

```text
void Date();
```

一旦写出返回类型，它就不再是合法构造函数声明。

构造函数也不能像普通成员函数那样通过对象显式重复调用：

```text
Date date;
date.Date(); // 错误
```

如果需要重置状态，应提供语义明确的`reset`或`set`接口。

### 2.4 默认构造函数

能够在不提供实参的情况下被调用的构造函数称为默认构造函数。

#### 无参构造函数

```cpp
Date()
    : _year(1970), _month(1), _day(1)
{}
```

#### 全缺省构造函数

```cpp
Date(int year = 1970, int month = 1, int day = 1)
    : _year(year), _month(month), _day(day)
{}
```

两者都能用`Date date;`调用，因此不能在同一个类中同时保留这两个版本，否则默认构造会产生二义性。

### 2.5 编译器隐式声明的默认构造函数

如果类没有用户声明的构造函数，编译器通常会隐式声明默认构造函数：

```cpp
class Date
{
private:
    int _year;
    int _month;
    int _day;
};

Date date;
```

但这个构造函数不会自动把所有内置类型成员设为零。对上面的局部对象进行默认初始化时，三个`int`成员可能具有不确定值，读取它们会造成严重问题。

### 2.6 类类型成员会调用自己的构造函数

```cpp
#include <iostream>

class Time
{
public:
    Time()
        : _hour(0), _minute(0), _second(0)
    {
        std::cout << "Time()\n";
    }

private:
    int _hour;
    int _minute;
    int _second;
};

class Date
{
private:
    int _year;
    Time _time;
};
```

创建`Date`对象时，即使`Date`没有手写构造函数，`_time`也会调用`Time`的默认构造函数。

相比之下，如果`_year`没有默认成员初始化器，它不会自动得到有意义的业务值。

### 2.7 C++11默认成员初始化器

C++11可以直接在类定义中给非静态数据成员提供默认值：

```cpp
class Date
{
private:
    int _year = 1970;
    int _month = 1;
    int _day = 1;
};
```

如果某个构造函数没有在初始化列表中显式初始化该成员，就会使用默认成员初始化器。

```cpp
class Date
{
public:
    Date() = default;

    explicit Date(int year)
        : _year(year)
    {}

private:
    int _year = 1970;
    int _month = 1;
    int _day = 1;
};
```

调用`Date(2026)`时，`_year`取2026，另外两个成员继续使用1。

### 2.8 用户声明构造函数后的影响

一旦用户声明了构造函数，编译器不会再因为“缺少无参版本”自动补一个默认构造函数。

```cpp
class Date
{
public:
    Date(int year, int month, int day);
};

// Date date; // 错误：没有可用的默认构造函数
```

需要无参构造时，应显式提供：

```cpp
Date() = default;
```

前提是各成员和基类允许这样默认构造。

### 2.9 最令人烦恼的解析

```cpp
Date first;
Date second(2026, 8, 15);
Date third();
```

`third`不是对象，而是一个函数声明：函数名为`third`，没有参数，返回`Date`。

这类现象被称为most vexing parse。C++11可以使用花括号避免歧义：

```cpp
Date third{};
Date fourth{2026, 8, 15};
```

### 2.10 单参数构造函数与`explicit`

```cpp
class Distance
{
public:
    Distance(int meters)
        : _meters(meters)
    {}

private:
    int _meters;
};
```

没有`explicit`时，编译器可能允许：

```cpp
Distance distance = 100;
```

如果这种隐式转换不是接口本意，应写成：

```cpp
explicit Distance(int meters)
    : _meters(meters)
{}
```

这样可以减少意外类型转换。

## 三、成员初始化列表

### 3.1 初始化与赋值不是一回事

下面的构造函数先完成成员初始化，再在函数体中赋值：

```cpp
Date(int year, int month, int day)
{
    _year = year;
    _month = month;
    _day = day;
}
```

对于`int`差异不大，但类类型成员可能先默认构造，再执行赋值，造成额外工作。

推荐使用初始化列表：

```cpp
Date(int year, int month, int day)
    : _year(year), _month(month), _day(day)
{}
```

### 3.2 必须使用初始化列表的成员

常见情况包括：

- 引用成员；
- `const`数据成员；
- 没有默认构造函数的类类型成员；
- 需要调用特定基类构造函数的基类子对象。

```cpp
class Example
{
public:
    Example(int& reference, int id)
        : _reference(reference), _id(id), _value(id * 2)
    {}

private:
    int& _reference;
    const int _id;
    int _value;
};
```

### 3.3 真正的初始化顺序

成员按照它们在类中声明的顺序初始化，与初始化列表书写顺序无关。

```cpp
class Example
{
public:
    Example(int value)
        : _second(value), _first(_second)
    {}

private:
    int _first;
    int _second;
};
```

实际先初始化`_first`，此时`_second`还没有初始化，代码存在问题。

正确写法：

```cpp
class Example
{
public:
    Example(int value)
        : _first(value), _second(_first)
    {}

private:
    int _first;
    int _second;
};
```

建议让初始化列表顺序与成员声明顺序一致，并开启编译器警告。

### 3.4 委托构造函数

C++11允许一个构造函数委托给同类的另一个构造函数：

```cpp
class Date
{
public:
    Date()
        : Date(1970, 1, 1)
    {}

    Date(int year, int month, int day)
        : _year(year), _month(month), _day(day)
    {}

private:
    int _year;
    int _month;
    int _day;
};
```

这样可以集中初始化逻辑，避免多个构造函数重复代码。

## 四、析构函数

### 4.1 析构函数的作用

析构函数在对象生命周期结束时执行，用于释放对象所拥有的资源。

```cpp
class Buffer
{
public:
    explicit Buffer(std::size_t size)
        : _data(new char[size]), _size(size)
    {}

    ~Buffer()
    {
        delete[] _data;
    }

private:
    char* _data;
    std::size_t _size;
};
```

### 4.2 析构函数的基本特征

- 名字是`~类名`；
- 没有返回类型；
- 不能接收参数；
- 不能重载出多个普通析构函数；
- 对象生命周期结束时自动调用；
- 如果未显式声明，编译器可能隐式声明析构函数。

```cpp
~Buffer();
```

### 4.3 析构不等于释放对象存储

对于局部对象：

```cpp
void function()
{
    Buffer buffer(1024);
}
```

离开作用域时先调用`buffer`的析构函数，之后自动存储区域由运行环境回收。

对于动态对象：

```cpp
Buffer* pointer = new Buffer(1024);
delete pointer;
```

`delete`先调用析构函数，再释放保存对象本身的动态存储。

析构函数内部的`delete[] _data`释放的是对象所拥有的缓冲区，而不是`Buffer`对象自己的存储。

### 4.4 析构顺序

一般遵循“后构造，先析构”：

- 局部对象按构造顺序的逆序析构；
- 数组元素按下标逆序析构；
- 数据成员按声明顺序的逆序析构；
- 派生类析构主体结束后，再析构基类部分。

```cpp
class A {};
class B {};

class Owner
{
private:
    A _a;
    B _b;
};
```

构造时先`_a`后`_b`，析构时先`_b`后`_a`。

### 4.5 编译器生成的析构函数会做什么

隐式定义的析构函数会按照规则析构非静态类类型成员和基类子对象。

```cpp
class Name
{
public:
    ~Name()
    {
        std::cout << "~Name()\n";
    }
};

class Person
{
private:
    Name _name;
    int _age;
};
```

`Person`对象销毁时，即使没有手写`~Person()`，`_name`的析构函数仍会被调用。

但如果类只保存一个拥有堆内存的裸指针，编译器无法知道该指针是否拥有资源，也不会自动对它执行`delete[]`。

### 4.6 RAII

RAII是Resource Acquisition Is Initialization的缩写，即资源获取即初始化。

核心思想是：

- 在对象构造时获得资源；
- 在对象析构时释放资源；
- 让资源生命周期绑定到对象生命周期；
- 即使函数提前返回或抛出异常，也能自动清理。

标准库中的`std::string`、`std::vector`、`std::unique_ptr`、文件流和锁管理器都体现了RAII。

### 4.7 析构函数中不必机械地把成员清零

```cpp
~Buffer()
{
    delete[] _data;
    _data = nullptr;
    _size = 0;
}
```

对象马上结束生命周期时，清零成员通常没有实际意义。关键是正确释放一次资源。

设为`nullptr`对某些调试场景有帮助，但不能修复对象外部已经存在的悬空指针。

### 4.8 多态基类的析构函数

如果类要作为多态基类并通过基类指针删除派生对象，析构函数应当是虚函数：

```cpp
class Base
{
public:
    virtual ~Base() = default;
};
```

否则通过`Base*`执行`delete`可能产生未定义行为。该问题会在多态章节进一步展开。

## 五、拷贝构造函数

### 5.1 什么是拷贝构造

使用一个已有对象初始化同类型的新对象时，会涉及拷贝构造：

```cpp
Date first(2026, 8, 15);
Date second(first);
Date third = first;
```

`second`和`third`都是新对象，因此这里是初始化，不是赋值。

### 5.2 典型声明

```cpp
class Date
{
public:
    Date(const Date& other)
        : _year(other._year),
          _month(other._month),
          _day(other._day)
    {}

private:
    int _year;
    int _month;
    int _day;
};
```

最常见的参数类型是`const ClassName&`，因为它：

- 避免为了传参再次拷贝；
- 可以读取源对象；
- 能绑定`const`对象；
- 能绑定许多临时对象场景。

### 5.3 为什么不能按值接收

```text
Date(Date other);
```

为了把实参传给`other`，必须先构造`other`，而构造`other`又需要调用拷贝构造，逻辑会无限递归。因此这种形式不能作为有效的普通拷贝构造接口。

标准定义还允许拷贝构造函数在第一个引用参数后带有额外的默认参数，但工程代码几乎都使用单个`const T&`参数的清晰形式。

### 5.4 哪些场景可能发生拷贝构造

- 用已有对象直接初始化新对象；
- 按值向函数传递对象；
- 函数按值返回对象；
- 抛出或捕获异常对象；
- 容器复制元素。

不过，编译器可能进行拷贝消除。C++11允许多种返回值优化，C++17又强化了部分场景的保证，因此不能只靠打印拷贝构造日志推断抽象语义。

### 5.5 隐式生成的拷贝构造是逐成员拷贝

如果没有显式声明拷贝构造，编译器可能生成一个，对基类子对象和非静态数据成员依次进行拷贝构造。

```cpp
class Date
{
private:
    int _year = 1970;
    int _month = 1;
    int _day = 1;
};
```

这个类的默认拷贝构造通常完全够用。

把它描述为“按字节复制”并不准确：

- 类类型成员会调用自己的拷贝构造函数；
- 基类子对象也按相应规则复制；
- 填充字节不构成有意义的成员值；
- 编译器实现不需要真的调用`memcpy`。

更准确的术语是成员级复制或逐成员复制。

## 六、浅拷贝与深拷贝

### 6.1 浅拷贝为什么危险

```cpp
class String
{
public:
    explicit String(const char* text)
    {
        _data = new char[std::strlen(text) + 1];
        std::strcpy(_data, text);
    }

    ~String()
    {
        delete[] _data;
    }

private:
    char* _data;
};
```

如果使用编译器生成的拷贝构造：

```cpp
String first("hello");
String second(first);
```

逐成员复制会复制`_data`中的地址：

```text
first._data  ─┐
              ├──> 同一块字符数组
second._data ─┘
```

两个对象都认为自己拥有同一资源，析构时会重复`delete[]`，产生未定义行为。

### 6.2 深拷贝

深拷贝为新对象申请独立资源，并复制资源内容：

```cpp
String(const String& other)
{
    _data = new char[std::strlen(other._data) + 1];
    std::strcpy(_data, other._data);
}
```

结果：

```text
first._data  ───> 第一块字符数组：hello
second._data ───> 第二块字符数组：hello
```

修改`second`不会影响`first`，两个对象析构时也分别释放自己的资源。

### 6.3 浅拷贝不一定永远错误

问题的根源不是“复制了指针”，而是没有明确所有权语义。

以下情况可能合理：

- 指针只是观察者，不拥有资源；
- 多个对象通过引用计数共享资源；
- 对象采用写时复制；
- 指向具有全局或更长生命周期的数据。

关键是类必须清楚表达资源由谁拥有、能否共享、何时释放。

### 6.4 优先使用标准资源管理类型

真实工程中，字符串应优先使用`std::string`，动态数组优先使用`std::vector`，独占动态对象优先使用`std::unique_ptr`。

```cpp
class Message
{
private:
    std::string _text;
    std::vector<int> _codes;
};
```

这些成员已经实现正确的构造、析构、拷贝和移动，外层类通常不需要手写资源管理逻辑。

## 七、运算符重载基础

### 7.1 什么是运算符重载

运算符重载允许用户定义类型使用符合直觉的运算符语法。

```cpp
class Date
{
public:
    bool operator==(const Date& other) const
    {
        return _year == other._year &&
               _month == other._month &&
               _day == other._day;
    }

private:
    int _year;
    int _month;
    int _day;
};
```

调用：

```cpp
if (first == second)
{
    // 日期相同
}
```

成员形式大致对应：

```cpp
first.operator==(second);
```

### 7.2 运算符函数名

基本形式：

```text
返回类型 operator运算符(参数列表)
```

例如：

```cpp
bool operator==(const Date& other) const;
Date& operator+=(int days);
Date operator+(int days) const;
```

### 7.3 不能改变的规则

运算符重载不能：

- 创建语言中不存在的新运算符；
- 改变运算符优先级；
- 改变结合性；
- 改变固定的操作数个数；
- 改变纯内置类型运算符的原有含义。

至少有一个操作数必须是类类型或枚举类型。

### 7.4 不能重载的运算符或语言构造

常见不能重载的包括：

```text
::
.
.*
?:
sizeof
typeid
alignof
```

其中前四个是常见的不可重载运算符，后几个属于不能通过`operator`函数自定义行为的语言构造。

### 7.5 成员形式为什么少一个参数

二元运算符写成成员函数时，左操作数由隐式`this`表示：

```cpp
bool Date::operator==(const Date& other) const;
```

概念上：

```text
left == right
left.operator==(right)
```

因此显式参数列表只有右操作数。

### 7.6 成员函数还是非成员函数

成员函数能够直接访问私有成员，适合赋值、下标、调用等与左操作数强相关的运算符。

非成员函数能让左右操作数更对称，并允许左侧也参与隐式转换。需要访问私有成员时，可以使用公开接口或在确有必要时声明友元。

例如输出运算符通常写成非成员函数：

```cpp
std::ostream& operator<<(std::ostream& output, const Date& date);
```

左操作数是`std::ostream`，不可能把它实现为`Date`的成员函数。

### 7.7 语义应该符合直觉

技术上可以让`Date::operator+`执行删除文件，但这种设计严重违背使用者预期。

良好的重载应该：

- 保持运算符惯常含义；
- 不制造惊讶副作用；
- 与复合赋值、比较等相关运算保持一致；
- 对不会修改对象的操作使用`const`。

## 八、拷贝赋值运算符

### 8.1 赋值与拷贝构造的区别

```cpp
Date first(2026, 8, 15);
Date second(first); // 拷贝构造：创建新对象

Date third;
third = first;      // 拷贝赋值：修改已有对象
```

判断关键是目标对象是否已经存在。

### 8.2 典型写法

```cpp
class Date
{
public:
    Date& operator=(const Date& other)
    {
        if (this != &other)
        {
            _year = other._year;
            _month = other._month;
            _day = other._day;
        }

        return *this;
    }

private:
    int _year;
    int _month;
    int _day;
};
```

### 8.3 为什么参数使用`const T&`

- 引用避免传参时额外复制；
- `const`保证不会修改右操作数；
- 可以接受`const`对象；
- 符合赋值“读取右侧、修改左侧”的语义。

### 8.4 为什么返回`T&`

返回左操作数自身可以支持连续赋值：

```cpp
first = second = third;
```

运算顺序大致是：

```text
second.operator=(third)
first.operator=(返回的second)
```

返回引用还能避免不必要的结果对象复制。

### 8.5 自赋值检查

```cpp
object = object;
```

值类型的逐成员赋值通常不会出错，但资源管理类若先释放左侧资源，再读取右侧数据，自赋值就会读取已经释放的资源。

```cpp
if (this == &other)
{
    return *this;
}
```

手工资源管理时要保证自赋值安全。是否显式检查，取决于具体实现策略。

### 8.6 深拷贝赋值与异常安全

一个安全思路是先复制成功，再替换当前资源：

```cpp
String& operator=(const String& other)
{
    if (this != &other)
    {
        String temporary(other);
        swap(temporary);
    }

    return *this;
}
```

如果构造`temporary`时内存分配失败，当前对象尚未改变。成功后交换资源，临时对象析构时释放旧资源。

这种技术称为copy-and-swap。

### 8.7 编译器生成的拷贝赋值

如果没有用户声明拷贝赋值，编译器可能隐式声明并生成逐成员赋值：

```cpp
class Date
{
private:
    int _year;
    int _month;
    int _day;
};
```

该实现对值语义成员通常正确。

如果成员中包含独占资源的裸指针，默认逐成员赋值只会复制地址，可能泄漏左侧原资源，并造成右侧资源被重复释放。

## 九、Rule of Three、Five与Zero

### 9.1 Rule of Three

如果类需要自定义以下任意一个：

- 析构函数；
- 拷贝构造函数；
- 拷贝赋值运算符；

通常意味着类直接管理资源，应该同时认真检查另外两个是否也需要自定义。

这称为Rule of Three。

### 9.2 Rule of Five

C++11加入移动语义后，资源管理类还要考虑：

- 移动构造函数；
- 移动赋值运算符。

加上Rule of Three中的三个操作，形成Rule of Five。

```cpp
class Buffer
{
public:
    Buffer(const Buffer& other);
    Buffer& operator=(const Buffer& other);

    Buffer(Buffer&& other) noexcept;
    Buffer& operator=(Buffer&& other) noexcept;

    ~Buffer();
};
```

移动操作转移资源所有权，通常不复制底层数据。

### 9.3 Rule of Zero

更推荐的设计是让类不直接管理裸资源，而使用已经正确实现资源语义的成员：

```cpp
class Document
{
private:
    std::string _title;
    std::vector<std::string> _lines;
};
```

此时通常无需手写析构、拷贝或移动操作，编译器生成的逐成员行为就能正确工作。

这称为Rule of Zero，也是现代C++最优先的方向。

### 9.4 用户声明析构函数对移动操作的影响

用户声明析构函数、拷贝构造或拷贝赋值等操作，可能抑制编译器隐式声明移动构造和移动赋值。

因此不能想当然地认为“写了析构函数以后，编译器还会自动给我最优移动操作”。资源类应明确设计自己的复制与移动策略。

## 十、C++11移动语义补充

### 10.1 移动构造函数

```cpp
Buffer(Buffer&& other) noexcept
    : _data(other._data), _size(other._size)
{
    other._data = nullptr;
    other._size = 0;
}
```

它直接接管`other`拥有的资源，然后把源对象置于有效但内容未指定或约定为空的状态。

### 10.2 移动赋值运算符

```cpp
Buffer& operator=(Buffer&& other) noexcept
{
    if (this != &other)
    {
        delete[] _data;

        _data = other._data;
        _size = other._size;

        other._data = nullptr;
        other._size = 0;
    }

    return *this;
}
```

左对象先释放自己的旧资源，再接管右对象资源。

### 10.3 为什么移动操作常标记`noexcept`

许多标准容器在扩容时，只有确认元素移动不会抛出异常，才更愿意使用移动构造；否则可能为了强异常保证而退回拷贝。

如果移动操作确实只进行指针交换或所有权转移，应考虑标记`noexcept`。

### 10.4 `std::move`本身不移动数据

```cpp
Buffer destination(std::move(source));
```

`std::move`主要执行类型转换，把表达式转换为可匹配移动操作的右值形式。真正的资源转移由移动构造或移动赋值完成。

使用后，`source`仍然是一个必须可以析构和重新赋值的有效对象，但它的具体内容取决于类型约定。

## 十一、日期类中的常见运算符

### 11.1 比较运算符

```cpp
class Date
{
public:
    bool operator==(const Date& other) const
    {
        return _year == other._year &&
               _month == other._month &&
               _day == other._day;
    }

    bool operator!=(const Date& other) const
    {
        return !(*this == other);
    }

private:
    int _year;
    int _month;
    int _day;
};
```

尽量通过一个基础运算符推导其他运算符，减少重复逻辑。

### 11.2 复合赋值与普通加法

```cpp
Date& operator+=(int days)
{
    // 修改当前日期
    return *this;
}

Date operator+(int days) const
{
    Date result(*this);
    result += days;
    return result;
}
```

`+=`修改当前对象并返回引用；`+`不修改原对象，而是返回一个新值。

### 11.3 前置与后置自增

```cpp
Date& operator++()
{
    *this += 1;
    return *this;
}

Date operator++(int)
{
    Date old(*this);
    *this += 1;
    return old;
}
```

后置版本的`int`参数只是语法标记，用于区分前置版本，并不表示调用者真的传入一个有业务意义的整数。

通常：

- 前置`++`返回修改后的对象引用；
- 后置`++`返回修改前的对象值；
- 如果不需要旧值，前置版本通常更直接。

## 十二、`const`成员函数

### 12.1 基本语法

```cpp
class Date
{
public:
    void print() const
    {
        std::cout << _year << '-'
                  << _month << '-'
                  << _day << '\n';
    }

private:
    int _year;
    int _month;
    int _day;
};
```

`const`写在参数列表之后，表示该成员函数不会通过普通方式修改当前对象的逻辑状态。

### 12.2 `const`修饰隐式当前对象

非`const`成员函数中：

```text
decltype(this)是Date*
```

`const`成员函数中：

```text
decltype(this)是const Date*
```

因此不能通过`this`修改普通非静态数据成员。

### 12.3 `const`对象能调用哪些函数

```cpp
const Date date;
date.print();
```

`const`对象只能调用可访问的`const`成员函数，因为调用非`const`成员函数可能修改对象。

```text
const对象 -> const成员函数：可以
const对象 -> 非const成员函数：不可以
```

### 12.4 非`const`对象能调用`const`成员函数吗

可以。

```cpp
Date date;
date.print();
```

非`const`对象可以安全地临时接受“不会修改对象”的约束。

### 12.5 成员函数之间的调用

一般规则：

```text
const成员函数 -> 非const成员函数：不可以
非const成员函数 -> const成员函数：可以
```

原因是`const`成员函数中的当前对象是`const`视角，不能把它直接传给要求可修改对象的成员函数。

### 12.6 根据`const`重载成员函数

```cpp
class Buffer
{
public:
    char& at(std::size_t index)
    {
        return _data[index];
    }

    const char& at(std::size_t index) const
    {
        return _data[index];
    }

private:
    char* _data;
};
```

对于非`const`对象，调用可修改版本；对于`const`对象，调用只读版本。

标准容器的`operator[]`、`begin`和`data`等接口也经常采用这种设计。

### 12.7 `mutable`

某些不改变对象逻辑值的内部状态，可以声明为`mutable`：

```cpp
class Result
{
public:
    int value() const
    {
        ++_accessCount;
        return _value;
    }

private:
    int _value = 0;
    mutable std::size_t _accessCount = 0;
};
```

常见用途包括缓存、访问统计和同步原语。但`mutable`不应成为绕过`const`设计的随意工具。

### 12.8 `const`成员函数不保证深层对象都不变

```cpp
class PointerHolder
{
public:
    void modifyPointee() const
    {
        *_pointer = 100;
    }

private:
    int* _pointer;
};
```

`const`限制的是当前对象的非`mutable`数据成员。指针成员本身不能改为指向别处，但它指向的外部对象是否可修改，取决于指针类型。

这也是“位常量性”与“逻辑常量性”需要区别考虑的地方。

## 十三、取地址运算符

### 13.1 默认情况不需要重载

```cpp
Date date;
Date* pointer = &date;

const Date constDate;
const Date* constPointer = &constDate;
```

内置取地址运算符已经能根据对象的`const`属性返回正确指针，绝大多数类都不应自定义`operator&`。

### 13.2 自定义取地址运算符

```cpp
class Date
{
public:
    Date* operator&()
    {
        return this;
    }

    const Date* operator&() const
    {
        return this;
    }
};
```

这个实现与普通取地址效果接近，因此没有实际必要。

### 13.3 为什么重载`operator&`要非常谨慎

调用者通常默认`&object`一定获得对象真实地址。改变这一语义会破坏通用代码的直觉，甚至让底层工具无法正常工作。

如果某个类型重载了`operator&`，可以使用`std::addressof`绕开重载，获得真实地址：

```cpp
#include <memory>

Date* realAddress = std::addressof(date);
```

## 十四、`= default`与`= delete`

### 14.1 显式要求默认实现

```cpp
class Value
{
public:
    Value() = default;
    Value(const Value&) = default;
    Value& operator=(const Value&) = default;
    ~Value() = default;

private:
    int _number = 0;
};
```

`= default`明确表达“需要标准生成的语义”，比写一个空函数体更准确。

```cpp
Value() {}
```

空函数体与默认化构造函数在平凡性、初始化和类型特征等方面不一定相同。

### 14.2 禁止复制

```cpp
class UniqueResource
{
public:
    UniqueResource() = default;

    UniqueResource(const UniqueResource&) = delete;
    UniqueResource& operator=(const UniqueResource&) = delete;
};
```

```text
UniqueResource first;
UniqueResource second(first); // 编译错误
```

互斥锁、独占文件句柄和某些单例对象通常不允许复制。

### 14.3 删除并不等于函数不存在

被`= delete`的函数仍会参与名字查找与重载决议，但一旦成为最终选择，程序就是不合法的。这能提供清晰的编译期错误。

## 十五、综合示例：实现具备深拷贝和移动语义的字符串类

下面的`String`用于学习资源管理。真实项目应优先使用`std::string`。

```cpp
#include <algorithm>
#include <cstddef>
#include <cstring>
#include <iostream>
#include <utility>

class String
{
public:
    explicit String(const char* text = "")
        : _data(nullptr), _size(0)
    {
        if (text == nullptr)
        {
            text = "";
        }

        _size = std::strlen(text);
        _data = new char[_size + 1];
        std::copy(text, text + _size + 1, _data);
    }

    ~String()
    {
        delete[] _data;
    }

    String(const String& other)
        : _data(new char[other._size + 1]),
          _size(other._size)
    {
        std::copy(other.c_str(),
                  other.c_str() + _size + 1,
                  _data);
    }

    String& operator=(const String& other)
    {
        if (this != &other)
        {
            String temporary(other);
            swap(temporary);
        }

        return *this;
    }

    String(String&& other) noexcept
        : _data(other._data), _size(other._size)
    {
        other._data = nullptr;
        other._size = 0;
    }

    String& operator=(String&& other) noexcept
    {
        if (this != &other)
        {
            delete[] _data;

            _data = other._data;
            _size = other._size;

            other._data = nullptr;
            other._size = 0;
        }

        return *this;
    }

    void swap(String& other) noexcept
    {
        using std::swap;
        swap(_data, other._data);
        swap(_size, other._size);
    }

    char& operator[](std::size_t index)
    {
        return _data[index];
    }

    const char& operator[](std::size_t index) const
    {
        return _data[index];
    }

    bool operator==(const String& other) const
    {
        return _size == other._size &&
               std::strcmp(c_str(), other.c_str()) == 0;
    }

    bool operator!=(const String& other) const
    {
        return !(*this == other);
    }

    const char* c_str() const
    {
        return _data == nullptr ? "" : _data;
    }

    std::size_t size() const
    {
        return _size;
    }

private:
    char* _data;
    std::size_t _size;
};

int main()
{
    String first("alpha");

    String second(first);
    second[0] = 'A';

    String third("temporary");
    third = first;

    String fourth(std::move(third));

    String fifth("old");
    fifth = std::move(second);

    std::cout << "first: " << first.c_str() << '\n';
    std::cout << "fourth: " << fourth.c_str() << '\n';
    std::cout << "fifth: " << fifth.c_str() << '\n';
    std::cout << "third size: " << third.size() << '\n';
    std::cout << std::boolalpha
              << "first == fifth: " << (first == fifth) << '\n';

    return 0;
}
```

预期输出：

```text
first: alpha
fourth: alpha
fifth: Alpha
third size: 0
first == fifth: false
```

### 15.1 构造函数

根据字符串长度申请独立字符数组，并复制结尾的`'\0'`。

### 15.2 析构函数

使用`delete[]`释放构造函数中由`new[]`获得的数组，保证分配和释放形式匹配。

### 15.3 拷贝构造

为新对象申请独立内存，因此修改`second[0]`不会影响`first`。

### 15.4 拷贝赋值

使用copy-and-swap：先构造临时深拷贝，再交换资源，兼顾自赋值和异常安全。

### 15.5 移动构造与移动赋值

直接转移指针和长度，并把源对象置为空状态，避免复制整个字符数组。

### 15.6 `const`与非`const`下标重载

非`const`对象获得`char&`，可以修改字符；`const`对象获得`const char&`，只能读取。

### 15.7 比较运算符

`==`比较长度和字符内容，`!=`复用`==`，避免重复实现。

## 十六、常见错误与误区

### 16.1 构造函数写返回类型

问题：构造函数不能声明返回类型。

```text
void Date(); // 错误
```

### 16.2 同时声明无参和全缺省构造函数

问题：`Date date;`同时匹配两个构造函数，产生二义性。

### 16.3 把`Date object()`当成创建对象

问题：它通常被解析为函数声明。

修正：使用`Date object;`或`Date object{};`。

### 16.4 在构造函数体中给所有成员赋值

问题：类类型成员可能先默认构造再赋值，引用和`const`成员根本无法这样初始化。

修正：优先使用成员初始化列表。

### 16.5 让初始化列表顺序与声明顺序不一致

问题：真正顺序由成员声明顺序决定，可能读取尚未初始化的成员。

修正：初始化列表按声明顺序书写。

### 16.6 认为默认构造会把内置成员清零

问题：许多默认初始化场景下，内置类型成员仍可能具有不确定值。

修正：使用默认成员初始化器或构造初始化列表建立明确状态。

### 16.7 把默认拷贝称为真正的逐字节复制

问题：编译器按成员和基类的复制语义工作，类类型成员会调用自己的拷贝构造或赋值。

修正：使用“逐成员拷贝”描述更准确。

### 16.8 资源类只写析构函数

问题：默认拷贝可能复制资源地址，导致重复释放。

修正：遵循Rule of Three/Five，或者改用Rule of Zero。

### 16.9 拷贝赋值先释放资源再复制

问题：自赋值时右操作数资源也被释放；新分配失败时对象可能丢失原状态。

修正：进行自赋值保护，或使用copy-and-swap等安全策略。

### 16.10 `new[]`与`delete`混用

```text
char* data = new char[100];
delete data; // 错误，应该delete[] data
```

分配和释放形式必须匹配。

### 16.11 忘记让只读接口成为`const`成员函数

问题：`const`对象无法调用这些接口，类型的只读使用受到限制。

修正：不修改逻辑状态的观察函数应尽量声明为`const`。

### 16.12 滥用运算符重载

问题：重载行为违背运算符惯例，使代码难以理解。

修正：只在语义自然、可预测时重载运算符。

### 16.13 随意重载`operator&`

问题：破坏调用者对`&object`获取真实地址的基本预期。

修正：绝大多数类型使用内置取地址即可；必要时可用`std::addressof`绕过重载。

### 16.14 认为`std::move`会自动清空对象

问题：`std::move`只是转换表达式类别，真正行为由目标类型的移动操作决定。

修正：移动后只依赖该类型承诺的有效状态，不假设统一内容。

## 十七、面试常见问题

### 17.1 构造函数的作用是什么

构造函数在对象生命周期开始时初始化基类和数据成员，建立类所要求的有效状态。它通常不负责决定对象存储由栈还是堆提供。

### 17.2 什么是默认构造函数

能够在不提供实参时调用的构造函数，包括无参构造函数、所有参数都有默认值的构造函数，以及满足条件时编译器隐式生成的构造函数。

### 17.3 编译器生成的默认构造会把成员清零吗

不保证。类类型成员会按自己的构造规则初始化，但没有默认成员初始化器的内置类型成员在某些默认初始化场景中可能具有不确定值。

### 17.4 初始化列表和构造函数体赋值有什么区别

初始化列表直接初始化成员；函数体赋值发生在成员已经初始化之后。引用、`const`成员和无默认构造函数的类类型成员必须通过初始化列表初始化。

### 17.5 成员按什么顺序初始化

按成员在类中的声明顺序初始化，与初始化列表中的书写顺序无关；析构时按相反顺序进行。

### 17.6 析构函数会释放对象本身的内存吗

析构函数负责清理对象拥有的资源并结束相应子对象生命周期。对象自身存储的回收由存储期或`delete`表达式的后续阶段处理。

### 17.7 什么是拷贝构造函数

它使用一个已有同类型对象初始化新对象，典型签名是`T(const T&)`。

### 17.8 为什么拷贝构造参数要使用引用

如果按值接收，为了构造形参本身又需要拷贝构造，形成无法完成的递归依赖。使用`const T&`还可避免额外复制并接受常对象。

### 17.9 默认拷贝是浅拷贝吗

默认拷贝执行逐成员复制。对于裸指针成员，复制结果只是相同地址，因此当该指针代表独占资源时会表现出危险的浅拷贝问题；对于`std::string`等值语义成员，其自身拷贝规则通常已经正确。

### 17.10 拷贝构造与拷贝赋值有什么区别

拷贝构造初始化一个尚未存在的新对象；拷贝赋值修改一个已经完成构造的对象。

### 17.11 赋值运算符为什么返回`T&`

为了符合内置类型赋值语义、支持连续赋值，并避免无意义的结果复制，通常返回`*this`的引用。

### 17.12 什么是自赋值

左右操作数是同一个对象，例如`object = object`。资源管理类必须确保自赋值不会提前释放随后仍需读取的资源。

### 17.13 什么是Rule of Three

如果类需要自定义析构、拷贝构造或拷贝赋值中的一个，通常应该同时检查另外两个，因为它们共同决定资源的复制与释放。

### 17.14 什么是Rule of Five

在Rule of Three基础上，加上移动构造和移动赋值。直接管理资源的C++11类应完整考虑这五项。

### 17.15 什么是Rule of Zero

让类使用标准容器、字符串和智能指针等RAII成员管理资源，从而不必手写析构、复制和移动逻辑。

### 17.16 运算符重载有哪些限制

不能创造新运算符，不能改变优先级、结合性和操作数个数，至少一个操作数必须是类或枚举类型，也不能重定义纯内置类型运算的含义。

### 17.17 `const`对象能调用非`const`成员函数吗

不能。非`const`成员函数可能修改对象。非`const`对象可以调用`const`成员函数。

### 17.18 `const`成员函数能调用非`const`成员函数吗

通常不能，因为它持有当前对象的`const`视角；反过来，非`const`成员函数可以调用`const`成员函数。

### 17.19 为什么通常不重载取地址运算符

调用者普遍期望`&object`返回真实对象地址。改变该语义会破坏通用代码和直觉，绝大多数类使用内置行为即可。

### 17.20 `= default`和空函数体一样吗

不完全一样。默认化函数保留标准生成语义，并可能影响平凡性、类型特征和初始化行为；空函数体是用户提供的具体实现。

## 十八、学习建议

### 18.1 用日志观察生命周期

在每个特殊成员函数中临时打印函数名：

```cpp
Date() { std::cout << "Date()\n"; }
Date(const Date&) { std::cout << "Date(const Date&)\n"; }
Date& operator=(const Date&) {
    std::cout << "operator=\n";
    return *this;
}
~Date() { std::cout << "~Date()\n"; }
```

分别测试局部对象、按值传参、按值返回、容器扩容与异常路径。

### 18.2 关闭拷贝消除进行学习实验

GCC学习实验可使用：

```bash
g++ -std=c++11 -fno-elide-constructors example.cpp
```

这样更容易观察允许被省略的拷贝或移动。但该选项只用于理解过程，正常工程不应为了观察日志关闭优化语义。

### 18.3 使用内存检查工具

GCC或Clang可开启：

```bash
-Wall -Wextra -Wpedantic -fsanitize=address,undefined
```

它们可以帮助发现重复释放、越界访问、释放后使用和部分未定义行为。

### 18.4 为资源类写四类测试

至少测试：

1. 普通构造与析构；
2. 拷贝后修改一方，另一方是否独立；
3. 自赋值是否安全；
4. 移动后源对象能否安全析构和重新赋值。

## 十九、总结

本篇的核心知识可以归纳为：

- 构造函数初始化对象，而不是简单“开空间创建对象”；
- 默认构造函数是能够无实参调用的构造函数；
- 编译器生成的默认构造不保证把所有内置成员清零；
- 成员初始化列表是真正的成员初始化位置，顺序由声明顺序决定；
- 析构函数负责释放对象拥有的资源，RAII让资源与对象生命周期绑定；
- 默认拷贝构造和拷贝赋值执行逐成员操作，不等同于无条件字节复制；
- 裸指针表示独占资源时，默认逐成员复制会造成浅拷贝风险；
- 拷贝构造用于创建新对象，拷贝赋值用于修改已有对象；
- 赋值运算符通常接收`const T&`并返回`T&`；
- 直接管理资源的类要考虑Rule of Three和Rule of Five；
- 现代C++优先使用标准RAII成员，遵循Rule of Zero；
- 运算符重载应遵循原有语义，不能改变优先级、结合性和操作数个数；
- `const`成员函数提供只读对象接口，并可与非`const`版本形成重载；
- 取地址运算符通常不应重载，必要时可用`std::addressof`获取真实地址；
- 传统“六个默认成员函数”是教学分类，现代特殊成员函数应包含移动构造和移动赋值。

真正掌握这一章的标志，是能够解释一个资源管理类在构造、复制、赋值、移动和析构每个阶段的所有权变化，而不仅仅是背出几个函数签名。
