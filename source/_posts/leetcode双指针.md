---
title: 双指针算法
date: 2026-08-24 17:07:00
categories:
  - 力扣
tags:
  - 双指针算法
type: page
comments: false
---

## 283.移动零

给定一个数组 `nums`，编写一个函数将所有 `0` 移动到数组的末尾，同时保持非零元素的相对顺序。

**请注意** ，必须在不复制数组的情况下原地对数组进行操作。

**示例 1:**

```
输入: nums = [0,1,0,3,12]
输出: [1,3,12,0,0]
```

**示例 2:**

```
输入: nums = [0]
输出: [0]
```

**提示**:

- `1 <= nums.length <= 104`
- `-231 <= nums[i] <= 231 - 1`

**进阶：**你能尽量减少完成的操作次数吗？

**c代码**

```c
void moveZeroes(int* nums, int numsSize)
 {
    int slow = 0;
    for(int i = 0; i < numsSize; ++i)
    {
        if(nums[i] != 0)
        {
            int temp = nums[slow];
            nums[slow] = nums[i];
            nums[i] = temp;
            slow++;
        }
    }

    // int slow = 0;
    // for(int i = 0; i < numsSize; ++i)
    // {
    //     if(nums[i] != 1)
    //     {
    //         int temp = nums[i];
    //         nums[i] = nums[slow];
    //         nums[slow] = temp;
    //         slow++;
    //     }
    // }

    // int slow = 0;
    // for(int i = 0; i < numsSize; ++i) // 遇到零元素，不处理的。快指针++
    // {
    //     if(nums[i] != 0)   // 遇到非零元素的，
    //     {
    //         int temp = nums[i];
    //         nums[i] = nums[slow];
    //         nums[slow] = temp;
    //         slow++;
    //     }
    // }


    // int index = 0;
    // for(int i = 0; i < numsSize; ++i)
    // {
    //     if(nums[i] != 0)
    //     {
    //         nums[index++] = nums[i];
    //     }
    // }

    // for(int slow = index; slow < numsSize; ++slow)
    // {
    //     nums[slow] = 0;
    // }




    // int slow = 0;
    // for(int i = 0; i < numsSize; i++)
    // {
    //     if(nums[i] != 0)
    //     {
    //         nums[slow++] = nums[i];
    //     }
    // }

    // for(slow; slow < numsSize; slow++)
    // {
    //     nums[slow] = 0;
    // }


    // int slow  = 0;
    // for (int i = 0; i < numsSize; i++)
    // {
    //     if(nums[i] != 0)
    //     {
    //         nums[slow++] = nums[i];
    //     }
    // }

    // for(slow; slow < numsSize; slow++)
    // {
    //     nums[slow] = 0;
    // }

    // int slow =  0; // 这里等着非零的数字交换过来的。
    // for(int i = 0; i < numsSize; i++)
    // {
    //     if(nums[i] != 0)
    //     {
    //         int temp = nums[slow];
    //         nums[slow] = nums[i];
    //         nums[i] = temp;
    //         slow++;
    //     }
    // }

/*

*/
    
}
```

**c++代码**

```c++
class Solution 
{
public:
    void moveZeroes(vector<int>& nums) 
    {
        //1.双指针算法(数组里面用数组下标来的)
        //1.一个指针遍历数组，一个指针记录处理的数据
        // size_t index = 0;
        // for(int i = 0; i < nums.size(); i++)
        // {
        //     if(nums[i] != 0)
        //     {
        //         swap(nums[index++], nums[i]);
        //     }
        // }

        // size_t index = 0;
        // for(int i = 0; i < nums.size(); ++i)
        // {
        //     if(nums[i] != 0)
        //     {
        //         nums[index++] = nums[i];
        //     }
        // }

        // for(size_t i = index; i < nums.size(); ++i)
        // {
        //     nums[i] = 0;
        // }

        size_t index = 0;
        for(int i = 0; i < nums.size(); ++i)
        {
            if(nums[i] != 0)
            {
                swap(nums[index++], nums[i]);
            }
        }
    }
};
```



## 1089.复写零

给你一个长度固定的整数数组 `arr` ，请你将该数组中出现的每个零都复写一遍，并将其余的元素向右平移。

注意：请不要在超过该数组长度的位置写入元素。请对输入的数组 **就地** 进行上述修改，不要从函数返回任何东西。

**示例 1：**

```
输入：arr = [1,0,2,3,0,4,5,0]
输出：[1,0,0,2,3,0,0,4]
解释：调用函数后，输入的数组将被修改为：[1,0,0,2,3,0,0,4]
```

**示例 2：**

```
输入：arr = [1,2,3]
输出：[1,2,3]
解释：调用函数后，输入的数组将被修改为：[1,2,3]
```

**提示：**

- `1 <= arr.length <= 104`
- `0 <= arr[i] <= 9`

**c代码**

