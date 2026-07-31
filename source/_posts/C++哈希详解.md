---
title: C++ 哈希详解：unordered_map、哈希表、位图与布隆过滤器
date: 2026-07-30 10:00:00
categories:
  - C++
tags:
  - C++
  - STL
  - 哈希表
  - unordered_map
  - unordered_set
  - 位图
  - 布隆过滤器
---

## 前言

在前面的关联式容器中，`map` 和 `set` 通常借助红黑树组织数据，查找、插入和删除的时间复杂度为 `O(log n)`，并且能够保持关键字有序。

C++11 又引入了一组无序关联式容器：

- `std::unordered_map`；
- `std::unordered_set`；
- `std::unordered_multimap`；
- `std::unordered_multiset`。

它们通常使用哈希表实现。在哈希函数分布合理、负载因子受控的情况下，查找、插入和删除的平均时间复杂度可以达到 `O(1)`。

本文将从容器使用一直深入到哈希表底层，并进一步介绍哈希结构在海量数据处理中的典型应用：

1. `unordered_map` 与 `unordered_set` 的接口；
2. 哈希函数、哈希冲突与负载因子；
3. 闭散列与开放定址；
4. 开散列与链地址法；
5. 扩容和重新哈希；
6. 自定义类型的哈希；
7. 位图与布隆过滤器；
8. 海量数据面试题；
9. 一致性哈希与密码学哈希的概念区别。

<!-- more -->

## 一、从有序关联式容器到无序关联式容器

### 1.1 两类关联式容器

STL 中的关联式容器可以分为两组。

有序关联式容器：

- `map`；
- `set`；
- `multimap`；
- `multiset`。

无序关联式容器：

- `unordered_map`；
- `unordered_set`；
- `unordered_multimap`；
- `unordered_multiset`。

两类容器都根据关键字管理元素，但组织方式不同。

| 对比项 | `map` / `set` | `unordered_map` / `unordered_set` |
| --- | --- | --- |
| 常见底层结构 | 红黑树 | 哈希表 |
| 元素顺序 | 按关键字有序 | 没有规定的排序顺序 |
| 平均查找复杂度 | `O(log n)` | `O(1)` |
| 最坏查找复杂度 | `O(log n)` | `O(n)` |
| 范围查询 | 擅长 | 不擅长 |
| 自定义规则 | 比较器 | 哈希函数和相等判断 |
| 典型用途 | 有序遍历、区间查询 | 快速精确查找、去重、计数 |

### 1.2 为什么哈希表平均可以达到 O(1)

树形容器查找元素时，需要沿着树高逐层比较。

哈希表则尝试通过一个函数，直接把关键字映射到某个桶：

```text
关键字 key
    │
    ▼
hash(key)
    │
    ▼
桶下标 = hash(key) % bucket_count
```

只要哈希分布比较均匀，一个桶中的元素数量通常很少，查找便不需要遍历全部数据。

但 `O(1)` 是平均复杂度，不是无条件保证。如果大量关键字落入同一个桶，查找仍可能退化为 `O(n)`。

### 1.3 如何选择容器

适合选择 `map` 或 `set` 的场景：

- 需要按照关键字有序遍历；
- 需要 `lower_bound`、`upper_bound` 等范围操作；
- 希望最坏情况下仍保持 `O(log n)`；
- 已经有自然、稳定的比较规则。

适合选择 `unordered_map` 或 `unordered_set` 的场景：

- 主要进行精确查找；
- 不关心遍历顺序；
- 希望获得较好的平均性能；
- 能够为关键字提供质量良好的哈希函数。

## 二、unordered_map

### 2.1 基本特点

`unordered_map` 保存唯一的键值对：

```cpp
#include <string>
#include <unordered_map>

std::unordered_map<std::string, int> scores;
```

其中：

- `std::string` 是键 `key_type`；
- `int` 是映射值 `mapped_type`；
- 元素类型是 `std::pair<const std::string, int>`；
- 同一个键只能出现一次；
- 键不能通过迭代器修改，值可以修改。

### 2.2 构造与初始化

```cpp
#include <string>
#include <unordered_map>

int main()
{
    std::unordered_map<std::string, int> empty;

    std::unordered_map<std::string, int> scores{
        {"Alice", 90},
        {"Bob", 85},
        {"Cindy", 95}
    };

    std::unordered_map<std::string, int> copy(scores);
}
```

### 2.3 插入元素

可以使用 `insert`：

```cpp
std::unordered_map<std::string, int> scores;

auto result = scores.insert({"Alice", 90});

if (result.second)
{
    // 插入成功，result.first 指向新元素
}
else
{
    // 键已经存在，result.first 指向原元素
}
```

`insert` 不会覆盖已有键对应的值：

```cpp
scores.insert({"Alice", 90});
scores.insert({"Alice", 100});  // 插入失败，原值仍为 90
```

C++17 可以使用 `insert_or_assign` 明确表达“插入或覆盖”：

```cpp
scores.insert_or_assign("Alice", 100);
```

还可以使用 `try_emplace`，仅在键不存在时构造映射值：

```cpp
scores.try_emplace("David", 88);
```

### 2.4 operator[] 的行为

`operator[]` 可以根据键访问值：

```cpp
scores["Alice"] = 90;
std::cout << scores["Alice"] << '\n';
```

当键不存在时，`operator[]` 会：

1. 插入这个键；
2. 对映射值进行值初始化；
3. 返回新值的引用。

例如：

```cpp
std::unordered_map<std::string, int> counts;

std::cout << counts.size() << '\n';  // 0
std::cout << counts["apple"] << '\n'; // 插入 apple，值为 0
std::cout << counts.size() << '\n';  // 1
```

这使它非常适合词频统计：

```cpp
for (const auto& word : words)
{
    ++counts[word];
}
```

但不要使用 `operator[]` 仅仅判断键是否存在，因为它会修改容器。

### 2.5 at、find 与 contains

不希望插入新元素时，可以使用 `at`：

```cpp
try
{
    std::cout << scores.at("Alice") << '\n';
}
catch (const std::out_of_range&)
{
    // 键不存在
}
```

也可以使用 `find`：

```cpp
auto it = scores.find("Alice");

if (it != scores.end())
{
    std::cout << it->second << '\n';
}
```

C++20 可以使用 `contains`：

```cpp
if (scores.contains("Alice"))
{
    // 键存在
}
```

三者区别如下：

| 接口 | 键不存在时 | 是否插入 | 适用场景 |
| --- | --- | --- | --- |
| `operator[]` | 返回新插入值的引用 | 是 | 插入、更新、计数 |
| `at` | 抛出 `std::out_of_range` | 否 | 必须存在的键 |
| `find` | 返回 `end()` | 否 | C++11 通用查询 |
| `contains` | 返回 `false` | 否 | C++20 存在性判断 |

### 2.6 count

`unordered_map` 中键唯一，所以：

