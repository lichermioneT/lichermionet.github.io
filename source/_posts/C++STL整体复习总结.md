---
title: C++ STL整体复习总结：六大组件、容器、算法与迭代器体系
date: 2026-08-15 15:00:00
categories:
  - C++
tags:
  - C++
  - STL
  - 容器
  - 算法
  - 迭代器
  - 仿函数
  - 空间配置器
---

STL 是 Standard Template Library 的缩写，即标准模板库。它以泛型编程为核心，把数据结构、遍历方式和处理算法拆分成可以自由组合的组件，使同一套算法能够处理不同容器。

学习 STL 不能只停留在记忆接口。真正重要的是理解容器特性、迭代器能力、算法前置条件、复杂度、失效规则以及六大组件之间如何协作。本文以整体知识框架为主线，对常用容器、算法、迭代器、适配器、函数对象和分配器进行系统复习。

<!-- more -->

## 一、STL的本质

STL 对常见数据结构和算法进行了泛型封装，例如：

- 动态顺序表：`std::vector`；
- 双端队列：`std::deque`；
- 双向链表：`std::list`；
- 栈和队列：`std::stack`、`std::queue`；
- 有序树结构：`std::set`、`std::map`；
- 哈希表：`std::unordered_set`、`std::unordered_map`；
- 排序、查找、复制、划分、排列和数值运算算法。

STL 的关键不是“提供了很多现成函数”，而是建立了一套组件协议：

```text
容器保存数据
    |
    v
迭代器描述访问方式和区间
    |
    v
算法只依赖迭代器能力
    |
    v
函数对象提供可替换策略
    |
    v
适配器重组已有接口
    |
    v
分配器负责底层存储获取与对象构造协作
```

算法不需要知道数据来自 `vector`、`list` 还是原生数组，只要传入的迭代器满足算法要求即可。

## 二、STL六大组件

经典 STL 通常总结为六大组件：

| 组件 | 作用 | 常见代表 |
| --- | --- | --- |
| 容器 | 保存和组织数据 | `vector`、`list`、`map` |
| 算法 | 对迭代器区间执行处理 | `sort`、`find`、`copy` |
| 迭代器 | 统一访问容器元素 | `begin()`、`end()` |
| 函数对象 | 向算法注入行为 | 比较器、谓词、Lambda |
| 适配器 | 转换现有组件的接口 | `stack`、`reverse_iterator` |
| 分配器 | 管理容器底层存储 | `std::allocator` |

这六部分不是彼此孤立的知识点。典型调用：

```cpp
std::sort(values.begin(),
          values.end(),
          std::greater<int>());
```

其中：

- `values` 是容器；
- `begin()` 和 `end()` 返回迭代器；
- `sort` 是算法；
- `greater<int>` 是函数对象；
- 容器内部使用分配器管理存储。

## 三、容器体系

### 3.1 序列容器

序列容器按照元素在线性序列中的位置组织数据。

| 容器 | 底层特征 | 随机访问 | 头部插入 | 尾部插入 | 中间插入 |
| --- | --- | --- | --- | --- | --- |
| `array` | 固定大小连续空间 | O(1) | 不支持扩容 | 不支持扩容 | 不支持扩容 |
| `vector` | 动态连续空间 | O(1) | O(N) | 均摊 O(1) | O(N) |
| `deque` | 分段连续结构 | O(1) | O(1) | O(1) | O(N) |
| `list` | 双向链表 | O(N) | O(1) | O(1) | 已知位置 O(1) |
| `forward_list` | 单向链表 | O(N) | O(1) | 无直接 `push_back` | 已知前驱 O(1) |

复杂度只是选择因素之一，还要考虑：

- 内存局部性；
- 额外指针开销；
- 迭代器失效；
- 是否需要稳定地址；
- 算法对迭代器类别的要求。

### 3.2 关联容器

有序关联容器通常使用平衡搜索树实现，但标准只规定行为和复杂度，不强制某一种具体树结构。

| 容器 | 是否重复 | 存储内容 | 查找复杂度 |
| --- | --- | --- | --- |
| `set` | 否 | 键 | O(log N) |
| `multiset` | 是 | 键 | O(log N) |
| `map` | 键不重复 | 键值对 | O(log N) |
| `multimap` | 键可重复 | 键值对 | O(log N) |

元素按比较器定义的顺序组织。

```cpp
std::map<std::string, int> scores;
scores["Alice"] = 95;
```

`map::operator[]` 在键不存在时会插入一个默认构造的映射值。如果只想查询而不插入，应使用 `find` 或 `at`。

### 3.3 无序关联容器

C++11 提供：

- `unordered_set`；
- `unordered_multiset`；
- `unordered_map`；
- `unordered_multimap`。