```c
void duplicateZeros(int* arr, int arrSize) 
{
// 1.根据数组元素，0加2，非零加+找到需要复写的元素。
    int cur = 0; // 计数器
    int i = 0;   // 复写的位置
    while(cur < arrSize)
    {
        if(arr[i] == 0)
        {
            cur += 2;
        }
        else 
        {
            cur += 1;
        }
        
        // 细节这里是++了，然后才去判断的，
        i++;
    }

    // 这里减1才是正确复写的位置。
    i--;

    int index = arrSize - 1; // 数组下标识从零开始的。
    if(cur > arrSize)
    {
        arr[index--] = 0; // 这种情况，最后一个元素一定是零的。这里减减，下次循环可以直接拿来用，然后在减减。
        i--;              // 跳过最后一个复写的元素
    }

// 全部开始复写了
    while(i >= 0)
    {
        // i慢指针等于0的时候，index移动两次 
        if(arr[i] == 0)
        {
            arr[index--] = 0;
            arr[index--] = 0;
        }
        else 
        {
            arr[index--] = arr[i]; // i慢指针等于非零的时候，index移动两次了
        }
        i--;
    }

    // int cur = 0;  
    // int i = 0;
    
    // while(cur < arrSize)
    // {
    //     if(arr[i] == 0)
    //     {
    //         cur += 2;
    //     }
    //     else 
    //     {
    //         cur += 1;
    //     }
    //     i++;
    // }

    // i--;
    // int index = arrSize-1;

    // if(cur > arrSize)
    // {
    //     arr[index--] = 0;
    //     i--;
    // }

    // while(i >= 0)
    // {
    //     if(arr[i] == 0)
    //     {
    //         arr[index--]=0;
    //         arr[index--]=0;
    //     }
    //     else 
    //     {
    //         arr[index--] = arr[i];
    //     }
    //     i--;
    // }

}
```

**c++代码**

```c++
class Solution {
public:
    void duplicateZeros(vector<int>& arr) 
    {
        // 1.sz数组的大小，i需要开始复写的位置，cur记录个数
        int sz = arr.size();
        int i = 0;
        int cur = 0;

        // 2.复写的元素大于数组的个数结束
        while(cur < sz)
        {
            if(arr[i] == 0)
            {
                cur += 2;
            }
            else 
            {
                cur += 1;
            }
            i++;  // 这里++了才出去了的
        }

        // 这里--还原需要复写的位置
        i--;

        // 3.最后一个复写的元素是零，超出了范围的
        int index = sz - 1;
        if(cur > sz)
        {
            arr[index--] = 0; // 最后一个位置复写零
            i--; // 复写元素往前移动
        }

        while(i >= 0)
        {
            if(arr[i] == 0)
            {
                arr[index--] = 0;
                arr[index--] = 0;
            }
            else 
            {
                arr[index--] = arr[i];
            }
            i--;
        }

        //1.找到最后一个复写的数字，从后面往前面复写
        //2.处理两种情况，复写的长度大于和等于给定的数组
        //3.开始复写
        
        // int sz = arr.size();
        // int i = 0;       // 记录开始复写的元素
        // int cur = 0;      // 记录复写的
        // while(cur < sz)
        // {
        //     if(arr[i] == 0)
        //     {
        //         cur += 2;
        //     }
        //     else 
        //     {
        //         cur += 1;
        //     }
        //     i++;
        // }

        // i--; // 里面已经大于了，但是也是i++了一次的。
        // int index = sz - 1;
        // if(cur > sz)
        // {
        //     arr[index--] = 0;
        //     i--;
        // }

        // while(i > 0)
        // {
        //     if(arr[i] == 0)
        //     {
        //         arr[index--] = 0;
        //         arr[index--] = 0;
        //     }
        //     else 
        //     {
        //         arr[index--] = arr[i];
        //     }
        //     i--;
        // }

        // int sz = arr.size();
        // int cur = 0;
        // int i = 0;
        // while(cur < sz)
        // {
        //     if(arr[i]  == 0)
        //     {
        //         cur += 2;
        //     }
        //     else 
        //     {
        //         cur += 1;
        //     }
        //     i++;
        // }

        // i--;
        // int index = sz-1;
        
        // if(cur > sz)
        // {
        //     arr[index--] = 0;
        //     i--;
        // }

        // while(i >= 0)
        // {
        //     if(arr[i] == 0)
        //     {
        //         arr[index--] = 0;
        //         arr[index--] = 0;
        //     }
        //     else 
        //     {
        //         arr[index--] = arr[i];
        //     }
        //     i--;
        // }

        // int n = arr.size();
        // int cur = 0;  // 判断满了没得
        // int i = 0;   // 需要复写的最后一个元素。

        // // 1. 找到最后一个会被处理的元素
        // while (cur < n) 
        // {
        //     if (arr[i] == 0) cur += 2;
        //     else cur += 1;
        //     i++;
        // }

        // i--;                // 最后一个有效原数组元素
        // int index = n - 1;  // 实际写入位置

        // // 2. 处理“多出来的 0”
        // if (cur > n) 
        // {      // 说明最后是 0，只能写一个
        //     arr[index] = 0;
        //     index--;
        //     i--;
        // }

        // // 3. 从后往前写
        // while (i >= 0) 
        // {
        //     if (arr[i] == 0) 
        //     {
        //         arr[index--] = 0;
        //         arr[index--] = 0;
        //     } 
        //     else 
        //     {
        //         arr[index--] = arr[i];
        //     }
        //     i--;
        // }

    }
};

```

## 202.快乐数

编写一个算法来判断一个数 `n` 是不是快乐数。

**「快乐数」** 定义为：

- 对于一个正整数，每一次将该数替换为它每个位置上的数字的平方和。
- 然后重复这个过程直到这个数变为 1，也可能是 **无限循环** 但始终变不到 1。
- 如果这个过程 **结果为** 1，那么这个数就是快乐数。

如果 `n` 是 *快乐数* 就返回 `true` ；不是，则返回 `false` 。

**示例 1：**

```
输入：n = 19
输出：true
解释：
12 + 92 = 82
82 + 22 = 68
62 + 82 = 100
12 + 02 + 02 = 1
```

