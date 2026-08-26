---
title: 滑动窗口
date: 2026-08-24 17:07:00
categories:
  - 力扣
tags:
  - 滑动窗口
type: page
comments: false
---

## 209.长度最小的子数组

给定一个含有 `n` 个正整数的数组和一个正整数 `target` **。**

找出该数组中满足其总和大于等于 `target` 的长度最小的 **子数组** `[numsl, numsl+1, ..., numsr-1, numsr]` ，并返回其长度**。**如果不存在符合条件的子数组，返回 `0` 。

**示例 1：**

```
输入：target = 7, nums = [2,3,1,2,4,3]
输出：2
解释：子数组 [4,3] 是该条件下的长度最小的子数组。
```

**示例 2：**

```
输入：target = 4, nums = [1,4,4]
输出：1
```

**示例 3：**

```
输入：target = 11, nums = [1,1,1,1,1,1,1,1]
输出：
```

**提示：**

- `1 <= target <= 109`
- `1 <= nums.length <= 105`
- `1 <= nums[i] <= 104`

**进阶：**

- 如果你已经实现 `O(n)` 时间复杂度的解法, 请尝试设计一个 `O(n log(n))` 时间复杂度的解法。

**c代码**

```c
int minSubArrayLen(int target, int* nums, int numsSize) 
{
    // // 1.定义左右窗口和保存的结果
    // int left = 0;
    // int right = 0;
    // int ret = INT_MAX;
    // int sum = 0;
    // while(right < numsSize)
    // {
    //     sum += nums[right];
    //     while(sum >= target)
    //     {
    //         ret = ret < (right - left + 1) ?  ret : (right - left + 1); // 缩小窗口，可能left++还是大于目标值，所以while循环的
    //         sum -= nums[left++];                                        // 左边缩小窗口
    //     }
    //     right++;     // 右边扩大窗口的                                         
    // }
    // return ret == INT_MAX ? 0 : ret ;


    int left = 0;
    int right = 0;
    int ret = INT_MAX;
    int sum = 0;
    while(right < numsSize)
    {
        sum += nums[right];
        
        while(sum >= target)
        {
            ret = ret < (right - left + 1) ? ret : (right - left + 1);
            sum -= nums[left++];
        }

        right++;
    }

    return ret == INT_MAX ? 0 : ret;
}
```

**c++**

