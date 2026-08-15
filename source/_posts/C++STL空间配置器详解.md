---
title: C++ STL空间配置器详解：allocator、内存池与SGI二级配置器
date: 2026-08-15 16:00:00
categories:
  - C++
tags:
  - C++
  - STL
  - allocator
  - 内存池
  - 空间配置器
  - 内存管理
---

STL 容器不仅要组织元素，还要获取原始存储、在存储上构造对象、销毁对象并归还存储。分配器（allocator）把这些底层步骤从容器的数据结构逻辑中分离出来，使容器能够适配不同内存来源和资源策略。

经典教材常以 SGI STL 的一级、二级空间配置器为例，讲解小对象内存池、尺寸分类自由链表和内存不足处理。这套设计非常有学习价值，但它是特定历史实现，不是 C++ 标准要求。本文会同时讲清标准 allocator 模型与 SGI 实现思想，避免把源码细节误认为语言规则。

<!-- more -->

## 一、什么是空间配置器

“空间配置器”是早期中文资料对 allocator 的常见翻译。现代语境通常直接称为“分配器”。

它服务于容器的底层存储管理，核心职责可以概括为：

```text
申请一段满足大小和对齐要求的原始存储
                    |
                    v
在指定地址上构造对象
                    |
                    v
使用对象
                    |
                    v
调用对象析构函数
                    |
                    v
归还原始存储
```

需要特别区分两组概念：

```text
分配存储 != 构造对象
销毁对象 != 释放存储
```

这正是理解 STL 容器内存管理的起点。

## 二、为什么容器不能只写 `new T[n]`

假设 `vector` 的容量为 10，但当前只有 3 个有效元素：

```text
size = 3
capacity = 10

[对象][对象][对象][原始存储][原始存储]...[原始存储]
```

如果直接执行 `new T[10]`，十个对象会全部被默认构造，这会带来问题：

- `T` 可能没有默认构造函数；
- 只需要三个对象，却构造了十个；
- 扩容时难以精确控制移动、复制和回滚；
- `size` 与已构造对象数量无法自然分离。

正确思路是：

1. 先申请足以容纳 10 个 `T` 的原始存储；
2. 只在前三个位置构造对象；
3. 插入新元素时，在下一个未初始化位置构造；
4. 删除元素时，析构对应对象但不一定立即释放整段存储；
5. 容器销毁或扩容后，再归还原始存储。

allocator 模型正是为这种需求服务。

## 三、直接频繁分配小块内存的问题

节点式容器可能为每个元素分别分配节点：

```text
list node
├── prev
├── next
└── value
```

如果每次都直接调用通用堆分配器，可能出现：

- 分配与释放调用频繁；
- 通用分配器元数据产生额外开销；
- 小块内存在堆上分散，局部性较差；
- 产生外部碎片；
- 并发分配可能发生锁竞争；
- 容器代码重复处理分配逻辑；
- 自定义内存来源难以接入。

但不能简单断言标准 `new` 或 `malloc` 一定很慢。现代系统分配器通常已经包含线程缓存、尺寸分类和内存池。是否需要自定义分配器，必须通过目标平台的实际测量判断。

## 四、`new` 表达式做了什么

```cpp
Widget* object = new Widget(argument);
```

概念上包含：

1. 调用合适的 `operator new` 获取原始存储；
2. 在该地址上执行 `Widget` 构造函数；
3. 构造成功后返回对象指针；
4. 构造失败时，调用匹配的 `operator delete` 归还刚申请的存储，再传播异常。

```cpp
delete object;
```

概念上包含：

1. 调用 `Widget` 析构函数；
2. 调用匹配的 `operator delete` 释放存储。

allocator 把这两阶段能力拆分出来，让容器分别控制对象数量和存储容量。

## 五、原始存储与对象生命周期

### 5.1 申请存储不代表对象已经存在

```cpp
void* memory = ::operator new(sizeof(Widget));
```

这里只得到满足要求的原始存储，还没有构造 `Widget`。

### 5.2 定位 `new`（placement new）构造对象

```cpp
#include <new>

Widget* object = new (memory) Widget(argument);
```

定位 `new` 不再分配内存，而是在调用者给定的地址上开始对象构造。

### 5.3 显式析构

```cpp
object->~Widget();
```

显式调用析构函数会结束对象生命周期，但不会自动归还原始存储。

### 5.4 最后释放存储

```cpp
::operator delete(memory);
```

顺序必须正确：

```text
allocate -> construct -> use -> destroy -> deallocate
```

## 六、C++11标准分配器接口

标准容器通常把分配器作为模板参数：