**示例 2：**

```
输入：n = 2
输出：false
```

**提示：**

- `1 <= n <= 231 - 1`

**c代码**

```c

// int bitSum(int n)
// {
//     int sum = 0;
//     while(n > 0)
//     {
//         int t = n % 10;
//         sum += t * t;
//         n /= 10;
//     }
//     return sum;
// }

// 计算每一位的的和
int bitSum(int n)
{
    int sum = 0;
    while(n)
    {
        int t = n % 10;
        sum +=  t*t;
        n /= 10;
    }

    return sum;
}

bool isHappy(int n)
{
    //抽屉原理
    // int slow = n;
    // int fast = bitSum(n);
    // while(slow != fast)
    // {
    //     slow = bitSum(slow);
    //     fast = bitSum(bitSum(fast));
    // }

    int slow = n;
    int fast = bitSum(n); // 快指针先走一步
    while(slow != fast)
    {
        slow = bitSum(slow); // 慢指针一步一步走
        fast = bitSum(bitSum(fast)); // 快指针两步两步走
    }

    return fast == 1;
}
```



**c++代码**

```c++
class Solution {
public:
//     bool isHappy(int n) 
//     {   
        
//         int slow = n;
//         int fast = bitSum(n);
//         while(slow != fast)
//         {
//             slow = bitSum(slow);
//             fast = bitSum(bitSum(fast));
//         }

//         return fast == 1;
//     }


// private:
//     int bitSum(int n)
//     {
//         int sum = 0;
//         while(n > 0)
//         {
//             int t = n % 10; // 取0-9;
//             sum += t * t;
//             n /= 10;        // 删除一位 
//         }
//         return sum;
//     }

// bool isHappy(int n)
// {
//     int slow = n;
//     int fast = bitSum(n);
//     while(slow != fast)
//     {
//         slow = bitSum(slow);
//         fast = bitSum(bitSum(fast));
//     }
//     return fast == 1;
// }

// private:
//     int bitSum(int n)
//     {
//         int sum = 0;
//         while(n)
//         {
//             int t = n % 10;
//             sum += t * t;
//             n /= 10;
//         }
//         return sum;
//     }

int bitSum(int n)
{
    int sum = 0;
    while(n)
    {
        int t = n % 10;
        sum += t * t;
        n /= 10;
    }
    return sum;
}

bool isHappy(int n)
{
    int slow = n;
    int fast = bitSum(n);
    
    while(slow != fast)
    {
        slow = bitSum(slow);
        fast = bitSum(bitSum(fast));
    }
    return fast == 1;
}

};
```

## 11.盛最多水的容器

给定一个长度为 `n` 的整数数组 `height` 。有 `n` 条垂线，第 `i` 条线的两个端点是 `(i, 0)` 和 `(i, height[i])` 。

找出其中的两条线，使得它们与 `x` 轴共同构成的容器可以容纳最多的水。

返回容器可以储存的最大水量。

**说明：**你不能倾斜容器。

```
输入：[1,8,6,2,5,4,8,3,7]
输出：49 
解释：图中垂直线代表输入数组 [1,8,6,2,5,4,8,3,7]。在此情况下，容器能够容纳水（表示为蓝色部分）的最大值为 49。
```

**示例 2：**

```
输入：height = [1,1]
输出：1
```

**提示：**

- `n == height.length`
- `2 <= n <= 105`
- `0 <= height[i] <= 104`

**c代码**

```c
int maxArea(int* height, int heightSize) 
{
    // int left = 0;
    // int right = heightSize - 1;
    // int ret = 0;
    // while(left < right)
    // {
    //     int v = (height[left] < height[right] ? height[left] : height[right]) * (right - left); 
    //     ret = ret > v ? ret : v;

    //     if(height[left] < height[right]) left++;
    //     else right--; 
    // }

    int left = 0;
    int right = heightSize -1;
    int max = 0;

    // 他们两个不想相等，之间就存在体积的。
    while(left < right)
    {
        // 1.计算体积
        int v =(height[left] < height[right] ? height[left] : height[right]) * (right - left);

        // 2.更新体积
        max = max > v ? max : v;

        // 3.注意算一次，就扔掉一个小的
        if(height[left] < height[right])
        {
            left++;
        }
        else 
        {
            right--;
        }
    }

    return max;
}
```

**c++代码**

```c++
class Solution 
{
public:
    int maxArea(vector<int>& height) 
    {
        // 暴力枚举
        // 双层for循环
        // 暴力枚举2

        //1.研究小区间
        //6 2 5 4
        //

    //     int letf = 0;
    //     int right = height.size()-1;
    //     int ret = 0;
    //     while(letf < right)
    //     {
    //         int v = min(height[letf], height[right])*(right - letf);
    //         ret = max(ret, v);

    //         if(height[letf] < height[right]) letf++;
    //         else right--;
    //     }
    //     return ret;
    // }

    int left = 0;
    int right = height.size() - 1;
    int ret = 0;
    while(left < right)
    {
        int v = min(height[left], height[right])*(right - left);
        ret = max(ret, v);

        if(height[left] < height[right])
        {
            left++;
        }
        else 
        {
            right--;
        }
    }
    return ret;
    }
};
```

## 611.有效三角形的个数

给定一个包含非负整数的数组 `nums` ，返回其中可以组成三角形三条边的三元组个数。

**示例 1:**