```cpp
std::size_t n = scores.count("Alice");
```

结果只能是 0 或 1。

在 `unordered_multimap` 中，同一个键可以出现多次，因此 `count` 可能大于 1。

### 2.7 删除元素

按照键删除：

```cpp
std::size_t removed = scores.erase("Alice");
```

返回实际删除的元素数量，对 `unordered_map` 来说是 0 或 1。

按照迭代器删除：

```cpp
auto it = scores.find("Bob");
if (it != scores.end())
{
    scores.erase(it);
}
```

清空容器：

```cpp
scores.clear();
```

### 2.8 遍历

```cpp
for (const auto& [name, score] : scores)
{
    std::cout << name << ": " << score << '\n';
}
```

无序容器的遍历顺序没有排序保证。以下操作都可能改变观察到的顺序：

- 插入或删除元素；
- 触发重新哈希；
- 更换编译器或标准库实现；
- 修改桶数量或最大负载因子。

业务逻辑不能依赖某次运行中碰巧出现的遍历顺序。

## 三、unordered_set

### 3.1 基本特点

`unordered_set` 只保存唯一关键字，没有单独的映射值：

```cpp
#include <unordered_set>

std::unordered_set<int> numbers{1, 3, 5, 7};
```

常见用途：

- 元素去重；
- 判断某个值是否出现；
- 求集合交集；
- 记录已经访问的节点；
- 滑动窗口中维护当前元素集合。

### 3.2 插入与查询

```cpp
std::unordered_set<int> values;

auto result = values.insert(10);
if (result.second)
{
    // 插入成功
}

if (values.find(10) != values.end())
{
    // 10 存在
}
```

### 3.3 两个数组的交集

```cpp
#include <unordered_set>
#include <vector>

std::vector<int> intersection(const std::vector<int>& a,
                              const std::vector<int>& b)
{
    std::unordered_set<int> seen(a.begin(), a.end());
    std::unordered_set<int> emitted;
    std::vector<int> result;

    for (int value : b)
    {
        if (seen.find(value) != seen.end() &&
            emitted.insert(value).second)
        {
            result.push_back(value);
        }
    }

    return result;
}
```

这里使用第二个集合 `emitted` 保证结果不重复。

### 3.4 map、set 与 multiset 版本对比

| 容器 | 保存内容 | 键能否重复 | 是否有 `operator[]` |
| --- | --- | --- | --- |
| `unordered_map` | 键值对 | 否 | 有 |
| `unordered_set` | 键 | 否 | 无 |
| `unordered_multimap` | 键值对 | 是 | 无 |
| `unordered_multiset` | 键 | 是 | 无 |

`unordered_multimap` 没有 `operator[]`，因为同一个键可能对应多个值，无法唯一确定应该返回哪一个。

## 四、桶接口与负载因子

### 4.1 什么是桶

哈希表通常把底层空间划分成多个桶。哈希值经过压缩后得到桶号：

```text
bucket_index = hash(key) % bucket_count
```

落入同一个桶的关键字发生了桶级冲突，需要由底层冲突解决策略继续处理。

### 4.2 常用桶接口

```cpp
std::unordered_map<std::string, int> table{
    {"apple", 1},
    {"banana", 2},
    {"orange", 3}
};

std::cout << table.bucket_count() << '\n';

for (std::size_t i = 0; i < table.bucket_count(); ++i)
{
    std::cout << "bucket " << i
              << ": " << table.bucket_size(i)
              << '\n';
}

std::cout << table.bucket("apple") << '\n';
```

常用接口：

| 接口 | 作用 |
| --- | --- |
| `bucket_count()` | 返回桶数量 |
| `bucket_size(i)` | 返回第 `i` 个桶中的元素数量 |
| `bucket(key)` | 返回指定键所在桶的编号 |
| `begin(i)` / `end(i)` | 遍历指定桶 |

桶接口主要用于观察分布、调试哈希质量，不应据此依赖标准库内部实现细节。

### 4.3 负载因子

负载因子定义为：

```text
load_factor = size / bucket_count
```

在标准库中：

```cpp
std::cout << table.load_factor() << '\n';
std::cout << table.max_load_factor() << '\n';
```

负载因子越大，平均每个桶中的元素越多，冲突概率通常也越高。

### 4.4 reserve 与 rehash

如果提前知道将插入大约多少元素，可以使用 `reserve`：

```cpp
std::unordered_map<int, int> table;
table.reserve(100000);
```

`reserve(n)` 的语义是为至少容纳 `n` 个元素准备合适的桶数量，同时考虑最大负载因子。

`rehash(n)` 则直接请求至少使用一定数量的桶：

```cpp
table.rehash(200000);
```

实际桶数可能大于请求值，因为具体实现会选择合适的桶数量。

提前 `reserve` 的好处：

- 减少多次扩容；
- 减少重复计算哈希和搬迁桶链接的成本；
- 降低迭代器因重新哈希而失效的机会。

## 五、哈希的基本概念

### 5.1 哈希函数

哈希函数把关键字映射成一个整数哈希值：

```text
hash_value = Hash(key)
```

再把哈希值压缩到桶范围：

```text
bucket_index = hash_value % bucket_count
```

一个好的通用哈希函数通常希望具备：

1. 相同关键字始终得到相同哈希值；
2. 不同输入尽可能均匀分布；
3. 计算成本足够低；
4. 能利用输入中各部分的信息；
5. 适合目标数据的真实分布。

### 5.2 哈希冲突

如果两个不同关键字得到相同桶号：

```text
key1 != key2
bucket(key1) == bucket(key2)
```

就发生了哈希冲突，也叫哈希碰撞。

例如，桶数为 10，使用：

```text
bucket(key) = key % 10
```

那么 4、14、24、44 都会落入 4 号桶。

### 5.3 冲突无法彻底避免

如果关键字可能取值的集合大于桶的数量，根据鸽巢原理，至少会有两个不同关键字映射到同一个桶。

因此：

- 好的哈希函数可以降低冲突概率；
- 合理扩容可以控制单桶压力；
- 冲突解决机制负责在冲突发生后保持正确性；
- 不存在一个通用哈希函数能够让所有可能输入都完全不冲突。

### 5.4 常见哈希方法

#### 直接定址法

直接用关键字或简单线性函数得到地址：

```text
Hash(key) = A × key + B
```

适用于关键字范围小、分布连续的场景。位图本质上就带有直接定址思想。

优点：

- 简单；
- 定位快；
- 在范围可控时没有普通意义上的哈希冲突。

缺点：

- 关键字范围很大但数据稀疏时，空间浪费严重。

#### 除留余数法

```text
Hash(key) = key % m
```

这是教学和哈希表实现中常见的方法。桶数 `m` 的选择会影响分布。传统实现常选择合适的质数；现代标准库也可能选择 2 的幂并配合更强的位混合方式。