```c++
class Solution {
public:
    int minSubArrayLen(int target, vector<int>& nums) 
    {
        // 1.定义窗口的指针。
        int left = 0;
        int right = 0;
        int ret = INT_MAX; // 定义很大的值，是为了更新窗口信息的。
        int sum = 0;

        // 2.right到了头，数据遍历完毕了的。
        while(right < nums.size())
        {
            sum += nums[right];
            
            // 3.进窗口，就要判断一次的。
            while(sum >= target)
            {
                // 4.更新结果的
                ret = min(ret, right - left + 1); 

                // 5.出窗口，滑动一次的。
                sum -= nums[left++];
            }

            right++;
        }

        return ret == INT_MAX ? 0 : ret;

        /*
            1.暴力枚举
            2.
                2.[2,3,1,2,4,3]
                        right    
                3. 2 3 1 2 >=7 了
                 letf
                           right
                4. 2 3 1 2 4
                    letf    321<7
                4.
            利用单调性，使用同向双指针算法。
            同向双指针，滑动窗口呢。
            就是利用这个窗口，判断。

        */

        // int left = 0;
        // int right = 0;
        // int n = nums.size();
        // int ret = INT_MAX;
        // int sum = 0;
        // while(right < n)
        // {
        //     sum += nums[right];
        //     while(sum >= target)
        //     {   ret = min(ret, right - left + 1);
        //         sum -= nums[left++];
        //     }
        //     right++;
        // }
        // return ret == INT_MAX ? 0 : ret;

        // 最短的子数组，并且是连续的数组。
        // 滑动窗口
        // 1.暴力算法
           // [2,3,1,2,4,3]
           // target = 7
           // 暴力枚举全部的数

           //[2 3 1 4]
           // l     r >= target;
           //   l   r
        // 利用单调性，同向双指针,滑动窗口。
        // 怎么用呢？

        // 1.left = 0; right = 0;
        // 2.进入窗口
        // 3.判断 
        //   出窗口
        /*
            r
            2 3 1 2 4 3
            l

            1.l = 0; r  = 0; sum = 0;
            2.进入窗口 sum = 2
            3.进 sum = 5;
            4.进 sum = 6;
            5.进 sum = 8;
                出，更新sum(这里是这道题更新结果。)
                len = r-l
                sum = 6;
                l++(3)
            6.进  sum = 10;
                len = r - l;
                sum = 7;
                l++;(1)
                
                二次判断
                len = r - l;
                sum = 6;
                l++;l=(2)

            7.进
        */

        /*
            为什么是对的？
            单调性：
                  r
            2 3 1 2  4 3
            l

            l+r>=target，已经没有必要枚举后面的了的。
            
        */

        // 时间复杂度2N；N
        // int n = nums.size();
        // int sum = 0;
        // int ret = INT_MAX;
        // for(int left = 0, right = 0; right < n; right++)
        // {
        //     sum += nums[right]; // 进入窗口
        //     while(sum >= target) // 判断
        //     {
        //         ret = min(ret, right-left+1); // 跟新结果
        //         sum -= nums[left++];   // 滚出窗口
        //     }
        // }
        // return ret  == INT_MAX ? 0 : ret;

    }


/*
#include <vector>
#include <algorithm>
#include <climits> // 用于 INT_MAX

using namespace std;

class Solution {
public:
    int minSubArrayLen(int target, vector<int>& nums) {
        int n = nums.size();
        if (n == 0) return 0;

        int left = 0;
        int right = 0;
        int sum = 0;
        int minLen = INT_MAX; // 初始化为最大整数，方便后面取最小值

        // 移动 right 指针扩大窗口
        while (right < n) {
            sum += nums[right];

            // 当窗口内的和满足条件时，尝试缩小窗口
            while (sum >= target) {
                // 更新最小长度
                int currentLen = right - left + 1;
                minLen = min(minLen, currentLen);

                // 缩小窗口：减去左边的值，左指针右移
                sum -= nums[left];
                left++;
            }
            
            // 继续扩大窗口
            right++;
        }

        // 如果 minLen 还是 INT_MAX，说明没找到满足条件的子数组，返回 0
        return (minLen == INT_MAX) ? 0 : minLen;
    }
};
*/

};
```



## 3.无重复字符的最长子串

给定一个字符串 `s` ，请你找出其中不含有重复字符的 **最长 子串** 的长度。

**示例 1:**

```
输入: s = "abcabcbb"
输出: 3 
解释: 因为无重复字符的最长子串是 "abc"，所以其长度为 3。注意 "bca" 和 "cab" 也是正确答案。
```

**示例 2:**

```
输入: s = "bbbbb"
输出: 1
解释: 因为无重复字符的最长子串是 "b"，所以其长度为 1。
```

**示例 3:**

```
输入: s = "pwwkew"
输出: 3
解释: 因为无重复字符的最长子串是 "wke"，所以其长度为 3。
     请注意，你的答案必须是 子串 的长度，"pwke" 是一个子序列，不是子串。
```

**提示：**

- `0 <= s.length <= 105`
- `s` 由英文字母、数字、符号和空格组成

**c代码**

```c
int lengthOfLongestSubstring(char* s) 
{       
    // int left = 0;
    // int right = 0;
    // int  ret = 0;
    // int hash[128] = {0};

    // while(s[right] != '\0')
    // {
    //     hash[s[right]]++;          // 记录元素，进入
    //     while(hash[s[right]] > 1)  // 证明已经有两个元素是在里面，开始去重
    //     {
    //         hash[s[left++]]--;
    //     }
    //     ret = ret > (right - left + 1) ? ret : (right - left + 1);
    //     right++;  // 下一轮
    // }
    // return ret;

    /*
         r  
    pwwkew
    012345
       l
    */

    int left = 0;
    int right = 0;
    int ret  = 0;
    int hash[128] = {0};

    while(s[right] != '\0')
    {
        hash[s[right]]++;
        while(hash[s[right]] > 1)
        {
            hash[s[left++]]--;
        }

        ret = ret > (right - left + 1) ? ret : (right - left + 1);
        right++;
    }

    return ret;
}
```

**c++代码**

