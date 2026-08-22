---
title: 深入理解C语言指针（四）：回调函数与qsort
date: 2026-08-22
categories: C 语言
tags: [C语言, 函数指针, 回调函数, qsort]
description: 理解回调函数的设计思想，掌握qsort的比较函数和通用排序实现原理。
---

# 深入理解C语言指针（四）：回调函数与qsort

## 1. 什么是回调函数

回调函数是通过函数指针传递给另一个函数，并在合适时机被调用的函数。它把“固定流程”和“可变行为”分离开。

```c
int add(int x, int y) { return x + y; }
int sub(int x, int y) { return x - y; }

int calculate(int x, int y, int (*operation)(int, int))
{
    return operation(x, y);
}
```

调用：

```c
int a = calculate(10, 5, add);
int b = calculate(10, 5, sub);
```

`calculate` 不关心具体运算，只负责组织调用过程。

## 2. qsort函数

`qsort` 声明在 `<stdlib.h>` 中：

```c
void qsort(void *base, size_t count, size_t size,
           int (*compare)(const void *, const void *));
```

参数含义：

- `base`：待排序数据首地址；
- `count`：元素个数；
- `size`：每个元素的字节数；
- `compare`：比较函数。

比较函数返回值约定：小于0表示第一个元素应在前；等于0表示相等；大于0表示第二个元素应在前。

## 3. 整数排序

```c
#include <stdio.h>
#include <stdlib.h>

int compare_int(const void *left, const void *right)
{
    int a = *(const int *)left;
    int b = *(const int *)right;
    return (a > b) - (a < b);
}

int main(void)
{
    int arr[] = {9, 1, 5, 3, 7};
    size_t count = sizeof(arr) / sizeof(arr[0]);
    qsort(arr, count, sizeof(arr[0]), compare_int);

    for (size_t i = 0; i < count; ++i)
        printf("%d ", arr[i]);
    return 0;
}
```

不建议直接 `return a - b;`，因为极端值相减可能发生有符号整数溢出。

## 4. 结构体排序

```c
#include <string.h>

struct Student
{
    char name[20];
    int age;
};

int compare_age(const void *left, const void *right)
{
    const struct Student *a = left;
    const struct Student *b = right;
    return (a->age > b->age) - (a->age < b->age);
}

int compare_name(const void *left, const void *right)
{
    const struct Student *a = left;
    const struct Student *b = right;
    return strcmp(a->name, b->name);
}
```

同一批数据只需更换比较函数，即可按不同字段排序。

## 5. 模拟通用排序的关键

通用排序不知道元素类型，因此使用 `char *` 按字节移动，通过 `size` 定位元素：

```c
static void swap_bytes(void *a, void *b, size_t size)
{
    unsigned char *x = a;
    unsigned char *y = b;
    while (size--)
    {
        unsigned char tmp = *x;
        *x++ = *y;
        *y++ = tmp;
    }
}
```

```c
void generic_bubble_sort(void *base, size_t count, size_t size,
                         int (*compare)(const void *, const void *))
{
    char *data = base;
    for (size_t end = count; end > 1; --end)
        for (size_t i = 0; i + 1 < end; ++i)
            if (compare(data + i * size, data + (i + 1) * size) > 0)
                swap_bytes(data + i * size, data + (i + 1) * size, size);
}
```

## 6. 总结

回调的本质是把行为当作参数传递。`qsort` 通过 `void *`、元素大小和比较回调实现类型无关的排序，这也是C语言实现泛型接口的重要方式。