它们基于哈希组织元素，平均查找、插入和删除复杂度为 O(1)，最坏情况可以退化到 O(N)。

使用自定义键时，需要正确提供：

- 相等判断；
- 哈希函数；
- 相等对象必须产生相同哈希值。

### 3.4 容器适配器

容器适配器不是完整开放底层容器接口，而是基于已有容器提供受限的数据结构语义：

| 适配器 | 语义 | 默认底层容器 |
| --- | --- | --- |
| `stack` | 后进先出 | `deque` |
| `queue` | 先进先出 | `deque` |
| `priority_queue` | 堆式优先队列 | `vector` |

```cpp
std::stack<int, std::vector<int>> stack;
```

只要自定义底层容器提供适配器所需接口，就可以替换默认类型。

## 四、如何选择容器

### 4.1 默认优先考虑 `vector`

`vector` 具有：

- 连续存储；
- 优秀的缓存局部性；
- O(1) 随机访问；
- 与大量标准算法兼容；
- 较低的单元素内存开销。

即使中间插入是 O(N)，实际性能也可能优于链表，因为连续复制常常比大量节点分配和指针跳转更高效。

### 4.2 什么时候考虑 `deque`

- 需要频繁在头尾插入和删除；
- 仍需要随机访问；
- 不要求整个数据区域连续。

### 4.3 什么时候考虑 `list`

- 已经持有迭代器，并需要 O(1) 节点插入或删除；
- 需要 `splice` 在链表间移动节点；
- 需要元素地址和迭代器在其他节点插入时保持稳定。

不要仅因为“中间插入 O(1)”就默认使用链表。寻找插入位置本身通常仍是 O(N)。

### 4.4 `map` 与 `unordered_map`

选择 `map`：

- 需要键有序；
- 需要范围查询；
- 需要稳定的 O(log N) 上界；
- 需要 `lower_bound`、`upper_bound`。

选择 `unordered_map`：

- 只做精确键查询；
- 有质量可靠的哈希函数；
- 可以接受桶结构和扩容；
- 更关注平均 O(1) 性能。

## 五、算法与迭代器区间

标准算法通常处理半开区间：

```text
[first, last)
```

含义是：

- 包含 `first` 指向的元素；
- 不包含 `last`；
- 空区间可以表示为 `first == last`；
- `end()` 指向尾元素的下一个位置，不能解引用。

```cpp
std::find(values.begin(), values.end(), target);
```

半开区间便于表示长度、拼接相邻区间和空范围。

## 六、算法分类

STL 算法可以按功能分为：

- 非修改序列算法：`find`、`count`、`equal`；
- 修改序列算法：`copy`、`transform`、`remove_if`；
- 排序与相关操作：`sort`、`partial_sort`、`nth_element`；
- 二分查找：`lower_bound`、`upper_bound`、`binary_search`；
- 集合算法：`set_union`、`set_intersection`；
- 堆算法：`make_heap`、`push_heap`、`pop_heap`；
- 最值算法：`min`、`max`、`min_element`；
- 排列算法：`next_permutation`、`prev_permutation`；
- 数值算法：`accumulate`、`inner_product`。

算法的头文件主要是：

```cpp
#include <algorithm>
#include <numeric>
```

## 七、`accumulate`

`std::accumulate` 定义在 `<numeric>` 中，对区间执行从左到右的折叠。

```cpp
template <class InputIt, class T>
T accumulate(InputIt first, InputIt last, T init);
```

### 7.1 基本累加

```cpp
std::vector<int> values{10, 20, 30};

int sum = std::accumulate(
    values.begin(),
    values.end(),
    0);
```

结果为 `60`。

### 7.2 初始值决定累加类型

```cpp
std::vector<double> values{1.5, 2.5, 3.5};

double correct = std::accumulate(
    values.begin(), values.end(), 0.0);

double wrong = std::accumulate(
    values.begin(), values.end(), 0);
```

第二次累加的内部结果类型是 `int`，每一步都可能截断小数，最后再转换为 `double`。因此初始值类型非常重要。

### 7.3 自定义二元操作

```cpp
int weighted = std::accumulate(
    values.begin(),
    values.end(),
    0,
    [](int result, int value)
    {
        return result + 2 * value;
    });
```

二元操作接收当前累积值和下一个元素，必须返回新的累积值。

## 八、`count` 与 `count_if`

```cpp
std::vector<int> values{1, 2, 3, 2, 4, 2};

auto twos = std::count(
    values.begin(), values.end(), 2);

auto even_count = std::count_if(
    values.begin(),
    values.end(),
    [](int value)
    {
        return value % 2 == 0;
    });
```

- `count` 统计等于指定值的元素；
- `count_if` 统计谓词返回 `true` 的元素；
- 两者都需要线性扫描，复杂度为 O(N)。