```cpp
template <class T,
          class Allocator = std::allocator<T>>
class vector;
```

### 6.1 `std::allocator<T>`

```cpp
#include <memory>

std::allocator<Widget> allocator;

Widget* storage = allocator.allocate(3);
```

`allocate(3)` 获得能容纳三个 `Widget` 的未初始化存储，不会自动调用三个构造函数。

### 6.2 使用 `allocator_traits`

C++11 推荐容器通过 `std::allocator_traits` 与分配器交互：

```cpp
using Allocator = std::allocator<Widget>;
using Traits = std::allocator_traits<Allocator>;

Allocator allocator;
Widget* storage = Traits::allocate(allocator, 3);

Traits::construct(allocator, storage, argument);
Traits::destroy(allocator, storage);

Traits::deallocate(allocator, storage, 3);
```

`allocator_traits` 可以：

- 为分配器补充默认类型信息；
- 统一调用 `allocate` 和 `deallocate`；
- 适配 `construct` 和 `destroy`；
- 完成分配器类型重绑定；
- 读取复制、移动和交换传播策略。

### 6.3 异常安全

如果连续构造多个对象时中途失败，已经构造成功的对象必须逆序销毁，最后再释放整段存储：

```cpp
Widget* storage = Traits::allocate(allocator, count);
std::size_t constructed = 0;

try
{
    for (; constructed < count; ++constructed)
    {
        Traits::construct(
            allocator,
            storage + constructed,
            source[constructed]);
    }
}
catch (...)
{
    while (constructed > 0)
    {
        --constructed;
        Traits::destroy(
            allocator,
            storage + constructed);
    }

    Traits::deallocate(allocator, storage, count);
    throw;
}
```

标准容器已经实现了这些复杂逻辑，普通业务代码不需要重新造轮子。

## 七、分配器重绑定

用户写的是：

```cpp
std::list<int, MyAllocator<int>> values;
```

但 `list` 底层真正分配的通常不是单独的 `int`，而是包含链接字段的内部节点：

```cpp
struct Node
{
    Node* previous;
    Node* next;
    int value;
};
```

容器需要把 `MyAllocator<int>` 转换为能分配 `Node` 的分配器：

```cpp
using NodeAllocator =
    typename std::allocator_traits<
        MyAllocator<int>>::template rebind_alloc<Node>;
```

这就是 rebind 的作用。

现代容器内部通常通过 `allocator_traits` 完成，不要求用户手工操作。

## 八、标准要求与具体实现必须分开

讲分配器时要区分三层：

### 8.1 标准层

规定：

- 分配器与容器如何交互；
- 分配和释放的基本契约；
- 传播规则；
- 对齐和类型要求；
- 容器可观察行为。

### 8.2 标准库实现层

不同实现可能选择：

- 直接调用全局 `operator new`；
- 接入系统分配器；
- 针对节点或线程做优化；
- 使用不同调试和安全机制。

### 8.3 经典 SGI STL 层

旧 SGI STL 采用一级和二级空间配置器，并用 128 字节分界、8 字节尺寸对齐和 16 条自由链表管理小块。

这些是具体实现策略，不是所有标准库都必须照搬的规定。

## 九、SGI STL一级空间配置器

经典 SGI 一级配置器主要包装 `malloc` 和 `free`，用于大块内存或二级配置器的后备路径。

```text
allocate(n)
    |
    +-- malloc(n) 成功 --> 返回
    |
    +-- 失败 --> 调用自定义 OOM 处理函数
                    |
                    +-- 处理后重试 malloc
                    |
                    +-- 没有处理函数 --> 抛出 bad_alloc
```

### 9.1 与 `std::set_new_handler` 的关系

标准 `operator new` 可以配合 `std::set_new_handler`。SGI 一级配置器中常见的是它自己维护的 malloc 失败处理函数，思想类似，但不能简单等同为标准 `new_handler` 的直接实现。

### 9.2 OOM处理器必须真正改善条件

失败处理函数可以尝试：

- 释放备用内存；
- 清理缓存；
- 记录诊断；
- 抛出异常或终止。

如果处理函数什么也不做却不断返回，分配器可能陷入无意义重试循环。

## 十、SGI STL二级空间配置器

经典实现把不大于 128 字节的请求视为小块，并向上舍入到 8 的倍数：

```text
请求大小:  1..8   -> 8
           9..16  -> 16
          17..24  -> 24
             ...
         121..128 -> 128
```

于是形成 16 个尺寸类别：

```text
8, 16, 24, ..., 128
```

每个尺寸类别对应一条自由链表：

