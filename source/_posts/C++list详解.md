---
title: C++ list详解：双向链表、迭代器与节点操作
date: 2026-08-15 22:40:00
categories:
  - C++
tags:
  - C++
  - STL
  - list
  - 双向链表
  - 迭代器
  - 迭代器失效
---

`std::list`是节点式双向链表。它不提供随机访问，却能在已知位置以常数复杂度插入、删除和转移节点，并且结构修改通常不会让其他节点的迭代器失效。

本文从`list`的接口与复杂度讲到哨兵节点、双向迭代器和迭代器失效，并与`vector`进行工程化比较。文末通过一个教学版双向链表展示节点链接、插入、删除和迭代器封装。

<!-- more -->

## 一、list的结构与特点

`std::list<T>`通常实现为双向链表。每个节点除保存元素外，还保存前驱和后继链接。

```text
sentinel <-> node1 <-> node2 <-> node3 <-> sentinel
```

很多实现使用哨兵节点把首尾边界统一起来：

- `begin()`指向第一个数据节点；
- `end()`指向哨兵节点；
- 空链表中哨兵的前后链接都指向自己；
- 在首尾插入、删除时不必为`nullptr`编写大量特殊分支。

### 1.1 核心优势

- 已知迭代器位置时，插入和删除通常为O(1)；
- 插入通常不会使已有元素的迭代器和引用失效；
- 删除通常只使指向被删元素的迭代器和引用失效；
- 支持`splice`在链表之间转移节点；
- 元素不要求连续存储。

### 1.2 主要代价

- 不支持`operator[]`；
- 寻找第n个元素需要O(n)遍历；
- 每个节点有额外链接和分配开销；
- 内存分散，缓存局部性通常弱于`vector`；
- 不能直接使用要求随机访问迭代器的算法，如`std::sort`。

## 二、构造与赋值

### 2.1 常见构造

```cpp
#include <list>

std::list<int> first;
std::list<int> second(4, 100);
std::list<int> third{1, 2, 3, 4};
std::list<int> copy(third);
```

### 2.2 区间构造

```cpp
int raw[] = {16, 2, 77, 29};
std::list<int> values(std::begin(raw), std::end(raw));
```

只要迭代器区间中的值能够构造元素，就可以从其他容器复制：

```cpp
std::vector<int> source{1, 2, 3};
std::list<int> values(source.begin(), source.end());
```

### 2.3 assign

```cpp
values.assign(5, 9);
values.assign(source.begin(), source.end());
```

`assign`替换原有内容，旧元素相关的迭代器和引用不应继续使用。

## 三、迭代器

### 3.1 list提供双向迭代器

```cpp
for (std::list<int>::iterator it = values.begin();
     it != values.end(); ++it)
{
    std::cout << *it << ' ';
}
```

双向迭代器支持：

- 解引用`*it`；
- 成员访问`it->member`；
- 前进`++it`；
- 后退`--it`；
- 相等与不等比较。

它不支持：

```cpp
// it + 5
// it[3]
// it < other
```

### 3.2 end可以递减但不能解引用

非空`list`中：

```cpp
std::list<int>::iterator it = values.end();
--it;
std::cout << *it; // 最后一个元素
```

`end()`本身是尾后位置，不能直接解引用。空容器中也不能对`end()`递减。

### 3.3 const迭代器

```cpp
void print(const std::list<int>& values)
{
    for (std::list<int>::const_iterator it = values.cbegin();
         it != values.cend(); ++it)
    {
        std::cout << *it << ' ';
    }
}
```

### 3.4 反向迭代器

```cpp
for (std::list<int>::reverse_iterator it = values.rbegin();
     it != values.rend(); ++it)
{
    std::cout << *it << ' ';
}
```

反向迭代器的`++`在逻辑上向前一个节点移动。

### 3.5 std::advance与std::next

`list`不支持迭代器加法，可以使用：

