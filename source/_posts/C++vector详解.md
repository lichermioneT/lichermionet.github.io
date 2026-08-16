---
title: C++ vector详解：接口、扩容、迭代器失效与模拟实现
date: 2026-08-15 22:30:00
categories:
  - C++
tags:
  - C++
  - STL
  - vector
  - 动态数组
  - 迭代器失效
  - 内存管理
---

`std::vector`是C++最常用的序列容器。它以连续内存保存元素，兼具随机访问、良好缓存局部性和摊销常数时间尾插。真正掌握`vector`，不仅要会调用`push_back`，还要理解`size`与`capacity`、扩容、元素搬移、迭代器失效以及为什么不能用`memcpy`复制一般对象。

本文从常用接口讲到实现原理，并给出一个基于分配器的教学版动态数组，以观察原始存储、对象构造、复制、移动和异常回滚。

<!-- more -->

## 一、vector的定位

`std::vector<T>`是元素类型为`T`的动态数组，具有以下核心特点：

1. 元素逻辑顺序与物理顺序一致；
2. 元素连续存储；
3. 支持常数时间随机访问；
4. 尾部追加通常为摊销O(1)；
5. 中间插入和删除通常需要移动后续元素；
6. 容量不足时会申请更大空间并迁移元素。

```cpp
#include <vector>

std::vector<int> values{1, 2, 3};
values.push_back(4);
std::cout << values[2];
```

由于内存连续，可以在满足接口要求时与需要数组地址和长度的底层API交互：

```cpp
const int* pointer = values.data();
std::size_t count = values.size();
```

空`vector`的`data()`结果不应被解引用。

## 二、构造方式

### 2.1 默认构造

```cpp
std::vector<int> first;
```

构造空容器，`size()`为零。初始`capacity()`的具体值不应作为标准保证。

### 2.2 指定元素数量

```cpp
std::vector<int> second(5);      // 5个值初始化的int，均为0
std::vector<int> third(5, 10);  // 5个10
```

必须区分圆括号与列表初始化：

```cpp
std::vector<int> a(5, 10); // 5个10
std::vector<int> b{5, 10}; // 两个元素：5和10
```

### 2.3 区间构造

```cpp
int raw[] = {1, 2, 3, 4};
std::vector<int> values(std::begin(raw), std::end(raw));
```

构造区间为左闭右开`[first, last)`，迭代器的值类型必须能够构造`vector`元素。

### 2.4 拷贝与移动

```cpp
std::vector<int> copy(values);
std::vector<int> moved(std::move(values));
```

复制会得到独立的元素序列。移动通常能转移底层存储，但具体是否能常数时间完成还受分配器等条件影响。被移动对象仍然有效，但其具体内容通常只保证处于可析构、可赋值的有效状态。

## 三、迭代器与遍历

### 3.1 正向迭代器

```cpp
for (std::vector<int>::iterator it = values.begin();
     it != values.end(); ++it)
{
    *it *= 2;
}
```

`begin()`指向第一个元素，`end()`指向尾后位置，不能解引用。

### 3.2 const迭代器

```cpp
void print(const std::vector<int>& values)
{
    for (std::vector<int>::const_iterator it = values.cbegin();
         it != values.cend(); ++it)
    {
        std::cout << *it << ' ';
    }
}
```

`const_iterator`允许移动迭代器，但不能通过它修改元素。

### 3.3 反向迭代器

```cpp
for (std::vector<int>::reverse_iterator it = values.rbegin();
     it != values.rend(); ++it)
{
    std::cout << *it << ' ';
}
```

反向迭代器执行`++`时，在逻辑上向前一个元素移动。

### 3.4 范围for

```cpp
for (int value : values)
{
    std::cout << value << ' ';
}
```

修改元素要使用引用：

```cpp
for (int& value : values)
{
    value += 1;
}
```

范围for内部也依赖迭代器。循环中改变`vector`结构可能导致其内部迭代器失效，不应边范围遍历边随意`push_back`或`erase`。

## 四、容量管理

### 4.1 size与capacity

- `size()`：已经构造并属于容器的元素数量；
- `capacity()`：当前存储在不重新分配时最多可容纳的元素数量；
- 必须满足`size() <= capacity()`。

```cpp
std::vector<int> values;
values.reserve(100);

std::cout << values.size();     // 0
std::cout << values.capacity(); // 至少100
```

不能访问`[size(), capacity())`，这部分只是存储能力，不是已经存在的元素。

### 4.2 reserve

```cpp
values.reserve(1000);
```

若请求值大于当前容量，容器会重新分配；若不大于当前容量，通常不做处理。`reserve`不改变`size()`。

已知即将追加大量元素时，提前预留容量可以：