```text
free_list[0]  -> 8字节块  -> 8字节块  -> ...
free_list[1]  -> 16字节块 -> 16字节块 -> ...
...
free_list[15] -> 128字节块 -> ...
```

有些讲义把它形容为“哈希桶”，因为会由请求大小快速映射到数组下标。但更准确的术语是：

```text
按尺寸分类的分离式自由链表
```

它不对任意键计算普通哈希，也不处理键冲突。

## 十一、尺寸对齐与索引计算

经典实现常使用：

```cpp
static std::size_t round_up(std::size_t bytes)
{
    return (bytes + 7) & ~std::size_t(7);
}

static std::size_t free_list_index(std::size_t bytes)
{
    return (bytes + 7) / 8 - 1;
}
```

例如：

```text
请求 1 字节  -> 8 字节类，索引 0
请求 8 字节  -> 8 字节类，索引 0
请求 9 字节  -> 16 字节类，索引 1
请求 128 字节 -> 128 字节类，索引 15
```

位运算舍入要求对齐值为 2 的幂。

### 11.1 内部碎片

请求 9 字节却分配 16 字节，多出的 7 字节属于内部碎片。

尺寸分类是在“分类数量”和“单块浪费”之间折中：

- 类别越密，内部浪费越少，但链表和管理成本更高；
- 类别越稀，查找简单，但舍入浪费更大。

### 11.2 对齐不是永远固定为8

旧实现选择 8 字节有当时的 ABI 和目标类型背景。现代分配器必须满足所分配类型的对齐要求。

如果类型需要更高对齐：

```cpp
struct alignas(32) VectorRegister
{
    unsigned char data[32];
};
```

只保证 8 字节对齐的旧池不能直接安全承载该类型。

C++17 对过度对齐动态分配提供了更明确的语言支持；在 C++11 自定义池中必须自行处理平台对齐接口。

## 十二、自由链表节点为什么使用联合体

经典实现使用类似结构：

```cpp
union FreeNode
{
    FreeNode* next;
    unsigned char client_data[1];
};
```

当内存块处于空闲状态时：

```text
块头部保存 next 指针
```

当内存块交给用户时：

```text
整块空间供用户使用
```

同一段字节在不同生命周期阶段承担不同角色，从而不需要额外为每个空闲块分配链表节点。

这是一种侵入式自由链表设计。

### 12.1 最小块大小

自由块至少要能容纳一个指针。若尺寸类别比指针还小，链表链接字段无法存放。

在 64 位环境中指针通常为 8 字节，这也是现代实现设计最小块尺寸时必须考虑的因素。

## 十三、小块申请流程

假设请求 `n <= 128`：

```text
将 n 向上舍入到尺寸类别
        |
计算自由链表下标
        |
对应链表是否非空？
   |                 |
  是                否
   |                 |
摘下首块返回      refill 补充该尺寸类别
```

典型伪代码：

```cpp
void* allocate_small(std::size_t bytes)
{
    const std::size_t size = round_up(bytes);
    const std::size_t index = free_list_index(size);

    FreeNode* result = free_lists[index];

    if (result == nullptr)
    {
        return refill(size);
    }

    free_lists[index] = result->next;
    return result;
}
```

从非空自由链表取首块通常是 O(1)。

## 十四、`refill` 如何补充自由链表

经典 SGI 策略会尝试一次从内存池取得多个同尺寸块，常见初始数量为 20：

```text
取得 N 个块
    |
第 1 块直接返回给本次调用
    |
剩余块串成自由链表
```

简化逻辑：

```cpp
void* refill(std::size_t block_size)
{
    int block_count = 20;
    unsigned char* chunk =
        chunk_alloc(block_size, block_count);

    if (block_count == 1)
    {
        return chunk;
    }

    // 第一块返回，其他块链接到对应自由链表
    link_remaining_blocks(
        chunk + block_size,
        block_size,
        block_count - 1);

    return chunk;
}
```

“20”是旧实现的批量策略，不是标准常量。现代池通常根据尺寸、历史负载和线程模型选择批量大小。

## 十五、`chunk_alloc` 的三种情况

设：

```text
block_size = 单块大小
block_count = 希望取得的块数
total_bytes = block_size * block_count
bytes_left = 当前池剩余字节数
```

### 15.1 池空间足够

```text
bytes_left >= total_bytes
```

直接切出完整批次，并移动池起始指针。

### 15.2 只能提供部分块

```text
block_size <= bytes_left < total_bytes
```

计算实际能提供的块数，返回部分批次。

### 15.3 连一块都不足