```
输入: nums = [2,2,3,4]
输出: 3
解释:有效的组合是: 
2,3,4 (使用第一个 2)
2,3,4 (使用第二个 2)
2,2,3
```

**示例 2:**

```
输入: nums = [4,2,3,4]
输出: 4
```

**提示:**

- `1 <= nums.length <= 1000`
- `0 <= nums[i] <= 1000`

**c代码**

```c
int cmp(const void*a, const void*b)
{
    return *(int*)a - *(int*)b;
}

int triangleNumber(int* nums, int numsSize) 
{

//1.排序
//2.a<b<c 只有a + b > c就行
//3.利用升序，减少计算就行了。
    qsort(nums, numsSize, sizeof(int), cmp);
    int ret = 0;
    for(int i = numsSize - 1; i >= 2; i--)
    {
        int left = 0;
        int right = i - 1;
        while(left < right)
        {
            if(nums[left] + nums[right] > nums[i])
            {
                ret += right - left;
                right--;
            }
            else
            {
                left++;
            }
        }
    }
    return ret;

    // for(int i = 0; i < numsSize - 1; i++)
    // {
        
    //     for(int j = 0; j < numsSize - 1 - i; j++)
    //     {
    //         if(nums[j] > nums[j + 1])
    //         {
    //             int temp = nums[j];
    //             nums[j] = nums[j+1];
    //             nums[j+1] = temp;
    //         }
    //     }
    // }


    // int ret = 0;
    // for(int i = numsSize - 1; i >=2; i--)
    // {
    //     int left = 0;
    //     int right = i-1;
        
    //     while(left < right)
    //     {
    //         if(nums[left] + nums[right] > nums[i])
    //         {
    //             ret += right-left;
    //             right--;
    //         }
    //         else 
    //         {
    //             left++;
    //         }
    //     }
    // }

    return ret;
}
```

**c++代码**

```c++
class Solution {
public:
    int triangleNumber(vector<int>& nums) 
    {
        // 1.排序
        sort(nums.begin(), nums.end());
        
        int ret = 0;
        int n = nums.size();
        // 2.确定外层循环
        for(int i = n - 1; i >= 2; --i)
        {
            int left = 0;
            int right = i - 1;
            while(left < right)
            {
                if(nums[left] + nums[right] > nums[i])
                {
                    ret += right - left;
                    right--;
                }
                else
                {
                    left++;
                }
            }
        }

        return ret;
/*
        // 1.先进行排序的。
        sort(nums.begin(), nums.end());
        
        int ret = 0;
        int n = nums.size();

        // 2.需要遍历整个数组的
        for(int i = n - 1; i >= 2; i--) // 
        {
            // 3.left指针和right指针。
            int left = 0;
            int right = i - 1;

            // 4.left<right之间就存在数字
            while(left < right)
            {
                //5.1,5.2的判断都是根据单调性的
                // 5.1当区间的数，已经大于了max,此时应该减少数组，所以right--
                if(nums[left] + nums[right] > nums[i])
                {
                    ret += right - left;
                    right--;
                }
                // 5.2当区间的数，已经小雨了max,此时应该增大数组，所以left++
                else 
                {
                    left++;
                }
            }
        }
        //6返回结果即可
        return ret;

*/
        // 任意 a + b > c;
        // 这里可以计算重复的
        // a<=b<=c -- 这里只需要判断 a+b>c。c无论加上a,b都是大的。
        // 优化先对数据进行排序
        /*
            for(i = 0; i < n; i++)
                for(j = 0; j < n; j++)
                    for(k = 0; k < n; k++)
                        check(i, j k)     3 * n3  nlogn + n3
            0   1  2  3  4  5   6
            [2, 2, 3, 4, 5, 9, 10]
             2+9 > 10 已经大于10现在只需要 right--; right-left种方法
             2+5 < 10 已经小于10现在只需要 left++;
             letf==right时 10--。
        
        1.固定最大的数
        2.最大数左边区间，双指针计算
        3.
        */

        // sort(nums.begin(), nums.end());
        
        // int ret = 0; 
        // int n = nums.size();
        // for(int i = n - 1; i >= 2; i--)
        // {
        //     // 双指针统计
        //     int left = 0;
        //     int right = i - 1;
        //     while(left < right)
        //     {
        //         if(nums[right] + nums[left] > nums[i])
        //         {
        //             ret += right - left;
        //             right--;
        //         }
        //         else 
        //         {
        //             left++;
        //         }
        //     }
        // }

        // return ret;

    }
};
```

## LCR179.查找总价格为目标值的两个商品

购物车内的商品价格按照升序记录于数组 `price`。请在购物车中找到两个商品的价格总和刚好是 `target`。若存在多种情况，返回任一结果即可。

**示例 1：**

```
输入：price = [3, 9, 12, 15], target = 18
输出：[3,15] 或者 [15,3]
```

**示例 2：**

```
输入：price = [8, 21, 27, 34, 52, 66], target = 61
输出：[27,34] 或者 [34,27]
```

**提示：**

- `1 <= price.length <= 10^5`
- `1 <= price[i] <= 10^6`
- `1 <= target <= 2*10^6`



**c代码**