关键不只是“模质数”，而是哈希函数和桶索引策略整体能否让真实输入均匀分布。

#### 平方取中法

对关键字平方，再截取中间若干位作为地址。它可以让关键字不同位置的位参与结果，但现代通用代码较少直接使用。

#### 折叠法

把长关键字分成几段，将各段相加或混合后得到地址。适合位数较长的数字关键字。

#### 数字分析法

事先分析关键字分布，选择变化较均匀的部分参与计算。例如手机号前几位可能高度集中，而后几位变化更丰富。

这种方法高度依赖数据分布。一旦数据来源改变，原先的规则可能迅速退化。

### 5.5 哈希函数与相等判断必须一致

无序容器不仅需要哈希函数，还需要键相等判断。

必须满足：

```text
如果 KeyEqual(a, b) 为 true，
那么 Hash(a) 必须等于 Hash(b)。
```

反过来不成立：哈希值相同的两个键不一定相等，因为哈希冲突是允许的。

如果相等规则忽略大小写，而哈希函数区分大小写，容器行为就会违反要求。

## 六、闭散列与开放定址

### 6.1 基本思想

闭散列通常指开放定址法。所有元素都存放在同一块数组中。

发生冲突时，不建立额外链表，而是按照探测序列继续寻找可用位置：

```text
初始位置冲突
     │
     ▼
检查下一个候选位置
     │
     ├── 空：插入
     ├── 相等：键已存在
     └── 仍被占用：继续探测
```

### 6.2 线性探测

线性探测序列为：

```text
index_i = (start + i) % capacity
i = 0, 1, 2, ...
```

假设容量是 10，4 号位置已经被占用，插入 44 时：

```text
44 % 10 = 4

检查 4 → 冲突
检查 5 → 冲突
检查 6 → 空，插入
```

优点：

- 实现简单；
- 数据存储连续，缓存局部性较好；
- 不需要为每个元素保存链表指针。

缺点：

- 容易产生主聚集；
- 一段连续区域越拥挤，后续冲突越严重；
- 负载因子接近 1 时性能急剧下降。

### 6.3 为什么不能直接删除

假设探测链如下：

```text
位置 4：4
位置 5：44
位置 6：84
```

如果把位置 4 直接改成“从未使用”，查找 44 时从 4 开始，看到空位就会错误地认为 44 不存在。

因此开放定址表通常需要三种状态：

```cpp
enum class State
{
    empty,    // 从未使用
    occupied, // 当前有元素
    deleted   // 曾经有元素，后来删除
};
```

`deleted` 也叫墓碑标记：

- 查找遇到 `deleted` 不能停止；
- 插入可以复用第一个 `deleted`；
- 查找遇到 `empty` 才能确定后面不再有目标键。

### 6.4 线性探测哈希表的正确实现

下面实现一个键唯一的简化版哈希集合。它重点演示：

- 三状态槽位；
- 环绕探测；
- 墓碑复用；
- 负载因子控制；
- 扩容后重新哈希。

```cpp
#include <cstddef>
#include <functional>
#include <utility>
#include <vector>

template <class Key,
          class Hash = std::hash<Key>,
          class KeyEqual = std::equal_to<Key>>
class LinearHashSet
{
private:
    enum class State
    {
        empty,
        occupied,
        deleted
    };

    struct Slot
    {
        Key key{};
        State state = State::empty;
    };

public:
    explicit LinearHashSet(std::size_t capacity = 8)
        : slots_(capacity < 8 ? 8 : capacity)
    {
    }

    bool insert(const Key& key)
    {
        if ((size_ + deleted_) * 10 >= slots_.size() * 7)
        {
            rehash(slots_.size() * 2);
        }

        return insert_without_rehash(key);
    }

    bool contains(const Key& key) const
    {
        return find_index(key) != npos;
    }

    bool erase(const Key& key)
    {
        const std::size_t index = find_index(key);
        if (index == npos)
        {
            return false;
        }

        slots_[index].state = State::deleted;
        --size_;
        ++deleted_;
        return true;
    }

    std::size_t size() const
    {
        return size_;
    }

    bool empty() const
    {
        return size_ == 0;
    }

private:
    static constexpr std::size_t npos =
        static_cast<std::size_t>(-1);

    std::size_t find_index(const Key& key) const
    {
        const std::size_t start = hash_(key) % slots_.size();

        for (std::size_t step = 0; step < slots_.size(); ++step)
        {
            const std::size_t index =
                (start + step) % slots_.size();
            const Slot& slot = slots_[index];

            if (slot.state == State::empty)
            {
                return npos;
            }

            if (slot.state == State::occupied &&
                equal_(slot.key, key))
            {
                return index;
            }
        }

        return npos;
    }

    bool insert_without_rehash(const Key& key)
    {
        const std::size_t start = hash_(key) % slots_.size();
        std::size_t first_deleted = npos;

        for (std::size_t step = 0; step < slots_.size(); ++step)
        {
            const std::size_t index =
                (start + step) % slots_.size();
            Slot& slot = slots_[index];

            if (slot.state == State::occupied)
            {
                if (equal_(slot.key, key))
                {
                    return false;
                }
                continue;
            }

            if (slot.state == State::deleted)
            {
                if (first_deleted == npos)
                {
                    first_deleted = index;
                }
                continue;
            }

            const std::size_t target =
                first_deleted == npos ? index : first_deleted;
            slots_[target].key = key;
            slots_[target].state = State::occupied;
            ++size_;

            if (first_deleted != npos)
            {
                --deleted_;
            }

            return true;
        }

        if (first_deleted != npos)
        {
            slots_[first_deleted].key = key;
            slots_[first_deleted].state = State::occupied;
            ++size_;
            --deleted_;
            return true;
        }

        return false;
    }

    void rehash(std::size_t new_capacity)
    {
        std::vector<Slot> old;
        old.swap(slots_);

        slots_.resize(new_capacity);
        size_ = 0;
        deleted_ = 0;

        for (const Slot& slot : old)
        {
            if (slot.state == State::occupied)
            {
                insert_without_rehash(slot.key);
            }
        }
    }

private:
    std::vector<Slot> slots_;
    std::size_t size_ = 0;
    std::size_t deleted_ = 0;
    Hash hash_{};
    KeyEqual equal_{};
};
```

### 6.5 讲义式实现中常见的错误

开放定址实现经常出现以下问题：

1. 查找向后移动时忘记对容量取模；
2. 表中没有 `empty` 槽位时陷入死循环；
3. 删除元素后错误地执行 `++size`；
4. `find` 失败时返回某个桶下标，而调用方却拿它与 -1 比较；
5. 插入遇到 `deleted` 就立即写入，导致后面已存在的相同键没有被发现；
6. 扩容时直接复制旧下标，而没有重新计算桶位置；
7. 负载因子计算使用整数除法，导致判断失真；
8. 只统计有效元素，不处理墓碑过多造成的性能退化。