```text
bytes_left < block_size
```

典型旧实现会：

1. 把仍可利用的尾部字节挂入对应尺寸自由链表；
2. 按增长公式向系统申请更大内存；
3. 申请成功后更新池边界并重新执行分配；
4. 系统申请失败时，尝试从更大尺寸自由链表拆借一块；
5. 仍失败则交给一级配置器处理。

### 15.4 为什么使用递归重试

池边界或可用来源更新后，重新进入同一决策流程可以复用逻辑。递归深度通常由有限的补充状态约束，但生产实现仍需要确保失败路径不会无限递归。

## 十六、池增长策略

旧 SGI 代码常见类似公式：

```text
bytes_to_get = 2 * total_bytes
             + round_up(heap_size / 16)
```

含义是：

- 至少补充本次目标批量的两倍；
- 随历史堆使用量增加额外增长；
- 减少后续向系统申请次数。

这是一种启发式策略，不代表任何场景下都最优。

池增长太快会保留大量未使用内存，增长太慢又会频繁访问系统分配器。合理参数必须结合实际对象尺寸分布和负载测量。

## 十七、内存不足时的后备策略

如果向系统申请新块失败，经典实现会扫描更大尺寸的自由链表：

```text
当前需要 32 字节
    |
检查 32、40、48...128 字节自由链表
    |
找到一块更大空闲块
    |
把它作为新的池区间并重试切分
```

这样可能从未使用的较大空闲块中回收机会。

如果仍然失败，再调用一级配置器的 OOM 处理流程。

这个设计体现了：

- 优先复用进程已经取得的内存；
- 再向系统请求；
- 最终按统一策略报告失败。

## 十八、小块释放流程

释放时必须知道原块对应的尺寸类别：

```cpp
void deallocate_small(void* pointer,
                      std::size_t bytes)
{
    const std::size_t size = round_up(bytes);
    const std::size_t index = free_list_index(size);

    FreeNode* node =
        static_cast<FreeNode*>(pointer);

    node->next = free_lists[index];
    free_lists[index] = node;
}
```

块不会立即交还操作系统，而是放回对应自由链表，供后续相同尺寸请求复用。

### 18.1 为什么必须传入正确大小

如果把 32 字节块错误地按 64 字节归还，它会进入错误自由链表。之后调用者可能把这块实际只有 32 字节的内存当成 64 字节使用，直接造成越界和内存破坏。

自定义池通常会通过以下方式降低风险：

- 块头保存尺寸类别；
- 每个 slab 只服务一个固定尺寸；
- 由类型专用池推导大小；
- 调试模式加入魔数和边界检查。

### 18.2 保留内存不一定是泄漏

池把空闲块保留给后续复用时，进程常驻内存可能不下降，但资源仍然可由池管理和再次分配。

这与“失去所有引用、再也无法使用”的真正泄漏不同。不过，池无限增长或生命周期设计不当仍会造成实际内存问题。

## 十九、空间分配与对象构造分离

旧 SGI 的 `simple_alloc<T, Alloc>` 只负责把元素数量换算成字节数量：

```cpp
template <class T, class RawAllocator>
class SimpleAllocator
{
public:
    static T* allocate(std::size_t count)
    {
        if (count == 0)
        {
            return nullptr;
        }

        return static_cast<T*>(
            RawAllocator::allocate(
                count * sizeof(T)));
    }

    static void deallocate(T* pointer,
                           std::size_t count)
    {
        if (count != 0)
        {
            RawAllocator::deallocate(
                pointer,
                count * sizeof(T));
        }
    }
};
```

它只管理存储，不调用 `T` 的构造和析构。

对象构造通常由定位 `new` 完成：

```cpp
template <class T, class... Args>
void construct(T* pointer, Args&&... args)
{
    new (static_cast<void*>(pointer))
        T(std::forward<Args>(args)...);
}
```

销毁：

```cpp
template <class T>
void destroy(T* pointer)
{
    pointer->~T();
}
```

现代标准容器应通过 `allocator_traits` 完成这些适配。

## 二十、平凡析构与类型萃取

对于 `int` 等平凡类型，逐个调用伪析构通常没有实际工作；对于 `std::string` 等非平凡类型，必须执行析构函数释放内部资源。

实现可以通过类型萃取选择策略：

```cpp
#include <type_traits>

std::is_trivially_destructible<T>::value
```

概念上：

```text
平凡析构类型 -> 可以跳过逐元素清理工作
非平凡类型   -> 必须逐个调用析构函数
```

普通业务代码不要仅凭“这个类看起来没有资源”就跳过析构，应让标准容器和类型系统决定。

