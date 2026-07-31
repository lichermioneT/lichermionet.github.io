---
title: C++ STL 关联式容器：map、set 与红黑树原理
date: 2026-07-30 10:00:00
categories:
  - C++
tags:
  - C++
  - STL
  - map
  - set
  - AVL树
  - 红黑树
---

## 前言

`vector`、`list` 和 `deque` 等容器主要按照元素的位置组织数据，属于序列式容器。`map` 和 `set` 则按照关键字组织数据，能够根据关键字快速完成查找、插入和删除，属于关联式容器。

本文将从 `pair` 开始，依次介绍 `set`、`map`、`multiset` 和 `multimap` 的使用，并继续分析它们与二叉搜索树、AVL 树和红黑树之间的关系。

本文主要内容如下：

1. 序列式容器与关联式容器的区别；
2. `std::pair` 键值对；
3. `set`、`map`、`multiset` 和 `multimap` 的接口；
4. `map::operator[]` 的底层逻辑；
5. 自定义比较器与严格弱序；
6. AVL 树的平衡因子与四种旋转；
7. 红黑树的性质、插入调整与复杂度；
8. `map` 和 `set` 如何复用同一棵红黑树；
9. 常见错误与面试问题。

## 一、关联式容器

### 1.1 序列式容器

序列式容器使用线性结构组织元素，元素的位置具有明确的先后关系。

常见序列式容器包括：

- `std::vector`；
- `std::list`；
- `std::deque`；
- `std::forward_list`。

例如，`vector` 中的第 `i` 个元素由位置决定。查找某个值时，如果数据没有额外的顺序信息，通常需要逐个比较，时间复杂度为 `O(n)`。

### 1.2 关联式容器

关联式容器按照关键字组织数据，而不是按照插入位置组织数据。

树形结构的关联式容器包括：

- `std::set`；
- `std::map`；
- `std::multiset`；
- `std::multimap`。

这些容器通常使用红黑树实现，具有以下共同特点：

- 元素始终按照关键字有序排列；
- 查找、插入和删除的时间复杂度通常为 `O(log n)`；
- 迭代器按照关键字顺序遍历；
- 不支持像 `vector` 那样通过整数下标随机访问。

### 1.3 有序容器与无序容器

STL 还提供了哈希结构的关联式容器：

- `std::unordered_set`；
- `std::unordered_map`；
- `std::unordered_multiset`；
- `std::unordered_multimap`。

两类容器的主要区别如下：

| 对比项 | `map` / `set` | `unordered_map` / `unordered_set` |
| --- | --- | --- |
| 常见底层结构 | 红黑树 | 哈希表 |
| 元素是否有序 | 有序 | 通常无序 |
| 平均查找复杂度 | `O(log n)` | `O(1)` |
| 最坏查找复杂度 | `O(log n)` | `O(n)` |
| 范围查询 | 支持 | 不擅长 |
| 自定义规则 | 比较器 | 哈希函数与相等判断 |

如果需要有序遍历、范围查找或稳定的最坏复杂度，可以优先考虑 `map` 和 `set`。如果只关心平均查找速度，通常可以考虑无序容器。

## 二、键值对 pair

### 2.1 pair 的作用

`std::pair` 用于将两个值组合成一个整体：

```cpp
template<class T1, class T2>
struct pair
{
    T1 first;
    T2 second;
};
```

其中：

- `first` 保存第一个值；
- `second` 保存第二个值。

例如，可以使用键值对表示英文单词和中文含义：

```cpp
std::pair<std::string, std::string> word(
    "apple",
    "苹果");

std::cout << word.first << '\n';
std::cout << word.second << '\n';
```

### 2.2 pair 的构造方式

```cpp
#include <string>
#include <utility>

std::pair<std::string, int> p1("apple", 3);

std::pair<std::string, int> p2 = std::make_pair("banana", 5);

std::pair<std::string, int> p3{"peach", 2};
```

在 C++17 中还可以使用结构化绑定：

```cpp
auto [name, count] = p3;
```

### 2.3 map 中的 value_type

`map<Key, T>` 中保存的元素类型并不是简单的 `pair<Key, T>`，而是：

```cpp
std::pair<const Key, T>
```

也就是说：

- `first` 是只读的键；
- `second` 是可以修改的映射值。

这样设计是为了防止用户直接修改键，从而破坏红黑树中的排列顺序。

## 三、set

### 3.1 set 的特点

`set` 用于保存互不重复的关键字：

```cpp
#include <set>

std::set<int> numbers;
```

它具有以下特点：

1. 元素唯一；
2. 元素按照比较规则有序排列；
3. 默认使用 `std::less<Key>`，即升序排列；
4. 查找、插入和删除通常为 `O(log n)`；
5. 迭代器指向的元素不能被修改；
6. 常见底层实现是红黑树。

从标准接口角度看，`set<Key>` 的 `value_type` 就是 `Key`。某些源码讲解会把 `set` 抽象成 `<value, value>`，用于说明其键和值相同，但这不是标准要求的实际元素类型。

### 3.2 模板参数

`set` 的模板参数可以简化理解为：

```cpp
template<
    class Key,
    class Compare = std::less<Key>,
    class Allocator = std::allocator<Key>>
class set;
```

各参数含义如下：

| 参数 | 含义 |
| --- | --- |
| `Key` | 元素类型 |
| `Compare` | 排序规则 |
| `Allocator` | 内存分配器 |

大多数情况下只需要指定 `Key`。

### 3.3 set 的构造

```cpp
#include <set>
#include <vector>

std::set<int> s1;
std::set<int> s2{5, 1, 3, 3, 2};

std::vector<int> values{8, 6, 7, 6, 5};
std::set<int> s3(values.begin(), values.end());
```

`s2` 的最终内容为：

```text
1 2 3 5
```

重复的 `3` 只会保留一次，元素也会自动排序。

### 3.4 set 的遍历

```cpp
for (int value : s2)
{
    std::cout << value << ' ';
}

std::cout << '\n';

for (auto it = s2.rbegin(); it != s2.rend(); ++it)
{
    std::cout << *it << ' ';
}
```

正向迭代器得到升序序列，反向迭代器得到降序序列。

### 3.5 为什么 set 中的元素不能修改

假设树中保存：

```text
1 3 5
```