```c
/**
 * Note: The returned array must be malloced, assume caller calls free().
 */
int* twoSum(int* price, int priceSize, int target, int* returnSize) 
{
    // 升序很关键的
    // *returnSize = 2;
    // int* ret = (int*)malloc(sizeof(int)*2);

    // int left = 0;
    // int right = priceSize - 1;
    // while(left < right)
    // {
    //     if(price[left] + price[right] > target)
    //     {
    //         right--;
    //     }
    //     else if(price[left] + price[right] < target)
    //     {
    //         left++;
    //     }
    //     else 
    //     {
    //         ret[0] = price[left];
    //         ret[1] = price[right];
    //         break;
    //     }
    // }
    // return ret;

    *returnSize = 2;
    int* ret = (int*)malloc(sizeof(int) * 2);

    int left = 0;
    int right = priceSize - 1;
    while(left < right)
    {
        if(price[left] + price[right] > target)
        {
            right--;
        }
        else if(price[left] + price[right] < target)
        {
            left++;
        }
        else 
        {
            ret[0] = price[left];
            ret[1] = price[right];
            break;
        }
    }

    return ret;
}
```

**c++代码**

```c++
class Solution 
{
public:
    vector<int> twoSum(vector<int>& price, int target) 
    {
    // 1.找到左右指针
        int sz = price.size();
        int left = 0;
        int right = sz - 1;
        vector<int> v;
    // 2.左指针<右指针 中间一定有数据的
        while(left < right)
        {   
            // 根据单调性，大了，需要减小，right--
            if(price[left] + price[right] > target)
            {
                right--;
            }
            // 根据单调性，小了，需要增大，left++
            else if(price[left]  + price[right] < target)
            {
                left++;
            }
            // 找到了，
            else 
            {
                v.push_back(price[left]);
                v.push_back(price[right]);
                // 注意，注意，否则死循环的。需要break;
                break;
            }
        }

        return v;

        // int sz = price.size();
        // int left = 0;
        // int right = sz - 1;
        // vector<int> v;
        // while(left != right)
        // {
        //     if(price[left] + price[right] > target)
        //     {
        //         right--;  // 右边到左边递减
        //     }
        //     else if(price[left] + price[right] < target)
        //     {
        //         left++; //  左边到右边递增
        //     }
        //     else 
        //     {
        //         v.push_back(price[left]);
        //         v.push_back(price[right]);
        //         break;
        //     }
        // }
        // return v;

        // vector<int> v;
        // int sz = price.size();  
        // for(int i  = 0; i < sz - 1; i++)
        // {
        //     for(int j = i + 1; j < sz; j++)
        //     {
        //         if(price[i] + price[j] == target)
        //         {
        //             v.push_back(price[i]);
        //             v.push_back(price[j]);
        //             break;
        //         }
        //     }
        // }
        // return v;
    }
};
```

## 15.三数之和

给你一个整数数组 `nums` ，判断是否存在三元组 `[nums[i], nums[j], nums[k]]` 满足 `i != j`、`i != k` 且 `j != k` ，同时还满足 `nums[i] + nums[j] + nums[k] == 0` 。请你返回所有和为 `0` 且不重复的三元组。

**注意：**答案中不可以包含重复的三元组。

**示例 1：**

```
输入：nums = [-1,0,1,2,-1,-4]
输出：[[-1,-1,2],[-1,0,1]]
解释：
nums[0] + nums[1] + nums[2] = (-1) + 0 + 1 = 0 。
nums[1] + nums[2] + nums[4] = 0 + 1 + (-1) = 0 。
nums[0] + nums[3] + nums[4] = (-1) + 2 + (-1) = 0 。
不同的三元组是 [-1,0,1] 和 [-1,-1,2] 。
注意，输出的顺序和三元组的顺序并不重要。
```

**示例 2：**

```
输入：nums = [0,1,1]
输出：[]
解释：唯一可能的三元组和不为 0 。
```

**示例 3：**

```
输入：nums = [0,0,0]
输出：[[0,0,0]]
解释：唯一可能的三元组和为 0 。
```

**提示：**

- `3 <= nums.length <= 3000`
- `-105 <= nums[i] <= 105`

**c代码**

```c
/**
 * Return an array of arrays of size *returnSize.
 * The sizes of the arrays are returned as *returnColumnSizes array.
 * Note: Both returned array and *columnSizes array must be malloced, assume caller calls free().
 */
int** threeSum(int* nums, int numsSize, int* returnSize, int** returnColumnSizes) 
{
    // for(int i = 0; i < numsSize - 1; i++)
    // {
    //     for(int j = 0; i < numsSize - 1 - i; j++)
    //     {
    //         if(nums[j] > nums[j + 1])
    //         {
    //             int temp = nums[j];
    //             nums[j] = nums[j +1];
    //             nums[j + 1] = temp;
    //         }
    //     }
    // }

    *returnSize = 0;
    if(numsSize < 3)
    {
        return NULL;
    }

    int cmp(const void* a, const void* b)
    {
        return *(int*)a - *(int*)b;
    }
    qsort(nums, numsSize, sizeof(int),  cmp);

    int capacity = numsSize*numsSize;
    int** result = (int**)malloc(sizeof(int*) * capacity);         // 定义一个 capacity*capacity的数组，里面存放指针。
    *returnColumnSizes = (int*)malloc(sizeof(int*) * capacity);    // 

    for(int i = 0; i < numsSize - 2; i++)
    {
        if(nums[i] > 0) break;
        if(i > 0 && nums[i] == nums[i-1]) continue;

        int letf = i + 1;
        int right = numsSize - 1;
        while(letf < right)
        {
            int sum = nums[i] + nums[letf] + nums[right]; // 注意溢出
            if(sum == 0)
            {
                result[*returnSize] = (int*)malloc(sizeof(int)*3);
                result[*returnSize][0] = nums[i];
                result[*returnSize][1] = nums[letf];
                result[*returnSize][2] = nums[right];

                // 记录这一行的列数 (固定是3)
                (*returnColumnSizes)[*returnSize] = 3;
                
                // 结果总数 +1
                (*returnSize)++;

                while(letf < right && nums[letf]  ==  nums[letf   + 1]) letf++;
                while(letf < right && nums[right] ==  nums[right] - 1) right--;
                letf++;
                right--;
            }
            else if(sum < 0) 
            {
                letf++;
            }
            else 
            {
                right--;
            }
        }
    }

    return result;
}
```