```c++
class Solution {
public:
    int lengthOfLongestSubstring(string s) 
    {
        vector<int> index(128, -1);

        int left = 0;
        int maxLen = 0;

        for(int right = 0; right < s.size(); ++right)
        {
            left = max(left, index[s[right]] + 1);

            index[s[right]] = right;

            maxLen = max(maxLen, right - left + 1);
        }

        return maxLen;

        // // 1.数组模拟哈希表。
        // int hash[128] = {0};
        
        // // 2.双指针,指针变量
        // int left = 0;
        // int right = 0;
        // int n = s.size();
        // int ret = 0;
        // while(right < n)
        // {
        //     // 3.进窗口，
        //     hash[s[right]]++; 

        //     // 4.出窗口，出现重复了的
        //     while(hash[s[right]] > 1)
        //     {
        //         hash[s[left++]]--; // 出窗口
        //     }

        //     // 5.更新结果
        //     ret = max(ret, right -  left + 1);

        //     right++; // 扩大窗口
        // }

        // return ret;


        // 连续不重复的子串 
        // abcabcbb

        /*     r  
            abcabcbb
            l
                r            
            abcabcbb
             l
                 r
            abcabcbb
              l  
                  r  
            abcabcbb
               a
        */
        // int n = s.size();
        // int left = 0;
        // int right = 0;
        // int hash[128] = {0};
        // int ret = 0;
        // while(right < n)
        // {
        //     hash[s[right]]++;
        //     while(hash [s[right]] > 1) // >1 需要有元素，退出窗口。直到这里没有大于1.去重成功了的。
        //     {
        //         hash[s[left++]]--; // 出窗口  left去重成功，则上面的s[right] < 1的。
        //     }
        //     ret = max(ret, right - left + 1);
        //     right++;            // 下一个元素进入窗口的
        // }

        // return ret;

        // 子串。子数组。都是连续的。  
        // 子序列是不连续的。
        /*
        abcabcbb
        abc bca 

        1.暴力解法
        abcabcbb
                r   
        de a bc a bca
        l
                  r   
        de a bc a bca
             l

                   r   
        de a bc a bca
              l
        // 双指针同一个方向，就是滑动指针。

        时间复杂度N

        */
        /*
        1.left right;
        2.进----字符进入hash_table right++
        3.判断 窗口内出现重复字符
            出 让重复的字符划出窗口，hash删除结果
        4.更新 重复的时候，更新

        为什么？？ 滑动窗口？这是因为重复了的。
        */
        
        // int hash[128] = {0}; // 数组模拟hash
        // int n = s.size();
        // int left = 0;
        // int right = 0;
        // int ret = 0;
        // while(right < n)
        // {
        //     hash[s[right]]++;
        //     while(hash[s[right]] > 1)
        //     {
        //         hash[s[left++]]--;
        //     }
        //     ret = max(ret, right-left+1);
        //     right++;
        // }
        // return ret;
        
        // int n = s.size();
        // int left = 0, right = 0; 
        // int count[128] = {0};
        // int ret = 0;
        // while(right < n)
        // {
        //     char c = s[right];
        //     count[c]++;

        //     while(count[c] > 1)
        //     {
        //         count[s[left]]--;
        //         left++;
        //     }

        //     ret = max(ret, right - left + 1);
        //     right++;
        // }
        // return ret;
    }
};
```



## 1004.最大连续1的个数III

给定一个二进制数组 `nums` 和一个整数 `k`，假设最多可以翻转 `k` 个 `0` ，则返回执行操作后 *数组中连续 `1` 的最大个数* 。

**示例 1：**

```
输入：nums = [1,1,1,0,0,0,1,1,1,1,0], K = 2
输出：6
解释：[1,1,1,0,0,1,1,1,1,1,1]
粗体数字从 0 翻转到 1，最长的子数组长度为 6。
```

**示例 2：**

```
输入：nums = [0,0,1,1,0,0,1,1,1,0,1,1,0,0,0,1,1,1,1], K = 3
输出：10
解释：[0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,1,1]
粗体数字从 0 翻转到 1，最长的子数组长度为 10。
```

**提示：**

- `1 <= nums.length <= 105`
- `nums[i]` 不是 0 就是 1
- `0 <= k <= nums.length`

**c代码**