谓词名称与实现必须一致。函数名写 `is_odd` 却用于注释“统计偶数”，会给阅读者造成错误理解。

## 九、`find` 与 `find_if`

```cpp
auto position = std::find(
    values.begin(), values.end(), target);

if (position != values.end())
{
    std::cout << *position << '\n';
}
```

找不到时返回 `last`，绝不能直接解引用而不检查。

```cpp
auto position = std::find_if(
    values.begin(),
    values.end(),
    [](int value)
    {
        return value > 100;
    });
```

### 9.1 关联容器优先使用成员 `find`

```cpp
std::set<int> values;

values.find(target);  // O(log N)
std::find(values.begin(), values.end(), target); // O(N)
```

通用 `std::find` 只会沿迭代器线性遍历，不会自动利用树或哈希结构。

`unordered_set::find` 平均为 O(1)。

## 十、`min`、`max` 与范围最值

```cpp
int larger = std::max(left, right);
int smaller = std::min(left, right);
```

对整个区间查找最值：

```cpp
auto minimum = std::min_element(
    values.begin(), values.end());

auto maximum = std::max_element(
    values.begin(), values.end());
```

使用前必须检查区间是否为空：

```cpp
if (minimum != values.end())
{
    std::cout << *minimum << '\n';
}
```

### 10.1 返回引用的生命周期

`std::min` 和 `std::max` 的常见两参数重载返回 `const T&`。不要把对临时实参的返回引用保存到完整表达式之后：

```cpp
const int& result = std::max(10, 20); // 悬空引用
```

按值接收即可：

```cpp
int result = std::max(10, 20);
```

## 十一、`merge`

`std::merge` 把两个已经有序的输入区间合并到输出区间。

```cpp
std::vector<int> first{1, 3, 5};
std::list<int> second{2, 4, 6};
std::vector<int> result(
    first.size() + second.size());

std::merge(first.begin(), first.end(),
           second.begin(), second.end(),
           result.begin());
```

必须满足：

1. 两个输入区间按照同一比较规则有序；
2. 输出位置有足够容量，或使用插入迭代器；
3. 输出范围不能以不受支持的方式覆盖输入范围。

使用插入迭代器：

```cpp
std::vector<int> result;
result.reserve(first.size() + second.size());

std::merge(first.begin(), first.end(),
           second.begin(), second.end(),
           std::back_inserter(result));
```

复杂度为 O(M + N)。

## 十二、`partial_sort` 与TOP-K

```cpp
std::vector<int> values{4, 1, 8, 0, 5, 9, 3, 7, 2, 6};

std::partial_sort(
    values.begin(),
    values.begin() + 4,
    values.end());
```

执行后：

- `[begin, begin + 4)` 是最小的四个元素；
- 这四个元素已经按升序排列；
- 后半区间的顺序没有保证。

找最大的四个元素：

```cpp
std::partial_sort(
    values.begin(),
    values.begin() + 4,
    values.end(),
    std::greater<int>());
```

典型复杂度约为 O(N log K)，适合 K 明显小于 N 的场景。

### 12.1 只需要第K位置时

如果只想找到排序后第 K 个元素，并让两侧完成划分，而不要求前 K 个有序，可以使用 `std::nth_element`，平均复杂度通常为 O(N)。

## 十三、`partition`

`std::partition` 按谓词把元素划分成两组：

```cpp
auto boundary = std::partition(
    values.begin(),
    values.end(),
    [](int value)
    {
        return value % 2 != 0;
    });
```

结果满足：

- `[begin, boundary)` 中谓词为 `true`；
- `[boundary, end)` 中谓词为 `false`；
- 每组内部相对顺序不保证。

如果必须保持原相对顺序，使用 `std::stable_partition`，但它可能需要额外内存或更多移动操作。

## 十四、`reverse`

```cpp
std::reverse(values.begin(), values.end());
```

`reverse` 原地逆置区间，需要双向迭代器，复杂度为 O(N)。

如果只想反向遍历，不需要修改容器：

```cpp
for (auto iterator = values.rbegin();
     iterator != values.rend();
     ++iterator)
{
    std::cout << *iterator << ' ';
}
```

## 十五、`sort`

### 15.1 基本用法

```cpp
std::sort(values.begin(), values.end());

std::sort(values.begin(),
          values.end(),
          std::greater<int>());
```

`sort` 要求随机访问迭代器，因此可以用于 `vector`、`deque` 和原生数组，不能直接用于 `list`。

```cpp
std::list<int> values;
values.sort();
```

链表提供成员 `sort`，可以通过重连节点完成排序。

### 15.2 实现原理

主流标准库通常使用 introsort 思路：