上面的实现通过有限次数的 `for` 循环避免死循环，并记住第一个墓碑位置，在确认探测链中没有重复键后再复用。

### 6.6 二次探测

二次探测使用平方增长的偏移量，例如：

```text
index_i = (start + i²) % capacity
```

它能够减轻线性探测的主聚集，但仍可能产生次聚集，而且能否覆盖足够多的槽位与表长、探测公式和负载因子有关。

不能简单地认为“只要还有空位，任意二次探测公式就一定能找到”。实现时需要选择匹配的容量策略，并在负载因子达到阈值前扩容。

### 6.7 双重哈希

双重哈希使用第二个哈希函数决定步长：

```text
index_i = (h1(key) + i × h2(key)) % capacity
```

如果步长与容量互质，探测可以覆盖整个表。它通常比简单线性探测更能打散冲突，但每次探测成本也更高。

## 七、开散列与链地址法

### 7.1 基本思想

开散列也叫链地址法或开链法。底层数组保存桶头指针，冲突元素挂在同一个桶的链表中：

```text
bucket[0] → nullptr
bucket[1] → 21 → 11 → 1 → nullptr
bucket[2] → 32 → 12 → nullptr
bucket[3] → nullptr
bucket[4] → 44 → 4 → nullptr
```

查找过程：

1. 计算哈希值；
2. 得到桶号；
3. 遍历该桶中的链表；
4. 使用相等判断确认目标键。

### 7.2 链地址法的复杂度

设：

- 元素数量为 `n`；
- 桶数量为 `m`；
- 负载因子 `α = n / m`。

哈希分布较均匀时，一个桶的平均长度约为 `α`，查找平均成本可以表示为 `O(1 + α)`。

当最大负载因子保持为常数时，通常把平均查找复杂度写成 `O(1)`。

如果所有元素都落入同一个桶，链表长度达到 `n`，最坏复杂度退化为 `O(n)`。

### 7.3 简化版链式哈希表

下面用 `std::forward_list` 管理每个桶，避免手写裸指针的析构和异常安全问题：

```cpp
#include <cstddef>
#include <forward_list>
#include <functional>
#include <utility>
#include <vector>

template <class Key,
          class Value,
          class Hash = std::hash<Key>,
          class KeyEqual = std::equal_to<Key>>
class ChainedHashMap
{
private:
    using Entry = std::pair<Key, Value>;
    using Bucket = std::forward_list<Entry>;

public:
    explicit ChainedHashMap(std::size_t bucket_count = 8)
        : buckets_(bucket_count < 8 ? 8 : bucket_count)
    {
    }

    bool insert(const Key& key, const Value& value)
    {
        if (size_ + 1 > buckets_.size())
        {
            rehash(buckets_.size() * 2);
        }

        Bucket& bucket = buckets_[index_for(key)];
        for (const auto& entry : bucket)
        {
            if (equal_(entry.first, key))
            {
                return false;
            }
        }

        bucket.emplace_front(key, value);
        ++size_;
        return true;
    }

    Value* find(const Key& key)
    {
        Bucket& bucket = buckets_[index_for(key)];
        for (auto& entry : bucket)
        {
            if (equal_(entry.first, key))
            {
                return &entry.second;
            }
        }
        return nullptr;
    }

    const Value* find(const Key& key) const
    {
        const Bucket& bucket = buckets_[index_for(key)];
        for (const auto& entry : bucket)
        {
            if (equal_(entry.first, key))
            {
                return &entry.second;
            }
        }
        return nullptr;
    }

    bool erase(const Key& key)
    {
        Bucket& bucket = buckets_[index_for(key)];
        auto previous = bucket.before_begin();

        for (auto current = bucket.begin();
             current != bucket.end();
             ++current)
        {
            if (equal_(current->first, key))
            {
                bucket.erase_after(previous);
                --size_;
                return true;
            }
            ++previous;
        }

        return false;
    }

    std::size_t size() const
    {
        return size_;
    }

    std::size_t bucket_count() const
    {
        return buckets_.size();
    }

private:
    std::size_t index_for(const Key& key) const
    {
        return hash_(key) % buckets_.size();
    }

    void rehash(std::size_t new_bucket_count)
    {
        std::vector<Bucket> new_buckets(new_bucket_count);

        for (Bucket& bucket : buckets_)
        {
            for (auto& entry : bucket)
            {
                const std::size_t index =
                    hash_(entry.first) % new_bucket_count;
                new_buckets[index].push_front(std::move(entry));
            }
        }

        buckets_.swap(new_buckets);
    }

private:
    std::vector<Bucket> buckets_;
    std::size_t size_ = 0;
    Hash hash_{};
    KeyEqual equal_{};
};
```

这是教学实现，省略了完整 STL 容器所需的迭代器、分配器、异常保证、节点句柄和透明查找等功能。

### 7.4 开散列如何扩容

扩容不能只调整桶数组大小，因为桶号依赖桶数量：

```text
old_index = hash(key) % old_bucket_count
new_index = hash(key) % new_bucket_count
```

正确扩容过程：

1. 创建更多桶；
2. 遍历所有有效元素；
3. 按新桶数重新计算每个元素的位置；
4. 把节点接入新桶；
5. 交换新旧表。

这个过程叫重新哈希，即 `rehash`。

### 7.5 开散列与闭散列对比

| 对比项 | 开放定址 | 链地址法 |
| --- | --- | --- |
| 元素位置 | 全部在数组槽位中 | 节点挂在桶链表上 |
| 额外指针 | 通常不需要 | 节点需要链接信息 |
| 缓存局部性 | 通常较好 | 节点分散时较差 |
| 删除 | 需要墓碑或搬移策略 | 链表摘除即可 |
| 高负载因子 | 性能下降明显 | 相对更能容忍 |
| 内存分配 | 可集中分配 | 传统实现常逐节点分配 |
| 冲突表现 | 探测次数增加 | 桶链变长 |

不能简单断言某一种永远更省内存。实际结果取决于：

- 槽位是否保存状态和空对象；
- 节点大小及分配器开销；
- 负载因子；
- 是否采用紧凑连续节点；
- 键值对象本身的大小。

## 八、扩容、重新哈希与迭代器失效

### 8.1 为什么需要扩容

随着元素增加：

- 开放定址表中的空槽减少；
- 链地址表中的平均桶长增加；
- 冲突和比较次数上升；
- 查询性能逐渐下降。

因此哈希表需要在负载因子达到阈值时扩容。

### 8.2 扩容不是简单复制

假设原桶数为 10：

```text
44 % 10 = 4
```

扩容到 23 个桶后：

```text
44 % 23 = 21
```

元素的目标桶改变，所以必须重新计算位置。

### 8.3 重新哈希的成本

一次重新哈希通常需要处理全部 `n` 个元素，单次成本为 `O(n)`。