```c
int longestOnes(int* nums, int numsSize, int k) 
{
    int left = 0;
    int right = 0;
    int zeros = 0;
    int ret = 0;
    for(right; right < numsSize; right++)
    {
        if(nums[right] == 0)
        {
            zeros++;
        }

        while(zeros > k) // 区间里面大于k个零，我们就开始让一些元素踢出去，然后更新区间的大小
        {
            if(nums[left++] == 0)
            {
                zeros--;
            }
        }

        ret = ret > (right - left + 1) ? ret : (right - left + 1);
    }    
    return ret;

    // int left = 0;
    // int right = 0;
    // int zeros = 0;
    // int ret = 0;
    // for(right; right < numsSize; ++right)
    // {
    //     if(nums[right] == 0)
    //     {
    //         zeros++;
    //     }

    //     while(zeros > k)
    //     {
    //         if(nums[left] == 0)
    //         {
    //             zeros--;
    //         }
    //     }
     
    //   ret = ret > (right - left + 1) ? ret : (right - left + 1);
    // }

    // return ret;
}
```

**c++代码**

```c++
class Solution {
public:
    int longestOnes(vector<int>& nums, int k) 
    {
        // 1.定义双指针 
        int left = 0;
        int right = 0;
        int n = nums.size();
        int count = 0;
        int ret = 0;

        while(right < n)
        {
            // 2.进入区间，统计一次零的个数
            if(nums[right] == 0)
            {
                count++;
            }

            // 3.区间的零的个数，大于目标值，出区间的。
            while(count > k)
            {
                if(nums[left++] == 0)
                {
                    count--;
                }
            }

            // 4.更新结果，然后进区间的。
            ret = max(ret, right - left + 1);
            right++;
        }
        return ret;

        // // 规划一个区间，区间的零 <=k, 就可以判断成功了。
        // int n = nums.size();
        // int left = 0;
        // int right = 0;
        // int count = 0;
        // int ret = 0;
        // while(right < n)
        // {
        //     // 进窗口，
        //     if(nums[right] == 0)
        //     {
        //         count++;
        //     }
            
        //     // 出窗口
        //     while(count > k)
        //     {
        //         if(nums[left++] == 0)
        //         {
        //             count--;
        //         }
        //     }
        //     ret = max(ret, right - left + 1);
        //     right++;

        // }
        // return ret;
    }
};
```



## 1658.将x减到0的最小操作数

给你一个整数数组 `nums` 和一个整数 `x` 。每一次操作时，你应当移除数组 `nums` 最左边或最右边的元素，然后从 `x` 中减去该元素的值。请注意，需要 **修改** 数组以供接下来的操作使用。

如果可以将 `x` **恰好** 减到 `0` ，返回 **最小操作数** ；否则，返回 `-1` 。

**示例 1：**

```
输入：nums = [1,1,4,2,3], x = 5
输出：2
解释：最佳解决方案是移除后两个元素，将 x 减到 0 。
```

**示例 2：**

```
输入：nums = [5,6,7,8,9], x = 4
输出：-1
```

**示例 3：**

```
输入：nums = [3,2,20,1,1,3], x = 10
输出：5
解释：最佳解决方案是移除后三个元素和前两个元素（总共 5 次操作），将 x 减到 0 。
```

**提示：**

- `1 <= nums.length <= 105`
- `1 <= nums[i] <= 104`
- `1 <= x <= 109`

**c代码**

```c
int minOperations(int* nums, int numsSize, int x) 
{
    int left = 0;
    int right = 0;
    int sum = 0;

    for(int i = 0; i < numsSize; ++i)
    {
        sum += nums[i];
    }

    int target = sum - x;

    if(target < 0)
    {
        return -1;
    }
    
    if(target == 0)
    {
        return numsSize;
    }

    int cursum = 0;
    int ret = -1;

    for(right; right < numsSize; ++right)
    {
        cursum += nums[right];

        while(cursum > target)
        {
            cursum -= nums[left++];
        }

        if(cursum == target)
        {
            ret = ret > (right - left + 1) ? ret : (right - left + 1);
        }
    }

    if(ret == -1)
    {
        return -1;
    }

    return numsSize - ret;
}
```

**c++代码**