- 减少分配次数；
- 减少元素搬移；
- 降低迭代器反复失效的次数。

### 4.3 resize

```cpp
values.resize(10);     // 改变size为10
values.resize(20, 7);  // 新元素用7构造
values.resize(3);      // 销毁尾部多余元素
```

`resize`改变有效元素数量，必要时也可能扩容。缩小时通常不降低`capacity()`。

### 4.4 shrink_to_fit

```cpp
values.shrink_to_fit();
```

这是请求而不是强制命令，标准库可以选择不缩减容量。若发生重新分配，相关迭代器、指针和引用会失效。

### 4.5 扩容倍率不是标准保证

不同实现可能使用不同增长策略。GCC、MSVC或不同版本观察到的1.5倍、2倍等结果，只是实现细节。

标准关注的是复杂度和语义，而不是固定倍率。若每次只增加一个位置，会导致频繁重新分配，无法实现尾插摊销O(1)，所以实现通常按比例增长。

## 五、元素访问

### 5.1 operator[]与at

```cpp
values[0] = 10;
int first = values.at(0);
```

- `operator[]`不做常规边界检查，越界是未定义行为；
- `at()`越界抛出`std::out_of_range`。

### 5.2 front与back

```cpp
int first = values.front();
int last = values.back();
```

容器必须非空。

### 5.3 data

```cpp
int* raw = values.data();
```

返回底层连续元素区的地址。任何可能导致重新分配的操作之后，都不应继续使用旧`data()`结果。

## 六、增删改查

### 6.1 push_back与emplace_back

```cpp
values.push_back(10);
values.push_back(existingValue);
```

对类对象：

```cpp
std::vector<std::pair<int, std::string>> records;
records.emplace_back(1, "Alice");
```

`emplace_back`直接使用参数构造尾部元素，可能避免临时对象，但不保证在所有场景都比`push_back`更好。表达已有对象时，`push_back`通常更清晰。

### 6.2 pop_back

```cpp
values.pop_back();
```

删除尾部元素但不返回它，调用前容器必须非空。

### 6.3 insert

```cpp
std::vector<int>::iterator position = values.begin() + 1;
values.insert(position, 99);
```

插入可能：

1. 容量不足，重新分配并迁移全部元素；
2. 容量足够，向后移动插入位置及其后的元素。

因此插入后旧`position`通常不应继续使用，应接收返回的新迭代器。

### 6.4 erase

```cpp
std::vector<int>::iterator next = values.erase(values.begin() + 1);
```

删除后后续元素向前移动，返回删除位置之后的新有效位置。

删除所有偶数：

```cpp
for (std::vector<int>::iterator it = values.begin();
     it != values.end();)
{
    if (*it % 2 == 0)
    {
        it = values.erase(it);
    }
    else
    {
        ++it;
    }
}
```

### 6.5 erase-remove惯用法

只需按条件批量删除时，更常用：

```cpp
values.erase(
    std::remove_if(values.begin(), values.end(),
                   [](int value) { return value % 2 == 0; }),
    values.end());
```

`std::remove_if`并不真正缩短容器，它把保留元素移动到前面并返回新的逻辑结尾；`erase`再删除尾部剩余元素。

### 6.6 查找

`vector`没有通用成员`find`，可使用标准算法：

```cpp
std::vector<int>::iterator it =
    std::find(values.begin(), values.end(), 42);

if (it != values.end())
{
    std::cout << "found";
}
```

线性查找复杂度为O(n)。如果数据有序并且频繁查找，可结合`lower_bound`；如果按键查询是核心需求，可能应选择关联容器。

## 七、迭代器失效规则

### 7.1 重新分配

一旦重新分配，旧存储被释放，所有指向旧元素的：

- 迭代器；
- 指针；
- 引用

都会失效。

可能触发重新分配的操作包括容量不足时的`push_back`、`emplace_back`、`insert`，以及增大的`reserve`、`resize`等。

### 7.2 容量足够时插入

即使没有重新分配，插入位置及其后的元素也会移动，因此指向这些位置的迭代器、指针和引用失效；插入位置之前的通常保持有效。

### 7.3 erase

删除位置及其后的迭代器、指针和引用失效，因为后续元素会向前移动。应使用`erase`返回值继续遍历。

### 7.4 错误示例

```cpp
std::vector<int> values{1, 2, 3};
std::vector<int>::iterator it = values.begin();

values.push_back(4);
// 如果发生扩容，it已失效
```

只要代码正确性依赖“这次应该不会扩容”，就应明确通过`reserve`建立容量前提，并仍然遵守其他失效规则。

## 八、底层结构

教学实现常用三个指针描述状态：

```cpp
T* start;
T* finish;
T* endOfStorage;
```

对应区间：