为什么插入仍可认为平均 `O(1)`？

因为容量通常按倍数增长。虽然少数插入会触发昂贵扩容，但把多次操作的总成本分摊后，每次插入的摊销成本仍可保持常数级。

### 8.4 unordered 容器的迭代器失效

需要重点记住：

- `clear`、赋值会使迭代器失效；
- `rehash`、`reserve` 触发重新哈希时，所有迭代器失效；
- 插入若触发重新哈希，所有迭代器失效；
- 插入未触发重新哈希时，已有迭代器通常保持有效；
- `erase` 只使指向被删除元素的迭代器失效；
- 重新哈希不会使未被删除元素的引用和指针失效，但迭代器会失效。

不能在保存迭代器后无条件插入大量元素，再继续使用旧迭代器。

## 九、自定义类型作为键

### 9.1 默认支持的类型

标准库为许多常见类型提供了 `std::hash`，例如：

- 整数；
- 枚举；
- 指针；
- `std::string`；
- `std::string_view`；
- 部分标准库类型。

自定义结构体通常需要提供自己的哈希函数和相等规则。

### 9.2 自定义哈希仿函数

```cpp
#include <cstddef>
#include <functional>
#include <string>
#include <unordered_set>

struct Student
{
    int id;
    std::string school;
};

struct StudentEqual
{
    bool operator()(const Student& left,
                    const Student& right) const
    {
        return left.id == right.id &&
               left.school == right.school;
    }
};

struct StudentHash
{
    std::size_t operator()(const Student& value) const
    {
        const std::size_t h1 = std::hash<int>{}(value.id);
        const std::size_t h2 =
            std::hash<std::string>{}(value.school);

        return h1 ^ (h2 + 0x9e3779b9U +
                     (h1 << 6U) + (h1 >> 2U));
    }
};

int main()
{
    std::unordered_set<Student,
                       StudentHash,
                       StudentEqual> students;

    students.insert({1001, "BIT"});
}
```

### 9.3 相等字段和哈希字段必须对应

上例中 `StudentEqual` 比较 `id` 和 `school`，`StudentHash` 也必须让这两个字段影响哈希结果。

如果相等判断只比较 `id`，但哈希函数还混入 `school`，就可能出现：

```text
Equal(a, b) == true
Hash(a) != Hash(b)
```

这违反无序容器的要求。

### 9.4 字符串哈希

字符串哈希需要让每个字符都影响最终结果。教学中常见多项式滚动形式：

```cpp
std::size_t hash_string(const std::string& text)
{
    std::size_t hash = 0;
    constexpr std::size_t seed = 131;

    for (unsigned char ch : text)
    {
        hash = hash * seed + ch;
    }

    return hash;
}
```

实际使用 `unordered_map<std::string, ...>` 时，通常直接使用标准库的 `std::hash<std::string>`。

还要注意：

- `std::hash` 适用于容器分桶；
- 标准不保证不同程序、不同实现中的哈希值永久一致；
- 不要把它的结果保存为跨版本文件格式；
- 它不是密码学哈希，不能用于密码、签名或安全校验。

### 9.5 哈希洪泛

如果攻击者能够构造大量落入同一桶的键，哈希表可能从平均 `O(1)` 退化到 `O(n)`，形成拒绝服务风险。

处理不可信输入时，可以考虑：

- 带随机种子的哈希；
- 经过安全设计的哈希算法；
- 限制请求和输入规模；
- 使用具有稳定最坏复杂度的树形容器；
- 采用标准库或成熟框架提供的防护。

## 十、unordered_map 与 unordered_set 的复用设计

### 10.1 两个容器底层的共同点

`unordered_set<K>` 保存 `K`。

`unordered_map<K, V>` 保存 `pair<const K, V>`。

底层哈希表真正关心的是：

- 元素类型是什么；
- 怎样从元素中取出键；
- 怎样计算键的哈希；
- 怎样判断键相等。

因此可以通过“取键仿函数”复用同一套哈希桶。

### 10.2 set 的取键器

```cpp
template <class Key>
struct SetKeyOfValue
{
    const Key& operator()(const Key& value) const
    {
        return value;
    }
};
```

### 10.3 map 的取键器

```cpp
template <class Key, class T>
struct MapKeyOfValue
{
    const Key&
    operator()(const std::pair<const Key, T>& value) const
    {
        return value.first;
    }
};
```

底层结构可以抽象为：

```cpp
template <class Key,
          class Value,
          class KeyOfValue,
          class Hash,
          class KeyEqual>
class HashTable;
```

这样：

- `unordered_set` 传入“元素本身就是键”的取键器；
- `unordered_map` 传入“`pair.first` 是键”的取键器；
- 哈希表的插入、查找、删除、扩容和迭代逻辑可以复用。

这与 `map`、`set` 复用同一棵红黑树的设计思想非常相似。

### 10.4 哈希桶迭代器的 ++

链地址哈希表的迭代器前进逻辑为：

1. 当前桶链表还有下一个节点，移动到下一个节点；
2. 当前链表结束，从后续桶中找到第一个非空桶；
3. 所有桶都结束，变成 `end()`。

```text
bucket[0] → A → B
bucket[1] → 空
bucket[2] → C

A ++ → B
B ++ → C
C ++ → end
```

因此无序容器至少提供前向迭代能力，但不能根据遍历顺序推断关键字大小关系。

## 十一、位图

### 11.1 位图的思想

如果问题只关心某个整数“存在或不存在”，用一个完整整数甚至一个哈希节点保存状态会浪费空间。

位图用一个二进制位表示一个状态：

```text
0：不存在
1：存在
```

例如要表示非负整数 0 到 31，只需要一个 32 位整数。

### 11.2 空间优势

保存 `N` 个布尔状态：

- 若每个状态使用 1 字节，需要约 `N` 字节；
- 位图只需要约 `N / 8` 字节。

要覆盖所有 32 位无符号整数：

```text
2^32 bits = 2^29 bytes = 512 MiB
```

这也是海量整数存在性问题中常见的计算。

### 11.3 位定位

如果底层使用 64 位无符号整数数组：

```text
word_index = value / 64
bit_index  = value % 64
mask       = 1ULL << bit_index
```

设置：

```cpp
words[word_index] |= mask;
```

清除：

```cpp
words[word_index] &= ~mask;
```

测试：

```cpp
(words[word_index] & mask) != 0
```

### 11.4 动态位图实现