- 常规阶段使用快速排序式分区；
- 递归深度过大时切换到堆排序，保证最坏复杂度；
- 小区间使用插入排序等策略降低常数。

但标准规定的是可观察行为和复杂度，不强制：

- 必须使用某种具体算法；
- 小区间阈值一定是 16；
- 一定采用某种取枢轴方式；
- 内部函数名或实现结构固定。

C++11 起，比较次数要求保证 O(N log N) 量级的最坏复杂度。

### 15.3 `sort` 不稳定

相等元素的原始相对顺序可能改变。

需要稳定排序时使用：

```cpp
std::stable_sort(
    records.begin(),
    records.end(),
    compare);
```

### 15.4 比较器必须满足严格弱序

正确：

```cpp
[](const Item& left, const Item& right)
{
    return left.score < right.score;
}
```

错误：

```cpp
[](const Item& left, const Item& right)
{
    return left.score <= right.score;
}
```

对同一个对象，`comp(x, x)` 必须为 `false`。使用 `<=` 会破坏严格弱序要求，算法行为不再可靠。

## 十六、`unique` 与去重

`std::unique` 只把相邻的等价元素压缩到区间前部，并返回新的逻辑结尾。

```cpp
std::vector<int> values{1, 1, 2, 2, 3, 3};

auto new_end = std::unique(
    values.begin(), values.end());
```

此时：

- `[begin, new_end)` 包含 `1, 2, 3`；
- 容器 `size()` 尚未改变；
- `[new_end, end)` 中的元素仍存在，但值不应被依赖。

真正缩短 `vector`：

```cpp
values.erase(new_end, values.end());
```

### 16.1 `unique` 不要求区间有序

它只处理相邻重复：

```cpp
std::vector<int> values{1, 2, 1};
```

没有相邻重复，因此调用 `unique` 后逻辑长度不变。

如果目标是删除整个序列中的所有重复值，可以先排序：

```cpp
std::sort(values.begin(), values.end());
values.erase(
    std::unique(values.begin(), values.end()),
    values.end());
```

这种方法会改变原顺序。如果必须保留首次出现顺序，可使用哈希集合辅助过滤。

## 十七、erase-remove惯用法

`std::remove` 和 `std::remove_if` 与 `unique` 类似，不会真正调用容器的 `erase`。

```cpp
values.erase(
    std::remove_if(
        values.begin(),
        values.end(),
        [](int value)
        {
            return value < 0;
        }),
    values.end());
```

过程是：

1. 算法把保留元素移动到前部；
2. 返回新的逻辑结尾；
3. 容器成员 `erase` 真正删除尾部无效范围。

对于 `list`，可以直接使用成员 `remove` 或 `remove_if`，它们真正删除节点。

## 十八、排列算法

### 18.1 `next_permutation`

```cpp
std::vector<int> values{1, 2, 3};

do
{
    print(values);
}
while (std::next_permutation(
    values.begin(), values.end()));
```

它把当前序列变成字典序中的下一个排列：

- 存在下一个排列时返回 `true`；
- 当前已经是最大排列时，重排为最小排列并返回 `false`。

### 18.2 是否必须先排序

调用 `next_permutation` 本身不要求输入已经排序，它可以从任意当前排列寻找下一个排列。

但如果想从头枚举全部字典序排列，必须先升序排序：

```cpp
std::sort(values.begin(), values.end());
```

`prev_permutation` 同理。若要从最大排列向前枚举全部排列，应先降序排序。

### 18.3 含重复元素

```cpp
std::vector<int> values{1, 1, 2};
```

从排序状态开始调用，会生成不同的字典序排列：

```text
1 1 2
1 2 1
2 1 1
```

不会把相同值的交换当成新的可观察排列。

## 十九、迭代器的本质

迭代器是对“如何访问序列元素”的抽象。它提供类似指针的操作协议，但不一定就是裸指针。

```cpp
auto iterator = container.begin();

std::cout << *iterator;
++iterator;
```

可能的实现包括：

- 裸指针；
- 包装节点指针的类；
- 调试模式下带容器归属检查的对象；
- 代理迭代器；
- 流迭代器或插入迭代器。

因此，“迭代器本质上就是指针”过于绝对。更准确的说法是：迭代器以统一语法模拟某种位置和遍历能力。

## 二十、为什么需要迭代器

`std::find` 的核心逻辑可以写成：

```cpp
template <class InputIterator, class T>
InputIterator find_value(
    InputIterator first,
    InputIterator last,
    const T& value)
{
    while (first != last)
    {
        if (*first == value)
        {
            break;
        }

        ++first;
    }

    return first;
}
```

算法只依赖：

- 能判断是否到达结尾；
- 能读取当前元素；
- 能移动到下一个元素。

