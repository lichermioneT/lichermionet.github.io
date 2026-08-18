---
title: LeetCode
date: 2026-08-18 17:07:00
categories:
  - 力扣
type: page
comments: false
---

可以，这一题你的整体思路是对的，但有一句需要改得更严谨：

> **“慢指针右边全部都是零”并不始终成立。**

更准确的说法是：在遍历过程中，`[0, slow)` 区间一定都是已经处理好的非零元素；`[slow, fast)` 是已经扫描过、等待被后续非零元素交换处理的区域；`[fast, n)` 是还没有扫描的区域。

你可以把整篇笔记优化成下面这样。

------

# 1. 移动零

**LeetCode 283：移动零**

## 题目描述

给定一个数组 `nums`，将所有 `0` 移动到数组末尾，同时保持所有非零元素的相对顺序。

要求：

- 必须原地修改数组；
- 不能复制数组；
- 非零元素之间的相对顺序不能改变。

例如：

```text
输入：
[0, 1, 0, 3, 12]

输出：
[1, 3, 12, 0, 0]
```

------

## 一、核心思路：双指针

使用两个指针：

```text
slow：慢指针
fast：快指针
```

### 快指针 `fast`

负责遍历整个数组，寻找非零元素。

### 慢指针 `slow`

表示：

> **下一个非零元素应该放置的位置。**

因此在遍历过程中始终满足：

```text
[0, slow)
```

这一段全部都是已经处理好的非零元素，并且相对顺序保持不变。

可以理解成：

```text
0                         n
|------|---------|---------|
 已处理    已扫描     未扫描
 非零区     区域       区域
        ↑         ↑
       slow      fast
```

------

# 二、具体处理过程

对于快指针 `fast` 指向的元素，有两种情况。

## 1. `nums[fast] == 0`

说明当前元素就是需要移动到后面的 `0`。

不需要处理：

```cpp
fast++;
```

继续寻找下一个非零元素。

------

## 2. `nums[fast] != 0`

说明发现了一个非零元素。

应该把它放到慢指针 `slow` 所表示的位置：

```cpp
swap(nums[slow], nums[fast]);
slow++;
```

然后快指针继续向后遍历。

------

# 三、执行过程

例如：

```text
nums = [0, 1, 0, 3, 12]
```

初始：

```text
slow = 0
fast = 0
```

### 第一次

```text
fast = 0
nums[fast] = 0
```

遇到 `0`，不处理：

```text
[0, 1, 0, 3, 12]
 ↑
slow
 ↑
fast
```

------

### 第二次

```text
fast = 1
nums[fast] = 1
```

遇到非零元素，与 `nums[slow]` 交换：

```text
swap(nums[0], nums[1])
```

得到：

```text
[1, 0, 0, 3, 12]
```

然后：

```text
slow++
```

此时：

```text
slow = 1
```

------

### 第三次

```text
fast = 2
nums[fast] = 0
```

遇到零，不处理。

------

### 第四次

```text
fast = 3
nums[fast] = 3
```

交换：

```text
swap(nums[1], nums[3])
```

得到：

```text
[1, 3, 0, 0, 12]
```

然后：

```text
slow = 2
```

------

### 第五次

```text
fast = 4
nums[fast] = 12
```

交换：

```text
swap(nums[2], nums[4])
```

得到：

```text
[1, 3, 12, 0, 0]
```

最终完成。

------

# 四、C 语言实现

```c
void moveZeroes(int* nums, int numsSize)
{
    int slow = 0;

    for (int fast = 0; fast < numsSize; ++fast)
    {
        // 找到非零元素
        if (nums[fast] != 0)
        {
            int temp = nums[fast];
            nums[fast] = nums[slow];
            nums[slow] = temp;

            ++slow;
        }
    }
}
```

这里：

```c
fast
```

负责遍历整个数组。

而：

```c
slow
```

始终指向：

```text
下一个非零元素应该存放的位置
```

------

# 五、C++ 实现

C++ 可以直接使用 `swap`：

```cpp
class Solution
{
public:
    void moveZeroes(vector<int>& nums)
    {
        size_t slow = 0;

        for (size_t fast = 0; fast < nums.size(); ++fast)
        {
            if (nums[fast] != 0)
            {
                swap(nums[slow], nums[fast]);
                ++slow;
            }
        }
    }
};
```

代码非常简洁。

------

# 六、另一种写法：覆盖 + 补零

