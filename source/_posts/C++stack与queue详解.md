---
title: C++ stack、queue与priority_queue详解：容器适配器与deque
date: 2026-08-15 22:50:00
categories:
  - C++
tags:
  - C++
  - STL
  - stack
  - queue
  - priority_queue
  - deque
  - 容器适配器
---

`stack`、`queue`和`priority_queue`不以完整容器接口呈现，而是通过限制底层容器的操作，分别形成后进先出、先进先出和按优先级访问的数据结构。理解它们的关键是“容器适配器”：存储工作由底层容器完成，适配器负责提供受约束的接口和语义。

本文系统介绍三种适配器的接口、复杂度、底层容器要求、比较器规则、`deque`结构，以及最小栈、逆波兰表达式和第K大元素等典型应用。

<!-- more -->

## 一、什么是容器适配器

适配器复用已有组件，并改变它对外暴露的接口。

```cpp
template<class T, class Container = std::deque<T>>
class stack;
```

可以把`stack`理解为：内部保存一个容器，但只允许访问尾部，隐藏迭代、随机访问和中间插入等接口，从而形成后进先出语义。

标准库中的主要容器适配器：

|适配器|语义|默认底层容器|
|---|---|---|
|`std::stack`|后进先出LIFO|`std::deque`|
|`std::queue`|先进先出FIFO|`std::deque`|
|`std::priority_queue`|优先级最高元素先出|`std::vector`|

适配器通常不提供迭代器，因为允许随意遍历和修改会削弱数据结构的接口约束。

## 二、stack

### 2.1 栈的语义

栈只允许在同一端压入和弹出元素：

```text
push -> [bottom ... top] <- pop
```

最后压入的元素最先弹出，因此称为LIFO，Last In First Out。

### 2.2 常用接口

```cpp
#include <stack>

std::stack<int> values;
values.push(10);
values.emplace(20);

std::cout << values.top();
values.pop();

std::cout << values.size();
std::cout << std::boolalpha << values.empty();
```

|接口|作用|
|---|---|
|`push(value)`|压入元素|
|`emplace(args...)`|在栈顶直接构造元素|
|`pop()`|删除栈顶，不返回值|
|`top()`|访问栈顶|
|`empty()`|判断是否为空|
|`size()`|返回元素数量|
|`swap()`|交换两个栈|

`top()`和`pop()`要求栈非空。标准容器接口不会为这种逻辑错误自动返回特殊值。

### 2.3 pop为什么不返回元素

标准库把“访问”和“删除”分成两个操作：

```cpp
int value = values.top();
values.pop();
```

历史和异常安全设计上，若复制返回值时抛出异常，同时元素已经删除，就难以保持清晰状态。分离接口让调用者先成功取得值，再执行删除。对移动类型也可根据需要移动栈顶对象后再`pop`。

### 2.4 指定底层容器

```cpp
std::stack<int, std::vector<int>> vectorStack;
std::stack<int, std::list<int>> listStack;
```

底层容器需要提供`back`、`push_back`和`pop_back`等适配器所需操作。默认`deque`兼顾尾部操作、分段增长和较低的大规模搬移需求。

### 2.5 栈的典型应用

- 函数调用与递归思想；
- 括号匹配；
- 表达式求值；
- 深度优先搜索；
- 浏览器后退；
- 撤销操作；
- 单调栈算法。

## 三、最小栈

要求`push`、`pop`、`top`和获取最小值都为O(1)，可以维护两个栈：

- 数据栈保存全部元素；
- 最小值栈保存当前各阶段的最小值。

关键细节是遇到相等最小值也要压入辅助栈：

```cpp
if (minimums.empty() || value <= minimums.top())
{
    minimums.push(value);
}
```

弹出时如果数据栈顶等于最小值栈顶，两边同时弹出。若只在严格小于时记录，重复最小值会导致提前丢失状态。

## 四、用栈判断出栈序列

给定压栈序列和候选出栈序列，可用辅助栈模拟：