```cpp
#include <cstddef>
#include <cstdint>
#include <stdexcept>
#include <vector>

class Bitmap
{
public:
    explicit Bitmap(std::size_t bit_count)
        : words_((bit_count + 63U) / 64U, 0),
          bit_count_(bit_count)
    {
    }

    void set(std::size_t position)
    {
        check(position);
        words_[position / 64U] |=
            (std::uint64_t{1} << (position % 64U));
    }

    void reset(std::size_t position)
    {
        check(position);
        words_[position / 64U] &=
            ~(std::uint64_t{1} << (position % 64U));
    }

    bool test(std::size_t position) const
    {
        check(position);
        return (words_[position / 64U] &
                (std::uint64_t{1} << (position % 64U))) != 0;
    }

    std::size_t size() const
    {
        return bit_count_;
    }

    std::size_t count() const
    {
        std::size_t total = 0;

        for (std::uint64_t word : words_)
        {
            while (word != 0)
            {
                word &= word - 1;
                ++total;
            }
        }

        return total;
    }

private:
    void check(std::size_t position) const
    {
        if (position >= bit_count_)
        {
            throw std::out_of_range("bitmap position");
        }
    }

private:
    std::vector<std::uint64_t> words_;
    std::size_t bit_count_;
};
```

`count` 使用 `word &= word - 1` 每次消去最低位的一个 1。

C++20 还可以使用 `<bit>` 中的 `std::popcount`。

### 11.5 位图实现的常见错误

1. 边界判断写成 `position > bit_count`，导致 `position == bit_count` 越界；
2. 使用 `1 << position`，当 `1` 是有符号 `int` 时可能产生错误位移；
3. 数组长度无条件写成 `bit_count / 32 + 1`，在整除时多分配且语义混乱；
4. 把“可表示的最大下标”和“位的数量”混为一谈；
5. 右移有符号负数，依赖实现行为；
6. 统计字节时把 `sizeof(word)` 当成位数。

### 11.6 位图的应用

- 快速判断整数是否存在；
- 对有限范围整数去重；
- 对整数排序；
- 计算集合交集、并集和差集；
- 操作系统的磁盘块、页框或资源标记；
- 权限和功能开关；
- 数据库索引中的位图结构。

### 11.7 位图的限制

普通位图更适合：

- 关键字是非负整数；
- 取值范围已知；
- 范围相对可控；
- 只需要少量状态。

如果关键字是字符串，或者整数范围巨大但实际数据极少，直接按值开位图可能浪费大量空间。

## 十二、布隆过滤器

### 12.1 为什么需要布隆过滤器

假设推荐系统要判断一篇新闻是否可能已经推送给用户：

- 完整哈希集合能够精确判断，但要保存全部元素，内存成本较高；
- 普通位图节省空间，但字符串不能直接一一映射到唯一位；
- 只用一个哈希位会有严重冲突。

布隆过滤器把位图和多个哈希函数结合起来，以少量内存完成近似存在性判断。

### 12.2 基本结构

布隆过滤器包含：

- 一个长度为 `m` 的位数组；
- `k` 个哈希函数；
- 已插入约 `n` 个元素。

插入一个键时：

1. 用 `k` 个哈希函数计算 `k` 个位置；
2. 把这些位置全部置 1。

```text
key ──h1──▶ bit[2]  = 1
    ├─h2──▶ bit[9]  = 1
    └─h3──▶ bit[15] = 1
```

### 12.3 查询规则

查询时重新计算相同的 `k` 个位置：

- 只要有一个位置为 0，元素一定没有插入过；
- 所有位置都为 1，元素可能插入过。

因此布隆过滤器提供：

```text
返回“不存在” → 一定不存在
返回“可能存在” → 可能存在，也可能误判
```

前提是位图没有被错误删除、哈希方案一致并且实现没有故障。

### 12.4 假阳性与假阴性

普通只插入布隆过滤器可能产生假阳性：

> 实际不存在，但判断为“可能存在”。

不会产生假阴性：

> 已经插入，却判断为“不存在”。

讲义中有时会把英文误写成 `False Position`，正确术语是：

- 假阳性：`false positive`；
- 假阴性：`false negative`。

### 12.5 误判率

在理想独立哈希假设下，误判率近似为：

```text
p ≈ (1 - e^(-kn/m))^k
```

其中：

- `m`：位数；
- `n`：预计插入元素数；
- `k`：哈希函数数量；
- `p`：假阳性概率。

给定 `m` 和 `n`，近似最优哈希函数个数：

```text
k ≈ (m / n) × ln 2
```

给定元素数 `n` 和目标误判率 `p`，所需位数近似：

```text
m ≈ -n × ln p / (ln 2)^2
```

哈希函数并不是越多越好：

- 太少，设置的位不足，区分度低；
- 太多，位图更快变满，计算成本也更高。

### 12.6 一个简化实现

下面使用双重哈希生成多个位置，避免维护许多完全独立的哈希实现：

```cpp
#include <cstddef>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

class BloomFilter
{
public:
    BloomFilter(std::size_t bit_count,
                std::size_t hash_count)
        : bits_((bit_count + 63U) / 64U, 0),
          bit_count_(bit_count),
          hash_count_(hash_count)
    {
    }

    void insert(const std::string& key)
    {
        const std::size_t h1 =
            std::hash<std::string>{}(key);
        const std::size_t h2 =
            mix(h1 ^ std::size_t{0x9e3779b9U});

        for (std::size_t i = 0; i < hash_count_; ++i)
        {
            const std::size_t position =
                (h1 + i * h2) % bit_count_;
            set(position);
        }
    }

    bool possibly_contains(const std::string& key) const
    {
        const std::size_t h1 =
            std::hash<std::string>{}(key);
        const std::size_t h2 =
            mix(h1 ^ std::size_t{0x9e3779b9U});

        for (std::size_t i = 0; i < hash_count_; ++i)
        {
            const std::size_t position =
                (h1 + i * h2) % bit_count_;
            if (!test(position))
            {
                return false;
            }
        }

        return true;
    }

private:
    static std::size_t mix(std::size_t value)
    {
        value ^= value >> 16U;
        value *= std::size_t{0x7feb352dU};
        value ^= value >> 15U;
        value *= std::size_t{0x846ca68bU};
        value ^= value >> 16U;
        return value | 1U;
    }

    void set(std::size_t position)
    {
        bits_[position / 64U] |=
            (std::uint64_t{1} << (position % 64U));
    }

    bool test(std::size_t position) const
    {
        return (bits_[position / 64U] &
                (std::uint64_t{1} << (position % 64U))) != 0;
    }

private:
    std::vector<std::uint64_t> bits_;
    std::size_t bit_count_;
    std::size_t hash_count_;
};
```

生产环境还应检查 `bit_count` 和 `hash_count` 不能为 0，并根据目标误判率计算参数。若数据需要跨进程或持久化，还应使用明确、稳定的哈希算法，而不是依赖 `std::hash` 的跨实现稳定性。

### 12.7 为什么普通布隆过滤器不能删除

不同元素可能共享某些位：

```text
apple  → 2, 5, 9
orange → 5, 8, 12
```

如果删除 `apple` 时把 2、5、9 全部清零，位置 5 同时属于 `orange`，就会制造假阴性。

因此普通布隆过滤器一般只支持：