## 二十一、`list` 如何结合节点分配器

链表的插入过程可以拆成：

```text
用节点分配器申请 Node 原始存储
            |
构造 Node 中的 value
            |
设置 prev 和 next
            |
链接到链表
```

删除过程：

```text
从链表解除节点链接
        |
析构 Node 中的 value
        |
把 Node 存储归还节点分配器
```

简化结构：

```cpp
template <class T, class Allocator>
class SimpleList
{
    struct Node
    {
        Node* previous;
        Node* next;
        T value;
    };

    using NodeAllocator =
        typename std::allocator_traits<
            Allocator>::template rebind_alloc<Node>;
};
```

### 21.1 创建节点的异常安全

如果节点存储申请成功，但 `T` 的构造函数抛异常，必须立即归还节点存储：

```cpp
Node* node = NodeTraits::allocate(allocator_, 1);

try
{
    NodeTraits::construct(
        allocator_, node, value);
}
catch (...)
{
    NodeTraits::deallocate(allocator_, node, 1);
    throw;
}
```

只有对象构造成功后，才能把节点正式链接进容器。

## 二十二、`vector` 如何使用分配器

扩容时的大致流程：

```text
申请更大原始存储
        |
在新存储中移动构造或复制构造旧元素
        |
若中途异常，销毁已构造的新元素并释放新存储
        |
全部成功后，销毁旧元素并释放旧存储
        |
更新 begin、end、capacity 指针
```

如果元素的移动构造可能抛异常，而复制构造可用，`vector` 可能选择复制以维持更强的异常保证。

这也是正确标记移动构造 `noexcept` 可能影响容器策略的原因。

## 二十三、分配器状态与传播

分配器可能无状态：

```cpp
std::allocator<int>
```

也可能携带状态：

- 指向某个内存池；
- NUMA 节点编号；
- 共享内存区域句柄；
- 调试统计上下文；
- 设备内存上下文。

容器复制、移动赋值或交换时，要决定是否把分配器状态一起传播。

C++11 allocator traits 包含相关策略：

- `propagate_on_container_copy_assignment`；
- `propagate_on_container_move_assignment`；
- `propagate_on_container_swap`；
- `select_on_container_copy_construction`。

如果两个容器的状态分配器不相等，又禁止传播，容器可能不能简单交换内部指针，因为一方最终可能用错误的分配器释放另一方的存储。

## 二十四、分配器的线程安全

必须分层讨论：

1. 不同分配器实例是否共享同一个池？
2. 自由链表头是否会被多个线程同时修改？
3. 是否使用锁、原子操作或线程本地缓存？
4. 对象构造和业务数据是否由其他同步机制保护？

经典 SGI 配置器的线程策略与版本、宏和模板参数有关，不能简单概括为“二级配置器天然线程安全”。

### 24.1 常见并发策略

- 一把全局锁：简单，但竞争大；
- 每个尺寸类一把锁：降低不同尺寸间竞争；
- 线程本地自由链表：热路径低竞争；
- 中央缓存加线程缓存：批量交换；
- 无锁链表：需要处理 ABA、内存回收等复杂问题。

自定义并发分配器远比单线程自由链表复杂。

## 二十五、内存池的优势

在匹配的负载下，内存池可能带来：

- O(1) 自由链表获取和归还；
- 减少系统分配调用；
- 降低每块元数据开销；
- 改善局部性；
- 降低外部碎片；
- 支持批量释放；
- 更稳定的延迟；
- 便于统计、限额和故障注入。

## 二十六、内存池的代价

- 尺寸舍入产生内部碎片；
- 空闲内存可能长期滞留在池中；
- 多线程同步复杂；
- 错误尺寸归还会破坏链表；
- 对齐和过度对齐类型难处理；
- 跨池释放可能崩溃；
- 调试工具看到的行为更复杂；
- 对象生命周期仍需单独正确管理；
- 工作负载变化时固定策略可能失效。

内存池不是“必然更快”的通用答案。

## 二十七、常见内存池类型

### 27.1 固定大小对象池

所有块大小相同，适合连接对象、任务节点等固定类型。

优点是逻辑简单，释放时无需额外查询尺寸类别。

### 27.2 分离尺寸类池

类似经典 SGI 二级配置器，为多个离散尺寸分别维护自由链表。

适合小块尺寸分布较广的通用分配。

### 27.3 单调分配器

只向前分配，不单独释放每个对象，最终一次性释放整片区域。

适合：

- 请求级临时对象；
- 编译器语法树；
- 一批对象生命周期完全相同的场景。