1. 按压栈序列依次压入；
2. 每次压入后，只要栈顶等于候选出栈序列当前元素，就不断弹出；
3. 最后辅助栈为空，说明候选序列可实现。

```cpp
bool isValidPopOrder(const std::vector<int>& pushed,
                     const std::vector<int>& popped)
{
    if (pushed.size() != popped.size())
    {
        return false;
    }

    std::stack<int> helper;
    std::size_t out = 0;

    for (int value : pushed)
    {
        helper.push(value);

        while (!helper.empty() &&
               out < popped.size() &&
               helper.top() == popped[out])
        {
            helper.pop();
            ++out;
        }
    }

    return helper.empty();
}
```

时间复杂度O(n)，每个元素最多入栈、出栈一次。

## 五、逆波兰表达式

后缀表达式中，运算符位于操作数之后：

```text
2 1 + 3 *
```

计算过程：

1. 数字入栈；
2. 遇到运算符，先弹出右操作数，再弹出左操作数；
3. 计算结果重新入栈；
4. 最后栈中唯一元素就是答案。

减法和除法尤其不能颠倒：

```cpp
const int right = values.top(); values.pop();
const int left = values.top(); values.pop();
values.push(left - right);
```

真实解析还要处理非法表达式、溢出、除零和数字格式。

## 六、queue

### 6.1 队列的语义

队列从尾部进入，从头部离开：

```text
pop <- [front ... back] <- push
```

最先进入的元素最先离开，因此称为FIFO，First In First Out。

### 6.2 常用接口

```cpp
#include <queue>

std::queue<std::string> tasks;
tasks.push("read");
tasks.emplace("write");

std::cout << tasks.front();
std::cout << tasks.back();
tasks.pop();
```

|接口|作用|
|---|---|
|`push(value)`|从队尾入队|
|`emplace(args...)`|在队尾直接构造|
|`pop()`|删除队头|
|`front()`|访问队头|
|`back()`|访问队尾|
|`empty()`|判断为空|
|`size()`|元素数量|

`front`、`back`和`pop`都要求队列非空。

### 6.3 指定底层容器

```cpp
std::queue<int, std::list<int>> listQueue;
```

底层容器需要支持`front`、`back`、`push_back`和`pop_front`。`vector`没有高效的`pop_front`，也不满足标准`queue`所需的全部接口，因此不能作为普通`queue`底层容器。

### 6.4 队列的典型应用

- 广度优先搜索；
- 二叉树层序遍历；
- 生产者消费者任务队列；
- 消息排队；
- 操作系统调度模型；
- 网络请求缓冲。

标准`std::queue`本身不是并发队列。多个线程共享时需要互斥量、条件变量和清晰的关闭协议。

## 七、用两个栈实现队列

维护：

- 输入栈：新元素压入；
- 输出栈：负责弹出队头。

当输出栈为空时，把输入栈所有元素倒入输出栈。每个元素最多在两个栈之间移动一次，因此单次最坏O(n)，均摊O(1)。

反过来，也可以用两个队列实现栈，但需要在压入或弹出阶段搬移元素。

## 八、priority_queue

### 8.1 优先队列的语义

普通队列按进入顺序出队，优先队列每次访问“优先级最高”的元素。默认比较规则下，`std::priority_queue<int>`的`top()`是最大值，通常称为大堆。

```cpp
std::priority_queue<int> values;
values.push(3);
values.push(8);
values.push(5);
std::cout << values.top(); // 8
```

### 8.2 模板参数

概念形式：

```cpp
template<
    class T,
    class Container = std::vector<T>,
    class Compare = std::less<typename Container::value_type>
> class priority_queue;
```

默认`std::less<T>`形成最大元素位于顶部的队列。

### 8.3 小堆

```cpp
std::priority_queue<
    int,
    std::vector<int>,
    std::greater<int>
> minimumQueue;
```

此时`top()`是最小值。

### 8.4 常用接口和复杂度