```text
[start, finish)         已构造元素
[finish, endOfStorage)  未构造原始存储
```

于是：

```cpp
size     = finish - start
capacity = endOfStorage - start
```

真正实现还必须处理空指针差值、分配器传播、异常安全、移动策略和对齐等问题。

## 九、为什么不能用memcpy搬移一般对象

对`int`等可平凡复制类型，逐字节复制可能可行；但一般C++对象不能简单`memcpy`。

```cpp
std::vector<std::string> values;
```

如果把`std::string`对象的字节直接复制到新地址，两个对象可能错误共享内部指针，最终造成重复释放或对象不变量破坏。

`vector`扩容时应在新存储中逐个构造对象：

- 可安全移动时优先移动；
- 为保持强异常保证，某些类型会使用复制；
- 构造中途失败时销毁新存储中已经构造的元素；
- 全部成功后再销毁旧元素并释放旧存储。

标准工具`std::move_if_noexcept`表达了这种选择思想。

## 十、二维vector

```cpp
std::vector<std::vector<int>> matrix(3, std::vector<int>(4, 0));
```

它表示3行4列，但每一行是独立的`vector`，各行元素连续，不保证所有行的数据合成一整块连续内存。

不规则二维结构也很自然：

```cpp
std::vector<std::vector<int>> triangle;
for (std::size_t row = 0; row < 5; ++row)
{
    triangle.push_back(std::vector<int>(row + 1, 1));
}
```

若外部API要求完全连续的矩阵，应考虑一维`vector`加行列下标映射。

## 十一、完整示例：教学版SimpleVector

下面的代码用`std::allocator`分离“获得原始存储”和“构造元素”，重点展示扩容与对象生命周期。它仍省略了完整标准接口和分配器传播规则，不能替代`std::vector`。

```cpp
#include <algorithm>
#include <cstddef>
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>
#include <utility>

template<class T>
class SimpleVector
{
public:
    using iterator = T*;
    using const_iterator = const T*;

    SimpleVector() noexcept
        : _data(nullptr), _size(0), _capacity(0)
    {
    }

    SimpleVector(const SimpleVector& other)
        : _data(nullptr), _size(0), _capacity(0)
    {
        if (other._size == 0)
        {
            return;
        }

        _data = Traits::allocate(_allocator, other._size);
        _capacity = other._size;

        try
        {
            for (; _size < other._size; ++_size)
            {
                Traits::construct(_allocator, _data + _size,
                                  other._data[_size]);
            }
        }
        catch (...)
        {
            destroyElements();
            Traits::deallocate(_allocator, _data, _capacity);
            _data = nullptr;
            _capacity = 0;
            throw;
        }
    }

    SimpleVector(SimpleVector&& other) noexcept
        : _data(other._data),
          _size(other._size),
          _capacity(other._capacity)
    {
        other._data = nullptr;
        other._size = 0;
        other._capacity = 0;
    }

    SimpleVector& operator=(SimpleVector other)
    {
        swap(other);
        return *this;
    }

    ~SimpleVector()
    {
        destroyElements();
        if (_data != nullptr)
        {
            Traits::deallocate(_allocator, _data, _capacity);
        }
    }

    void swap(SimpleVector& other) noexcept
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

        T* newData = Traits::allocate(_allocator, newCapacity);
        std::size_t constructed = 0;

        try
        {
            for (; constructed < _size; ++constructed)
            {
                Traits::construct(
                    _allocator,
                    newData + constructed,
                    std::move_if_noexcept(_data[constructed]));
            }
        }
        catch (...)
        {
            while (constructed > 0)
            {
                --constructed;
                Traits::destroy(_allocator, newData + constructed);
            }
            Traits::deallocate(_allocator, newData, newCapacity);
            throw;
        }

        destroyElements();
        if (_data != nullptr)
        {
            Traits::deallocate(_allocator, _data, _capacity);
        }

        _data = newData;
        _size = constructed;
        _capacity = newCapacity;
    }

    void push_back(const T& value)
    {
        ensureCapacityForOneMore();
        Traits::construct(_allocator, _data + _size, value);
        ++_size;
    }

    void push_back(T&& value)
    {
        ensureCapacityForOneMore();
        Traits::construct(_allocator, _data + _size, std::move(value));
        ++_size;
    }

    void pop_back()
    {
        if (_size == 0)
        {
            throw std::out_of_range("SimpleVector::pop_back");
        }

        --_size;
        Traits::destroy(_allocator, _data + _size);
    }

    T& at(std::size_t index)
    {
        if (index >= _size)
        {
            throw std::out_of_range("SimpleVector::at");
        }
        return _data[index];
    }

    const T& at(std::size_t index) const
    {
        if (index >= _size)
        {
            throw std::out_of_range("SimpleVector::at");
        }
        return _data[index];
    }

    iterator begin() noexcept { return _data; }
    iterator end() noexcept { return _data == nullptr ? nullptr : _data + _size; }
    const_iterator begin() const noexcept { return _data; }
    const_iterator end() const noexcept
    {
        return _data == nullptr ? nullptr : _data + _size;
    }

    std::size_t size() const noexcept { return _size; }
    std::size_t capacity() const noexcept { return _capacity; }
    bool empty() const noexcept { return _size == 0; }

private:
    using Allocator = std::allocator<T>;
    using Traits = std::allocator_traits<Allocator>;

    void ensureCapacityForOneMore()
    {
        if (_size == _capacity)
        {
            reserve(_capacity == 0 ? 1 : _capacity * 2);
        }
    }

    void destroyElements() noexcept
    {
        while (_size > 0)
        {
            --_size;
            Traits::destroy(_allocator, _data + _size);
        }
    }

    Allocator _allocator;
    T* _data;
    std::size_t _size;
    std::size_t _capacity;
};

int main()
{
    SimpleVector<std::string> words;
    words.reserve(3);
    words.push_back("vector");
    words.push_back("stores");
    words.push_back("objects");

    SimpleVector<std::string> copy = words;
    copy.at(0) = "copy";

    for (const std::string& word : words)
    {
        std::cout << word << ' ';
    }
    std::cout << '\n';

    for (const std::string& word : copy)
    {
        std::cout << word << ' ';
    }
    std::cout << '\n';

    std::cout << "size: " << words.size() << '\n';
    std::cout << "capacity: " << words.capacity() << '\n';

    return 0;
}
```