如果通过迭代器将 `3` 直接修改为 `100`，节点仍然停留在原来的树结构中，但它与左右子树之间的大小关系已经被破坏。

因此，下面的代码无法通过编译：

```cpp
std::set<int> values{1, 3, 5};
auto it = values.find(3);

// *it = 100;  // 错误：set 元素不可修改
```

如果需要修改元素，必须先删除旧值，再插入新值：

```cpp
values.erase(3);
values.insert(100);
```

### 3.6 insert 的返回值

`set::insert` 的常用重载返回：

```cpp
std::pair<iterator, bool>
```

- `first`：指向目标元素；
- `second`：表示本次是否真正插入成功。

```cpp
std::set<int> values;

auto result1 = values.insert(10);
auto result2 = values.insert(10);

std::cout << result1.second << '\n';  // true
std::cout << result2.second << '\n';  // false
std::cout << *result2.first << '\n';  // 10
```

第二次插入失败，但返回的迭代器仍然指向已经存在的 `10`。

### 3.7 查找与统计

```cpp
auto it = values.find(10);

if (it != values.end())
{
    std::cout << "找到了：" << *it << '\n';
}

std::cout << values.count(10) << '\n';
```

对于 `set`：

- `find` 找到时返回元素迭代器，否则返回 `end()`；
- `count` 只能返回 `0` 或 `1`。

如果只想判断是否存在，C++20 可以使用：

```cpp
if (values.contains(10))
{
    // ...
}
```

### 3.8 删除操作

```cpp
std::set<int> values{1, 2, 3, 4, 5};

values.erase(3);              // 按值删除

auto it = values.find(4);
if (it != values.end())
{
    values.erase(it);         // 按迭代器删除
}

values.erase(
    values.begin(),
    values.end());            // 删除一个区间
```

按键删除时，返回被删除元素的数量。对于 `set`，返回值只能是 `0` 或 `1`。

### 3.9 范围查询

有序关联式容器支持高效范围查询：

| 接口 | 含义 |
| --- | --- |
| `lower_bound(key)` | 第一个不小于 `key` 的位置 |
| `upper_bound(key)` | 第一个大于 `key` 的位置 |
| `equal_range(key)` | 同时返回上述两个边界 |

例如，输出 `[3, 7]` 范围内的元素：

```cpp
std::set<int> values{1, 3, 4, 6, 7, 9};

auto first = values.lower_bound(3);
auto last = values.upper_bound(7);

for (auto it = first; it != last; ++it)
{
    std::cout << *it << ' ';
}
```

输出：

```text
3 4 6 7
```

**用法总结**

```c++
#include <iostream>
#include <set>
#include <vector>
using namespace std;

int main()
{
// 1.构造函数
	set<int> s1;                        // 空构造
	set<int> s2{ 1,2,3,4,5 ,5};         // 初始化列表
	vector<int> v{ 1,23,4,5 };
	set<int> s3{ v.begin(), v.end() };  // 迭代器构造
	set<int> s4(s3);                    // 拷贝构造

// 2.迭代器
	// 正向，反向，常量，普通
	set<int>::iterator it1 = s4.begin();
	set<int>::iterator it2 = s4.end();
	set<int>::const_iterator it3 = s4.cbegin();
	set<int>::const_iterator it4 = s4.cend();

	set<int>::reverse_iterator it5 = s4.rbegin();
	set<int>::reverse_iterator it6 = s4.rend();
	set<int>::const_reverse_iterator it7 = s4.crbegin();
	set<int>::const_reverse_iterator it8 = s4.crend();

// 3.容量相关的函数
	cout << s1.empty() << endl;  // 空的就是true
	cout << s4.empty() << endl;  // 元素个数

// 4.修改操作
	// insert插入成功失败都会返回插入的值，需要根据pair的第二个参数进行判断的
	pair<set<int>::iterator, bool> ret = s1.insert(88);
	cout << "ret:" << *ret.first << endl;
	cout << "ret:" << ret.second << endl;
	ret = s1.insert(88);
	cout << "ret:" << *ret.first << endl;
	cout << "ret:" << ret.second << endl;

// 删除指定值，或者迭代器的位置
	cout << s2.erase(3) << endl;
	s2.erase(s2.begin());

	s2.clear(); // 元素清空

// STL查找都要注意，迭代器和end进行判断的
	set<int> s6{ 1,3,4,5,6,7,8,20 };
	set<int>::iterator it9 = s6.find(3);
	if (it9 != s6.end())
	{
		cout << *it9 << endl;
	}

	cout << s6.count(1) << endl;
	cout << s6.count(3) << endl;

	return 0;
}
```

**总结：**

**1.插入的时候，迭代器的类型。**

**2.查找的时候，注意和end进行判断**

**3.set底层是红黑树的**



## 四、map

### 4.1 map 的特点

`map` 用于保存互不重复的键值对：

```cpp
#include <map>

std::map<std::string, std::string> dictionary;
```

它具有以下特点：

1. 元素类型为 `pair<const Key, T>`；
2. 键唯一，映射值可以重复；
3. 元素按照键排序；
4. 键不能修改，映射值可以修改；
5. 查找、插入和删除通常为 `O(log n)`；
6. 支持 `operator[]`；
7. 常见底层实现是红黑树。

### 4.2 模板参数

```cpp
template<
    class Key,
    class T,
    class Compare = std::less<Key>,
    class Allocator =
        std::allocator<std::pair<const Key, T>>>
class map;
```

| 参数 | 含义 |
| --- | --- |
| `Key` | 键的类型 |
| `T` | 映射值的类型 |
| `Compare` | 键的排序规则 |
| `Allocator` | 内存分配器 |

红黑树只根据键进行比较，不会根据映射值决定节点位置。

### 4.3 map 的插入

```cpp
std::map<std::string, std::string> dictionary;

dictionary.insert(
    std::pair<std::string, std::string>(
        "apple",
        "苹果"));

dictionary.insert(
    std::make_pair("banana", "香蕉"));

dictionary.insert({"peach", "桃子"});

dictionary.emplace("watermelon", "西瓜");
```

插入相同键时，`insert` 不会覆盖原来的映射值：

```cpp
auto result =
    dictionary.insert({"apple", "苹果树"});

if (!result.second)
{
    std::cout << "键已存在，当前值为："
              << result.first->second
              << '\n';
}
```

### 4.4 map 的遍历

