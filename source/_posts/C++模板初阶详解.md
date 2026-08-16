---
title: C++模板初阶：函数模板、类模板与实例化规则
date: 2026-08-15 22:00:00
categories:
  - C++
tags:
  - C++
  - 模板
  - 泛型编程
  - 函数模板
  - 类模板
  - 模板实例化
---

当多个函数或类只有“所处理的数据类型”不同，逐份复制代码不仅低效，还容易让各版本的行为逐渐失去一致。C++模板把类型或编译期常量变成参数，让编译器根据实际使用生成对应代码，是标准库容器、算法、智能指针等设施的重要基础。

本文从泛型编程出发，系统整理函数模板的定义、模板实参推导、显式模板实参、重载匹配规则，以及类模板的定义、实例化、类外成员实现和代码组织方式。文末还会通过一个可直接编译的综合示例串联类型模板参数与非类型模板参数。

<!-- more -->

## 一、为什么需要泛型编程

### 1.1 从交换函数说起

如果没有模板，为不同类型编写交换函数，代码可能是这样的：

```cpp
void swapInt(int& left, int& right)
{
    int temporary = left;
    left = right;
    right = temporary;
}

void swapDouble(double& left, double& right)
{
    double temporary = left;
    left = right;
    right = temporary;
}
```

两个函数的控制逻辑完全相同，差异只有类型。继续支持`long`、`std::string`或自定义类型时，还要重复更多代码。

函数重载能统一函数名，却没有消除实现重复：

```cpp
void swapValue(int& left, int& right);
void swapValue(double& left, double& right);
void swapValue(std::string& left, std::string& right);
```

模板则把类型本身参数化：

```cpp
template<class T>
void swapValue(T& left, T& right)
{
    T temporary = left;
    left = right;
    right = temporary;
}
```

调用时，编译器根据实参推导`T`：

```cpp
int a = 1;
int b = 2;
swapValue(a, b);       // T推导为int

double x = 1.5;
double y = 2.5;
swapValue(x, y);       // T推导为double
```

实际项目中交换对象通常优先使用`std::swap`。这里自行实现是为了观察模板语法和实例化过程。

### 1.2 泛型编程的含义

泛型编程是编写与具体类型相对独立的通用代码。算法只描述“需要哪些操作”，类型只要满足这些要求就能参与运算。

例如，上面的`swapValue`隐含要求`T`能够：

- 构造临时对象；
- 完成赋值；
- 正确管理自身资源。

模板并不会让任意类型自动具备这些能力。若类型不满足模板所需操作，相关模板实例化通常会在编译期失败。

### 1.3 模板属于编译期机制

模板不是运行时根据数据类型分支的机制。编译器看到具体使用后，会形成相应的模板特化，例如：

```cpp
swapValue<int>(a, b);
swapValue<double>(x, y);
```

可以把模板理解为生成代码的规则，但要注意准确术语：

- 函数模板本身是模板实体；
- 由它形成的某个特化是函数；
- 类模板本身不是一个完整类型；
- `Vector<int>`这样的类模板特化才是具体类型。

## 二、函数模板的基本语法

### 2.1 定义格式

```cpp
template<typename T>
T add(T left, T right)
{
    return left + right;
}
```

也可以写成：

```cpp
template<class T>
T add(T left, T right)
{
    return left + right;
}
```

在“声明类型模板参数”这一位置，`typename`和`class`含义等价。二者只是写法偏好，不要求`T`必须是类类型，`T`同样可以是`int`。

不能把这里的`class`随意替换为`struct`：

```cpp
// 错误：struct不能用于这种类型模板参数声明
// template<struct T>
```

### 2.2 模板参数与函数参数

下面两类参数处于不同层次：

```cpp
template<class T>        // 模板参数列表
T add(T left, T right)   // 函数参数列表
{
    return left + right;
}
```

- `T`是模板参数，在编译期确定；
- `left`和`right`是函数形参，调用函数时接收值；
- `int`、`double`等替换`T`的内容称为模板实参；
- 传给`left`、`right`的表达式称为函数实参。

### 2.3 多个类型模板参数

同一模板可以接收多个类型参数：