|接口|典型复杂度|
|---|---|
|`top()`|O(1)|
|`push()`、`emplace()`|O(log n)|
|`pop()`|O(log n)|
|`empty()`、`size()`|O(1)|

底层通常是二叉堆，使用连续容器保存完全二叉树。

### 8.5 堆的下标关系

若根节点下标为0：

```text
leftChild  = 2 * parent + 1
rightChild = 2 * parent + 2
parent     = (child - 1) / 2
```

插入时把元素放到末尾并向上调整；删除顶部时把末尾元素移到根，减少有效长度，再向下调整。

### 8.6 比较器最容易混淆的地方

比较器表达的是两个元素的优先顺序关系。默认`std::less<T>`使较大元素留在顶部；`std::greater<T>`使较小元素留在顶部。

自定义任务：

```cpp
struct Task
{
    int priority;
    std::string name;
};

struct LowerPriority
{
    bool operator()(const Task& left, const Task& right) const
    {
        return left.priority < right.priority;
    }
};
```

使用该比较器时，优先级数值较大的任务位于顶部。

比较器必须满足严格弱序，不能使用不一致或随时间变化的规则破坏堆不变量。

## 九、第K大元素

常见方案有两种：

### 9.1 大堆保存全部元素

把n个元素放入大堆，再弹出k-1次，顶部就是第k大。复杂度约O(n + k log n)，空间O(n)。

### 9.2 大小为k的小堆

维护当前最大的k个元素：

1. 前k个元素入小堆；
2. 后续元素若大于堆顶，就替换堆顶；
3. 最终堆顶是第k大。

复杂度O(n log k)，空间O(k)，当k远小于n时更有优势。

## 十、deque的结构

### 10.1 分段连续

`deque`常通过一个映射表管理多块固定大小缓冲区。每块内部连续，整体不保证形成单一连续数组。

这让它能够：

- 在头尾两端高效增长；
- 避免像`vector`扩容那样搬移全部元素；
- 支持随机访问。

但不能把`&deque[0]`和元素数量当成整块连续数组交给要求连续内存的API。

### 10.2 迭代器较复杂

`deque`迭代器通常需要记录：

- 当前元素位置；
- 当前缓冲区起止；
- 映射表中的块位置。

递增时要判断是否越过当前块并跳到下一块，因此比原生指针迭代器复杂。

### 10.3 为什么适合作为stack和queue默认底层

`stack`和`queue`通常只访问端点，不需要频繁全量遍历或连续内存。`deque`提供：

- 两端高效操作；
- 分段增长，无需整体搬移；
- 比节点链表更好的空间局部性；
- 恰好满足适配器所需接口。

这不是说`deque`在所有场景都优于`vector`和`list`，而是它的优势与适配器访问模式高度匹配。

## 十一、适配器的简化实现

栈的核心封装非常直接：

```cpp
template<class T, class Container = std::deque<T>>
class Stack
{
public:
    bool empty() const { return _container.empty(); }
    std::size_t size() const { return _container.size(); }
    T& top() { return _container.back(); }
    const T& top() const { return _container.back(); }
    void push(const T& value) { _container.push_back(value); }
    void pop() { _container.pop_back(); }

private:
    Container _container;
};
```

队列把访问端改成`front()`和`pop_front()`。这体现了模板与组合的价值：适配器无需重新实现节点或动态数组。

## 十二、完整示例

下面同时演示最小栈、普通任务队列和自定义优先队列。