- 插入；
- 查询；
- 整体重建或清空。

### 12.8 计数布隆过滤器

计数布隆过滤器把每一位改成小计数器：

- 插入时，对对应计数器加一；
- 删除时，对对应计数器减一；
- 查询时，检查计数器是否都大于 0。

它能够支持受限删除，但代价包括：

- 使用更多内存；
- 计数器可能溢出；
- 若删除一个从未插入的元素，会破坏其他元素的状态；
- 仍然不能仅凭过滤器确认元素是否真实存在。

删除前通常需要额外系统保证，例如由精确存储确认该元素确实存在。

### 12.9 优点与缺点

优点：

- 空间效率高；
- 插入和查询成本约为 `O(k)`；
- 不必保存元素原文；
- 非常适合做昂贵查询前的第一层过滤；
- 多个哈希位置可以并行计算。

缺点：

- 存在假阳性；
- 不能返回元素本身；
- 普通版本不支持安全删除；
- 参数估计不合理时误判率会迅速升高；
- 不能替代需要精确结果的最终存储。

### 12.10 典型应用

- 缓存穿透防护；
- 推荐内容去重；
- 爬虫 URL 去重；
- 数据库和存储系统判断某个键一定不在某个文件中；
- 分布式系统中的集合摘要；
- 垃圾邮件或黑名单的第一层筛选。

正确的工程理解是：

> 布隆过滤器负责快速排除“一定不存在”的情况，判断“可能存在”后仍可能需要访问精确存储。

## 十三、海量数据问题

### 13.1 100 GB 日志中出现次数最多的 IP

如果日志无法全部装入内存，可以采用哈希切分：

1. 选择分片数量 `M`；
2. 读取每个 IP；
3. 计算 `hash(ip) % M`；
4. 把 IP 写入对应小文件；
5. 相同 IP 一定进入同一个分片；
6. 对每个分片使用 `unordered_map` 统计频次；
7. 比较各分片的局部最大值，得到全局最大值。

关键点：

- `M` 要让单个分片能够放入内存；
- 同一关键字必须使用相同切分规则；
- 如果数据倾斜严重，需要进一步切分超大分片；
- 中间文件需要考虑磁盘空间和顺序 I/O。

### 13.2 如何得到 Top K IP

每个分片统计完频次后：

1. 使用大小为 `K` 的小根堆保留该分片 Top K；
2. 汇总所有分片的候选；
3. 再使用一个大小为 `K` 的小根堆得到全局 Top K。

由于每个 IP 只会出现在一个分片中，不需要跨分片合并同一 IP 的计数。

### 13.3 Linux 命令思路

如果 IP 位于日志第一列，可以使用：

```bash
awk '{print $1}' access.log |
sort |
uniq -c |
sort -nr |
head -n 10
```

其中 `sort` 可以使用磁盘进行外部排序，但 100 GB 数据仍应考虑：

- 临时目录空间；
- `LC_ALL=C` 带来的排序性能；
- `sort -S` 内存限制；
- `sort -T` 临时目录；
- 日志压缩与字段位置；
- 并行和分片策略。

### 13.4 40 亿个不重复无符号整数的存在性判断

若关键字是 32 位无符号整数：

1. 建立覆盖 `2^32` 个状态的位图；
2. 每个输入整数对应一位；
3. 出现时置 1；
4. 查询时检查对应位。

空间约为：

```text
2^32 bits = 512 MiB
```

构建时间为 `O(n)`，单次查询为 `O(1)`。

### 13.5 100 亿整数中找只出现一次的数

如果整数范围是 32 位无符号数，可以用每个值 2 位的状态：

```text
00：未出现
01：出现一次
10：出现至少两次
```

每读到一个值就更新状态，最后扫描所有状态为 `01` 的位置。

覆盖完整 `2^32` 范围需要约 1 GiB，仅位图本身就可能达到或超过题目内存限制，还要留出程序开销。因此若限制严格，应进一步：

- 按高位分区，分批处理；
- 使用外部排序；
- 根据题目实际值域缩小位图。

### 13.6 两个百亿整数文件求交集

若值域是完整 32 位无符号整数：

1. 用约 512 MiB 位图记录文件 A；
2. 扫描文件 B；
3. 若对应位为 1，则属于交集；
4. 如结果要求去重，可在输出后清除该位或使用额外输出标记。

如果值域未知或无法开位图，可以对两个文件使用相同哈希规则分片：

```text
A → A0, A1, ..., AM-1
B → B0, B1, ..., BM-1
```

只需要分别处理 `Ai` 和 `Bi`，因为相同值一定进入编号相同的分片。

### 13.7 找出现次数不超过两次的整数

可以为每个值使用 2 位饱和计数：

```text
00：0 次
01：1 次
10：2 次
11：3 次及以上
```

读取数据时最多增长到 `11`。扫描时输出状态为 `01` 或 `10` 的值。

### 13.8 两个百亿 query 文件求交集

精确方案：

1. 对两个文件使用相同哈希函数切分；
2. 对每对对应分片建立精确集合并求交集；
3. 处理超大倾斜分片；
4. 对结果按需求去重。

近似方案：

1. 把文件 A 的 query 加入布隆过滤器；
2. 扫描文件 B；
3. 判断为“不存在”的直接排除；
4. 判断为“可能存在”的作为候选。

近似方案会包含假阳性。如果最终结果必须精确，还要把候选交给精确集合、磁盘索引或原始分片验证。

## 十四、一致性哈希

### 14.1 普通取模的问题

分布式缓存常用：

```text
node = hash(key) % server_count
```

当服务器数量从 4 变为 5 时，大量键的取模结果都会变化，导致大规模缓存迁移或失效。

### 14.2 哈希环

一致性哈希把哈希空间看成一个环：

1. 服务器映射到环上；
2. 数据键也映射到环上；
3. 从键的位置顺时针找到第一个服务器；
4. 该服务器负责这个键。

新增或删除节点时，主要影响相邻区间的数据，而不是重映射全部键。

### 14.3 虚拟节点

物理服务器在环上分布不均可能造成数据倾斜。常见做法是为每台物理服务器创建多个虚拟节点：

```text
server-A → A#1, A#2, A#3, ...
server-B → B#1, B#2, B#3, ...
```

虚拟节点能够改善负载均衡，也便于根据服务器容量设置不同权重。

一致性哈希解决的是节点变化时的数据迁移问题，不等同于普通容器内部的哈希冲突解决。

## 十五、哈希与加密哈希

### 15.1 容器哈希

`unordered_map` 使用的哈希重点是：

- 速度快；
- 分布较均匀；
- 相同输入得到相同结果；
- 适合桶索引。

它通常不要求：

- 抗碰撞攻击；
- 不可逆；
- 隐藏原始数据；
- 防止伪造。

### 15.2 密码学哈希

SHA-256 等密码学哈希更强调：