**c++代码**

```c++
class Solution 
{
public:
    vector<vector<int>> threeSum(vector<int>& nums) 
    {
        int size = nums.size();
        sort(nums.begin(), nums.end());
        vector<vector<int>> ret;

        if(size < 3)
        {
            return ret;
        }

        for(int i = 0; i < size - 2; ++i)
        {
            if(nums[i] > 0)
            {
                break;
            }

            if(i > 0 && nums[i] == nums[i - 1])
            {
                continue;
            }

            int left = i + 1;
            int right = size - 1;
            while(left < right)
            {
                int sum = nums[left] + nums[right] + nums[i];
                if(sum > 0)
                {
                    right--;
                }
                else if(sum < 0) 
                {
                    left++;
                }
                else 
                {
                    ret.push_back({nums[i], nums[left], nums[right]});

                    left++;
                    right--;
                    while(left < right && nums[left] == nums[left - 1])
                    {
                        left++;
                    }

                    while(left < right && nums[right] == nums[right + 1])
                    {
                        right--;
                    }
                }
            }
        }

        return ret;
    }
/*
        vector<vector<int>> ret;
        int n = nums.size();

        //1.排序
        sort(nums.begin(), nums.end());

        // 特殊情况，没有三个数直接返回的。
        if(nums.size() < 3)
        {
            return ret;
        }

        // 2.固定第一个数
        for(int i = 0; i < n - 2; ++i)
        {   
            // 最小的数大于零，直接退出
            if(nums[i] > 0)
            {
                break;
            } 

            // 3.去重固定的第一个数，第一次不需要进程去重的。后面才需要的。
            if(i > 0 && nums[i] == nums[i - 1])
            {
                continue;
            }

            // 1.双指针的left和right;
            int left = i + 1;
            int right = n - 1;

            while(left < right)
            {
                int sum = nums[i] + nums[left] + nums[right];
                if(sum > 0)
                {
                    right--;
                }
                else if(sum < 0)
                {
                    left++;
                }
                else 
                {
                    ret.push_back({nums[i], nums[left], nums[right]});
                    // 1. 已经满足了，所以双指针都需要移动的
                    left++;
                    right--;

                    // 2.开始去重了
                    // 2.1去重的关键，left<right. 
                    // 2.2 nums[left] == nums[left-1], 目前的数==前面的一个数
                    while(left < right && nums[left] == nums[left-1])
                    {
                        left++;
                    }
                    while(left < right && nums[right] == nums[right + 1])
                    {
                        right--;
                    }

                    // 3.完成去重的时候。 nums[left]和nums[right]都不相等了的
                }
            }

        }

        return ret;
*/

        // vector<vector<int>> ret;
        // // 1.排序
        // sort(nums.begin(), nums.end());

        // // 2.双指针算法
        // int n = nums.size();
        // for(int i = 0; i < n; ) // 固定第一个数
        // {
        //     if(nums[i] > 0) break; // 最小的i都大于零，直接退出就行了的

        //     int target = -nums[i];
        //     int left = i + 1;
        //     int right = n - 1;

        //     while(left < right)
        //     {
        //         int sum = nums[left] + nums[right];
        //         if(sum > target)
        //         {
        //             right--;
        //         }
        //         else if(sum < target)
        //         {
        //             left++;
        //         }
        //         else 
        //         {
        //              ret.push_back({nums[i], nums[left], nums[right]});
        //             left++;
        //             right--;

        //             // 去重的left和right;
        //             while(left < right && nums[left] == nums[left-1])
        //             {
        //                 left++;
        //             }
        //             while(left < right && nums[right] == nums[right+1])
        //             {
        //                 right--;
        //             }
        //         }


        //     }
        //         // 去重right;
        //         i++;
        //         while(i < n && nums[i] == nums[i-1])
        //         {
        //             i++;
        //         }

          
        // }
        // return ret;




        // vector<vector<int>> ret;
        // int n = nums.size();
        // sort(nums.begin(), nums.end());
        // if (n < 3) return ret ;

        // for(int i = 0; i < n - 2; i++)
        // {
        //     if(nums[i] > 0) break; // 已经是排序的了，最小的都大于零，其它的也大于零了。
        //     int left = i + 1;
        //     int right = n - 1;

        //     if(i > 0 && nums[i] == nums[i-1]) continue; // 第一次不用重复，后面得才开始去重。num[i] num[i-1]判断已经走过的数字

        //     while(left < right)
        //     {
        //         int sum = nums[i] + nums[left] + nums[right];
        //         if(sum > 0)
        //         {
        //             right--;
        //         }
        //         else if(sum < 0)
        //         {
        //             left++;
        //         }
        //         else 
        //         {
        //             ret.push_back({nums[i], nums[left], nums[right]});
        //             while(left < right && nums[left] == nums[left + 1]) left++;
        //             while(left < right && nums[right] == nums[right - 1]) right--;
        //             left++;
        //             right--;
        //         }
        //     }
        // }
        // return ret;
        //1.暴力解法，暴力枚举。
        //2. 如何去重？

        // 1.先排序，枚举，set去重

        // 1.排序，双指针或者二分法，
        // 找到一种结果之后，跳过重复的元素。 left right 和i
        // 需要两个地方去重 
        // vector<vector<int>> ret;
        // int n = nums.size();
        
        // sort(nums.begin(), nums.end());
        // for(int i = 0; i < n; )
        // {
        //     if(nums[i] > 0) break;
        //     int left = i + 1;
        //     int right = n - 1;
        //     int target = -nums[i];

        //     while(left < right)
        //     {
        //         int sum = nums[left] + nums[right];
        //         if(sum > target)
        //         { 
        //             right--;
        //         }
        //         else if(sum < target) 
        //         {
        //             left++;
        //         }
        //         else 
        //         {
        //             ret.push_back({nums[i], nums[left], nums[right]});
        //             left++;
        //             right--;

        //             while(left < right && nums[left] == nums[left-1]) 
        //             {
        //                 left++;
        //             }
        //             while(left < right && nums[right] == nums[right+1]) 
        //             {
        //                 right--;
        //             }
        //         }
        //     }

        //     i++;
        //     while(i < n && nums[i] == nums[i-1]) i++;
        // }
        // return ret;

    //     vector<vector<int>> ret;
    //     int n = nums.size();
    //     sort(nums.begin(), nums.end());

    //     for(int i = 0; i < n - 2; i++)
    //     {
    //         if(nums[i] > 0) break;

    //         if(i > 0 && nums[i] == nums[i-1]) continue; // 第一次外面的去重了

    //         int left = i + 1;
    //         int right = n - 1;
    //         while(left < right)
    //         {
    //             int sum = nums[i] + nums[left] + nums[right];
    //             if(sum ==  0)
    //             {
    //                 ret.push_back({nums[i], nums[left], nums[right]});
    //                 while (left < right && nums[left] == nums[left + 1]) left++;
    //                 while (left < right && nums[right] == nums[right - 1]) right--;
                    
    //                 left++;
    //                 right--;
    //             }
    //             else if(sum <  0) 
    //             {
    //                 left++;
    //             }
    //             else 
    //             {
    //                 right--;
    //             }
    //         }
    //     }
    //     return ret;
    // }
};
```