```cpp
for (const auto& entry : dictionary)
{
    std::cout << entry.first
              << " -> "
              << entry.second
              << '\n';
}
```

遍历顺序由键决定，与元素的插入顺序无关。

在 C++17 中可以使用结构化绑定：

```cpp
for (const auto& [key, value] : dictionary)
{
    std::cout << key << " -> " << value << '\n';
}
```

### 4.5 operator[] 的行为

`map::operator[]` 不只是查找操作。

它的逻辑可以近似理解为：

```cpp
mapped_type& operator[](const key_type& key)
{
    auto result = insert(
        std::make_pair(key, mapped_type()));

    return result.first->second;
}
```

执行过程如下：

1. 使用 `key` 和映射类型的默认值构造键值对；
2. 尝试将键值对插入 `map`；
3. 键存在时，插入失败并获得已有元素的迭代器；
4. 键不存在时，插入默认值并获得新元素的迭代器；
5. 返回映射值 `second` 的引用。

因此：

```cpp
std::map<std::string, int> counts;

std::cout << counts.size() << '\n';  // 0
std::cout << counts["apple"] << '\n'; // 0
std::cout << counts.size() << '\n';  // 1
```

虽然只是读取 `counts["apple"]`，但 `"apple"` 不存在，因此容器中插入了 `{"apple", 0}`。

### 4.6 operator[] 的三种用途

#### 插入

```cpp
dictionary["orange"] = "橙子";
```

#### 查找

```cpp
std::cout << dictionary["apple"] << '\n';
```

但这种写法可能产生插入副作用。

#### 修改

```cpp
dictionary["apple"] = "苹果（已更新）";
```

### 4.7 operator[]、at 和 find 的区别

| 接口 | 键存在 | 键不存在 | 是否可能修改容器 |
| --- | --- | --- | --- |
| `operator[]` | 返回映射值引用 | 插入默认值并返回引用 | 是 |
| `at` | 返回映射值引用 | 抛出 `std::out_of_range` | 否 |
| `find` | 返回迭代器 | 返回 `end()` | 否 |

如果只是检查数据，不希望容器发生变化，优先使用 `find`：

```cpp
auto it = dictionary.find("pear");

if (it != dictionary.end())
{
    std::cout << it->second << '\n';
}
```

如果键必须存在，可以使用 `at`：

```cpp
try
{
    std::cout << dictionary.at("pear") << '\n';
}
catch (const std::out_of_range&)
{
    std::cout << "键不存在\n";
}
```

### 4.8 使用 map 统计次数

`operator[]` 的默认插入行为非常适合计数：

```cpp
std::vector<std::string> words{
    "apple",
    "banana",
    "apple",
    "orange",
    "banana",
    "apple"
};

std::map<std::string, int> counts;

for (const std::string& word : words)
{
    ++counts[word];
}

for (const auto& entry : counts)
{
    std::cout << entry.first
              << " : "
              << entry.second
              << '\n';
}
```

第一次遇到单词时，`counts[word]` 会插入值 `0`，然后再执行自增。

输出：

```text
apple : 3
banana : 2
orange : 1
```

### 4.9 如何更新已经存在的值

`insert` 遇到重复键时不会更新。可以使用以下方式：

```cpp
dictionary["apple"] = "新含义";
```

C++17 还提供：

```cpp
dictionary.insert_or_assign("apple", "新含义");
dictionary.try_emplace("pear", "梨");
```

两者区别如下：

- `insert_or_assign`：键存在时进行赋值；
- `try_emplace`：键存在时不会构造新的映射值，更适合构造代价较高的对象。

### 4.10 map 中哪些内容可以修改

```cpp
auto it = dictionary.find("apple");

if (it != dictionary.end())
{
    // it->first = "pear";  // 错误：键是 const
    it->second = "苹果";
}
```

键决定红黑树中的位置，因此不能直接修改；映射值不参与排序，可以安全修改。



**用法总结**