```cpp
std::list<int>::iterator it = values.begin();
std::advance(it, 3);

std::list<int>::iterator another = std::next(values.begin(), 2);
```

对双向链表移动k步仍然需要O(k)，工具函数没有改变底层复杂度。

## 四、容量与元素访问

### 4.1 empty与size

```cpp
if (!values.empty())
{
    std::cout << values.size();
}
```

现代标准要求`list::size()`为常数复杂度。极老的实现背景不应替代当前标准接口保证。

### 4.2 front与back

```cpp
int first = values.front();
int last = values.back();
```

链表非空时可访问首尾。空容器调用会产生未定义行为。

`list`没有`operator[]`和`at()`，因为按下标访问无法提供常数复杂度。

## 五、首尾操作

```cpp
std::list<int> values{2, 3};

values.push_front(1);
values.push_back(4);

values.pop_front();
values.pop_back();
```

这些操作通常为O(1)。`pop_front`与`pop_back`要求容器非空，并且不会返回被删值；如需保留值，应先读取再删除。

C++11还提供：

```cpp
values.emplace_front(constructorArguments...);
values.emplace_back(constructorArguments...);
```

它们使用参数直接构造节点中的元素。

## 六、insert、emplace与erase

### 6.1 insert在pos之前插入

```cpp
std::list<int>::iterator position = std::next(values.begin());
std::list<int>::iterator inserted = values.insert(position, 99);
```

新元素位于`position`之前，返回指向新元素的迭代器。只要已知`position`，链接节点通常是O(1)。

还可插入多个元素或迭代器区间：

```cpp
values.insert(position, 3, 7);
values.insert(position, source.begin(), source.end());
```

总复杂度还要计入新节点数量及构造成本。

### 6.2 emplace

```cpp
std::list<std::pair<int, std::string>> records;
records.emplace(records.begin(), 1, "Alice");
```

它在目标节点中直接构造元素。

### 6.3 erase

```cpp
std::list<int>::iterator next = values.erase(position);
```

删除`position`指向的节点并返回下一个位置。原`position`失效，不能再解引用或递增。

边遍历边删除的正确模式：

```cpp
for (std::list<int>::iterator it = values.begin();
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

## 七、list的专用操作

### 7.1 remove与remove_if

```cpp
values.remove(10);
values.remove_if([](int value) { return value < 0; });
```

它们会遍历链表并真正删除匹配节点。不要把它与`std::remove`混淆：通用`std::remove`只是移动元素，且链表有更合适的成员接口。

### 7.2 unique

```cpp
values.unique();
```

只删除相邻的重复元素。若希望去除所有重复值，常先排序再`unique`：

```cpp
values.sort();
values.unique();
```

### 7.3 sort

```cpp
values.sort();
values.sort(std::greater<int>());
```

`std::sort`要求随机访问迭代器，不能用于`list`。`list::sort`通常通过重新链接节点排序，无需把元素搬进连续数组。

### 7.4 merge

```cpp
std::list<int> left{1, 3, 5};
std::list<int> right{2, 4, 6};
left.merge(right);
```

两个链表必须已经按相同规则排序。合并后节点进入`left`，`right`通常变空。

### 7.5 reverse

```cpp
values.reverse();
```

通过调整链接反转节点顺序。

### 7.6 splice

`splice`是链表的重要优势，可把一个或多个节点转移到另一个链表的指定位置：

```cpp
std::list<int> first{1, 2};
std::list<int> second{3, 4};