## 18.四数之和

给你一个由 `n` 个整数组成的数组 `nums` ，和一个目标值 `target` 。请你找出并返回满足下述全部条件且**不重复**的四元组 `[nums[a], nums[b], nums[c], nums[d]]` （若两个四元组元素一一对应，则认为两个四元组重复）：

- `0 <= a, b, c, d < n`
- `a`、`b`、`c` 和 `d` **互不相同**
- `nums[a] + nums[b] + nums[c] + nums[d] == target`

你可以按 **任意顺序** 返回答案 。

**示例 1：**

```
输入：nums = [1,0,-1,0,-2,2], target = 0
输出：[[-2,-1,1,2],[-2,0,0,2],[-1,0,0,1]]
```

**示例 2：**

```
输入：nums = [2,2,2,2,2], target = 8
输出：[[2,2,2,2]]
```

**提示：**

- `1 <= nums.length <= 200`
- `-109 <= nums[i] <= 109`
- `-109 <= target <= 109`

**c代码**

```c
#include <stdlib.h>

static int cmpInt(const void* a, const void* b)
{
    int x = *(const int*)a;
    int y = *(const int*)b;

    if (x < y)
    {
        return -1;
    }
    if (x > y)
    {
        return 1;
    }

    return 0;
}

/**
 * Return an array of arrays of size *returnSize.
 * The sizes of the arrays are returned as *returnColumnSizes array.
 *
 * Both returned array and *returnColumnSizes must be malloced.
 * The caller is responsible for freeing them.
 */
int** fourSum(int* nums,
              int numsSize,
              int target,
              int* returnSize,
              int** returnColumnSizes)
{
    *returnSize = 0;
    *returnColumnSizes = NULL;

    if (nums == NULL || numsSize < 4)
    {
        return NULL;
    }

    /* 双指针和去重的前提是数组有序 */
    qsort(nums, numsSize, sizeof(int), cmpInt);

    int capacity = 16;

    int** result = (int**)malloc(sizeof(int*) * capacity);
    *returnColumnSizes = (int*)malloc(sizeof(int) * capacity);

    if (result == NULL || *returnColumnSizes == NULL)
    {
        free(result);
        free(*returnColumnSizes);

        *returnColumnSizes = NULL;
        return NULL;
    }

    for (int i = 0; i < numsSize - 3; ++i)
    {
        /* i 去重 */
        if (i > 0 && nums[i] == nums[i - 1])
        {
            continue;
        }

        /*
         * 剪枝：
         * 当前 i 对应的最小四数和已经大于 target，
         * 后面的 nums[i] 更大，可以直接结束。
         */
        long long minSum =
            (long long)nums[i] +
            nums[i + 1] +
            nums[i + 2] +
            nums[i + 3];

        if (minSum > target)
        {
            break;
        }

        /*
         * 当前 i 对应的最大四数和仍然小于 target，
         * 说明当前 i 太小，继续枚举下一个 i。
         */
        long long maxSum =
            (long long)nums[i] +
            nums[numsSize - 1] +
            nums[numsSize - 2] +
            nums[numsSize - 3];

        if (maxSum < target)
        {
            continue;
        }

        for (int j = i + 1; j < numsSize - 2; ++j)
        {
            /* j 去重 */
            if (j > i + 1 && nums[j] == nums[j - 1])
            {
                continue;
            }

            int left = j + 1;
            int right = numsSize - 1;

            while (left < right)
            {
                long long sum =
                    (long long)nums[i] +
                    nums[j] +
                    nums[left] +
                    nums[right];

                if (sum == (long long)target)
                {
                    /*
                     * 当前容量不够时扩容。
                     */
                    if (*returnSize == capacity)
                    {
                        int newCapacity = capacity * 2;

                        int** newResult = (int**)realloc(
                            result,
                            sizeof(int*) * newCapacity);

                        int* newColumnSizes = (int*)realloc(
                            *returnColumnSizes,
                            sizeof(int) * newCapacity);

                        if (newResult == NULL || newColumnSizes == NULL)
                        {
                            /*
                             * LeetCode 一般不要求处理分配失败。
                             * 这里进行基本清理。
                             */
                            if (newResult != NULL)
                            {
                                result = newResult;
                            }

                            if (newColumnSizes != NULL)
                            {
                                *returnColumnSizes = newColumnSizes;
                            }

                            for (int k = 0; k < *returnSize; ++k)
                            {
                                free(result[k]);
                            }

                            free(result);
                            free(*returnColumnSizes);

                            *returnSize = 0;
                            *returnColumnSizes = NULL;

                            return NULL;
                        }

                        result = newResult;
                        *returnColumnSizes = newColumnSizes;
                        capacity = newCapacity;
                    }

                    int* row = (int*)malloc(sizeof(int) * 4);

                    if (row == NULL)
                    {
                        for (int k = 0; k < *returnSize; ++k)
                        {
                            free(result[k]);
                        }

                        free(result);
                        free(*returnColumnSizes);

                        *returnSize = 0;
                        *returnColumnSizes = NULL;

                        return NULL;
                    }

                    row[0] = nums[i];
                    row[1] = nums[j];
                    row[2] = nums[left];
                    row[3] = nums[right];

                    result[*returnSize] = row;
                    (*returnColumnSizes)[*returnSize] = 4;
                    (*returnSize)++;

                    left++;
                    right--;

                    /* left 去重 */
                    while (left < right &&
                           nums[left] == nums[left - 1])
                    {
                        left++;
                    }

                    /* right 去重 */
                    while (left < right &&
                           nums[right] == nums[right + 1])
                    {
                        right--;
                    }
                }
                else if (sum < (long long)target)
                {
                    left++;
                }
                else
                {
                    right--;
                }
            }
        }
    }

    /*
     * 没有找到结果时，释放预先申请的空间。
     */
    if (*returnSize == 0)
    {
        free(result);
        free(*returnColumnSizes);

        *returnColumnSizes = NULL;
        return NULL;
    }

    return result;
}
```