```c++
#include <iostream>
#include <map>
#include <string>
#include <utility>

using namespace std;

void PrintMap(const map<int, string>& m)
{
    for (const auto& [key, value] : m)
    {
        cout << key << " : " << value << '\n';
    }

    cout << "--------------------\n";
}

int main()
{
    // =====================================================
    // 1. 构造函数
    // =====================================================

    // 默认构造
    map<int, string> m1;

    // 初始化列表构造
    map<int, string> m2{
        {1, "one"},
        {2, "two"},
        {3, "three"}
    };

    // 拷贝构造
    map<int, string> m3(m2);

    // 范围构造
    map<int, string> m4(m2.begin(), m2.end());

    // 移动构造
    map<int, string> m5(std::move(m4));

    cout << "m2：" << '\n';
    PrintMap(m2);

    // =====================================================
    // 2. 迭代器
    // =====================================================

    map<int, string>::iterator it1 = m3.begin();
    map<int, string>::iterator it2 = m3.end();

    map<int, string>::const_iterator it3 = m3.cbegin();
    map<int, string>::const_iterator it4 = m3.cend();

    map<int, string>::reverse_iterator it5 = m3.rbegin();
    map<int, string>::reverse_iterator it6 = m3.rend();

    map<int, string>::const_reverse_iterator it7 = m3.crbegin();
    map<int, string>::const_reverse_iterator it8 = m3.crend();

    cout << "正向遍历：" << '\n';
    for (auto it = m3.begin(); it != m3.end(); ++it)
    {
        cout << it->first << " : " << it->second << '\n';
    }

    cout << "反向遍历：" << '\n';
    for (auto it = m3.rbegin(); it != m3.rend(); ++it)
    {
        cout << it->first << " : " << it->second << '\n';
    }

    cout << "--------------------\n";

    // =====================================================
    // 3. 容量相关
    // =====================================================

    cout << boolalpha;
    cout << "m3.empty() = " << m3.empty() << '\n';
    cout << "m3.size()  = " << m3.size() << '\n';
    cout << "m3.max_size() = " << m3.max_size() << '\n';

    cout << "--------------------\n";

    // =====================================================
    // 4. 插入元素
    // =====================================================

    // 方式一：insert + make_pair
    pair<map<int, string>::iterator, bool> ret1 =
        m1.insert(make_pair(4, "four"));

    if (ret1.second)
    {
        cout << "插入成功：" << ret1.first->first
            << " : " << ret1.first->second << '\n';
    }
    else
    {
        cout << "插入失败，key 已存在：" << ret1.first->first << '\n';
    }

    // 再次插入相同 key，插入失败
    auto ret2 = m1.insert({ 4, "FOUR" });

    if (!ret2.second)
    {
        cout << "key = 4 已存在，原值为："
            << ret2.first->second << '\n';
    }

    // 方式二：使用 operator[]
    m1[1] = "one";
    m1[2] = "two";

    // 方式三：使用 emplace
    m1.emplace(3, "three");

    // 方式四：使用 insert_or_assign，C++17
    // key 存在则修改，不存在则插入
    m1.insert_or_assign(2, "TWO");

    // 方式五：使用 try_emplace，C++17
    // 只有 key 不存在时才构造 value
    m1.try_emplace(5, "five");

    cout << "插入元素后的 m1：" << '\n';
    PrintMap(m1);

    // =====================================================
    // 5. 元素访问
    // =====================================================

    // operator[]
    // key 不存在时，会自动插入一个默认值
    cout << "m1[1] = " << m1[1] << '\n';

    // at()
    // key 不存在时抛出 out_of_range 异常
    try
    {
        cout << "m1.at(2) = " << m1.at(2) << '\n';
        cout << "m1.at(100) = " << m1.at(100) << '\n';
    }
    catch (const out_of_range& e)
    {
        cout << "访问失败：" << e.what() << '\n';
    }

    cout << "--------------------\n";

    // =====================================================
    // 6. 查找元素
    // =====================================================

    // find()
    auto pos = m1.find(3);

    if (pos != m1.end())
    {
        cout << "找到元素：" << pos->first
            << " : " << pos->second << '\n';
    }
    else
    {
        cout << "没有找到 key = 3" << '\n';
    }

    // count()
    // 对于 map，返回值只能是 0 或 1
    cout << "key = 3 的数量：" << m1.count(3) << '\n';
    cout << "key = 10 的数量：" << m1.count(10) << '\n';

    // contains()，C++20
    /*
    if (m1.contains(3))
    {
        cout << "m1 中存在 key = 3" << '\n';
    }
    */

    cout << "--------------------\n";

    // =====================================================
    // 7. lower_bound、upper_bound 和 equal_range
    // =====================================================

    // 第一个 key >= 3 的位置
    auto lower = m1.lower_bound(3);

    if (lower != m1.end())
    {
        cout << "lower_bound(3)："
            << lower->first << " : " << lower->second << '\n';
    }

    // 第一个 key > 3 的位置
    auto upper = m1.upper_bound(3);

    if (upper != m1.end())
    {
        cout << "upper_bound(3)："
            << upper->first << " : " << upper->second << '\n';
    }

    // 返回 [lower_bound, upper_bound)
    auto range = m1.equal_range(3);

    cout << "equal_range(3)：" << '\n';
    for (auto it = range.first; it != range.second; ++it)
    {
        cout << it->first << " : " << it->second << '\n';
    }

    cout << "--------------------\n";

    // =====================================================
    // 8. 删除元素
    // =====================================================

    // 按 key 删除
    // 返回实际删除的元素数量
    size_t eraseCount = m1.erase(5);
    cout << "删除 key = 5 的元素数量：" << eraseCount << '\n';

    // 按迭代器删除
    if (!m1.empty())
    {
        m1.erase(m1.begin());
    }

    // 删除一个范围
    auto first = m1.lower_bound(3);
    auto last = m1.end();
    m1.erase(first, last);

    cout << "删除后的 m1：" << '\n';
    PrintMap(m1);

    // =====================================================
    // 9. swap 和 clear
    // =====================================================

    map<int, string> m6{
        {10, "ten"},
        {20, "twenty"}
    };

    cout << "交换前 m1：" << '\n';
    PrintMap(m1);

    cout << "交换前 m6：" << '\n';
    PrintMap(m6);

    m1.swap(m6);

    cout << "交换后 m1：" << '\n';
    PrintMap(m1);

    cout << "交换后 m6：" << '\n';
    PrintMap(m6);

    m1.clear();

    cout << "clear 后 m1.size() = " << m1.size() << '\n';
    cout << "clear 后 m1.empty() = " << m1.empty() << '\n';

    return 0;
}
```





## 五、multiset 与 multimap

### 5.1 multiset

`multiset` 与 `set` 的主要区别是：`multiset` 允许关键字重复。

```cpp
std::multiset<int> values{
    3, 1, 2, 3, 2, 3
};

for (int value : values)
{
    std::cout << value << ' ';
}
```

输出：

```text
1 2 2 3 3 3
```

```cpp
std::cout << values.count(3) << '\n';  // 3
```

对于 `multiset`，`count` 不再局限于 `0` 和 `1`。

### 5.2 获取所有相同元素

```cpp
auto range = values.equal_range(3);

for (auto it = range.first; it != range.second; ++it)
{
    std::cout << *it << ' ';
}
```

还可以分别使用：

```cpp
auto first = values.lower_bound(3);
auto last = values.upper_bound(3);
```

### 5.3 multimap

`multimap` 允许多个键值对拥有相同的键：

```cpp
std::multimap<std::string, std::string> contacts;

contacts.insert({"技术部", "张三"});
contacts.insert({"技术部", "李四"});
contacts.insert({"市场部", "王五"});
```

查找技术部的所有员工：

```cpp
auto range = contacts.equal_range("技术部");

for (auto it = range.first; it != range.second; ++it)
{
    std::cout << it->second << '\n';
}
```

### 5.4 multimap 为什么没有 operator[]

假设 `multimap` 中存在：

```text
<技术部, 张三>
<技术部, 李四>
```

此时执行：

```cpp
contacts["技术部"]
```

容器无法确定应该返回哪一个映射值的引用，也无法确定用户是想访问已有元素还是继续插入一个同键元素。

因此，`multimap` 不提供 `operator[]`。

### 5.5 四种容器对比

| 容器 | 数据形式 | 键是否唯一 | 是否有 `operator[]` |
| --- | --- | --- | --- |
| `set` | `Key` | 是 | 否 |
| `multiset` | `Key` | 否 | 否 |
| `map` | `pair<const Key, T>` | 是 | 是 |
| `multimap` | `pair<const Key, T>` | 否 | 否 |