```cpp
template<class Left, class Right>
auto addDifferent(const Left& left, const Right& right)
    -> decltype(left + right)
{
    return left + right;
}
```

这是C++11合法的尾置返回类型写法。返回类型通过表达式`left + right`推导，因而可以处理两种不同类型。

```cpp
auto value = addDifferent(3, 4.5); // Left为int，Right为double
```

不过，能否相加仍取决于相应类型是否提供合法的`operator+`。

### 2.4 非类型模板参数

模板参数还可以是编译期值：

```cpp
template<class T, std::size_t N>
class StaticArray
{
private:
    T _data[N];
};
```

这里：

- `T`是类型模板参数；
- `N`是非类型模板参数；
- `StaticArray<int, 5>`的容量在编译期就是`5`。

`StaticArray<int, 5>`与`StaticArray<int, 10>`是不同类型。

## 三、模板实例化与模板实参推导

### 3.1 隐式推导

调用函数模板时省略尖括号，编译器会从函数实参推导模板实参：

```cpp
template<class T>
T add(T left, T right)
{
    return left + right;
}

int first = add(1, 2);           // 推导T为int
double second = add(1.2, 3.4);   // 推导T为double
```

编译器可据此形成对应的函数模板特化。为了入门理解，也常把这一过程概括为“根据类型生成对应函数”。

### 3.2 同一模板参数推导冲突

下面的调用通常不能通过推导：

```cpp
auto value = add(1, 2.5);
```

原因是同一个`T`分别从两个形参位置推导：

- 第一个实参要求`T`为`int`；
- 第二个实参要求`T`为`double`；
- 两个结论冲突。

模板实参推导阶段通常不会先把`int`隐式转换为`double`，再替程序员选择`T`。

### 3.3 解决推导冲突的三种方式

方式一：主动统一实参类型。

```cpp
auto value = add(static_cast<double>(1), 2.5);
```

方式二：显式指定模板实参。

```cpp
auto value = add<double>(1, 2.5);
```

此时`T`已经明确为`double`，第一个函数实参可以按普通函数调用规则从`int`转换为`double`。

方式三：设计两个类型模板参数。

```cpp
template<class Left, class Right>
auto add(const Left& left, const Right& right)
    -> decltype(left + right)
{
    return left + right;
}
```

应该选择哪种方式，取决于接口语义：

- 如果两个参数在业务上必须同型，就保留单个`T`；
- 如果算法天然允许混合类型，就考虑多个模板参数；
- 不要只为“让代码编译”而放宽本应存在的类型约束。

### 3.4 推导阶段与调用阶段的转换

“函数模板不允许类型转换”是一个过度简化的说法。更准确的理解是：

1. 推导模板实参时，只进行规则允许的有限调整，通常不会依赖普通隐式转换来消除冲突；
2. 模板实参确定以后，调用形成的函数特化时仍可能发生正常的参数转换。

```cpp
template<class T>
T larger(T left, T right)
{
    return left < right ? right : left;
}

double result = larger<double>(3, 4.5);
```

因为`T`已经显式指定为`double`，形参类型就是`double`，整数`3`可转换为`double`。

### 3.5 显式模板实参与显式实例化不是一回事

下面是调用时显式指定模板实参：

```cpp
int value = add<int>(1, 2);
```

标准术语中的“显式实例化定义”更接近：

```cpp
template int add<int>(int, int);
```

它明确要求编译器在当前位置为`int`形成实例。还可以使用显式实例化声明：

```cpp
extern template int add<int>(int, int);
```

初学阶段最常见的是前一种调用语法，但在讨论代码组织和编译性能时要区分这些概念。

## 四、模板实参推导中的常见细节

### 4.1 按值形参通常会忽略顶层const

```cpp
template<class T>
void inspectByValue(T value);

const int number = 10;
inspectByValue(number); // T通常推导为int
```

按值传递会产生新对象，实参自身的顶层`const`通常不会成为`T`的一部分。

### 4.2 引用形参可保留更多类型信息

```cpp
template<class T>
void inspectConstReference(const T& value);

const int number = 10;
inspectConstReference(number); // T推导为int，形参为const int&
```

```cpp
template<class T>
void inspectReference(T& value);

const int number = 10;
inspectReference(number); // T可推导为const int
```