**c++代码**

```c++
class Solution {
public:
    vector<vector<int>> fourSum(vector<int>& nums, int target) 
    {
        vector<vector<int>> ret;
        sort(nums.begin(), nums.end());

        int n = nums.size();
        if (n < 4) return ret;

        for(int i = 0; i < n - 3; ++i)
        {
            // 1.跳过第一个数
            if(i > 0 && nums[i] == nums[i-1])
            {
                continue;
            }

            for(int j = i + 1; j < n - 2; ++j)
            {   
                // 2.跳过第二个数。
                if(j > i + 1 && nums[j] == nums[j-1])
                {
                    continue;
                }

                int left = j + 1;
                int right = n - 1;
                while(left < right)
                {
                    long long sum = (long long)nums[i] + nums[j] + nums[left] + nums[right];
                    if(sum == target)
                    {
                        ret.push_back({nums[i], nums[j], nums[left], nums[right]});
                        left++;
                        right--;

                        while(left < right && nums[left] == nums[left-1]) left++;
                        while(left < right && nums[right] == nums[right+1]) right--;
                    }
                    else if( sum > target)
                    {
                        right--;
                    }
                    else 
                    {
                        left++;
                    }
                }
            }
        }

        return ret;

        // vector<vector<int>> ret;
        // sort(nums.begin(), nums.end());

        // //1. a.固定一个数a, target;
        // //2. a []三数之和等于 target-a;
        // //3. a b[] 双指针等于 target - a - b;

        // // 不重复，不漏
        // // a b [left ...  right]

        // int n = nums.size();
        // if (n < 4) return ret;

        // for(int i = 0; i < n - 3; i++) // 固定数a
        // {
        //     if(i > 0 && nums[i] == nums[i - 1]) continue;

        //     for(int j = i + 1; j < n - 2; j++) // 固定数b;
        //     {
        //         if(j > i + 1 && nums[j] == nums[j - 1])  continue;

        //         int left = j + 1;
        //         int right = n - 1;

        //         while(left < right)
        //         {
        //             long long sum = (long long)nums[i] + nums[j] + nums[left] + nums[right];
        //             if(sum == target)
        //             {
        //                 ret.push_back({nums[i], nums[j], nums[left], nums[right]});

        //                 while(left < right && nums[left] == nums[left+1]) left++;
        //                 while(left < right && nums[right] == nums[right-1]) right--;
        //                 left++;
        //                 right--;
        //             }
        //             else if(sum > target)
        //             {
        //                 right--;
        //             }
        //             else 
        //             {
        //                 left++;
        //             }
        //         }
        //     }
        // }
        // return ret;
    }
};
```