### 27.4 slab或页式池

按页向系统申请，每个 slab 服务一种对象或尺寸类，便于批量管理和缓存局部性优化。

## 二十八、C++17的PMR补充

C++17 引入 `<memory_resource>`，把分配策略更多地放到运行时对象中：

- `std::pmr::memory_resource`；
- `std::pmr::polymorphic_allocator`；
- `std::pmr::monotonic_buffer_resource`；
- `std::pmr::unsynchronized_pool_resource`；
- `std::pmr::synchronized_pool_resource`。

它解决了传统 allocator 类型成为容器模板参数、不同分配器类型不易统一传递等部分问题。

但 PMR 不属于 C++11。严格使用 C++11 的项目仍需使用传统 allocator 模型或项目自定义资源接口。

## 二十九、一个可编译的C++11自定义分配器

下面实现一个教学用统计分配器。它不实现内存池，只用于展示 allocator 与容器如何协作。

```cpp
#include <cstddef>
#include <limits>
#include <memory>
#include <new>
#include <utility>

struct AllocationStatistics
{
    static std::size_t allocations;
    static std::size_t deallocations;
    static std::size_t constructions;
    static std::size_t destructions;
};

std::size_t AllocationStatistics::allocations = 0;
std::size_t AllocationStatistics::deallocations = 0;
std::size_t AllocationStatistics::constructions = 0;
std::size_t AllocationStatistics::destructions = 0;

template <class T>
class TrackingAllocator
{
public:
    using value_type = T;

    TrackingAllocator() noexcept = default;

    template <class U>
    TrackingAllocator(
        const TrackingAllocator<U>&) noexcept
    {
    }

    T* allocate(std::size_t count)
    {
        if (count > max_size())
        {
            throw std::bad_alloc();
        }

        ++AllocationStatistics::allocations;

        return static_cast<T*>(
            ::operator new(count * sizeof(T)));
    }

    void deallocate(T* pointer,
                    std::size_t) noexcept
    {
        ++AllocationStatistics::deallocations;
        ::operator delete(pointer);
    }

    template <class U, class... Args>
    void construct(U* pointer, Args&&... args)
    {
        ++AllocationStatistics::constructions;

        new (static_cast<void*>(pointer))
            U(std::forward<Args>(args)...);
    }

    template <class U>
    void destroy(U* pointer) noexcept
    {
        ++AllocationStatistics::destructions;
        pointer->~U();
    }

    std::size_t max_size() const noexcept
    {
        return std::numeric_limits<std::size_t>::max()
             / sizeof(T);
    }

    template <class U>
    struct rebind
    {
        using other = TrackingAllocator<U>;
    };
};

template <class T, class U>
bool operator==(const TrackingAllocator<T>&,
                const TrackingAllocator<U>&) noexcept
{
    return true;
}

template <class T, class U>
bool operator!=(const TrackingAllocator<T>& left,
                const TrackingAllocator<U>& right) noexcept
{
    return !(left == right);
}
```

关键点：

- `value_type` 告诉 traits 分配元素类型；
- 转换构造支持类型重绑定；
- `allocate` 只申请原始存储；
- `construct` 使用定位 `new`；
- `destroy` 只析构对象；
- `deallocate` 只归还存储；
- 相等比较表示不同实例能否互相释放对方申请的内存。

生产分配器还需要认真处理传播、对齐、状态、异常和并发，不能直接复制教学代码上线。

## 三十、综合示例

下面程序使用统计分配器观察 `vector` 的分配、构造、销毁和释放过程。