first.splice(first.end(), second);
```

在分配器等前提满足时，它主要改变链接，不复制节点中的元素。可以转移：

- 整个链表；
- 单个节点；
- 一个迭代器区间。

需要遵守同一容器内移动、位置是否落在转移区间等前置条件。

## 八、迭代器失效

### 8.1 插入

插入新节点通常不会使已有元素的迭代器、指针和引用失效。

### 8.2 删除

删除只使指向被删除节点的迭代器、指针和引用失效，其他节点通常保持有效。

### 8.3 splice

转移节点后，指向被转移元素的迭代器通常仍然指向同一元素，但元素所属容器已经改变。后续操作必须使用正确容器。

### 8.4 clear与析构

所有节点被删除，相关位置全部失效。

相较`vector`，`list`的迭代器稳定性更强，但“被删除节点的迭代器仍可使用”永远是错误的。

## 九、list与vector的正确比较

|维度|vector|list|
|---|---|---|
|存储|连续|节点式|
|随机访问|O(1)|不支持|
|已知位置插入/删除|需要移动，O(n)|链接操作O(1)|
|寻找位置|可随机访问|通常O(n)|
|缓存局部性|好|较弱|
|节点开销|低|有前后链接和分配开销|
|迭代器稳定性|结构修改影响较广|除被删节点外通常稳定|

不能只看到“`list`插入O(1)”就认为它一定更快：

1. 如果先遍历到位置，寻找成本是O(n)；
2. 每个节点单独分配可能较慢；
3. 指针跳转不利于缓存和预取；
4. `vector`搬移简单对象往往非常高效。

默认序列容器通常先考虑`vector`，只有节点稳定、频繁已知位置插删、`splice`等需求明确时再选择`list`。

## 十、底层插入与删除

假设`position`指向插入位置，新节点为`node`：

```cpp
node->next = position;
node->prev = position->prev;
position->prev->next = node;
position->prev = node;
```

删除`position`：

```cpp
position->prev->next = position->next;
position->next->prev = position->prev;
delete position;
```

真实实现还要处理分配器、异常、大小计数和调试迭代器。

## 十一、为什么list迭代器不是普通T指针

数据节点之间不连续，`T* + 1`无法找到下一个节点。迭代器需要同时知道节点，并在`operator++`中沿`next`移动：

```cpp
iterator& operator++()
{
    node = node->next;
    return *this;
}
```

解引用时则访问节点中的值：

```cpp
T& operator*() const
{
    return node->value;
}
```

这说明“迭代器像指针”是接口层类比，不等于所有迭代器都是原生指针。

## 十二、完整示例：教学版SimpleList

下面实现哨兵节点、双向链接、迭代器、插入和删除。为突出结构，它明确禁用复制，并省略const迭代器、移动、分配器和全部标准接口。

```cpp
#include <cstddef>
#include <iostream>
#include <string>
#include <utility>

template<class T>
class SimpleList
{
private:
    struct NodeBase
    {
        NodeBase* previous;
        NodeBase* next;
    };

    struct Node : NodeBase
    {
        explicit Node(const T& value)
            : NodeBase{nullptr, nullptr}, data(value)
        {
        }

        explicit Node(T&& value)
            : NodeBase{nullptr, nullptr}, data(std::move(value))
        {
        }

        T data;
    };

public:
    class iterator
    {
        friend class SimpleList;

    public:
        iterator() : _node(nullptr) {}

        T& operator*() const
        {
            return static_cast<Node*>(_node)->data;
        }

        T* operator->() const
        {
            return &static_cast<Node*>(_node)->data;
        }

        iterator& operator++()
        {
            _node = _node->next;
            return *this;
        }

        iterator& operator--()
        {
            _node = _node->previous;
            return *this;
        }

        bool operator==(const iterator& other) const
        {
            return _node == other._node;
        }

        bool operator!=(const iterator& other) const
        {
            return !(*this == other);
        }

    private:
        explicit iterator(NodeBase* node) : _node(node) {}
        NodeBase* _node;
    };

    SimpleList() : _root{&_root, &_root}, _size(0) {}

    SimpleList(const SimpleList&) = delete;
    SimpleList& operator=(const SimpleList&) = delete;

    ~SimpleList()
    {
        clear();
    }

    iterator begin() noexcept { return iterator(_root.next); }
    iterator end() noexcept { return iterator(&_root); }

    bool empty() const noexcept { return _size == 0; }
    std::size_t size() const noexcept { return _size; }

