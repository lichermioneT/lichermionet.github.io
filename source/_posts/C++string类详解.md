---
title: C++ string类详解：接口、容量、查找与模拟实现
date: 2026-08-15 22:20:00
categories:
  - C++
tags:
  - C++
  - STL
  - string
  - 字符串
  - 深拷贝
  - 迭代器
---

`std::string`把字符序列、动态存储、长度管理和常用字符串操作封装在一个值类型中。它比C风格字符数组更容易复制、拼接、查找和传递，但仍需正确理解`size`、`capacity`、`reserve`、`resize`、`c_str`以及迭代器失效等规则。

本文系统整理`std::string`的构造、遍历、容量、修改、查找、截取、输入和C接口兼容方式，并通过一个教学版字符串类解释深拷贝、空字符、扩容和复制交换。

<!-- more -->

## 一、C风格字符串与std::string

### 1.1 C风格字符串

C语言通常用以`'\0'`结尾的字符数组表示字符串：

```cpp
char text[] = "hello";
```

数组实际包含：

```text
h e l l o \0
```

常见操作依赖`<cstring>`中的函数：

- `std::strlen`计算长度；
- `std::strcmp`比较内容；
- `std::strcpy`复制；
- `std::strcat`拼接；
- `std::strstr`查找子串。

使用时必须自己保证：

- 目标缓冲区足够大；
- 字符串存在结尾空字符；
- 指针有效；
- 源和目标的重叠情况符合函数要求。

### 1.2 std::string的优势

```cpp
#include <string>

std::string first = "hello";
std::string second = first;
second += " C++";
```

`std::string`会管理自身内存，并记录有效字符数量。它具有值语义：复制一个字符串后，通常可以独立修改两者而互不影响。

现代C++中，普通文本处理优先使用`std::string`；只有与C接口、系统调用或特定二进制协议交互时，才经常需要裸字符缓冲区。

### 1.3 string可以包含`'\0'`

`std::string`不是只能保存传统C字符串，它可以保存任意字符，包括中间的空字符：

```cpp
std::string value("ab\0cd", 5);
std::cout << value.size(); // 5
```

如果把`value.c_str()`交给只依赖结尾`'\0'`的C函数，该函数可能只看到`"ab"`。因此传递二进制内容时还要同时传递长度。

## 二、构造与赋值

**基本用法**

```
```



### 2.1 常见构造方式

```cpp
std::string empty;
std::string text("hello");
std::string copy(text);
std::string repeated(5, 'x');
std::string part(text, 1, 3); // "ell"
```

C++11支持列表初始化，但`std::string`构造时要注意参数含义：

```cpp
std::string a(3, 'A');   // "AAA"
std::string b{'A', 'B'}; // "AB"
```

### 2.2 区间构造

```cpp
const char raw[] = {'C', '+', '+', '1', '1'};
std::string version(raw, raw + 5);
```

区间通常采用左闭右开形式`[first, last)`。

### 2.3 赋值

```cpp
std::string value;
value = "hello";
value.assign(4, 'x');
value.assign("abcdef", 3); // "abc"
```

普通代码中`operator=`最直观；`assign`适合需要明确指定次数或区间的场景。

## 三、size、length、capacity与max_size

### 3.1 size和length

`size()`与`length()`对`std::string`含义相同，都返回有效字符数量：

```cpp
std::string text = "hello";
std::cout << text.size();   // 5
std::cout << text.length(); // 5
```

返回类型是`std::string::size_type`，通常是无符号整数。循环下标可使用`std::size_t`或`auto`，避免无意义的有符号/无符号比较警告。

### 3.2 capacity

`capacity()`表示当前无需重新分配即可容纳的字符数量。它通常不小于`size()`，但具体数值和增长策略由实现决定。

```cpp
std::string text = "hello";
std::cout << text.size() << ' ' << text.capacity();
```

不能根据某个平台观察到的容量推导所有标准库实现。

### 3.3 empty和clear

```cpp
if (text.empty())
{
    // 没有有效字符
}

text.clear();
```