输出：

```text
vector stores objects 
copy stores objects 
size: 3
capacity: 3
```

## 十二、常见错误

### 12.1 reserve后直接通过下标写入

```cpp
std::vector<int> values;
values.reserve(10);
// values[0] = 1; // 错误：size仍为0
```

应使用`push_back`，或按语义使用`resize`创建元素。

### 12.2 修改容器后继续使用旧迭代器

扩容、插入和删除后要根据规则重新获取位置，优先使用接口返回的新迭代器。

### 12.3 认为clear会释放容量

`clear()`销毁所有元素并把`size()`变为零，但通常保留容量以便复用。

### 12.4 用memcpy复制vector中的类对象

逐字节复制可能破坏对象所有权和生命周期。应通过构造、赋值或标准算法复制对象。

### 12.5 在循环中反复进行单个中间erase

每次删除都要移动后续元素，可能形成O(n²)。按条件批量删除应考虑erase-remove或重新构造结果。

## 十三、vector与list对比

|维度|vector|list|
|---|---|---|
|内存布局|连续|节点分散|
|随机访问|O(1)|不支持|
|尾部追加|摊销O(1)|O(1)|
|已知位置插入|O(n)|O(1)|
|缓存局部性|通常较好|通常较差|
|节点额外开销|较小|前后指针开销|
|失效规则|结构修改影响较广|通常只影响被删节点|

复杂度表不能替代实际测量。即使`list`插入本身O(1)，寻找插入位置仍可能O(n)，而`vector`连续移动简单类型可能非常快。

## 十四、面试常见问题

### 14.1 vector底层如何表示

常见实现维护起始位置、有效元素尾后位置和存储尾后位置，从指针差计算`size`与`capacity`。

### 14.2 vector为什么扩容后迭代器失效

元素被迁移到新的存储地址，旧地址释放，原迭代器、指针和引用都指向旧存储。

### 14.3 push_back一定是O(1)吗

单次扩容可能是O(n)，但连续多次尾插的摊销复杂度为O(1)。

### 14.4 reserve与resize的区别

`reserve`请求容量，不创建新元素；`resize`改变元素数量，扩大时会构造新元素。

### 14.5 为什么vector扩容不能直接memcpy

一般对象可能拥有资源并依赖构造、移动、复制和析构维护不变量，逐字节复制无法正确表达这些语义。

## 十五、总结

1. `vector`是连续存储的动态数组，默认适合作为序列容器首选。
2. `size`表示已存在元素数，`capacity`表示当前存储能力。
3. `reserve`减少扩容次数，`resize`改变有效元素数量。
4. 扩容倍率属于实现细节，标准只规定语义和复杂度要求。
5. 重新分配会使所有旧迭代器、指针和引用失效。
6. `erase`后应使用返回值继续遍历，批量条件删除可使用erase-remove。
7. `vector`扩容要逐个构造或移动一般对象，不能对任意`T`使用`memcpy`。
8. 真正的实现必须区分原始存储与已构造对象，并正确处理异常回滚。