    iterator insert(iterator position, const T& value)
    {
        Node* node = new Node(value);
        linkBefore(position._node, node);
        ++_size;
        return iterator(node);
    }

    iterator insert(iterator position, T&& value)
    {
        Node* node = new Node(std::move(value));
        linkBefore(position._node, node);
        ++_size;
        return iterator(node);
    }

    void push_back(const T& value)
    {
        insert(end(), value);
    }

    void push_back(T&& value)
    {
        insert(end(), std::move(value));
    }

    iterator erase(iterator position)
    {
        NodeBase* node = position._node;
        NodeBase* next = node->next;

        node->previous->next = node->next;
        node->next->previous = node->previous;
        delete static_cast<Node*>(node);
        --_size;

        return iterator(next);
    }

    void clear() noexcept
    {
        NodeBase* current = _root.next;
        while (current != &_root)
        {
            NodeBase* next = current->next;
            delete static_cast<Node*>(current);
            current = next;
        }

        _root.next = &_root;
        _root.previous = &_root;
        _size = 0;
    }

private:
    static void linkBefore(NodeBase* position, NodeBase* node)
    {
        node->next = position;
        node->previous = position->previous;
        position->previous->next = node;
        position->previous = node;
    }

    NodeBase _root;
    std::size_t _size;
};

int main()
{
    SimpleList<std::string> words;
    words.push_back("list");
    words.push_back("keeps");
    words.push_back("nodes");

    SimpleList<std::string>::iterator it = words.begin();
    ++it;
    words.insert(it, "links");

    for (const std::string& word : words)
    {
        std::cout << word << ' ';
    }
    std::cout << '\n';

    it = words.begin();
    ++it;
    words.erase(it);

    for (const std::string& word : words)
    {
        std::cout << word << ' ';
    }
    std::cout << '\n';
    std::cout << "size: " << words.size() << '\n';

    return 0;
}
```

输出：

```text
list links keeps nodes 
list keeps nodes 
size: 3
```

## 十三、常见错误

### 13.1 试图使用下标

`list`不支持`values[index]`。若算法核心依赖随机访问，可能选择错了容器。

### 13.2 对list调用std::sort

`std::sort`需要随机访问迭代器。应使用`values.sort()`。

### 13.3 erase后继续使用原迭代器

被删节点已经销毁，必须使用`erase`返回的下一个迭代器。

### 13.4 认为插入O(1)就忽略寻找位置

插入链接为O(1)，但从头找到第n个位置通常为O(n)。

### 13.5 在未排序链表上merge

`merge`要求两个输入链表已经按相同比较规则排序，否则不满足前置条件。

## 十四、面试常见问题

### 14.1 list底层为什么常使用哨兵节点

哨兵把空链表、首节点和尾节点的链接统一起来，减少边界分支，并自然表示`end()`。

### 14.2 list插入为什么通常不导致迭代器失效

新节点独立分配，只调整邻接链接，已有节点地址不变。

### 14.3 list删除后哪些迭代器失效

指向被删除节点的迭代器、指针和引用失效，其他节点通常不受影响。

### 14.4 list为什么不能随机访问

节点不连续，必须沿链接逐个移动，无法通过地址加偏移在O(1)内定位第n个元素。

### 14.5 list一定比vector插入快吗

不一定。还要考虑寻找位置、节点分配、缓存局部性、元素移动成本和实际数据规模。

## 十五、总结

1. `list`通常是带哨兵的双向链表，提供双向迭代器。
2. 已知位置插入和删除的链接操作为O(1)，但寻找位置可能为O(n)。
3. `list`不支持随机访问，也不能使用要求随机访问迭代器的`std::sort`。
4. 插入通常不使已有迭代器失效，删除只使被删节点相关位置失效。
5. `sort`、`merge`、`splice`、`remove`和`unique`是重要成员操作。
6. `splice`能够通过调整链接转移节点，是节点式容器的重要能力。
7. 默认序列容器仍应优先评估`vector`，只有明确需求时选择`list`。