这里的`const`是否进入`T`，与形参写法密切相关。

### 4.3 数组推导与退化

按值接收数组时，数组通常会调整为指针：

```cpp
template<class T>
void byValue(T value);

int numbers[5] = {};
byValue(numbers); // T通常推导为int*
```

若使用数组引用，可以保留数组长度：

```cpp
template<class T, std::size_t N>
std::size_t arraySize(const T (&)[N])
{
    return N;
}

int numbers[5] = {};
std::size_t count = arraySize(numbers); // 5
```

这种模式是非类型模板参数的经典应用。

### 4.4 返回类型通常不能单独完成推导

```cpp
template<class T>
T createValue();

// int number = createValue(); // T无法仅由接收变量的类型推导
```

C++的普通函数模板调用通常不会根据赋值目标反向推导模板实参，需要显式指定：

```cpp
int number = createValue<int>();
```

### 4.5 默认函数实参通常不能替代模板推导来源

```cpp
template<class T>
void printValue(T value = T{});

// printValue();      // 没有调用实参可用于推导T
printValue<int>();    // 正确，T已明确
```

默认函数实参解决的是“函数实参可否省略”，并不自动告诉编译器模板参数是什么。

### 4.6 模板参数默认值

模板参数本身也可以设置默认值：

```cpp
template<class T = int>
class Counter
{
private:
    T _value{};
};

Counter<> first;        // T为int
Counter<long> second;   // T为long
```

注意，`Counter<>`中的空尖括号仍表示这是模板特化。

## 五、普通函数与函数模板共同重载

### 5.1 基本示例

```cpp
void print(int value)
{
    std::cout << "ordinary: " << value << '\n';
}

template<class T>
void print(T value)
{
    std::cout << "template: " << value << '\n';
}
```

调用：

```cpp
print(10);    // 普通int版本通常胜出
print(3.14);  // 模板版本，T为double
```

### 5.2 不能机械地记成“普通函数永远优先”

重载决议首先比较候选函数所需的转换质量。当普通函数和模板形成的特化匹配程度相同，普通函数通常更优；如果模板提供了更好的匹配，模板仍可能胜出。

```cpp
void show(long value)
{
    std::cout << "long\n";
}

template<class T>
void show(T value)
{
    std::cout << "template\n";
}

show(10); // 模板可精确匹配int，普通函数需要int到long转换
```

因此应该按下面的思路分析：

1. 收集名字可见且参数数量等条件合适的候选；
2. 对函数模板进行实参推导，形成可行的函数特化；
3. 比较各可行函数的转换序列；
4. 匹配质量相同或模板之间竞争时，再应用相应的优先规则。

### 5.3 强制调用模板版本

```cpp
print<>(10);
print<int>(10);
```

写出尖括号后，调用目标会限定在相应模板候选中。`print<>`表示让编译器继续推导模板实参，`print<int>`则显式给出`T`。

### 5.4 函数模板也可以重载

```cpp
template<class T>
void output(const T& value)
{
    std::cout << value << '\n';
}

template<class T>
void output(const T* pointer)
{
    if (pointer != nullptr)
    {
        std::cout << *pointer << '\n';
    }
}
```

传入指针时，第二个模板通常更特化。模板重载的完整规则涉及函数模板部分排序，是后续学习模板进阶的重要内容。

## 六、类模板

### 6.1 为什么类也需要模板

顺序表、栈、队列、树和智能指针的管理逻辑通常与元素类型无关。如果分别编写`IntVector`、`DoubleVector`、`StringVector`，会产生大量重复实现。

类模板把元素类型变成参数：

```cpp
template<class T>
class Box
{
public:
    explicit Box(const T& value)
        : _value(value)
    {
    }

    const T& get() const
    {
        return _value;
    }

private:
    T _value;
};
```

使用时必须给出模板实参：

```cpp
Box<int> integerBox(10);
Box<std::string> textBox("hello");
```

在C++11中不能写成`Box box(10);`并期待自动推出`Box<int>`。类模板实参推导是C++17引入的重要特性，而且具体是否可推导还取决于构造函数和推导指引。

### 6.2 类模板名与具体类型

`Box`是类模板名，`Box<int>`才是具体类型。