```cpp
#include <cstddef>
#include <iostream>
#include <limits>
#include <memory>
#include <new>
#include <utility>
#include <vector>

struct Statistics
{
    static std::size_t allocations;
    static std::size_t deallocations;
    static std::size_t constructions;
    static std::size_t destructions;
};

std::size_t Statistics::allocations = 0;
std::size_t Statistics::deallocations = 0;
std::size_t Statistics::constructions = 0;
std::size_t Statistics::destructions = 0;

template <class T>
class CountingAllocator
{
public:
    using value_type = T;

    CountingAllocator() noexcept = default;

    template <class U>
    CountingAllocator(
        const CountingAllocator<U>&) noexcept
    {
    }

    T* allocate(std::size_t count)
    {
        if (count > max_size())
        {
            throw std::bad_alloc();
        }

        ++Statistics::allocations;

        return static_cast<T*>(
            ::operator new(count * sizeof(T)));
    }

    void deallocate(T* pointer,
                    std::size_t) noexcept
    {
        ++Statistics::deallocations;
        ::operator delete(pointer);
    }

    template <class U, class... Args>
    void construct(U* pointer, Args&&... args)
    {
        ++Statistics::constructions;

        new (static_cast<void*>(pointer))
            U(std::forward<Args>(args)...);
    }

    template <class U>
    void destroy(U* pointer) noexcept
    {
        ++Statistics::destructions;
        pointer->~U();
    }

    std::size_t max_size() const noexcept
    {
        return std::numeric_limits<std::size_t>::max()
             / sizeof(T);
    }

    template <class U>
    struct rebind
    {
        using other = CountingAllocator<U>;
    };
};

template <class T, class U>
bool operator==(const CountingAllocator<T>&,
                const CountingAllocator<U>&) noexcept
{
    return true;
}

template <class T, class U>
bool operator!=(const CountingAllocator<T>& left,
                const CountingAllocator<U>& right) noexcept
{
    return !(left == right);
}

class Record
{
public:
    explicit Record(int value)
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

int main()
{
    {
        std::vector<Record,
                    CountingAllocator<Record>> records;

        records.reserve(3);
        records.emplace_back(10);
        records.emplace_back(20);
        records.emplace_back(30);

        int sum = 0;
        for (const Record& record : records)
        {
            sum += record.value();
        }

        std::cout << "size: " << records.size() << '\n';
        std::cout << "capacity: " << records.capacity() << '\n';
        std::cout << "sum: " << sum << '\n';
        std::cout << "allocations: "
                  << Statistics::allocations
                  << '\n';
        std::cout << "constructions: "
                  << Statistics::constructions
                  << '\n';
        std::cout << "deallocations before scope exit: "
                  << Statistics::deallocations
                  << '\n';
    }

    std::cout << "destructions after scope exit: "
              << Statistics::destructions
              << '\n';
    std::cout << "deallocations after scope exit: "
              << Statistics::deallocations
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
size: 3
capacity: 3
sum: 60
allocations: 1
constructions: 3
deallocations before scope exit: 0
destructions after scope exit: 3
deallocations after scope exit: 1
```

`reserve(3)` 申请一次能容纳三个 `Record` 的原始存储，但没有构造对象；三次 `emplace_back` 分别构造三个对象。离开作用域后，先析构三个对象，再释放整段存储。

## 三十一、常见错误

### 31.1 把SGI实现当成标准规定

问题：不同标准库不必使用 128 字节分界、8 字节对齐或二级配置器。

修正：明确标注“经典 SGI STL 实现”。

### 31.2 把自由链表数组称为普通哈希表

问题：它按离散尺寸直接计算下标，不执行通用键哈希和冲突处理。

修正：称为尺寸类数组或分离式自由链表。

### 31.3 混淆分配与构造

```cpp
T* storage = allocator.allocate(count);
storage[0] = value;
```

问题：如果位置上尚未构造 `T`，直接按对象赋值可能违反对象生命周期规则。

修正：使用 `allocator_traits::construct` 或正确的定位构造。

### 31.4 释放存储前忘记析构对象

问题：`std::string`、智能指针等成员资源没有清理。

修正：先逐个销毁已构造对象，再 deallocate。

### 31.5 构造中途异常时泄漏

问题：只记录总容量，没有记录已成功构造数量，无法正确回滚。

修正：维护已构造边界，异常时逆序销毁并释放存储。

### 31.6 向错误尺寸自由链表归还内存

问题：后续可能把小块当大块使用，导致越界。

修正：尺寸由池可靠保存或由类型固定推导，并在调试模式验证。

### 31.7 忽略对齐

问题：返回地址不满足 `alignof(T)` 时，在该位置构造对象就是未定义行为。

修正：分配器必须同时满足大小和对齐要求。

### 31.8 认为池中空闲内存一定是泄漏

问题：池可能有意缓存资源供后续复用。

修正：区分“仍由池拥有并可复用”和“已经失去引用”的内存。

### 31.9 认为内存池一定更快

问题：现代系统分配器已经高度优化，自定义池可能增加碎片、锁竞争和复杂度。

修正：用基准测试和真实负载数据决定。

### 31.10 不处理零大小与溢出

`count * sizeof(T)` 可能溢出，`allocate(0)` 的返回行为也不应被随意假设。

修正：在乘法前使用 `max_size()` 检查，并遵守分配器契约。

### 31.11 跨分配器释放

问题：用分配器 B 释放分配器 A 申请的存储，可能破坏两个池。

修正：明确 allocator 相等性、传播规则和资源归属。

### 31.12 只保护引用计数却不保护自由链表