四种容器都按照键有序排列，常见底层实现都是红黑树。

## 六、自定义比较器

### 6.1 默认比较器

下面两个声明等价：

```cpp
std::set<int> s1;
std::set<int, std::less<int>> s2;
```

`std::less<int>` 按照升序排列。

如果希望降序排列，可以使用：

```cpp
std::set<int, std::greater<int>> values{
    1, 5, 3, 2, 4
};
```

### 6.2 仿函数比较器

```cpp
struct Student
{
    int id;
    std::string name;
};

struct CompareStudent
{
    bool operator()(
        const Student& left,
        const Student& right) const
    {
        return left.id < right.id;
    }
};

std::set<Student, CompareStudent> students;
students.insert({3, "Alice"});
students.insert({1, "Bob"});
students.insert({2, "Carol"});
```

此时学生按照 `id` 升序排列。

### 6.3 严格弱序

关联式容器要求比较器满足严格弱序。最基本的要求包括：

1. `comp(x, x)` 必须为 `false`；
2. 如果 `comp(a, b)` 为 `true`，则 `comp(b, a)` 必须为 `false`；
3. 比较关系必须具有传递性。

错误示例：

```cpp
struct BadCompare
{
    bool operator()(int left, int right) const
    {
        return left <= right;
    }
};
```

当 `left == right` 时，`left <= right` 为 `true`，违反了严格弱序，容器行为将不再可靠。

正确写法：

```cpp
return left < right;
```

### 6.4 容器如何判断两个键相等

树形关联式容器通常不要求键提供 `operator==`。

在比较器 `comp` 下，如果：

```cpp
!comp(a, b) && !comp(b, a)
```

容器就认为 `a` 和 `b` 等价。

这意味着在上面的学生集合中，只要两个学生的 `id` 相同，容器就认为它们是重复键，即使 `name` 不同。

## 七、map 与 set 综合示例

下面的程序集中演示去重、计数、范围查询和一键多值。

```cpp
#include <iostream>
#include <map>
#include <set>
#include <string>
#include <vector>

int main()
{
    std::vector<int> numbers{
        5, 3, 1, 3, 5, 2, 4, 2
    };

    std::set<int> uniqueNumbers(
        numbers.begin(),
        numbers.end());

    std::cout << "去重并排序：";
    for (int value : uniqueNumbers)
    {
        std::cout << value << ' ';
    }
    std::cout << '\n';

    std::vector<std::string> words{
        "apple",
        "banana",
        "apple",
        "orange",
        "banana",
        "apple"
    };

    std::map<std::string, int> counts;
    for (const std::string& word : words)
    {
        ++counts[word];
    }

    std::cout << "单词统计：\n";
    for (const auto& entry : counts)
    {
        std::cout << entry.first
                  << " -> "
                  << entry.second
                  << '\n';
    }

    std::multimap<std::string, std::string> employees;
    employees.insert({"研发部", "张三"});
    employees.insert({"研发部", "李四"});
    employees.insert({"市场部", "王五"});

    std::cout << "研发部员工：";
    auto range = employees.equal_range("研发部");
    for (auto it = range.first; it != range.second; ++it)
    {
        std::cout << it->second << ' ';
    }
    std::cout << '\n';

    return 0;
}
```

运行结果：

```text
去重并排序：1 2 3 4 5
单词统计：
apple -> 3
banana -> 2
orange -> 1
研发部员工：张三 李四
```

## 八、经典题目：前 K 个高频单词

对应题目：LeetCode 692，Top K Frequent Words。

题目要求：

1. 按照出现次数从高到低排列；
2. 次数相同时，按照单词字典序升序排列。

可以先使用 `map` 统计次数，再使用带自定义比较器的 `set` 排序。

```cpp
class Solution
{
private:
    using WordCount = std::pair<std::string, int>;

    struct Compare
    {
        bool operator()(
            const WordCount& left,
            const WordCount& right) const
        {
            if (left.second != right.second)
            {
                return left.second > right.second;
            }

            return left.first < right.first;
        }
    };

public:
    std::vector<std::string> topKFrequent(
        std::vector<std::string>& words,
        int k)
    {
        std::map<std::string, int> counts;

        for (const std::string& word : words)
        {
            ++counts[word];
        }

        std::set<WordCount, Compare> ranking(
            counts.begin(),
            counts.end());

        std::vector<std::string> result;

        for (const WordCount& item : ranking)
        {
            if (k == 0)
            {
                break;
            }

            result.push_back(item.first);
            --k;
        }

        return result;
    }
};
```

设输入单词总数为 `n`，不同单词数量为 `m`：

- 使用 `map` 统计：`O(n log m)`；
- 将 `m` 个键值对插入 `set`：`O(m log m)`；
- 总空间复杂度：`O(m)`。

这不是该题复杂度最低的解法，但非常适合练习 `map`、`set`、键值对和自定义比较器。

## 九、为什么不能直接使用普通二叉搜索树

普通二叉搜索树的查找、插入和删除复杂度取决于树高 `h`：

```text
O(h)
```

当数据随机且树接近平衡时：

```text
h ≈ log₂n
```

但如果按照升序插入：

```text
1 2 3 4 5 6 7
```

普通二叉搜索树会退化为单支树，树高变成 `n`，操作复杂度退化为 `O(n)`。

为了保证稳定的查找效率，必须在插入和删除过程中主动维护树的平衡。

常见平衡搜索树包括：

- AVL 树；
- 红黑树。

## 十、AVL 树

### 10.1 AVL 树的概念

AVL 树首先是一棵二叉搜索树，同时还满足：

- 左子树和右子树都是 AVL 树；
- 任意节点左右子树高度之差的绝对值不超过 `1`。

如果规定平衡因子为：

```text
bf = 右子树高度 - 左子树高度
```

那么 AVL 树中每个节点的平衡因子只能是：

```text
-1、0、1
```

### 10.2 AVL 节点

```cpp
template<class T>
struct AVLTreeNode
{
    explicit AVLTreeNode(const T& data)
        : left(nullptr)
        , right(nullptr)
        , parent(nullptr)
        , value(data)
        , bf(0)
    {
    }

    AVLTreeNode<T>* left;
    AVLTreeNode<T>* right;
    AVLTreeNode<T>* parent;
    T value;
    int bf;
};
```

保存父指针可以让插入后的平衡因子更新和旋转连接更加方便。