```cpp
Box<int> first(1);
Box<double> second(1.0);
```

`Box<int>`和`Box<double>`是两个不同类型，通常不能互相赋值，除非程序显式设计了相应的转换接口。

### 6.3 类模板中的成员函数

成员函数可以直接定义在类体内：

```cpp
template<class T>
class Holder
{
public:
    void set(const T& value)
    {
        _value = value;
    }

private:
    T _value{};
};
```

也可以在类外定义。此时既要写模板参数列表，也要写带模板参数的类名：

```cpp
template<class T>
class Holder
{
public:
    void set(const T& value);

private:
    T _value{};
};

template<class T>
void Holder<T>::set(const T& value)
{
    _value = value;
}
```

容易漏掉的是`Holder<T>::`中的`<T>`。

### 6.4 类模板成员通常按需实例化

编译器通常只在某个成员被使用时实例化它。这意味着同一个类模板中，某些成员可能仅对部分类型有效。

```cpp
template<class T>
class DebugBox
{
public:
    void print() const
    {
        std::cout << _value << '\n';
    }

private:
    T _value{};
};
```

如果某类型不支持流输出，只要不使用相应`print`成员，其他不依赖流输出的成员仍可能正常使用。但接口设计不应故意依赖这种偶然性，模板的类型要求最好保持清晰。

## 七、模板代码为什么通常写在头文件中

### 7.1 普通分离编译方式可能失败

普通类常采用：

```text
declaration.hpp  声明
implementation.cpp  定义
main.cpp  使用
```

但模板只有在具体模板实参已知后才能形成对应代码。如果`main.cpp`使用`Box<int>`，编译该文件时通常需要看到模板定义，而不只是声明。

若模板定义藏在另一个独立编译的`.cpp`中，当前翻译单元可能无法完成实例化，最后出现链接错误。

### 7.2 常见组织方式

方式一：声明和定义都放在`.hpp`中。

```cpp
// box.hpp
template<class T>
class Box
{
    // 完整实现
};
```

方式二：把实现放入`.tpp`、`.ipp`等文件，并在头文件末尾包含它。

```cpp
// box.hpp
template<class T>
class Box
{
    // 声明
};

#include "box.tpp"
```

对使用者而言，模板完整定义仍在实例化点可见。

### 7.3 显式实例化方式

如果只准备支持有限的类型，也可以把模板定义放在`.cpp`中，再显式实例化选定版本：

```cpp
template class Box<int>;
template class Box<double>;
```

这种方式可以控制代码生成和编译依赖，但调用方只能安全使用已经提供定义的特化，扩展性与普通头文件模板不同。

## 八、从模板顺序表理解类模板

### 8.1 教学版原始指针实现

模板课程中常见下面的结构：

```cpp
template<class T>
class Vector
{
public:
    Vector(std::size_t capacity = 10)
        : _data(new T[capacity]),
          _size(0),
          _capacity(capacity)
    {
    }

    ~Vector()
    {
        delete[] _data;
    }

private:
    T* _data;
    std::size_t _size;
    std::size_t _capacity;
};
```

它能展示`T*`、`new T[]`和类模板实例化，但距离健壮容器还有明显差距。

### 8.2 默认复制会造成资源错误

编译器生成的复制构造和复制赋值会逐成员复制`_data`指针，导致两个对象指向同一块数组，析构时可能重复释放。

因此，直接管理资源的类至少要认真处理：

- 析构函数；
- 复制构造函数；
- 复制赋值运算符；
- C++11中的移动构造和移动赋值。

这就是“三法则/五法则”的典型场景。更推荐让资源交给标准容器或智能资源类，从而接近“零法则”。

### 8.3 `new T[capacity]`会预先构造全部元素

`new T[capacity]`不仅分配空间，还会构造`capacity`个`T`对象。这带来两个问题：

1. `T`通常必须可默认构造；
2. 即使逻辑长度`_size`为零，容量区的对象也已经全部存在。

真正的`std::vector`会区分：

- 已分配但尚未构造对象的原始存储；
- `[0, size)`范围内已经存在的元素；
- `[size, capacity)`范围内尚未开始生命周期的空间。