```c++
class Solution {
public:
    int minOperations(vector<int>& nums, int x) 
    {
        int sum = 0;

        for(auto e : nums)
        {
            sum += e;
        }

        // 要寻找的目标子数组和
        int target = sum - x;

        // 特殊情况
        if(target < 0)
        {
            return -1;
        }

        // target == 0
        // 说明必须全部删除
        if(target == 0)
        {
            return nums.size();
        }

        int left = 0;
        int curSum = 0;

        int maxLen = -1;

        for(int right = 0; right < nums.size(); ++right)
        {
            curSum += nums[right];

            // 窗口过大
            while(curSum > target)
            {
                curSum -= nums[left];
                ++left;
            }

            // 找到目标
            if(curSum == target)
            {
                maxLen = max(maxLen, right - left + 1);
            }
        }

        if(maxLen == -1)
        {
            return -1;
        }

        return nums.size() - maxLen;
        // int sum = 0;
        // for(auto e : nums)
        // {
        //     sum += e;
        // }

        // int target = sum - x;
        // if(target < 0) 
        // {
        //     return -1;
        // }

        // int ret = -1;
        // for(int left = 0, right = 0, tmp = 0; right < nums.size(); right++)
        // {
        //     tmp += nums[right];
            
        //     while(tmp > target)
        //     {
        //         tmp -= nums[left++];
        //     }

        //     if(tmp == target)
        //     {
        //         ret = max(ret, right - left + 1);
        //     }
        // }

        // if(ret == -1)
        // {
        //     return ret;
        // }
        // else 
        // {
        //     return nums.size() - ret;
        // }

    }
};
```



## 904.水果成篮

你正在探访一家农场，农场从左到右种植了一排果树。这些树用一个整数数组 `fruits` 表示，其中 `fruits[i]` 是第 `i` 棵树上的水果 **种类** 。

你想要尽可能多地收集水果。然而，农场的主人设定了一些严格的规矩，你必须按照要求采摘水果：

- 你只有 **两个** 篮子，并且每个篮子只能装 **单一类型** 的水果。每个篮子能够装的水果总量没有限制。
- 你可以选择任意一棵树开始采摘，你必须从 **每棵** 树（包括开始采摘的树）上 **恰好摘一个水果** 。采摘的水果应当符合篮子中的水果类型。每采摘一次，你将会向右移动到下一棵树，并继续采摘。
- 一旦你走到某棵树前，但水果不符合篮子的水果类型，那么就必须停止采摘。

给你一个整数数组 `fruits` ，返回你可以收集的水果的 **最大** 数目。

**示例 1：**

```
输入：fruits = [1,2,1]
输出：3
解释：可以采摘全部 3 棵树。
```

**示例 2：**

```
输入：fruits = [0,1,2,2]
输出：3
解释：可以采摘 [1,2,2] 这三棵树。
如果从第一棵树开始采摘，则只能采摘 [0,1] 这两棵树。
```

**示例 3：**

```
输入：fruits = [1,2,3,2,2]
输出：4
解释：可以采摘 [2,3,2,2] 这四棵树。
如果从第一棵树开始采摘，则只能采摘 [1,2] 这两棵树。
```

**示例 4：**

```
输入：fruits = [3,3,3,1,2,1,1,2,3,3,4]
输出：5
解释：可以采摘 [1,2,1,1,2] 这五棵树。
```

**提示：**

- `1 <= fruits.length <= 105`
- `0 <= fruits[i] < fruits.length`

**c++代码**

```c++
class Solution {
public:
    int totalFruit(vector<int>& fruits) 
    {
        // int ret = 0;
        // // 1.统计窗口内出现了多少种水果的
        // unordered_map<int, int> hash; 

        // // 2.滑动窗口的区间
        // for(int left = 0, right = 0; right <fruits.size(); ++right)
        // {
        //     // 3.进窗口
        //     hash[fruits[right]]++; // 1.需要补充的知识。c++课程还没看完的。

        //     // 4.判读，水果的种类
        //     while(hash.size() > 2)
        //     {
        //         // 5.出窗口
        //         hash[fruits[left]]--;

        //         if(hash[fruits[left]] == 0)
        //         {
        //             hash.erase(fruits[left]);
        //         }

        //         left++;
        //     }

        //     ret = max(ret, right - left + 1);
        // }
        
        // return ret;

        int ret = 0;
        // 1.统计窗口内出现了多少种水果的
        int hash[100001] = {0};

        // 2.滑动窗口的区间
        for(int left = 0, right = 0, kind = 0; right <fruits.size(); ++right)
        {
            // 维护水果的种类
            if(hash[fruits[right]] == 0)
            {
                kind++;
            }

            // 3.进窗口
            hash[fruits[right]]++; // 1.需要补充的知识。c++课程还没看完的。


            // 4.判读，水果的种类
            while(kind > 2)
            {
                // 5.出窗口
                hash[fruits[left]]--;

                if(hash[fruits[left]] == 0)
                {
                    kind--;
                }

                left++;
            }

            ret = max(ret, right - left + 1);
        }
        
        return ret;
    }
};
```