### 10.3 AVL 树的插入过程

AVL 树的插入分为两步：

1. 按照普通二叉搜索树的规则插入节点；
2. 从新节点的父节点开始向上更新平衡因子。

假设新节点为 `cur`，父节点为 `parent`：

- 插入到父节点左侧：`parent->bf--`；
- 插入到父节点右侧：`parent->bf++`。

更新后的平衡因子有三种情况：

| 更新结果 | 含义 | 后续处理 |
| --- | --- | --- |
| `bf == 0` | 子树高度没有增加 | 停止向上更新 |
| `bf == 1` 或 `bf == -1` | 子树高度增加但仍平衡 | 继续向上更新 |
| `bf == 2` 或 `bf == -2` | 当前子树失衡 | 旋转调整 |

### 10.4 AVL 树的四种旋转

| 失衡类型 | 插入位置 | 调整方式 |
| --- | --- | --- |
| LL | 较高左子树的左侧 | 右单旋 |
| RR | 较高右子树的右侧 | 左单旋 |
| LR | 较高左子树的右侧 | 先左旋，再右旋 |
| RL | 较高右子树的左侧 | 先右旋，再左旋 |

### 10.5 LL：右单旋

插入路径为“左、左”时，进行右单旋：

```text
        parent                 subL
        /    \                 /  \
     subL     c      ->       a   parent
     /  \                         /   \
    a  subLR                    subLR  c
```

关键步骤如下：

1. `subL` 的右子树交给 `parent` 作为左子树；
2. `parent` 成为 `subL` 的右孩子；
3. 重新连接原来的祖父节点；
4. 更新父指针和平衡因子。

### 10.6 RR：左单旋

RR 与 LL 对称：

```text
    parent                         subR
    /   \                          /  \
   a   subR          ->        parent  c
       /  \                    /   \
    subRL  c                  a   subRL
```

### 10.7 LR：先左旋再右旋

插入发生在左孩子的右子树中：

1. 先对左孩子进行左旋，将 LR 转换为 LL；
2. 再对失衡节点进行右旋。

### 10.8 RL：先右旋再左旋

插入发生在右孩子的左子树中：

1. 先对右孩子进行右旋，将 RL 转换为 RR；
2. 再对失衡节点进行左旋。

### 10.9 AVL 树的验证

验证一棵树是否为 AVL 树，需要同时检查：

1. 中序遍历是否严格有序；
2. 每个节点左右子树高度差是否不超过 `1`；
3. 保存的平衡因子是否与实际高度差一致。

```cpp
int Height(Node* root)
{
    if (root == nullptr)
    {
        return 0;
    }

    return 1 + std::max(
        Height(root->left),
        Height(root->right));
}

bool IsBalanced(Node* root)
{
    if (root == nullptr)
    {
        return true;
    }

    int leftHeight = Height(root->left);
    int rightHeight = Height(root->right);
    int actualBF = rightHeight - leftHeight;

    if (std::abs(actualBF) > 1 || actualBF != root->bf)
    {
        return false;
    }

    return IsBalanced(root->left)
        && IsBalanced(root->right);
}
```

这段验证代码会重复计算子树高度，最坏时间复杂度为 `O(n²)`。如果在一次后序遍历中同时返回高度和验证结果，可以优化到 `O(n)`。

### 10.10 AVL 树的性能

AVL 树的高度始终为 `O(log n)`，因此：

- 查找：`O(log n)`；
- 插入：`O(log n)`；
- 删除：`O(log n)`。

AVL 树追求严格平衡，查找效率很高，但插入和删除时可能需要更多的平衡维护。

## 十一、红黑树

### 11.1 红黑树的概念

红黑树是一棵近似平衡的二叉搜索树。每个节点额外保存一种颜色：

```cpp
enum class Color
{
    Red,
    Black
};
```

红黑树不像 AVL 树那样要求左右子树高度差不超过 `1`，而是通过颜色约束保证最长路径不会超过最短路径的两倍。

### 11.2 红黑树的五条性质

1. 每个节点不是红色就是黑色；
2. 根节点是黑色；
3. 红色节点的孩子必须是黑色，即不能出现连续红色节点；
4. 从任意节点出发，到所有后代空节点的路径包含相同数量的黑色节点；
5. 所有空节点 `NIL` 都视为黑色。

第四条性质中的黑色节点数量通常称为黑高。

### 11.3 为什么最长路径不超过最短路径的两倍

假设从某个节点到空节点的每条路径都包含 `bh` 个黑色节点：

- 最短路径可以全部由黑色节点组成，长度约为 `bh`；
- 最长路径可以在每两个黑色节点之间插入一个红色节点；
- 因为不能出现连续红色节点，所以最长路径至多约为 `2bh`。

因此：

```text
最长路径长度 <= 2 × 最短路径长度
```

红黑树的高度始终为 `O(log n)`。

### 11.4 红黑树节点

```cpp
template<class T>
struct RBTreeNode
{
    explicit RBTreeNode(
        const T& data,
        Color color = Color::Red)
        : left(nullptr)
        , right(nullptr)
        , parent(nullptr)
        , value(data)
        , color(color)
    {
    }

    RBTreeNode<T>* left;
    RBTreeNode<T>* right;
    RBTreeNode<T>* parent;
    T value;
    Color color;
};
```

### 11.5 为什么新节点默认插入为红色

如果新节点插入为黑色，那么经过新节点的所有路径都会增加一个黑色节点，立即破坏“每条路径黑高相同”的性质，调整范围可能很大。

如果新节点插入为红色：

- 不会改变任何路径的黑高；
- 只有父节点也是红色时，才会出现连续红色冲突。

因此，将新节点默认设为红色，通常需要处理的问题更局部。

如果插入的是根节点，最后再将根节点改为黑色。

### 11.6 红黑树插入的角色

插入调整中常用四个指针：

- `cur`：当前节点；
- `parent`：父节点；
- `grandparent`：祖父节点；
- `uncle`：叔叔节点。

只有当 `parent` 为红色时才需要调整，因为这违反了不能出现连续红色节点的性质。

### 11.7 情况一：叔叔节点为红色

已知：

- `cur` 为红色；
- `parent` 为红色；
- `grandparent` 为黑色；
- `uncle` 存在且为红色。

处理方式：