`clear()`把长度变为零，但标准并不要求它释放容量。若代码依赖内存归还，应重新设计生命周期，或在确有需要时使用其他方式；`shrink_to_fit()`也只是非强制请求。

### 3.4 max_size

`max_size()`给出实现理论上允许的最大元素数量，但它不代表实际一定能够分配这么大。可用内存、地址空间、分配器和系统限制都可能让分配提前失败。

## 四、reserve与resize的区别

### 4.1 reserve只处理容量

```cpp
std::string text;
text.reserve(100);
```

`reserve(100)`请求容量至少能够容纳100个字符，不会把`size()`变成100，也不会凭空增加100个有效字符。

若预先知道最终长度，提前`reserve`可以减少多次扩容：

```cpp
std::string result;
result.reserve(1000);

for (int i = 0; i < 1000; ++i)
{
    result.push_back('x');
}
```

### 4.2 resize会改变有效长度

```cpp
std::string text = "abc";
text.resize(5, 'x'); // "abcxx"
text.resize(2);      // "ab"
```

规则是：

- 新长度小于原长度：删除尾部字符；
- 新长度大于原长度并给出字符：使用该字符补齐；
- 新长度大于原长度但未给字符：新位置值初始化为`'\0'`。

补入的`'\0'`也属于字符串有效内容，`size()`会包含它们，只是直接打印时不容易观察。

### 4.3 对比总结

|接口|是否改变size|主要目的|
|---|---:|---|
|`reserve(n)`|否|预留存储，减少扩容|
|`resize(n)`|是|改变有效字符数量|
|`clear()`|变为0|清空逻辑内容|
|`shrink_to_fit()`|否|非强制请求缩减容量|

## 五、元素访问与遍历

### 5.1 operator[]与at

```cpp
std::string text = "hello";
text[0] = 'H';

char first = text.at(0);
```

区别：

- `operator[]`不执行常规边界检查，越界访问会造成未定义行为；
- `at()`越界时抛出`std::out_of_range`；
- 非const字符串返回可修改引用；
- const字符串只能读取。

`text[text.size()]`在现代标准中可读取结尾空字符，但不能把它当普通可修改元素使用，更不能访问更远位置。

### 5.2 front与back

```cpp
char first = text.front();
char last = text.back();
```

调用前字符串必须非空。空字符串上调用`front()`或`back()`会产生未定义行为。

### 5.3 下标遍历

```cpp
for (std::size_t index = 0; index < text.size(); ++index)
{
    std::cout << text[index];
}
```

### 5.4 迭代器遍历

```cpp
for (std::string::iterator it = text.begin();
     it != text.end(); ++it)
{
    *it = static_cast<char>(std::toupper(
        static_cast<unsigned char>(*it)));
}
```

把可能为负的`char`直接传给`std::toupper`可能产生未定义行为，因此先转换为`unsigned char`。

### 5.5 范围for

```cpp
for (char ch : text)
{
    std::cout << ch;
}
```

需要修改时使用引用：

```cpp
for (char& ch : text)
{
    if (ch == '_')
    {
        ch = '-';
    }
}
```

### 5.6 反向遍历

```cpp
for (std::string::reverse_iterator it = text.rbegin();
     it != text.rend(); ++it)
{
    std::cout << *it;
}
```

## 六、字符串修改

### 6.1 push_back与pop_back

```cpp
std::string text = "C+";
text.push_back('+');
text.pop_back();
```

`pop_back()`要求字符串非空。

### 6.2 append与operator+=

```cpp
std::string text = "hello";
text.append(" world");
text += '!';
text += " C++";
```

`operator+=`是最常用的拼接接口之一。连续大量拼接时，若能估计总长度，可以先`reserve`。

### 6.3 insert

```cpp
std::string text = "Helo";
text.insert(3, 1, 'l');       // "Hello"
text.insert(5, " C++");      // "Hello C++"
```

中间插入通常需要移动后续字符，复杂度与移动字符数量有关。

### 6.4 erase