实现这种管理要使用分配器、定位构造和显式销毁等技术，不属于模板初阶的必备实现任务。业务代码应直接优先使用`std::vector<T>`。

### 8.4 下标和扩容还需要处理更多问题

一个可靠动态数组还需要考虑：

- 越界访问策略；
- 扩容时元素复制或移动；
- 构造过程中抛出异常后的回滚；
- 空容器的迭代器行为；
- 对齐要求；
- 分配失败；
- 迭代器失效规则；
- 复杂类型的析构顺序。

因此，模板能消除类型重复，但不会自动解决资源管理与异常安全问题。

## 九、一个完整的C++11综合示例

下面实现固定容量数组`StaticArray<T, N>`。它不需要手动管理动态内存，适合专注练习：

- 函数模板；
- 显式模板实参；
- 类模板；
- 类型模板参数；
- 非类型模板参数；
- 类外定义成员函数；
- 模板函数接收类模板对象。

```cpp
#include <algorithm>
#include <cstddef>
#include <initializer_list>
#include <iostream>
#include <stdexcept>
#include <string>

template<class T>
T larger(T left, T right)
{
    return left < right ? right : left;
}

template<class T, std::size_t N>
class StaticArray
{
    static_assert(N > 0, "StaticArray requires a positive size");

public:
    StaticArray();
    StaticArray(std::initializer_list<T> values);

    std::size_t size() const noexcept;
    T& operator[](std::size_t index);
    const T& operator[](std::size_t index) const;

    T* begin() noexcept;
    T* end() noexcept;
    const T* begin() const noexcept;
    const T* end() const noexcept;

    void fill(const T& value);

private:
    T _data[N];
};

template<class T, std::size_t N>
StaticArray<T, N>::StaticArray()
    : _data{}
{
}

template<class T, std::size_t N>
StaticArray<T, N>::StaticArray(std::initializer_list<T> values)
    : _data{}
{
    if (values.size() > N)
    {
        throw std::length_error("too many initializers");
    }

    std::copy(values.begin(), values.end(), _data);
}

template<class T, std::size_t N>
std::size_t StaticArray<T, N>::size() const noexcept
{
    return N;
}

template<class T, std::size_t N>
T& StaticArray<T, N>::operator[](std::size_t index)
{
    return _data[index];
}

template<class T, std::size_t N>
const T& StaticArray<T, N>::operator[](std::size_t index) const
{
    return _data[index];
}

template<class T, std::size_t N>
T* StaticArray<T, N>::begin() noexcept
{
    return _data;
}

template<class T, std::size_t N>
T* StaticArray<T, N>::end() noexcept
{
    return _data + N;
}

template<class T, std::size_t N>
const T* StaticArray<T, N>::begin() const noexcept
{
    return _data;
}

template<class T, std::size_t N>
const T* StaticArray<T, N>::end() const noexcept
{
    return _data + N;
}

template<class T, std::size_t N>
void StaticArray<T, N>::fill(const T& value)
{
    std::fill(begin(), end(), value);
}

template<class T, std::size_t N>
T sum(const StaticArray<T, N>& values)
{
    T result{};

    for (const T& value : values)
    {
        result += value;
    }

    return result;
}

int main()
{
    std::cout << "larger: " << larger<double>(3, 4.5) << '\n';

    StaticArray<int, 4> numbers{1, 2, 3, 4};
    std::cout << "sum: " << sum(numbers) << '\n';

    for (int value : numbers)
    {
        std::cout << value << ' ';
    }
    std::cout << '\n';

    StaticArray<std::string, 3> words;
    words.fill("template");

    for (const std::string& word : words)
    {
        std::cout << word << ' ';
    }
    std::cout << '\n';

    return 0;
}
```

运行结果：

```text
larger: 4.5
sum: 10
1 2 3 4 
template template template 
```

### 9.1 显式模板实参后的转换

```cpp
larger<double>(3, 4.5)
```

这里已经明确`T`为`double`，所以整数`3`可转换为`double`。如果写成：

```cpp
// larger(3, 4.5)
```

编译器会分别得到`int`和`double`两个互相冲突的推导结果。

### 9.2 类型参数与非类型参数

```cpp
StaticArray<int, 4> numbers;
```