- 原像抗性；
- 第二原像抗性；
- 碰撞抗性；
- 微小输入变化带来大幅输出变化。

密码保存还不能只做一次普通 SHA-256，应使用专门的密码哈希方案，例如 Argon2、scrypt、bcrypt 或 PBKDF2，并配合独立盐值和合理成本参数。

不要用 `std::hash<std::string>`：

- 保存密码；
- 校验文件是否遭到恶意篡改；
- 实现数字签名；
- 替代消息认证码。

## 十六、常见错误

### 16.1 认为 unordered_map 永远是 O(1)

正确说法是平均 `O(1)`，最坏可退化到 `O(n)`。性能受哈希质量、负载因子和输入分布影响。

### 16.2 依赖无序容器的遍历顺序

无序容器不保证关键字排序，也不保证插入顺序。需要稳定顺序时应额外排序或选择有序容器。

### 16.3 使用 operator[] 判断键是否存在

`operator[]` 会插入缺失键。只判断存在性应使用 `find` 或 C++20 的 `contains`。

### 16.4 自定义相等规则与哈希规则不一致

如果两个键被认为相等，它们必须得到相同哈希值。

### 16.5 扩容时不重新计算桶号

桶号依赖桶数量。更换容量后必须对所有元素重新哈希。

### 16.6 开放定址删除时直接置空

直接置空会截断探测链，造成后续元素无法找到。应使用墓碑或适合该探测算法的后移删除策略。

### 16.7 开放定址查找不做环绕

下标到达数组末尾后应回到 0，并限制最多探测一个完整表，防止越界和死循环。

### 16.8 负载因子使用整数除法

错误：

```cpp
if (size / capacity > 0.7)
{
}
```

`size / capacity` 可能先执行整数除法。

可以改成：

```cpp
if (size * 10 >= capacity * 7)
{
}
```

或显式转换为浮点数。

### 16.9 位图边界判断写错

如果 `bit_count` 表示位的数量，合法下标是 `0` 到 `bit_count - 1`，判断应为：

```cpp
if (position >= bit_count)
{
    // 越界
}
```

### 16.10 位移使用有符号 1

应根据底层字宽使用：

```cpp
std::uint64_t{1} << position
```

避免 `1 << 31` 等有符号位移问题。

### 16.11 认为布隆过滤器“存在”就是确定存在

布隆过滤器只能回答：

- 一定不存在；
- 可能存在。

需要精确结果时必须继续查询真实存储。

### 16.12 直接从普通布隆过滤器删除

共享位会被其他元素使用，直接清零可能制造假阴性。需要删除时考虑计数布隆过滤器或整体重建。

## 十七、常见面试问题

### 17.1 map 和 unordered_map 有什么区别

`map` 通常使用红黑树，元素有序，操作为 `O(log n)`，适合范围查询。

`unordered_map` 通常使用哈希表，元素无规定顺序，操作平均 `O(1)`、最坏 `O(n)`，适合精确查找。

### 17.2 什么是哈希冲突

不同关键字经过哈希和桶映射后落入相同位置或同一个桶，称为哈希冲突。

### 17.3 哈希冲突有哪些解决方法

常见方法：

- 开放定址：线性探测、二次探测、双重哈希；
- 链地址法：同桶元素使用链表或其他结构组织。

### 17.4 什么是负载因子

负载因子通常是：

```text
元素数量 / 桶数量
```

它反映哈希表拥挤程度。负载因子过高通常会增加冲突并降低性能。

### 17.5 为什么扩容必须重新哈希

因为桶号通常由 `hash(key) % bucket_count` 决定，桶数量改变后，元素对应的桶号也会改变。

### 17.6 为什么开放定址不能随便删除

直接改成空槽会截断其他元素的探测链，使查找提前失败。常用墓碑标记区分“从未使用”和“已经删除”。

### 17.7 为什么线性探测会产生数据堆积

冲突元素不断占据相邻位置，形成连续簇。后续落入簇中任意位置的元素都要向后探测，使簇继续扩大，这叫主聚集。

### 17.8 哈希表什么时候扩容

通常在下一次插入会使负载因子超过阈值时扩容。开放定址还需要考虑墓碑数量，链地址法则主要控制平均桶长。

### 17.9 unordered_map 的 operator[] 有什么副作用

键不存在时会插入键，并值初始化映射值。只查询存在性时不应使用它。

### 17.10 rehash 后哪些东西失效

无序容器重新哈希会使迭代器失效；未删除元素的引用和指针通常仍保持有效。

### 17.11 位图适合什么场景

适合值域已知、以非负整数为键、只需记录少量状态的海量数据问题。

### 17.12 布隆过滤器为什么有误判

不同元素的多个哈希位置可能重叠。一个从未插入的元素，其对应位置也可能恰好都被其他元素置为 1，于是出现假阳性。

### 17.13 布隆过滤器会有假阴性吗

标准只插入且没有位被错误清除的布隆过滤器不会有假阴性。直接删除共享位或实现错误可能破坏这一性质。

### 17.14 布隆过滤器为什么不能直接删除

一个位可能被多个元素共享。删除一个元素时清除该位，会让其他已插入元素被错误判断为不存在。

### 17.15 如何处理 100 GB 日志中的 Top K

先按关键字哈希切分为能装入内存的小文件，再逐分片计数；每个分片用大小为 `K` 的小根堆保留候选，最后合并所有候选得到全局 Top K。

### 17.16 std::hash 能用于保存密码吗

不能。`std::hash` 面向容器分桶，不具备密码学安全保证。密码应使用专门的慢速密码哈希算法和独立盐值。

## 十八、总结

哈希的核心不是简单地写出 `key % capacity`，而是把多个部分组合成一个正确、稳定且高效的系统：

1. 哈希函数负责把关键字转换为哈希值；
2. 桶映射把哈希值压缩到存储范围；
3. 冲突解决机制保证不同键能够共存；
4. 相等判断负责在冲突后确认真正的目标键；
5. 负载因子决定哈希表的拥挤程度；
6. 扩容和重新哈希维持平均性能；
7. `unordered_map` 和 `unordered_set` 提供平均 `O(1)` 的精确查找；
8. 开放定址具有较好的缓存局部性，但删除和高负载处理更复杂；
9. 链地址法删除直观、负载更灵活，但传统节点结构会引入指针和分配开销；
10. 位图用一个比特记录整数状态，适合有限值域的海量数据；
11. 布隆过滤器用可控假阳性换取极高空间效率；
12. 哈希切分能够把无法装入内存的大问题拆成多个小问题；
13. 一致性哈希用于减少分布式节点变化带来的数据迁移；
14. 容器哈希与密码学哈希的目标完全不同。

掌握这些内容后，就不只是会使用 `unordered_map`，还能够解释它为什么快、什么时候会变慢、扩容时发生了什么，以及怎样把哈希思想应用到缓存、存储和海量数据处理中。