1. 将 `parent` 和 `uncle` 改为黑色；
2. 将 `grandparent` 改为红色；
3. 将 `grandparent` 作为新的 `cur`；
4. 继续向上检查。

如果 `grandparent` 最终成为根节点，需要把根重新改为黑色。

### 11.8 情况二：叔叔为黑色，节点在外侧

以父节点是祖父节点左孩子为例：

- `parent` 是 `grandparent` 的左孩子；
- `cur` 是 `parent` 的左孩子；
- `uncle` 不存在或为黑色。

这是 LL 结构，处理方式为：

1. 将 `parent` 改为黑色；
2. 将 `grandparent` 改为红色；
3. 对 `grandparent` 进行右单旋。

右侧 RR 情况与之对称，需要进行左单旋。

### 11.9 情况三：叔叔为黑色，节点在内侧

以 LR 结构为例：

- `parent` 是 `grandparent` 的左孩子；
- `cur` 是 `parent` 的右孩子。

处理方式：

1. 先对 `parent` 左旋；
2. 将结构转换为 LL；
3. 再按照情况二处理。

RL 情况与之对称。

### 11.10 红黑树插入调整总结

| 父节点位置 | 当前节点位置 | 叔叔颜色 | 操作 |
| --- | --- | --- | --- |
| 左 | 左 | 黑或不存在 | 祖父右旋，父黑祖父红 |
| 左 | 右 | 黑或不存在 | 父左旋，再按 LL 处理 |
| 右 | 右 | 黑或不存在 | 祖父左旋，父黑祖父红 |
| 右 | 左 | 黑或不存在 | 父右旋，再按 RR 处理 |
| 任意 | 任意 | 红 | 父叔变黑，祖父变红，继续向上 |

调整结束后，必须确保根节点为黑色。

### 11.11 红黑树的验证

验证过程包括：

1. 根节点是否为黑色；
2. 中序遍历是否有序；
3. 是否存在连续红色节点；
4. 每条根到空节点的路径黑高是否相同。

下面展示验证红色冲突和黑高的核心逻辑：

```cpp
bool Check(
    Node* root,
    int currentBlackCount,
    int expectedBlackCount)
{
    if (root == nullptr)
    {
        return currentBlackCount == expectedBlackCount;
    }

    if (root->color == Color::Black)
    {
        ++currentBlackCount;
    }

    if (root->color == Color::Red
        && root->parent != nullptr
        && root->parent->color == Color::Red)
    {
        return false;
    }

    return Check(
               root->left,
               currentBlackCount,
               expectedBlackCount)
        && Check(
               root->right,
               currentBlackCount,
               expectedBlackCount);
}
```

实际验证时，可以先沿一条路径计算基准黑高，再调用递归函数检查所有路径。

## 十二、AVL 树与红黑树对比

| 对比项 | AVL 树 | 红黑树 |
| --- | --- | --- |
| 平衡程度 | 严格平衡 | 近似平衡 |
| 高度 | 通常更低 | 可能略高 |
| 查找性能 | 通常略好 | 稳定高效 |
| 插入、删除调整 | 可能更频繁 | 通常更少 |
| 约束方式 | 平衡因子 | 颜色和黑高 |
| 典型用途 | 查询密集场景 | 增删查综合场景 |

两者的查找、插入和删除复杂度都是 `O(log n)`。

STL 中的 `map` 和 `set` 需要同时兼顾查找、插入、删除和迭代器稳定性，因此常见实现选择红黑树。

需要注意，C++ 标准规定的是接口语义和复杂度，不强制某个实现必须使用红黑树；只是主流标准库通常采用红黑树。

## 十三、红黑树如何同时实现 map 和 set

### 13.1 核心问题

`set` 保存：

```cpp
Key
```

`map` 保存：

```cpp
std::pair<const Key, Value>
```

两者的节点值类型不同，但查找和排序时都只需要获得键。

因此，可以将红黑树抽象成：

```cpp
template<
    class Key,
    class ValueType,
    class KeyOfValue>
class RBTree;
```

三个模板参数分别表示：

- `Key`：键的类型；
- `ValueType`：节点实际保存的类型；
- `KeyOfValue`：从节点值中提取键的仿函数。

### 13.2 set 的键提取器

`set` 的节点值本身就是键：

```cpp
template<class Key>
struct SetKeyOfValue
{
    const Key& operator()(const Key& value) const
    {
        return value;
    }
};
```

红黑树类型可以表示为：

```cpp
RBTree<Key, Key, SetKeyOfValue<Key>>
```

### 13.3 map 的键提取器

`map` 从键值对的 `first` 中提取键：

```cpp
template<class Key, class Value>
struct MapKeyOfValue
{
    using Pair = std::pair<const Key, Value>;

    const Key& operator()(const Pair& value) const
    {
        return value.first;
    }
};
```

红黑树类型可以表示为：

```cpp
RBTree<
    Key,
    std::pair<const Key, Value>,
    MapKeyOfValue<Key, Value>>
```

这样，`map` 和 `set` 就可以复用同一套红黑树的插入、删除、查找和迭代器逻辑。

## 十四、红黑树迭代器原理

### 14.1 begin 和 end

对红黑树进行中序遍历可以得到有序序列，因此：

- `begin()` 指向最左侧节点，也就是最小元素；
- `end()` 指向一个不保存有效元素的哨兵节点。

不能简单地让 `end()` 等于 `nullptr`，因为双向迭代器需要支持：

```cpp
--container.end()
```

结果应当指向容器中的最后一个元素。

常见实现会增加一个头哨兵节点：

- 哨兵的 `parent` 指向根节点；
- 哨兵的 `left` 指向最小节点；
- 哨兵的 `right` 指向最大节点；
- `end()` 指向哨兵。

### 14.2 operator++ 的原理

寻找当前节点在中序遍历中的后继：

1. 如果存在右子树，后继是右子树的最左节点；
2. 如果不存在右子树，向上查找；
3. 找到第一个“当前节点位于其左子树”的祖先；
4. 该祖先就是后继。

核心逻辑：

```cpp
void Increment()
{
    if (_node->right != nullptr)
    {
        _node = _node->right;

        while (_node->left != nullptr)
        {
            _node = _node->left;
        }
    }
    else
    {
        Node* parent = _node->parent;

        while (_node == parent->right)
        {
            _node = parent;
            parent = parent->parent;
        }

        _node = parent;
    }
}
```