问题：多个线程并发修改链表头会产生数据竞争。

修正：根据性能需求使用锁、线程缓存或经过验证的并发算法。

## 三十二、面试常见问题

### 32.1 为什么要把内存分配和对象构造分开

容器的 `capacity` 可以大于 `size`。它需要先获得未初始化存储，只在实际元素位置构造对象，从而支持无默认构造类型、延迟构造和异常回滚。

### 32.2 `allocate` 后对象已经存在了吗

没有。它只返回能容纳对象的原始存储。还需要通过 allocator traits 或定位 `new` 构造对象。

### 32.3 SGI一级配置器做什么

经典实现主要封装 `malloc/free`，并在分配失败时执行自定义 OOM 处理和重试，通常处理大块内存或作为后备。

### 32.4 SGI二级配置器做什么

经典实现管理不大于 128 字节的小块，通过 8 字节尺寸分类、16 条自由链表和内存池批量获取来减少频繁系统分配。

### 32.5 为什么有16条自由链表

尺寸类别为 `8, 16, ..., 128`，数量是 `128 / 8 = 16`。这是旧 SGI 的参数选择，不是标准规定。

### 32.6 为什么自由节点使用联合体

空闲时用同一块存储开头保存下一节点指针，分配给用户后整块作为数据区，减少额外节点元数据。

### 32.7 `refill` 为什么一次申请多个块

把一次系统或池获取成本摊销到多个后续小块分配中，第一块立即返回，其余挂入自由链表。

### 32.8 内部碎片与外部碎片是什么

内部碎片是已分配块内部因尺寸舍入而未使用的空间；外部碎片是空闲空间分散，虽然总量足够但难以形成所需连续块。

### 32.9 allocator为什么需要rebind

容器模板参数面向元素类型，但节点式容器实际分配内部节点，需要把元素分配器适配成节点分配器。

### 32.10 `allocator_traits` 有什么作用

它统一访问分配器的类型和操作，提供默认适配、重绑定、构造销毁和传播策略查询，降低容器与具体 allocator 的耦合。

### 32.11 自定义分配器如何处理异常

分配失败应按契约抛出 `std::bad_alloc`；对象构造中途失败时，容器负责销毁已构造对象并释放相应存储。

### 32.12 内存池是否线程安全

取决于实现。自由链表并发访问需要同步，经典 SGI 的具体线程策略取决于版本和配置，不能一概而论。

### 32.13 为什么移动构造的 `noexcept` 会影响vector

扩容时容器希望保持异常安全。如果移动可能抛异常而复制可用，容器可能选择复制；不抛移动更适合作为提交过程。

### 32.14 PMR是什么

它是 C++17 的多态内存资源框架，让容器通过运行时 `memory_resource` 选择单调池、同步池等资源策略。

## 三十三、实践建议

1. 普通项目优先使用标准容器和默认分配器；
2. 先通过 profiling 确认分配确实是瓶颈；
3. 区分标准接口、标准库实现和 SGI 教学源码；
4. 始终把分配、构造、销毁、释放视为四个步骤；
5. 使用 `allocator_traits`，不要让容器直接依赖分配器细节；
6. 自定义分配器必须满足大小和对齐要求；
7. 明确有状态分配器的复制、移动和交换传播规则；
8. 为对象构造失败设计完整回滚路径；
9. 调试模式检查重复释放、跨池释放和错误尺寸归还；
10. 并发池要单独设计线程安全，不能依赖普通自由链表；
11. 对池的峰值、常驻量、命中率和碎片率进行监控；
12. C++17 项目可优先评估 PMR，而不是从零实现通用池；
13. 固定类型对象池通常比通用小块分配器更容易正确实现；
14. 任何性能结论都要用真实平台和负载验证。

## 三十四、总结

STL 分配器的核心不是某段自由链表代码，而是对存储与对象生命周期的分层管理：

- allocator 获取和归还原始存储；
- allocator traits 统一分配器协议；
- 容器决定在哪些位置构造和销毁元素；
- rebind 让元素分配器适配内部节点类型；
- 经典 SGI 一级配置器包装通用堆并处理 OOM；
- 二级配置器通过尺寸类、自由链表和内存池复用小块；
- 128、8、16 和 20 都是具体实现参数，不是标准规定；
- 自定义池必须处理对齐、异常、碎片、并发和资源归属；
- 只有测量证明分配是瓶颈时，复杂分配策略才值得引入。

可以把完整生命周期记为：

```text
allocate 原始存储
    -> construct 对象
        -> 使用对象
            -> destroy 对象
                -> deallocate 存储
```