```cpp
std::string text = "Hello C++";
text.erase(5, 1); // 删除空格，得到"HelloC++"
```

第二个参数是删除长度，不是结束下标。

### 6.5 replace

```cpp
std::string url = "http://example.com";
url.replace(0, 4, "https");
```

它可把“删除一段”和“插入新内容”合并为一次语义清晰的操作。

### 6.6 swap

```cpp
std::string first = "left";
std::string second = "right";
first.swap(second);
```

`swap`通常能高效交换字符串状态，但指针、引用和迭代器在交换后的归属规则应以标准和对应接口说明为准。

## 七、查找与截取

### 7.1 find

```cpp
std::string path = "/home/user/main.cpp";
std::size_t position = path.find("user");

if (position != std::string::npos)
{
    std::cout << position;
}
```

查找失败返回`std::string::npos`。它是`size_type`能表示的特殊最大值，不要与`-1`进行有符号逻辑混用。

### 7.2 rfind

获取文件后缀常从右侧寻找点号：

```cpp
std::size_t dot = path.rfind('.');
if (dot != std::string::npos)
{
    std::string suffix = path.substr(dot);
}
```

真实路径处理还要考虑隐藏文件、目录中的点、大小写和无后缀情况，文件系统任务更适合使用对应的路径库。

### 7.3 find_first_of等接口

- `find_first_of(chars)`：寻找任意一个给定字符首次出现的位置；
- `find_last_of(chars)`：寻找任意给定字符最后出现的位置；
- `find_first_not_of(chars)`：寻找第一个不属于集合的字符；
- `find_last_not_of(chars)`：从后向前寻找不属于集合的字符。

它们的参数是“字符集合”，不是必须连续匹配的完整子串。

### 7.4 substr

```cpp
std::string text = "template";
std::string part = text.substr(1, 4); // "empl"
```

参数含义是起始位置和长度。如果长度超出剩余范围，会截取到结尾；如果起始位置大于`size()`，会抛出`std::out_of_range`。

## 八、比较

`std::string`支持关系运算：

```cpp
if (first == second) {}
if (first < second) {}
```

比较通常按字符的字典序进行，它不是自然语言排序，也不自动忽略大小写或处理本地化规则。

对于C字符串不能用指针相等判断内容：

```cpp
const char* left = "hello";
const char* right = "hello";

// left == right比较地址，不表达通用的内容相等语义
bool same = std::strcmp(left, right) == 0;
```

而两个`std::string`使用`==`比较的是内容。

## 九、输入与输出

### 9.1 operator>>按单词读取

```cpp
std::string word;
std::cin >> word;
```

默认跳过前导空白，并在下一个空白处停止，不能读取含空格的整行文本。

### 9.2 getline读取整行

```cpp
std::string line;
std::getline(std::cin, line);
```

它读取到换行符为止，换行符被取走但不存入字符串。

### 9.3 混用`>>`和getline

```cpp
int age = 0;
std::string name;

std::cin >> age;
std::getline(std::cin >> std::ws, name);
```

`std::ws`会消费前导空白。若空格本身是有效输入的一部分，就要根据协议更精确地处理剩余换行，而不是无条件使用`std::ws`。

## 十、与C接口交互

### 10.1 c_str

```cpp
std::string path = "config.txt";
const char* pointer = path.c_str();
```

`c_str()`返回以`'\0'`结尾的只读字符序列，可传给接受`const char*`的C接口。

### 10.2 指针生命周期

保存`c_str()`结果后修改字符串，指针可能失效：

```cpp
const char* oldPointer = path.c_str();
path += ".bak";
// 不应继续假定oldPointer有效
```

需要使用时应尽量在调用点临时取得，不要长期缓存。

### 10.3 data

在C++11中，`data()`返回`const char*`；从C++17开始，非const字符串可获得可写指针，但只能在现有`size()`范围内按规则修改，不能写越界或破坏对象不变量。

## 十一、迭代器、引用和指针失效

会引发重新分配的操作，通常使指向原存储的迭代器、引用和指针失效，例如：