完整实现还要结合头哨兵处理边界。

### 14.3 operator-- 的原理

寻找当前节点的中序前驱：

1. 如果当前是 `end()`，直接移动到最大节点；
2. 如果存在左子树，前驱是左子树的最右节点；
3. 如果不存在左子树，向上查找；
4. 找到第一个“当前节点位于其右子树”的祖先。

`operator++` 和 `operator--` 互为对称操作。

## 十五、复杂度与迭代器失效

### 15.1 常用接口复杂度

| 操作 | `map` / `set` | `multimap` / `multiset` |
| --- | --- | --- |
| `find` | `O(log n)` | `O(log n)` |
| `insert` | `O(log n)` | `O(log n)` |
| 按迭代器 `erase` | 均摊 `O(1)` | 均摊 `O(1)` |
| 按键 `erase` | `O(log n)` | `O(log n + k)` |
| `lower_bound` | `O(log n)` | `O(log n)` |
| `upper_bound` | `O(log n)` | `O(log n)` |
| `count` | `O(log n)` | `O(log n + k)` |

其中 `k` 表示与目标键等价的元素数量。

### 15.2 迭代器失效规则

对于树形关联式容器：

- 插入元素通常不会使已有迭代器失效；
- 删除某个元素，只会使指向该元素的迭代器失效；
- 其他元素的迭代器通常仍然有效。

安全的遍历删除方式：

```cpp
for (auto it = values.begin(); it != values.end();)
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

不能在删除后继续使用原来的失效迭代器。

## 十六、常见错误

### 16.1 使用 operator[] 判断键是否存在

错误写法：

```cpp
if (counts["apple"] != 0)
{
    // ...
}
```

当键不存在时，这段代码会插入 `"apple"`。

正确做法：

```cpp
if (counts.find("apple") != counts.end())
{
    // ...
}
```

### 16.2 认为 insert 会覆盖旧值

```cpp
std::map<std::string, int> scores;
scores.insert({"Tom", 80});
scores.insert({"Tom", 100});
```

最终仍然是 `80`。

需要覆盖时使用：

```cpp
scores["Tom"] = 100;
```

### 16.3 直接修改 set 元素或 map 的键

这两种操作都会破坏红黑树排序，因此标准接口禁止修改。

### 16.4 比较器使用小于等于

`<=` 不满足严格弱序，必须使用严格比较关系。

### 16.5 忘记检查 find 的返回值

错误写法：

```cpp
auto it = scores.find("Alice");
std::cout << it->second << '\n';
```

当键不存在时，`it == scores.end()`，解引用会产生未定义行为。

### 16.6 混淆 map 和 multimap

如果同一个键需要保存多个映射值，应使用 `multimap`，或者使用：

```cpp
std::map<Key, std::vector<Value>>
```

两者的使用方式和数据语义不同，需要根据业务需求选择。

## 十七、常见面试问题

### 17.1 map 和 set 的区别是什么？

`set` 只保存唯一键，主要用于查找、去重和有序集合；`map` 保存唯一键与映射值，用于建立映射关系。

### 17.2 map 和 unordered_map 的区别是什么？

`map` 通常使用红黑树，元素有序，操作复杂度为 `O(log n)`；`unordered_map` 使用哈希表，元素通常无序，平均操作复杂度为 `O(1)`，最坏为 `O(n)`。

### 17.3 为什么 map 的 key 不能修改？

键决定节点在红黑树中的位置。直接修改键会导致树的结构与排序规则不一致。

### 17.4 map 的 operator[] 有什么副作用？

当键不存在时，它会插入一个使用默认映射值构造的新元素，因此不能把它当成完全只读的查找接口。

### 17.5 map 中的元素类型是什么？

```cpp
std::pair<const Key, T>
```

其中键为 `const`，映射值可以修改。

### 17.6 为什么 multimap 没有 operator[]？

因为同一个键可以对应多个映射值，无法确定应该返回哪一个值的引用。

### 17.7 为什么 set 的迭代器不能修改元素？

`set` 的元素本身就是排序键，修改它会破坏红黑树的有序性。

### 17.8 红黑树为什么比普通二叉搜索树稳定？

红黑树通过颜色和黑高约束限制树高，保证高度为 `O(log n)`，不会因为有序插入而退化成单支树。

### 17.9 AVL 树和红黑树有什么区别？

AVL 树更加平衡，查询通常更快；红黑树调整更宽松，插入和删除通常需要更少旋转，更适合综合增删查场景。

### 17.10 为什么红黑树新节点默认是红色？

红色节点不会增加路径黑高，只可能产生局部的连续红色冲突；如果默认插入黑色节点，会直接改变相关路径的黑高，调整更加困难。

### 17.11 map 和 set 的底层一定是红黑树吗？

不一定。C++ 标准没有强制具体底层结构，只规定容器行为和复杂度。主流标准库通常使用红黑树实现。

### 17.12 如何利用同一棵红黑树实现 map 和 set？

让红黑树接收节点值类型和键提取器：

- `set` 的节点值就是键；
- `map` 的节点值是键值对，从 `first` 中提取键。

这样两种容器可以复用红黑树的绝大部分实现。

## 十八、总结

本文需要重点掌握以下内容：

1. `map` 和 `set` 属于有序关联式容器；
2. `set` 保存唯一键，`map` 保存唯一键与映射值；
3. `multiset` 和 `multimap` 允许键重复；
4. `map` 的元素类型是 `pair<const Key, T>`；
5. `set` 元素和 `map` 的键不能修改；
6. `map::operator[]` 在键不存在时会插入默认值；
7. `find` 和 `at` 不会因为键不存在而插入元素；
8. 有序关联式容器支持 `lower_bound`、`upper_bound` 和范围查询；
9. 自定义比较器必须满足严格弱序；
10. 普通二叉搜索树可能退化，AVL 树和红黑树通过平衡约束控制树高；
11. AVL 树严格平衡，红黑树近似平衡；
12. 红黑树插入的核心操作是变色和旋转；
13. 红黑树新节点默认设为红色，可以避免直接改变路径黑高；
14. `map` 和 `set` 可以通过节点值类型与键提取器复用同一棵红黑树；
15. 掌握这些内容有助于深入理解 STL 关联式容器、迭代器和泛型设计。