它不关心底层是连续数组、链表节点还是树的中序遍历。容器设计者负责提供满足约定的迭代器，算法设计者只面向迭代器能力编程。

## 二十一、迭代器类别

经典迭代器按照能力逐级增强：

| 类别 | 核心能力 | 典型来源 |
| --- | --- | --- |
| 输入迭代器 | 单向读取 | 输入流迭代器 |
| 输出迭代器 | 单向写入 | 插入迭代器 |
| 前向迭代器 | 可多遍单向访问 | `forward_list` |
| 双向迭代器 | 支持 `++` 和 `--` | `list`、`set`、`map` |
| 随机访问迭代器 | 支持跳跃、差值和下标式能力 | `vector`、`deque` |

能力关系可以理解为：

```text
随机访问
   |
双向
   |
前向
   |
输入
```

输出迭代器是面向写入的另一条能力分支。

C++20 进一步引入连续迭代器概念；本文主体以 C++11 的经典类别为准。

### 21.1 算法对类别的要求

- `find` 只要求输入迭代器；
- `reverse` 要求双向迭代器；
- `sort` 要求随机访问迭代器；
- `partition` 在 C++11 接口中面向前向迭代器；
- `lower_bound` 可接受前向迭代器，但在非随机访问迭代器上移动成本可能较高。

容器提供的迭代器能力不足时，算法无法编译，这是一种编译期接口约束。

## 二十二、自定义迭代器需要提供什么

一个只支持前向遍历的迭代器通常需要：

- `operator*`：返回当前元素引用；
- `operator->`：返回指向当前元素的指针或代理；
- 前置和后置 `operator++`；
- `operator==` 与 `operator!=`；
- 适当的迭代器类型信息。

注意返回类型：

```cpp
reference operator*() const;
pointer operator->() const;
```

不是把两者写反。

双向迭代器还需要 `operator--`，随机访问迭代器还需要加减、距离、关系比较和索引等操作。

## 二十三、`begin`、`end` 与const迭代器

```cpp
std::vector<int> values{1, 2, 3};

std::vector<int>::iterator first = values.begin();
std::vector<int>::iterator last = values.end();
```

只读访问：

```cpp
std::vector<int>::const_iterator iterator = values.cbegin();
```

区分两个概念：

```cpp
const_iterator        // 不能通过迭代器修改元素
const iterator object // 迭代器变量自身不能移动
```

它们类似于 `const T*` 与 `T* const` 的区别。

## 二十四、反向迭代器

反向迭代器是正向迭代器的适配器：

- 反向迭代器 `++` 向容器前部移动；
- 反向迭代器 `--` 向容器尾部移动。

```cpp
for (auto iterator = values.rbegin();
     iterator != values.rend();
     ++iterator)
{
    std::cout << *iterator << ' ';
}
```

### 24.1 `base()` 的位置关系

如果反向迭代器 `reverse` 指向某个元素，那么 `reverse.base()` 返回的正向迭代器通常指向该元素的下一个位置。

```text
正向:  [A] [B] [C] [D] end
                   ^
                reverse
                       ^
                  reverse.base()
```

这是为了让 `[rbegin, rend)` 与正向半开区间规则保持一致。

## 二十五、迭代器失效

容器修改后，已有迭代器、指针和引用是否继续有效，取决于容器与操作。

### 25.1 `vector`

- 扩容会使所有指向原存储的迭代器、指针和引用失效；
- 未扩容的尾部插入通常保留插入点之前的迭代器，但 `end()` 会变化；
- 中间插入和删除会使操作位置及其后的迭代器失效。

### 25.2 `list`

插入通常不会使其他节点迭代器失效；删除只使被删除节点的迭代器失效。

### 25.3 `map` 与 `set`

插入通常不会使已有迭代器失效；删除只使被删元素迭代器失效。

### 25.4 `unordered` 容器

重哈希会使迭代器失效，但对元素的引用和指针通常仍保持有效；删除仍会使被删元素的引用、指针和迭代器失效。

使用前应查看具体容器和具体操作的标准说明，不能把一种容器的规则套到所有容器上。

### 25.5 删除循环的安全写法

```cpp
for (auto iterator = values.begin();
     iterator != values.end();)
{
    if (should_remove(*iterator))
    {
        iterator = values.erase(iterator);
    }
    else
    {
        ++iterator;
    }
}
```

使用 `erase` 返回的下一个有效位置继续遍历。

## 二十六、适配器

适配器把已有组件接口转换成另一种接口，不一定创建新的底层能力。

### 26.1 容器适配器

- `stack`；
- `queue`；
- `priority_queue`。

### 26.2 迭代器适配器

