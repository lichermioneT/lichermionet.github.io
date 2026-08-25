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



**c代码**

```

```

**c++代码**

```

```



**c代码**

```

```

**c++代码**

```

```



**c代码**

```

```

**c++代码**

```

```



**c代码**

```

```

**c++代码**

```

```



**c代码**

```

```

**c++代码**

```

```