对应关系是：

|模板形参|模板实参|作用|
|---|---|---|
|`T`|`int`|确定元素类型|
|`N`|`4`|确定编译期容量|

### 9.3 类外成员定义

```cpp
template<class T, std::size_t N>
void StaticArray<T, N>::fill(const T& value)
```

需要同时写出：

1. 模板参数列表；
2. `StaticArray<T, N>`这一完整类模板特化形式；
3. 作用域限定符`::`；
4. 成员函数自己的声明部分。

### 9.4 `sum`也是一个函数模板

```cpp
template<class T, std::size_t N>
T sum(const StaticArray<T, N>& values)
```

调用`sum(numbers)`时，编译器从`StaticArray<int, 4>`推导出：

- `T`为`int`；
- `N`为`4`。

模板参数不一定直接对应某个独立形参，也可以从复合类型结构中推导出来。

## 十、常见错误与定位方法

### 10.1 忘记模板参数列表

错误：

```cpp
T add(T left, T right)
{
    return left + right;
}
```

修正：

```cpp
template<class T>
T add(T left, T right)
{
    return left + right;
}
```

### 10.2 类模板实例化时漏写尖括号

```cpp
template<class T>
class Box {};

// Box object;    // C++11中错误：Box不是具体类型
Box<int> object;  // 正确
```

### 10.3 同一个模板参数得到不同推导结果

```cpp
template<class T>
T add(T left, T right);

// add(1, 2.0);
```

检查方法：逐个标出每个形参位置会把`T`推导为什么。不要只看`+`最终能否完成数值转换。

### 10.4 类外定义漏掉`<T>`

错误：

```cpp
template<class T>
void Box::set(const T& value)
{
}
```

修正：

```cpp
template<class T>
void Box<T>::set(const T& value)
{
}
```

### 10.5 只有声明，没有对实例化点可见的定义

```cpp
template<class T>
T add(T left, T right); // 只有声明
```

调用处可能编译通过，但链接时找不到对应定义。应让完整模板定义可见，或在其他翻译单元中提供匹配的显式实例化定义。

### 10.6 模板体中的操作不适用于实际类型

```cpp
template<class T>
T multiply(T left, T right)
{
    return left * right;
}
```

若`T`没有合法乘法，模板声明本身未必立刻报错，但实例化相应版本时会失败。阅读错误信息时，要先找到：

1. 哪个模板被实例化；
2. `T`等模板参数实际替换成了什么；
3. 模板体中的哪项操作不成立；
4. 最初从哪一行用户代码触发实例化。

### 10.7 把所有报错都归咎于模板语法

模板错误也可能来自普通C++问题，例如：

- 缺少头文件；
- 名字未限定命名空间；
- 访问私有成员；
- 对象不可复制；
- 运算符不存在；
- const限定不匹配；
- 链接时缺少定义。

先把编译器实例化信息还原成“某个具体类型的普通代码”，往往更容易定位根因。

## 十一、模板使用中的工程建议

### 11.1 用`const T&`避免不必要复制

只读参数常写成：

```cpp
template<class T>
void print(const T& value);
```

但小型标量按值传递也很合理。是否按引用传递要结合语义、对象大小和生命周期，不需要机械统一。

### 11.2 不要让模板隐含要求失控

```cpp
template<class T>
void process(T value)
{
    value.open();
    value.sort();
    std::cout << value << '\n';
}
```

这个模板同时要求`T`具备`open`、`sort`和流输出能力。要求越多，复用范围越窄，错误信息也越复杂。应尽量让一个模板承担清晰、单一的职责。

在C++20中可使用概念与`requires`显式表达约束；在C++11中常通过文档、类型特征、`static_assert`和SFINAE表达部分要求。

### 11.3 优先复用标准库

学习模板时自行实现交换、数组和顺序表很有价值；生产代码中则优先考虑：

- `std::swap`；
- `std::array`；
- `std::vector`；
- `<algorithm>`中的通用算法；
- `<type_traits>`中的类型工具。

标准库实现处理了大量边界情况和性能细节。

### 11.4 留意代码膨胀

不同模板实参可能形成不同机器代码。若一个大型函数模板被许多类型实例化，可能增加编译时间和二进制体积。