- `reverse_iterator`；
- `back_insert_iterator`；
- `front_insert_iterator`；
- `insert_iterator`；
- `istream_iterator`；
- `ostream_iterator`；
- C++11 的 `move_iterator`。

```cpp
std::copy(source.begin(),
          source.end(),
          std::back_inserter(destination));
```

`back_inserter` 把算法的赋值操作适配成容器的 `push_back`，因此无需提前调整目标 `size()`。

### 26.3 函数适配工具

C++11 常见工具包括：

- `std::bind`；
- `std::function`；
- `std::mem_fn`；
- `std::ref`、`std::cref`。

简单行为优先使用 Lambda，通常更直观，也更容易被编译器优化。

## 二十七、函数对象

重载了 `operator()` 的对象可以像函数一样调用：

```cpp
class IsMultipleOf
{
public:
    explicit IsMultipleOf(int divisor)
        : divisor_(divisor)
    {
    }

    bool operator()(int value) const
    {
        return value % divisor_ == 0;
    }

private:
    int divisor_;
};
```

调用：

```cpp
auto count = std::count_if(
    values.begin(),
    values.end(),
    IsMultipleOf(3));
```

函数对象相比普通函数可以携带状态，例如除数 `3`。

### 27.1 Lambda与函数对象

```cpp
int divisor = 3;

auto count = std::count_if(
    values.begin(),
    values.end(),
    [divisor](int value)
    {
        return value % divisor == 0;
    });
```

编译器会为 Lambda 生成闭包类型，捕获的数据成为闭包对象状态。从使用模型上看，Lambda 可以理解为编译器生成的函数对象，但其具体生成细节由实现负责。

### 27.2 谓词

返回可用于条件判断结果的可调用对象称为谓词。

- 一元谓词：接收一个元素，例如 `count_if`；
- 二元谓词：接收两个元素，例如 `sort` 比较器。

排序比较器必须满足严格弱序，不能使用不一致或随调用变化的比较规则。

## 二十八、空间配置器

标准容器通常有分配器模板参数：

```cpp
template <class T,
          class Allocator = std::allocator<T>>
class vector;
```

分配器负责容器底层存储相关协作。概念上要区分：

```text
分配原始存储
    !=
在存储上构造对象
    !=
销毁对象
    !=
归还原始存储
```

容器扩容的大致过程是：

1. 分配更大的未初始化存储；
2. 在新存储上移动或复制构造元素；
3. 销毁旧元素；
4. 释放旧存储。

### 28.1 为什么需要分配器

- 支持自定义内存池；
- 指定特殊地址空间；
- 收集分配统计；
- 满足共享内存或硬件内存需求；
- 将容器逻辑与存储策略解耦。

### 28.2 不要把某个旧实现当成标准要求

旧版 SGI STL 常讲一级、二级空间配置器和小块内存自由链表。这是非常有价值的实现思想，但不是 C++ 标准要求所有 `std::allocator` 或标准库都采用相同结构。

学习时应区分：

- 标准规定的接口、语义和复杂度；
- 某个标准库版本的具体实现；
- 教学模拟实现。

### 28.3 自定义分配器的难点

完整分配器需要满足 allocator-aware container 协议，还涉及：

- `rebind` 和类型适配；
- 复制、移动、交换时的传播规则；
- 分配器相等性；
- 对齐；
- 异常安全；
- 对象构造和销毁。

除非有明确性能测量和工程需求，不应仅为“减少一次 `new`”就随意替换标准分配器。

## 二十九、STL整体协作示例

下面的程序综合演示：

- `vector` 容器；
- Lambda 函数对象；
- `sort`；
- `count_if`；
- `accumulate`；
- `partial_sort`；
- `sort + unique + erase`；
- `partition`；
- `next_permutation`；
- `stack` 容器适配器。