- 容量不足时的追加或插入；
- 增大的`reserve`；
- 可能扩容的`resize`；
- 某些赋值和替换操作。

即使没有重新分配，中间插入或删除也可能使受影响位置及其后的迭代器失效。最稳妥的做法是：结构修改后不要继续使用旧位置对象，除非明确查过该操作的保证。

## 十二、string的典型实现思路

一个教学版字符串常保存：

```cpp
char* _data;
std::size_t _size;
std::size_t _capacity;
```

并维护不变量：

1. `_data`指向至少`_capacity + 1`字节；
2. `_size <= _capacity`；
3. `_data[_size] == '\0'`；
4. 对象拥有并负责释放自己的动态数组。

### 12.1 浅拷贝问题

如果只逐成员复制`_data`：

```cpp
MyString first("hello");
MyString second = first;
```

两个对象会指向同一数组，随后可能出现：

- 修改互相影响；
- 一个对象析构后另一个悬空；
- 两次析构重复释放同一地址。

### 12.2 深拷贝

深拷贝为新对象分配独立空间并复制字符。复制赋值还要正确处理自赋值和旧资源释放。

### 12.3 复制交换

一种简洁写法是让赋值参数按值传入，再交换内部资源：

```cpp
MyString& operator=(MyString other)
{
    swap(other);
    return *this;
}
```

参数对象负责持有新内容，交换后其析构函数释放旧资源。这种写法天然处理自赋值，并能提供较强的异常安全保证。

### 12.4 小字符串优化

许多现代`std::string`实现会把较短字符串直接存放在对象内部，避免单独动态分配，称为Small String Optimization，简称SSO。

SSO很常见，但内部缓冲区大小、对象布局和具体策略都不是标准保证，不能据此编写依赖某个实现的可移植代码。

### 12.5 写时拷贝的历史背景

写时拷贝让多个字符串先共享存储，修改时再复制。它需要引用计数，并会让并发、迭代器、非常量访问和复杂度保证变得困难。现代C++标准对连续存储及操作语义的要求使主流`std::string`不再采用传统写时拷贝。

## 十三、完整示例：教学版MyString

下面的实现只用于理解资源管理，并非完整替代`std::string`。它实现构造、深拷贝、移动、复制交换、扩容、追加和下标访问。

```cpp
#include <algorithm>
#include <cstddef>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <utility>

class MyString
{
public:
    explicit MyString(const char* text = "")
        : _data(nullptr), _size(std::strlen(text)), _capacity(_size)
    {
        _data = new char[_capacity + 1];
        std::copy(text, text + _size + 1, _data);
    }

    MyString(const MyString& other)
        : _data(new char[other._capacity + 1]),
          _size(other._size),
          _capacity(other._capacity)
    {
        std::copy(other._data, other._data + _size + 1, _data);
    }

    MyString(MyString&& other) noexcept
        : _data(other._data),
          _size(other._size),
          _capacity(other._capacity)
    {
        other._data = nullptr;
        other._size = 0;
        other._capacity = 0;
    }

    MyString& operator=(MyString other)
    {
        swap(other);
        return *this;
    }

    ~MyString()
    {
        delete[] _data;
    }

    void swap(MyString& other) noexcept
    {
        using std::swap;
        swap(_data, other._data);
        swap(_size, other._size);
        swap(_capacity, other._capacity);
    }

    void reserve(std::size_t newCapacity)
    {
        if (newCapacity <= _capacity)
        {
            return;
        }

        char* newData = new char[newCapacity + 1];
        if (_data != nullptr)
        {
            std::copy(_data, _data + _size + 1, newData);
        }
        else
        {
            newData[0] = '\0';
        }
        delete[] _data;

        _data = newData;
        _capacity = newCapacity;
    }

    void push_back(char ch)
    {
        if (_size == _capacity)
        {
            reserve(_capacity == 0 ? 1 : _capacity * 2);
        }

        _data[_size] = ch;
        ++_size;
        _data[_size] = '\0';
    }

    void append(const MyString& other)
    {
        if (this == &other)
        {
            MyString copy(other);
            append(copy);
            return;
        }

        const std::size_t required = _size + other._size;
        if (required > _capacity)
        {
            reserve(required);
        }

        std::copy(other._data,
                  other._data + other._size + 1,
                  _data + _size);
        _size = required;
    }

    char& at(std::size_t index)
    {
        if (index >= _size)
        {
            throw std::out_of_range("MyString::at");
        }
        return _data[index];
    }

    const char& at(std::size_t index) const
    {
        if (index >= _size)
        {
            throw std::out_of_range("MyString::at");
        }
        return _data[index];
    }

    const char* c_str() const noexcept
    {
        return _data == nullptr ? "" : _data;
    }

    std::size_t size() const noexcept
    {
        return _size;
    }

    std::size_t capacity() const noexcept
    {
        return _capacity;
    }

private:
    char* _data;
    std::size_t _size;
    std::size_t _capacity;
};

int main()
{
    MyString first("hello");
    first.push_back(' ');
    first.append(MyString("C++"));

    MyString second = first;
    second.at(0) = 'H';

    std::cout << first.c_str() << '\n';
    std::cout << second.c_str() << '\n';
    std::cout << "size: " << second.size() << '\n';
    std::cout << "capacity: " << second.capacity() << '\n';

    return 0;
}
```

