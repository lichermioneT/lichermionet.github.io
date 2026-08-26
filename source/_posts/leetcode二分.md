---
title: 二分
date: 2026-08-24 17:07:00
categories:
  - 力扣
tags:
  - 二分
type: page
comments: false
---

## 704.二分查找

给定一个 `n` 个元素有序的（升序）整型数组 `nums` 和一个目标值 `target` ，写一个函数搜索 `nums` 中的 `target`，如果 `target` 存在返回下标，否则返回 `-1`。

你必须编写一个具有 `O(log n)` 时间复杂度的算法。
**示例 1:**

```
输入: nums = [-1,0,3,5,9,12], target = 9
输出: 4
解释: 9 出现在 nums 中并且下标为 4
```

**示例 2:**

```
输入: nums = [-1,0,3,5,9,12], target = 2
输出: -1
解释: 2 不存在 nums 中因此返回 -1
```

**提示：**

1. 你可以假设 `nums` 中的所有元素是不重复的。
2. `n` 将在 `[1, 10000]`之间。
3. `nums` 的每个元素都将在 `[-9999, 9999]`之间。

```c++
class Solution {
public:
    int search(vector<int>& nums, int target) 
    {
        int left = 0;
        int right = nums.size() - 1;
        int mid = 0;

        // 相等的时候也需要进行判断的。
        while(left <= right)
        {   
            // 防止溢出的
            mid = left + (right - left + 1) / 2;

            if(nums[mid] > target)
            {
                right =  mid - 1;
            }
            else if(nums[mid] < target)
            {
                left = mid + 1;
            }
            else 
            {
                return mid;
            }
        }

        return -1;
    }
};
```

## 34.在排序数组中查找元素的第一个和最后一个位置

给你一个按照非递减顺序排列的整数数组 `nums`，和一个目标值 `target`。请你找出给定目标值在数组中的开始位置和结束位置。

如果数组中不存在目标值 `target`，返回 `[-1, -1]`。

你必须设计并实现时间复杂度为 `O(log n)` 的算法解决此问题。

**示例 1：**

```
输入：nums = [5,7,7,8,8,10], target = 8
输出：[3,4]
```

**示例 2：**

```
输入：nums = [5,7,7,8,8,10], target = 6
输出：[-1,-1]
```

**示例 3：**

```
输入：nums = [], target = 0
输出：[-1,-1]
```

**提示：**

- `0 <= nums.length <= 105`
- `-109 <= nums[i] <= 109`
- `nums` 是一个非递减数组
- `-109 <= target <= 109`

```c++
class Solution {
public:
    int findLeft(vector<int>& nums, int target)
    {
        int left = 0;
        int right = nums.size() - 1;
        int ans = -1;

        while (left <= right)
        {
            int mid = left + (right - left) / 2;

            if (nums[mid] >= target)
            {
                if (nums[mid] == target)
                {
                    ans = mid; // 先记录一个区间的断点信息
                }

                right = mid - 1; // 这里不一定是最右边的区间的
            }
            else
            {
                left = mid + 1; // 
            }
        }

        return ans;
    }

    int findRight(vector<int>& nums, int target)
    {
        int left = 0;
        int right = nums.size() - 1;
        int ans = -1;

        while (left <= right)
        {
            int mid = left + (right - left) / 2;

            if (nums[mid] <= target)
            {
                if (nums[mid] == target)
                {
                    ans = mid;
                }

                left = mid + 1;
            }
            else
            {
                right = mid - 1;
            }
        }

        return ans;
    }

    vector<int> searchRange(vector<int>& nums, int target) 
    {
        int leftIndex = findLeft(nums, target);
        int rightIndex = findRight(nums, target);

        return {leftIndex, rightIndex};
    }
};
```



## 69.x的平方根

给你一个非负整数 `x` ，计算并返回 `x` 的 **算术平方根** 。

由于返回类型是整数，结果只保留 **整数部分** ，小数部分将被 **舍去 。**

**注意：**不允许使用任何内置指数函数和算符，例如 `pow(x, 0.5)` 或者 `x ** 0.5` 。

**示例 1：**

```
输入：x = 4
输出：2
```

**示例 2：**

```
输入：x = 8
输出：2
解释：8 的算术平方根是 2.82842..., 由于返回类型是整数，小数部分将被舍去。
```

**提示：**

- `0 <= x <= 231 - 1`

```c++
class Solution {
public:
    int mySqrt(int x) 
    {
        if(x < 1) 
        {
            return 0;
        }

        int left = 1;
        int right = x;

        while(left < right)
        {
            long long int  mid = left + (right - left + 1) / 2; // 防止溢出了
            if(mid * mid <= x)
            {
                left = mid;
            }
            else 
            {
                right = mid - 1;
            }
        }

        return left;
    }
};
```

**35.搜索插入位置**

给定一个排序数组和一个目标值，在数组中找到目标值，并返回其索引。如果目标值不存在于数组中，返回它将会被按顺序插入的位置。

请必须使用时间复杂度为 `O(log n)` 的算法。

**示例 1:**

```
输入: nums = [1,3,5,6], target = 5
输出: 2
```

**示例 2:**

```
输入: nums = [1,3,5,6], target = 2
输出: 1
```

**示例 3:**

```
输入: nums = [1,3,5,6], target = 7
输出: 4
```

**提示:**

- `1 <= nums.length <= 104`
- `-104 <= nums[i] <= 104`
- `nums` 为 **无重复元素** 的 **升序** 排列数组
- `-104 <= target <= 104`

```c++
class Solution {
public:
    int searchInsert(vector<int>& nums, int target) 
    {
        int left = 0;
        int right = nums.size() - 1;
        int mid = 0;
        while(left < right) 
        {
            int mid = left + (right - left) / 2;
            if(nums[mid] < target)
            {
                left = mid + 1;
            }
            else 
            {
                right = mid;
            }
        }   

        if(nums[left] < target) 
        {
            return left + 1;
        }
        else 
        {
            return left;
        }
    }
};
```