```cpp
#include <algorithm>
#include <functional>
#include <iostream>
#include <iterator>
#include <numeric>
#include <stack>
#include <string>
#include <vector>

struct Task
{
    int id;
    std::string name;
    int priority;
};

int main()
{
    std::vector<Task> tasks{
        {1, "compile", 3},
        {2, "test", 5},
        {3, "deploy", 4},
        {4, "document", 2}
    };

    std::sort(
        tasks.begin(),
        tasks.end(),
        [](const Task& left, const Task& right)
        {
            return left.priority > right.priority;
        });

    std::cout << "sorted tasks:";
    for (const Task& task : tasks)
    {
        std::cout << ' ' << task.name;
    }
    std::cout << '\n';

    const auto high_priority_count =
        std::count_if(
            tasks.begin(),
            tasks.end(),
            [](const Task& task)
            {
                return task.priority >= 4;
            });

    const int priority_sum =
        std::accumulate(
            tasks.begin(),
            tasks.end(),
            0,
            [](int result, const Task& task)
            {
                return result + task.priority;
            });

    std::cout << "high priority: "
              << high_priority_count
              << '\n';
    std::cout << "priority sum: "
              << priority_sum
              << '\n';

    std::vector<int> scores{
        70, 95, 82, 91, 60, 88
    };

    std::partial_sort(
        scores.begin(),
        scores.begin() + 3,
        scores.end(),
        std::greater<int>());

    std::cout << "top 3:";
    for (auto iterator = scores.begin();
         iterator != scores.begin() + 3;
         ++iterator)
    {
        std::cout << ' ' << *iterator;
    }
    std::cout << '\n';

    std::vector<int> ids{3, 1, 2, 3, 2, 1};
    std::sort(ids.begin(), ids.end());
    ids.erase(
        std::unique(ids.begin(), ids.end()),
        ids.end());

    std::cout << "unique ids:";
    for (int id : ids)
    {
        std::cout << ' ' << id;
    }
    std::cout << '\n';

    const auto odd_end =
        std::partition(
            ids.begin(),
            ids.end(),
            [](int value)
            {
                return value % 2 != 0;
            });

    std::cout << "odd count: "
              << std::distance(ids.begin(), odd_end)
              << '\n';

    std::vector<int> permutation{1, 2, 3};
    std::next_permutation(
        permutation.begin(),
        permutation.end());

    std::cout << "next permutation:";
    for (int value : permutation)
    {
        std::cout << ' ' << value;
    }
    std::cout << '\n';

    std::stack<std::string> history;
    history.push("open");
    history.push("edit");
    history.push("save");

    std::cout << "latest action: "
              << history.top()
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
sorted tasks: test deploy compile document
high priority: 2
priority sum: 14
top 3: 95 91 88
unique ids: 1 2 3
odd count: 2
next permutation: 1 3 2
latest action: save
```

## 三十、常见错误

### 30.1 把迭代器等同于裸指针

问题：链表、树、流和调试迭代器都可能是类或代理对象。

修正：面向迭代器支持的操作和类别编程，不依赖其内部表示。

### 30.2 解引用 `end()`

问题：`end()` 是尾后位置，不代表最后一个元素。

修正：只有 `iterator != end()` 时才能解引用。

### 30.3 忽略算法前置条件

例如：

- `merge` 要求输入有序；
- 二分查找要求区间按相同比较规则有序；
- `sort` 要求随机访问迭代器；
- 堆操作要求目标范围满足相应堆前提。

违反前置条件时，结果可能错误或行为未定义。

### 30.4 给 `sort` 传 `<=`

问题：不满足严格弱序。

修正：升序使用 `<`，降序使用 `>`，并保持比较器一致。

### 30.5 认为 `unique` 会删除元素

问题：算法只返回新的逻辑结尾，容器大小不变。

修正：配合容器 `erase`。

### 30.6 认为 `unique` 必须先排序

它本身只要求能够比较相邻元素，不要求排序。排序是为了让所有相同值相邻，从而实现全局去重。

### 30.7 认为 `next_permutation` 输入必须有序

算法可以处理任意当前排列。只有从头枚举全部排列时，才需要先排序到最小排列。

### 30.8 输出迭代器没有空间

```cpp
std::vector<int> result;
std::copy(source.begin(), source.end(), result.begin());
```

问题：`result.begin() == result.end()`，没有可写元素。

修正：先 `resize`，或使用 `back_inserter`。

### 30.9 容器修改后继续使用失效迭代器

问题：扩容、插入或删除可能使原位置失效。

修正：熟悉具体容器规则，并使用修改操作返回的新迭代器。

### 30.10 对关联容器使用通用 `find`

问题：退化成线性遍历。

修正：优先使用容器成员 `find`。

### 30.11 `accumulate` 初始值类型错误

问题：累加过程按初始值类型进行，可能逐步截断。

修正：使用 `0.0`、`0LL` 或明确目标类型初始值。

### 30.12 认为 `vector` 中间插入一定比 `list` 慢

复杂度不是实际性能的唯一因素。链表需要查找位置、节点分配和指针跳转，`vector` 的连续内存复制可能更快。

### 30.13 把某个STL实现细节当成标准

问题：库版本更换后，阈值、树结构、分配策略和内部函数都可能变化。

修正：回答时区分标准保证、常见实现和教学代码。

## 三十一、面试常见问题

### 31.1 STL六大组件是什么

容器、算法、迭代器、函数对象、适配器和分配器。

### 31.2 STL为什么能实现算法与容器解耦

容器通过迭代器暴露统一的访问协议，算法只依赖迭代器类别和元素操作，不依赖具体底层结构。

### 31.3 `vector` 与 `list` 的主要区别