可以考虑：

- 把与类型无关的逻辑抽到普通函数；
- 减少无意义的模板层次；
- 对有限支持类型使用显式实例化；
- 避免在大型公共头文件中包含不必要实现。

不过，不要因为担心模板代码膨胀而过早牺牲接口清晰度，应先测量再优化。

### 11.5 报错位置可能远离根因

模板实例化链可能跨越多个函数和头文件。诊断时优先寻找编译器输出中的：

- `required from here`；
- 模板参数替换结果；
- 第一条真正说明非法操作的错误；
- 自己代码最早触发调用的位置。

不要只盯着标准库头文件中的最后一行报错。

## 十二、面试与复习问题

### 12.1 `typename`和`class`有什么区别

在声明类型模板参数时二者等价：

```cpp
template<typename T>
template<class T>
```

但`typename`还有另一项用途：在模板中说明某个依赖名称是类型。

```cpp
template<class Container>
void visit(const Container& container)
{
    typename Container::const_iterator iterator = container.begin();
    (void)iterator;
}
```

这里的`typename`不能简单用`class`替换。

### 12.2 函数模板与模板函数是什么关系

严格说：

- `template<class T> T add(T, T)`是函数模板；
- `add<int>`对应的特化是一个函数；
- “模板函数”常作为口语表达，但容易混淆模板本身和生成的函数。

### 12.3 类模板是否是类

类模板是生成类的模板。`Vector<int>`、`Vector<double>`这样的特化才是具体类类型。

### 12.4 为什么`add(1, 2.0)`推导失败

同一个`T`从两个位置分别推导为`int`和`double`。推导阶段不会先进行普通数值转换来替程序员决定统一类型。

### 12.5 为什么`add<double>(1, 2.0)`可以成功

`T`已经显式确定为`double`，函数形参类型随之确定。随后调用该函数时，整数`1`可以进行普通的隐式转换。

### 12.6 普通函数一定比函数模板优先吗

不一定。先比较转换序列质量；当匹配质量相同，普通非模板函数通常优先。模板若能精确匹配而普通函数需要转换，模板可能胜出。

### 12.7 模板为什么通常不能只把实现放进`.cpp`

使用某个模板实参时，编译器通常需要看到模板定义才能实例化。独立翻译单元只看到声明时，可能无法形成所需代码。显式实例化可作为支持有限类型时的替代方案。

### 12.8 `Vector<int>`与`Vector<double>`是什么关系

它们是由同一个类模板形成的不同类型，成员布局、操作合法性和生成代码都可能不同。

### 12.9 模板会自动提升运行效率吗

模板让编译器掌握具体类型，常有利于内联和优化，并避免某些运行时分派，但不保证程序必然更快。算法复杂度、内存访问和对象成本仍由实际实现决定。

### 12.10 模板能否完全代替函数重载

不能。普通重载适合表达某些类型的特殊语义或行为；模板适合描述共享规则。二者可以组合使用，标准库中也大量使用这种设计。

## 十三、本节总结

1. 模板把类型或编译期常量参数化，是C++泛型编程的核心工具。
2. `template<class T>`与`template<typename T>`在声明类型模板参数时等价。
3. 函数模板可以通过调用实参推导模板参数，也可以显式指定模板实参。
4. 同一个模板参数从不同位置得到冲突类型时，推导通常失败。
5. “推导阶段不依赖普通隐式转换消除冲突”不等于“函数模板永远不能发生类型转换”。
6. 普通函数与函数模板共同参与重载决议，先比较匹配质量，不能机械地认为普通函数永远优先。
7. 类模板本身不是具体类型，`ClassName<T>`才是一个类模板特化。
8. 类外定义成员时要同时写模板参数列表和`ClassName<T>::`。
9. 模板完整定义通常必须在实例化点可见，因此模板实现常放在头文件或被头文件包含的实现文件中。
10. 模板解决的是类型复用问题，不会自动解决资源管理、异常安全和接口约束问题。

掌握模板初阶后，下一步可以继续学习模板特化、可变参数模板、SFINAE、类型萃取，以及C++20概念。它们都是在“让通用代码更准确地表达类型要求”这条主线上逐步发展出来的。