除了交换法，还可以分成两步。

第一步：

把所有非零元素依次放到数组前面。

```cpp
size_t index = 0;

for (size_t i = 0; i < nums.size(); ++i)
{
    if (nums[i] != 0)
    {
        nums[index++] = nums[i];
    }
}
```

例如：

```text
原数组：

[0, 1, 0, 3, 12]

处理后前半部分：

[1, 3, 12, ?, ?]
```

第二步：

把剩余位置全部补 `0`：

```cpp
for (size_t i = index; i < nums.size(); ++i)
{
    nums[i] = 0;
}
```

最终：

```text
[1, 3, 12, 0, 0]
```

完整代码：

```cpp
class Solution
{
public:
    void moveZeroes(vector<int>& nums)
    {
        size_t index = 0;

        // 1. 保存所有非零元素
        for (size_t i = 0; i < nums.size(); ++i)
        {
            if (nums[i] != 0)
            {
                nums[index++] = nums[i];
            }
        }

        // 2. 剩余位置补 0
        for (size_t i = index; i < nums.size(); ++i)
        {
            nums[i] = 0;
        }
    }
};
```

------

# 七、两种方法比较

| 方法            | 时间复杂度 | 空间复杂度 | 特点                     |
| --------------- | ---------- | ---------- | ------------------------ |
| 双指针 + `swap` | `O(n)`     | `O(1)`     | 一次遍历，代码简洁       |
| 覆盖 + 补零     | `O(n)`     | `O(1)`     | 思路直观，但需要两次处理 |

这道题我更推荐：

```cpp
双指针 + swap
```

------

# 八、为什么不会破坏非零元素的相对顺序？

因为快指针：

```text
从左向右
```

依次寻找非零元素。

找到一个，就依次放到：

```text
slow = 0
slow = 1
slow = 2
...
```

因此：

```text
原数组：
0  1  0  3  12

发现非零元素的顺序：
1 → 3 → 12

最终：
1  3  12  0  0
```

非零元素始终按照原来的顺序被放到数组前面。

所以这是一个**稳定处理**。

------

# 九、双指针真正需要记住的含义

这道题不要死记：

```text
一个快指针
一个慢指针
```

真正应该理解的是：

### `fast`

```text
负责寻找 / 遍历
```

### `slow`

```text
负责记录下一个有效元素应该存放的位置
```

也就是：

```text
fast：找数据
slow：放数据
```

这是很多数组双指针题目的共同模型。

------

# 十、与快速排序的联系

这道题的思想和快速排序中的 **partition（分区）** 有一定相似性。

本质上都是：

```text
遍历数组 + 根据条件划分区间
```

移动零：

```text
非零元素 | 零元素
```

快速排序 partition：

```text
小于 pivot | 大于等于 pivot
```

例如：

```cpp
if (nums[i] < pivot)
{
    swap(nums[i], nums[slow]);
    ++slow;
}
```

你会发现结构非常像：

```cpp
if (nums[i] != 0)
{
    swap(nums[i], nums[slow]);
    ++slow;
}
```

所以这道题实际上也是一种简单的 **partition 分区思想**。

------

# 十一、总结

这道题核心只有一句话：

> **快指针寻找非零元素，慢指针记录下一个非零元素应该存放的位置。**

执行规则：

1. `fast` 从头到尾遍历数组。
2. `nums[fast] == 0`：不处理，继续遍历。
3. `nums[fast] != 0`：交换 `nums[fast]` 和 `nums[slow]`。
4. 交换完成后 `slow++`。
5. 当 `fast` 遍历结束时，数组自然变成：

```text
非零元素 | 零元素
```

时间复杂度：

```text
O(n)
```

空间复杂度：

```text
O(1)
```

### 面试时可以直接概括

```text
使用快慢双指针。

fast 负责遍历数组寻找非零元素，
slow 指向下一个非零元素应该放置的位置。

当 fast 遇到 0 时直接跳过；
当 fast 遇到非零元素时，
交换 nums[fast] 和 nums[slow]，
随后 slow 向后移动。

遍历结束后，
所有非零元素保持原有相对顺序位于数组前部，
所有 0 被移动到数组末尾。
```

这版比你原来的一个关键提升，就是把 **`slow` 的含义定义清楚了：`slow` 不是简单的“慢指针”，而是“下一个有效元素应该放置的位置”**。以后做删除元素、移除重复项、按条件划分数组等题时，都可以沿用这个理解。