`vector` 连续存储、支持 O(1) 随机访问、局部性好，但扩容和中间移动可能使迭代器失效；`list` 节点分散、不支持随机访问，已知位置插删 O(1)，其他节点迭代器通常稳定，但内存开销和缓存性能较差。

### 31.4 `map` 与 `unordered_map` 的区别

`map` 有序，查找 O(log N)，支持范围查询；`unordered_map` 基于哈希，平均查找 O(1)，不维护键顺序，最坏可退化到 O(N)。

### 31.5 为什么 `list` 不能使用 `std::sort`

`std::sort` 需要随机访问迭代器，而 `list` 只提供双向迭代器。`list` 使用自己的成员 `sort`。

### 31.6 什么是半开区间

`[first, last)` 包含首位置但不包含尾位置。`last` 可表示尾后和空区间，便于算法组合。

### 31.7 迭代器有哪些类别

输入、输出、前向、双向和随机访问迭代器；C++20 还有连续迭代器概念。

### 31.8 `sort` 通常如何实现

主流库常使用 introsort，把快速排序式分区、堆排序和小区间插入排序结合起来。但具体策略属于实现细节，标准主要规定结果和复杂度。

### 31.9 `sort` 和 `stable_sort` 的区别

`sort` 不保证相等元素相对顺序；`stable_sort` 保证稳定性，可能使用额外内存或承担不同常数开销。

### 31.10 `partial_sort` 和 `nth_element` 的区别

`partial_sort` 让前 K 个元素有序；`nth_element` 只保证第 K 位置是完全排序后的对应元素，并完成两侧划分，前半不保证有序。

### 31.11 `unique` 为什么要配合 `erase`

算法只移动覆盖元素并返回逻辑结尾，不改变容器结构；`erase` 才真正缩短容器。

### 31.12 什么是迭代器失效

容器修改后，原迭代器不再指向合法预期位置。继续使用失效迭代器通常属于未定义行为。

### 31.13 仿函数有什么优势

它具有函数调用语法，同时能够保存状态、参与模板内联和作为算法策略类型。

### 31.14 Lambda与仿函数是什么关系

Lambda 表达式产生一个闭包对象，其类型由编译器生成，并提供函数调用行为。使用模型上可以把它理解为匿名函数对象。

### 31.15 分配器负责什么

它为 allocator-aware 容器提供存储分配与相关构造协作，使容器的数据结构逻辑和底层存储策略解耦。

### 31.16 为什么默认优先 `vector`

它连续存储、局部性好、随机访问快、元素开销低，并能配合大多数标准算法。除非需求明确匹配其他容器，否则通常是良好起点。

## 三十二、复习路线

### 第一阶段：接口与基本使用

1. 熟练使用 `vector`、`string`、`map`、`unordered_map`；
2. 掌握插入、删除、查找和遍历；
3. 能查看标准库文档；
4. 熟悉常用算法和 Lambda。

### 第二阶段：底层结构与复杂度

1. 动态数组扩容；
2. 链表节点结构；
3. 红黑树的平衡目标；
4. 哈希桶、负载因子和重哈希；
5. 各接口时间复杂度。

### 第三阶段：迭代器与泛型设计

1. 半开区间；
2. 迭代器类别；
3. 自定义迭代器基本接口；
4. 迭代器失效；
5. 算法对迭代器能力的要求。

### 第四阶段：工程使用

1. 根据数据访问模式选择容器；
2. 正确编写比较器和哈希器；
3. 使用 erase-remove；
4. 分析内存分配与缓存局部性；
5. 结合性能测试验证选择。

### 第五阶段：模拟实现与源码阅读

1. 实现简化版 `vector`；
2. 实现链表及其迭代器；
3. 实现堆、哈希桶、AVL 树或红黑树；
4. 阅读一个确定版本的标准库实现；
5. 始终区分源码实现与标准契约。

## 三十三、总结

STL 的知识体系可以浓缩为四条主线：

1. 容器决定数据如何组织以及修改操作的成本；
2. 迭代器把不同底层结构统一为算法能够理解的访问协议；
3. 算法在半开区间上工作，并依赖明确的迭代器能力和前置条件；
4. 函数对象、适配器和分配器进一步提供行为、接口与存储策略的可组合性。

真正熟练使用 STL，需要同时回答：

- 这个容器为什么适合当前数据访问模式？
- 这个操作的时间和空间复杂度是什么？
- 算法要求什么迭代器类别和前置条件？
- 修改容器后哪些迭代器会失效？
- 比较器是否满足严格弱序？
- 当前结论是标准保证，还是某个实现细节？

最后记住 STL 的核心思想：

```text
容器负责存储，迭代器负责连接，
算法负责处理，策略负责变化。
```