## 438.找到字符串中所有字母异位词

给定两个字符串 `s` 和 `p`，找到 `s` 中所有 `p` 的 **异位词** 的子串，返回这些子串的起始索引。不考虑答案输出的顺序。

**示例 1:**

```
输入: s = "cbaebabacd", p = "abc"
输出: [0,6]
解释:
起始索引等于 0 的子串是 "cba", 它是 "abc" 的异位词。
起始索引等于 6 的子串是 "bac", 它是 "abc" 的异位词。
```

 **示例 2:**

```
输入: s = "abab", p = "ab"
输出: [0,1,2]
解释:
起始索引等于 0 的子串是 "ab", 它是 "ab" 的异位词。
起始索引等于 1 的子串是 "ba", 它是 "ab" 的异位词。
起始索引等于 2 的子串是 "ab", 它是 "ab" 的异位词。
```

**提示:**

- `1 <= s.length, p.length <= 3 * 104`
- `s` 和 `p` 仅包含小写字母

```c++
class Solution 
{
public:
    bool isequla(int* p1, int*p2)
    {
        for(int i = 0; i < 26; ++i)
        {
            if(p1[i] == p2[i])
            {
               continue;
            }
            else
            {
                return false;
            }
        }
        return true;
    }

    vector<int> findAnagrams(string s, string p) 
    {
        // int hash1[26] = {0};
        // int hash2[26] = {0};
        // int len = p.size();

        // for(int i = 0; i < len; ++i)
        // {
        //     hash2[p[i] - 'a']++;
        // }

        // int left = 0;
        // int right = 0;
        // vector<int> ret;
        // while(right < s.size())
        // {
        //     hash1[s[right] -'a']++;
        //     if(right - left + 1 == len)
        //     {
        //         if(isequla(hash1, hash2))
        //         {
        //             ret.push_back(left);
        //         }

        //         hash1[s[left] - 'a']--;
        //         left++;
        //     }
        //     right++;
        // }

        // return ret;

//  ###################
//  维护一个有效字符数变量，不需要进行判断 数组的
        int hash1[26] = {0}; // 字符串p的每个字符出现的个数
        vector<int> ret;

        for(auto ch : p)
        {
            hash1[ch - 'a']++;
        }
        int m = p.size();

        int hash2[26] = {0}; // 统计窗口里面

        for(int left = 0, right = 0, count =0; right < s.size(); right++)
        {
            char in = s[right];
            hash2[in - 'a']++;  // 进窗口

            if(hash2[in - 'a'] <= hash1[in - 'a']) // 维护count
            {
                count++;
            }

            if(right - left + 1 > m)
            {   
                char out = s[left++];
                if(hash2[out - 'a']-- <= hash1[out - 'a'])
                {
                    count--;
                }
            }

            if(count == m)
            {
                ret.push_back(left);
            }
        }

        return ret;
    }
};
```



## 30.串联所有单词的子串

给定一个字符串 `s` 和一个字符串数组 `words`**。** `words` 中所有字符串 **长度相同**。

 `s` 中的 **串联子串** 是指一个包含 `words` 中所有字符串以任意顺序排列连接起来的子串。

- 例如，如果 `words = ["ab","cd","ef"]`， 那么 `"abcdef"`， `"abefcd"`，`"cdabef"`， `"cdefab"`，`"efabcd"`， 和 `"efcdab"` 都是串联子串。 `"acdbef"` 不是串联子串，因为他不是任何 `words` 排列的连接。

返回所有串联子串在 `s` 中的开始索引。你可以以 **任意顺序** 返回答案。

**示例 1：**

```
输入：s = "barfoothefoobarman", words = ["foo","bar"]
输出：[0,9]
解释：因为 words.length == 2 同时 words[i].length == 3，连接的子字符串的长度必须为 6。
子串 "barfoo" 开始位置是 0。它是 words 中以 ["bar","foo"] 顺序排列的连接。
子串 "foobar" 开始位置是 9。它是 words 中以 ["foo","bar"] 顺序排列的连接。
输出顺序无关紧要。返回 [9,0] 也是可以的。
```