运行结果中的容量取决于当前实现的扩容过程；这份代码的输出为：

```text
hello C++
Hello C++
size: 9
capacity: 10
```

教学实现仍省略了迭代器、查找、插入、删除、比较、分配器、异常边界和完整重载集合。生产代码应使用`std::string`。

## 十四、常见错误

### 14.1 把capacity当成有效长度

`capacity()`只表示当前可容纳空间，不能访问`[size(), capacity())`作为已存在的有效字符。

### 14.2 用`find`结果直接作为下标

```cpp
std::size_t position = text.find(':');
if (position != std::string::npos)
{
    // 再使用position
}
```

查找失败必须先判断`npos`。

### 14.3 长期保存c_str指针

字符串修改、移动、销毁后，原指针可能失效。应缩短裸指针使用范围。

### 14.4 `cin >> text`期望读取整行

提取运算符遇空白停止；整行读取要使用`std::getline`。

### 14.5 忽略有符号char问题

调用`std::isdigit`、`std::tolower`等字符分类函数前，应把普通`char`转换为`unsigned char`，EOF情况除外。

## 十五、面试常见问题

### 15.1 size和capacity有什么区别

`size`是有效字符数量，`capacity`是在不重新分配情况下可容纳的字符数量。

### 15.2 reserve和resize有什么区别

`reserve`改变容量请求但不改变有效长度；`resize`改变有效长度，扩展时会构造或填充值。

### 15.3 clear会释放内存吗

它保证把字符串清空，即`size()`变为零，但不保证把容量归还给系统。

### 15.4 std::string是否一定采用深拷贝

从可观察值语义看，复制后的两个字符串可独立修改。内部是否使用SSO等优化是实现细节；现代标准库不能使用破坏标准要求的传统写时拷贝行为。

### 15.5 c_str返回的指针何时失效

字符串被销毁，或执行可能修改内部存储的非const操作后，不应继续假定旧指针有效。具体保证要查看相应标准版本和接口。

## 十六、总结

1. `std::string`是管理字符序列的值类型，普通文本处理优先于裸字符数组。
2. `size()`表示有效字符数量，`capacity()`表示当前存储能力。
3. `reserve`主要预留容量，`resize`会改变字符串长度。
4. `operator[]`不做常规越界检查，`at()`越界会抛出异常。
5. `find`失败返回`std::string::npos`，使用前必须判断。
6. `operator>>`按空白分词，`getline`读取整行。
7. `c_str()`便于与C接口交互，但返回指针不应跨越字符串修改长期保存。
8. 手写字符串要处理深拷贝、资源释放、扩容、结尾空字符和异常安全。
9. SSO和具体扩容倍率属于实现细节，不是跨平台标准保证。