```cpp
#include <iostream>
#include <queue>
#include <stack>
#include <stdexcept>
#include <string>
#include <vector>

class MinStack
{
public:
    void push(int value)
    {
        _values.push(value);
        if (_minimums.empty() || value <= _minimums.top())
        {
            _minimums.push(value);
        }
    }

    void pop()
    {
        requireNotEmpty();
        if (_values.top() == _minimums.top())
        {
            _minimums.pop();
        }
        _values.pop();
    }

    int top() const
    {
        requireNotEmpty();
        return _values.top();
    }

    int minimum() const
    {
        requireNotEmpty();
        return _minimums.top();
    }

    bool empty() const noexcept
    {
        return _values.empty();
    }

private:
    void requireNotEmpty() const
    {
        if (_values.empty())
        {
            throw std::out_of_range("MinStack is empty");
        }
    }

    std::stack<int> _values;
    std::stack<int> _minimums;
};

struct Task
{
    int priority;
    std::string name;
};

struct LowerPriority
{
    bool operator()(const Task& left, const Task& right) const
    {
        return left.priority < right.priority;
    }
};

int main()
{
    MinStack values;
    values.push(5);
    values.push(2);
    values.push(2);
    values.push(8);

    std::cout << "minimum: " << values.minimum() << '\n';
    values.pop();
    values.pop();
    std::cout << "minimum after pop: " << values.minimum() << '\n';

    std::queue<std::string> jobs;
    jobs.push("parse");
    jobs.push("compute");
    jobs.push("write");

    std::cout << "queue:";
    while (!jobs.empty())
    {
        std::cout << ' ' << jobs.front();
        jobs.pop();
    }
    std::cout << '\n';

    std::priority_queue<Task, std::vector<Task>, LowerPriority> tasks;
    tasks.push(Task{2, "normal"});
    tasks.push(Task{5, "urgent"});
    tasks.push(Task{1, "background"});

    std::cout << "priority order:";
    while (!tasks.empty())
    {
        std::cout << ' ' << tasks.top().name;
        tasks.pop();
    }
    std::cout << '\n';

    return 0;
}
```

输出：

```text
minimum: 2
minimum after pop: 2
queue: parse compute write
priority order: urgent normal background
```

## 十三、常见错误

### 13.1 空容器上调用top、front或pop

这些操作要求非空。业务接口应先判断，或在更高层封装错误策略。

### 13.2 认为pop会返回被删元素

`pop()`返回`void`。先用`top()`或`front()`取得值，再删除。

### 13.3 优先队列比较器方向写反

先用三个不同优先级的小样例验证顶部元素，再投入算法。明确比较器返回`true`表示左侧在优先顺序上排在右侧之后。

### 13.4 使用不稳定比较规则

比较器应满足严格弱序，不能依赖会在元素入堆后改变的外部状态。

### 13.5 把标准queue当作线程安全队列

它不提供阻塞等待和同步语义。并发任务队列需要互斥量、条件变量、停止标志和异常处理。

## 十四、面试常见问题

### 14.1 stack和queue为什么叫容器适配器

它们不重新定义完整存储结构，而是封装满足要求的底层容器，并限制接口形成LIFO或FIFO语义。

### 14.2 为什么默认使用deque

`deque`两端操作高效、增长时通常不搬移全部元素，空间局部性又优于纯节点链表，适合只访问端点的栈和队列。

### 14.3 priority_queue默认是大堆还是小堆

默认使用`std::less<T>`，顶部是最大元素，即通常所说的大堆。

### 14.4 如何建立小堆

指定底层容器与`std::greater<T>`：

```cpp
std::priority_queue<int, std::vector<int>, std::greater<int>> values;
```

### 14.5 最小栈如何做到O(1)获取最小值

额外维护最小值栈，记录每个阶段的最小值；压入相等最小值时也同步记录。

## 十五、总结

1. `stack`是LIFO，`queue`是FIFO，`priority_queue`按优先级访问顶部。
2. 三者都是容器适配器，不提供完整容器接口和普通迭代器。
3. `stack`和`queue`默认使用`deque`，`priority_queue`默认使用`vector`。
4. `pop()`只删除不返回，访问前必须保证容器非空。
5. `priority_queue`默认是大堆，小堆可使用`std::greater<T>`。
6. 自定义比较器必须满足严格弱序，并仔细确认比较方向。
7. `deque`是分段连续结构，适合两端操作，但不能当作整块连续数组。
8. 标准适配器本身不提供并发同步，多线程队列需要额外封装。