**示例 2：**

```
输入：s = "wordgoodgoodgoodbestword", words = ["word","good","best","word"]
输出：[]
解释：因为 words.length == 4 并且 words[i].length == 4，所以串联子串的长度必须为 16。
s 中没有子串长度为 16 并且等于 words 的任何顺序排列的连接。
所以我们返回一个空数组。
```

**示例 3：**

```
输入：s = "barfoofoobarthefoobarman", words = ["bar","foo","the"]
输出：[6,9,12]
解释：因为 words.length == 3 并且 words[i].length == 3，所以串联子串的长度必须为 9。
子串 "foobarthe" 开始位置是 6。它是 words 中以 ["foo","bar","the"] 顺序排列的连接。
子串 "barthefoo" 开始位置是 9。它是 words 中以 ["bar","the","foo"] 顺序排列的连接。
子串 "thefoobar" 开始位置是 12。它是 words 中以 ["the","foo","bar"] 顺序排列的连接。
```

**提示：**

- `1 <= s.length <= 104`
- `1 <= words.length <= 5000`
- `1 <= words[i].length <= 30`
- `words[i]` 和 `s` 由小写英文字母组成

```c++
class Solution {
public:
    vector<int> findSubstring(string s, vector<string>& words) 
    {
        vector<int> ret;
        unordered_map<string, int> hash1; // 保持words所有单词的频次。   
        for(auto& s : words)
        {
            hash1[s]++;
        }


        int len =words[0].size(); // 一个单词多长
        int m = words.size(); // 多少个单词

        // 执行len次
        for(int i = 0; i < len; i++)
        {
            unordered_map<string, int> hash2;
            for(int left = i, right = i, count = 0; right + len <= s.size(); right += len)
            {
                string in = s.substr(right, len);
                hash2[in]++;
                
                if(hash2[in] <= hash1[in])
                {
                    count++;
                }

                if(right - left + 1 > len * m)
                {
                    string out = s.substr(left, len);
                    if(hash2[out] <= hash1[out]) count--;
                    hash2[out]--;

                    left += left;
                }

                if(count == m)
                {
                    ret.push_back(left);
                }
            }
    
        }

        return ret;
    }
};
```



## 76.最小覆盖子串

给定两个字符串 `s` 和 `t`，长度分别是 `m` 和 `n`，返回 s 中的 **最短窗口 子串**，使得该子串包含 `t` 中的每一个字符（**包括重复字符**）。如果没有这样的子串，返回空字符串 `""`。

测试用例保证答案唯一。

**示例 1：**

```
输入：s = "ADOBECODEBANC", t = "ABC"
输出："BANC"
解释：最小覆盖子串 "BANC" 包含来自字符串 t 的 'A'、'B' 和 'C'。
```

**示例 2：**

```
输入：s = "a", t = "a"
输出："a"
解释：整个字符串 s 是最小覆盖子串。
```

**示例 3:**

```
输入: s = "a", t = "aa"
输出: ""
解释: t 中两个字符 'a' 均应包含在 s 的子串中，
因此没有符合条件的子字符串，返回空字符串。
```

**提示：**

- `m == s.length`
- `n == t.length`
- `1 <= m, n <= 105`
- `s` 和 `t` 由英文字母组成

**进阶：**你能设计一个在 `O(m + n)` 时间内解决此问题的算法吗？

```c++
class Solution {
public:
    string minWindow(string s, string t) 
    {
        // 1.都是英文字符，
        // hash1,统计字符串2出现的频率
        int hash1[128]  = {0};
        int kinds = 0;
        for(auto e : t)
        {
            if(hash1[e] == 0)
                kinds++; // 这里就是一种映射
        }

        // 2.滑动窗口内每个字字符出现的频次
        int hash2[128] = {0};
        int minlen = INT_MAX, begin = -1;
        for(int left = 0, right = 0, count = 0; right < s.size(); right++)
        {
            char in = s[right];
            hash2[in]++;
            if(hash2[in] == hash1[in])
            {
                count++;
            }

            while(kinds == count)
            {
                if(right - left + 1 < minlen)
                {
                    minlen = right - left + 1;
                    begin = left;
                }
                
                char out = s[left++];
                if(hash2[out]-- == hash1[out]) 
                    count--;
            }
        }

        if(begin == -1) return "";
        else return s.substr(begin, minlen);
    }
};
```









