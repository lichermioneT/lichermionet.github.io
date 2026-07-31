---
title: C语言分支和循环（上）：条件判断、循环控制与流程跳转
date: 2026-07-31 10:00:00
categories:
  - C 语言
tags:
  - C语言
  - if
  - switch
  - while
  - for
  - do-while
  - 流程控制
---

## 前言

C 语言是一门结构化程序设计语言。一个程序无论多么复杂，基本执行流程都可以由三种结构组合而成：

1. **顺序结构**：语句按照书写顺序依次执行；
2. **选择结构**：根据条件选择不同分支；
3. **循环结构**：在条件满足时重复执行一段代码。

C 语言使用 `if` 和 `switch` 实现选择结构，使用 `while`、`for` 和 `do...while` 实现循环结构，并通过 `break`、`continue` 和 `goto` 改变局部执行流程。

本文主要介绍：

- `if`、`else if` 和嵌套分支；
- 关系运算符与逻辑运算符；
- 条件运算符 `?:`；
- 短路求值；
- `switch`、`case`、`default` 和分支贯穿；
- `while`、`for`、`do...while`；
- `break` 与 `continue`；
- 循环嵌套和复杂度；
- `goto` 的限制与合理用途；
- 常见错误和面试问题。

> 本文示例以常见的 C11/C17 编译环境为背景。建议编译时开启 `-Wall -Wextra -Wpedantic`，让编译器尽早发现可疑条件和流程错误。

<!-- more -->

## 一、程序的三种基本结构

### 1.1 顺序结构

顺序结构是最普通的执行方式：

```c
int a = 10;
int b = 20;
int sum = a + b;
printf("%d\n", sum);
```

程序从上到下依次执行，没有条件选择，也没有重复。

### 1.2 选择结构

选择结构根据条件决定执行哪一段代码：

```c
if (temperature >= 30)
{
    printf("天气炎热\n");
}
else
{
    printf("天气不算炎热\n");
}
```

### 1.3 循环结构

循环结构用于重复执行：

```c
for (int i = 1; i <= 5; ++i)
{
    printf("%d ", i);
}
```

输出：

```text
1 2 3 4 5
```

真实程序通常是三种结构的组合。例如，循环读取用户输入，在循环内部通过分支判断是否合法，再执行对应操作。

## 二、条件中的真假

### 2.1 0 为假，非 0 为真

在 C 语言的条件判断中：

- 数值 0 表示假；
- 任意非 0 数值表示真。

```c
if (0)
{
    printf("不会执行\n");
}

if (5)
{
    printf("会执行\n");
}

if (-10)
{
    printf("也会执行\n");
}
```

不要误以为只有 1 才是真。1 是关系表达式和逻辑表达式常见的真值结果，但条件中的其他非 0 值也都被视为真。

### 2.2 关系和逻辑表达式产生 0 或 1

关系运算符和逻辑运算符的结果类型是 `int`，结果为 0 或 1：

```c
int a = 10;
int b = 20;

printf("%d\n", a < b);   // 1
printf("%d\n", a == b);  // 0
printf("%d\n", a && b);  // 1
```

### 2.3 使用 bool 提高可读性

C99 提供 `_Bool`。引入 `<stdbool.h>` 后，可以使用 `bool`：

```c
#include <stdbool.h>

bool logged_in = true;

if (logged_in)
{
    printf("登录成功\n");
}
```

`bool` 适合表达“是或否”的状态，但条件判断仍然遵循 0 为假、非 0 为真的规则。

## 三、if 语句

### 3.1 基本语法

`if` 的基本形式为：

```c
if (表达式)
{
    语句;
}
```

当表达式结果非 0 时执行分支，否则跳过。

例如，判断整数是否为奇数：

```c
#include <stdio.h>

int main(void)
{
    int number = 0;

    if (scanf("%d", &number) != 1)
    {
        printf("输入无效\n");
        return 1;
    }

    if (number % 2 != 0)
    {
        printf("%d 是奇数\n", number);
    }

    return 0;
}
```

这里使用 `number % 2 != 0`，而不是 `number % 2 == 1`。

在 C 语言中，负数余数的符号与被除数一致：

```c
-3 % 2  // -1
```

因此 `-3 % 2 == 1` 为假，但 -3 明明是奇数。使用 `!= 0` 对正负整数都成立。

### 3.2 if...else

二选一分支：

```c
if (number % 2 != 0)
{
    printf("奇数\n");
}
else
{
    printf("偶数\n");
}
```

只要 `number` 是整数，它要么是奇数，要么是偶数，所以适合使用 `if...else`。

### 3.3 输入验证也是分支

`scanf` 返回成功赋值的项目数量。应先检查输入是否成功：

```c
int age = 0;

if (scanf("%d", &age) != 1)
{
    printf("请输入整数年龄\n");
    return 1;
}

if (age < 0)
{
    printf("年龄不能为负数\n");
}
else if (age >= 18)
{
    printf("成年\n");
}
else
{
    printf("未成年\n");
}
```

分支不仅用于业务结果，也用于处理错误、边界和异常输入。

### 3.4 使用大括号控制复合语句

如果没有大括号，`if` 默认只控制紧随其后的一条语句：

```c
if (age >= 18)
    printf("成年\n");

printf("这句话总会执行\n");
```

缩进不会改变 C 语言语法。下面这段虽然缩进看起来像受 `if` 控制，实际第二个 `printf` 始终执行：

```c
if (age >= 18)
    printf("成年了\n");
    printf("可以办理成人业务\n");
```

正确写法：

```c
if (age >= 18)
{
    printf("成年了\n");
    printf("可以办理成人业务\n");
}
```

建议即使分支中只有一条语句，也保留大括号。后续添加代码时不容易引入控制范围错误。

### 3.5 else if 多分支

判断整数的符号：

```c
if (number > 0)
{
    printf("正数\n");
}
else if (number < 0)
{
    printf("负数\n");
}
else
{
    printf("零\n");
}
```

执行规则：

1. 从上向下判断；
2. 找到第一个为真的条件；
3. 执行对应分支；
4. 跳过后续所有 `else if` 和 `else`。

所以条件顺序非常重要。

### 3.6 区间判断的条件顺序

根据年龄分类：

```c
if (age < 0)
{
    printf("年龄无效\n");
}
else if (age < 18)
{
    printf("少年\n");
}
else if (age <= 44)
{
    printf("青年\n");
}
else if (age <= 59)
{
    printf("中年\n");
}
else if (age <= 89)
{
    printf("老年\n");
}
else
{
    printf("高龄老人\n");
}
```

到达 `age <= 44` 时，前面的 `age < 18` 已经为假，因此此处隐含了 `age >= 18`，不必重复书写完整区间。

### 3.7 嵌套 if

分支中可以继续嵌套分支：

```c
if (number > 0)
{
    if (number % 2 == 0)
    {
        printf("正偶数\n");
    }
    else
    {
        printf("正奇数\n");
    }
}
else
{
    printf("不是正数\n");
}
```

嵌套层数过深会降低可读性。实际代码可以通过提前返回、拆分函数或重新组织条件减少缩进。

### 3.8 悬空 else

规则是：

> `else` 总是与前面最近的、尚未匹配 `else` 的 `if` 结合。

例如：

```c
if (a == 1)
    if (b == 2)
        printf("A\n");
    else
        printf("B\n");
```

`else` 与 `if (b == 2)` 匹配，而不是与 `if (a == 1)` 匹配。

如果希望它与外层 `if` 匹配，应明确加大括号：

```c
if (a == 1)
{
    if (b == 2)
    {
        printf("A\n");
    }
}
else
{
    printf("B\n");
}
```

不要依靠缩进猜测 `else` 的归属，用大括号表达真实结构。

## 四、关系运算符

### 4.1 六种关系运算符

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `>` | 大于 | `a > b` |
| `<` | 小于 | `a < b` |
| `>=` | 大于等于 | `a >= b` |
| `<=` | 小于等于 | `a <= b` |
| `==` | 等于 | `a == b` |
| `!=` | 不等于 | `a != b` |

关系表达式通常用于 `if`、`while` 和 `for` 的条件部分。

### 4.2 == 与 = 不同

`==` 用于比较：

```c
if (x == 3)
{
    printf("x 等于 3\n");
}
```

`=` 用于赋值：

```c
x = 3;
```

下面的代码语法合法，但通常是错误：

```c
if (x = 3)
{
    printf("总会进入这个分支\n");
}
```

赋值表达式的结果是赋入的值 3，3 为非 0，所以条件为真。

开启编译器警告通常能发现这种可疑写法：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic main.c
```

如果确实要在条件中赋值，应把意图写清楚：

```c
int ch = 0;

while ((ch = getchar()) != EOF)
{
    putchar(ch);
}
```

### 4.3 常量写在左边不是必需规则

有些代码把常量写在左边：

```c
if (3 == x)
{
}
```

这样误写成 `3 = x` 时会编译失败。但现代编译器警告已经能很好地发现条件中的可疑赋值，团队更重要的是统一风格并开启警告。

### 4.4 C 语言不能直接写数学链式比较

错误思路：

```c
if (18 <= age <= 36)
{
    printf("青年\n");
}
```

C 会从左向右解释为：

```c
if ((18 <= age) <= 36)
```

`18 <= age` 的结果只可能是 0 或 1，而 0 和 1 都小于等于 36，所以条件几乎总是真。

正确写法：

```c
if (age >= 18 && age <= 36)
{
    printf("年龄在 18 到 36 之间\n");
}
```

### 4.5 浮点数相等比较

很多小数无法用二进制浮点数精确表示：

```c
double result = 0.1 + 0.2;

if (result == 0.3)
{
    // 不一定进入
}
```

数值计算中通常比较差值是否落在允许误差内：

```c
#include <math.h>

if (fabs(result - 0.3) < 1e-12)
{
    printf("近似相等\n");
}
```

固定写死的绝对误差并不适合所有数量级。严谨的数值程序需要根据数据范围同时考虑绝对误差和相对误差。

## 五、条件运算符 ?:

### 5.1 基本形式

条件运算符是 C 语言唯一的三目运算符：

```c
条件 ? 表达式1 : 表达式2
```

执行规则：

- 条件为真，只计算表达式 1；
- 条件为假，只计算表达式 2；
- 被选中表达式的结果成为整个条件表达式的结果。

### 5.2 求两个数中的较大值

```c
int max = a > b ? a : b;
```

等价分支：

```c
int max = 0;

if (a > b)
{
    max = a;
}
else
{
    max = b;
}
```

### 5.3 只有一个分支会被求值

```c
int denominator = 0;
int result = denominator != 0 ? 100 / denominator : 0;
```

当 `denominator` 为 0 时，`100 / denominator` 不会执行，因此不会发生整数除零。

这与 `&&`、`||` 一样，具有选择性求值特点。

### 5.4 不要过度嵌套

下面虽然合法，但不容易阅读：

```c
const char *level =
    score >= 90 ? "A" :
    score >= 80 ? "B" :
    score >= 60 ? "C" : "D";
```

条件运算符从右向左结合。简单赋值很适合 `?:`，复杂业务分支更适合 `if...else if`。

### 5.5 条件运算符与 if 的选择

适合条件运算符：

- 根据条件选择一个值；
- 表达式短小；
- 两个分支没有复杂副作用。

适合 `if...else`：

- 每个分支有多条语句；
- 需要日志、错误处理或提前返回；
- 条件较多；
- 使用三目运算符会降低可读性。

## 六、逻辑运算符

### 6.1 三种逻辑运算符

| 运算符 | 含义 | 为真的条件 |
| --- | --- | --- |
| `!` | 逻辑非 | 操作数为 0 |
| `&&` | 逻辑与 | 两侧都非 0 |
| `||` | 逻辑或 | 至少一侧非 0 |

### 6.2 逻辑非 !

`!` 把真假反转：

```c
int flag = 0;

if (!flag)
{
    printf("flag 为假\n");
}
```

`!` 的结果一定是 0 或 1：

```c
printf("%d\n", !0);    // 1
printf("%d\n", !100);  // 0
```

两个逻辑非可以把任意标量真值规范化为 0 或 1：

```c
int normalized = !!value;
```

### 6.3 逻辑与 &&

两侧条件都为真，结果才为真：

```c
if (month >= 3 && month <= 5)
{
    printf("春季\n");
}
```

可以用真值表表示：

| A | B | `A && B` |
| ---: | ---: | ---: |
| 0 | 0 | 0 |
| 0 | 非 0 | 0 |
| 非 0 | 0 | 0 |
| 非 0 | 非 0 | 1 |

### 6.4 逻辑或 ||

至少一个条件为真，结果就为真：

```c
if (month == 12 || month == 1 || month == 2)
{
    printf("冬季\n");
}
```

真值表：

| A | B | `A || B` |
| ---: | ---: | ---: |
| 0 | 0 | 0 |
| 0 | 非 0 | 1 |
| 非 0 | 0 | 1 |
| 非 0 | 非 0 | 1 |

### 6.5 闰年判断

公历闰年规则：

1. 能被 400 整除，是闰年；
2. 或者能被 4 整除但不能被 100 整除，也是闰年。

```c
int is_leap_year =
    (year % 400 == 0) ||
    (year % 4 == 0 && year % 100 != 0);

if (is_leap_year)
{
    printf("%d 是闰年\n", year);
}
else
{
    printf("%d 不是闰年\n", year);
}
```

括号并非全部是语法必需的，但能够直观表达两组规则。

### 6.6 运算符优先级

本章常见优先级由高到低可简化记为：

```text
! 
* / %
+ -
< <= > >=
== !=
&&
||
?:
=
```

不要把所有代码都建立在记忆优先级上。混合多种运算符时，使用括号表达意图：

```c
if ((age >= 18 && age <= 60) || has_special_permission)
{
}
```

## 七、短路求值

### 7.1 && 的短路

`&&` 先计算左操作数：

- 左侧为假，整个表达式必为假；
- 此时右操作数不再计算。

```c
if (denominator != 0 && numerator / denominator > 2)
{
}
```

当分母为 0 时，除法不会执行。

### 7.2 || 的短路

`||` 先计算左操作数：

- 左侧为真，整个表达式必为真；
- 此时右操作数不再计算。

```c
if (is_admin || check_permission(user))
{
}
```

当 `is_admin` 已经为真时，`check_permission` 不会调用。

### 7.3 利用短路保护指针

```c
if (pointer != NULL && *pointer > 0)
{
    printf("目标值为正数\n");
}
```

必须先判断指针非空，再解引用。交换顺序会失去保护：

```c
// 错误顺序：pointer 为空时，左侧已经解引用
if (*pointer > 0 && pointer != NULL)
{
}
```

### 7.4 短路运算保证先后顺序

C 标准保证 `&&` 和 `||` 先对左操作数求值，并在需要时才求值右操作数。

分析：

```c
int a = 0;
int b = 2;
int d = 4;

int result = a++ && ++b && d++;
```

执行过程：

1. 计算 `a++`，表达式产生旧值 0，然后 `a` 变为 1；
2. 左侧为假，后面的 `++b` 和 `d++` 都不执行；
3. `result` 得到 0；
4. 最终 `a == 1`、`b == 2`、`d == 4`。

### 7.5 不要滥用副作用

虽然短路顺序有保证，下面的代码仍然不够直观：

```c
ready && process_data();
```

它在 C 中合法，但如果调用函数是主要意图，使用 `if` 更清晰：

```c
if (ready)
{
    process_data();
}
```

尤其不要把大量自增、赋值和函数调用塞入一个逻辑表达式中。

## 八、switch 语句

### 8.1 基本语法

`switch` 适合根据一个离散值选择分支：

```c
switch (expression)
{
    case constant1:
        statement1;
        break;

    case constant2:
        statement2;
        break;

    default:
        default_statement;
        break;
}
```

执行过程：

1. 计算 `switch` 表达式；
2. 找到值相等的 `case` 标签；
3. 从该位置开始向下执行；
4. 遇到 `break` 或 `switch` 结束时离开；
5. 没有匹配项时，从 `default` 开始执行；没有 `default` 则什么也不做。

### 8.2 switch 表达式的类型

`switch` 的控制表达式必须具有整数类型或枚举类型，并会进行整型提升。

可以使用：

```c
int option;
char command;
enum Color color;
```

不能直接使用：

```c
// switch (3.14)        // 浮点数不允许
// switch ("start")     // 字符串不允许
```

字符串分支通常使用 `strcmp` 配合 `if...else`，或者先把字符串解析成枚举值。

### 8.3 case 必须是整数常量表达式

合法：

```c
switch (command)
{
    case 'A':
        break;
    case 10:
        break;
    case 2 + 3:
        break;
}
```

普通变量不能作为 `case`：

```c
int target = 3;

switch (value)
{
    // case target:  // 错误：不是整数常量表达式
    //     break;
}
```

同一个 `switch` 中，转换后的 `case` 值不能重复。

另外，`case` 和常量之间是否书写空格只是排版风格，不是语法要求；`case 1:` 和 `case  1:` 都可以。

### 8.4 break 与分支贯穿

`case` 本质上是跳转标签，不会自动在下一条 `case` 前停止。

```c
switch (day)
{
    case 1:
        printf("星期一\n");
        break;
    case 2:
        printf("星期二\n");
        break;
    default:
        printf("输入无效\n");
        break;
}
```

如果省略 `break`，执行会继续进入后续标签，这叫分支贯穿或 `fallthrough`。

### 8.5 有意利用分支贯穿

判断工作日和休息日：

```c
switch (day)
{
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
        printf("工作日\n");
        break;

    case 6:
    case 7:
        printf("休息日\n");
        break;

    default:
        printf("日期无效\n");
        break;
}
```

前面几个 `case` 没有语句，表示多个值共享同一个处理分支。

如果某个有实际语句的分支还要继续进入下一个分支，应加注释说明是故意贯穿，避免维护者误认为漏写 `break`。

### 8.6 default 的位置

`default` 可以出现在 `switch` 复合语句中的任意标签位置，不要求必须放在最后。

但由于分支会向下贯穿，位置仍然会影响执行流程。为提高可读性，通常把 `default` 放在最后并显式书写 `break`。

### 8.7 负数取余与 switch

讲义中常用 `n % 3` 判断余数 0、1、2，但如果 `n` 可以是负数：

```c
-7 % 3  // -1
```

此时只写 `case 0`、`case 1`、`case 2` 会漏掉负余数。

如果业务希望得到 0 到 2 的规范化余数，可以写：

```c
int remainder = ((n % 3) + 3) % 3;

switch (remainder)
{
    case 0:
        printf("余数为 0\n");
        break;
    case 1:
        printf("余数为 1\n");
        break;
    case 2:
        printf("余数为 2\n");
        break;
}
```

### 8.8 if 与 switch 如何选择

适合 `switch`：

- 判断同一个整数或枚举表达式；
- 分支对应若干离散常量；
- 希望多个值共享处理逻辑。

适合 `if...else`：

- 区间判断；
- 浮点比较；
- 字符串比较；
- 多个变量组成复杂条件；
- 分支条件不是简单相等判断。

## 九、while 循环

### 9.1 基本语法

```c
while (condition)
{
    loop_body;
}
```

执行顺序：

1. 判断条件；
2. 条件为假，直接结束；
3. 条件为真，执行循环体；
4. 回到条件继续判断。

`while` 可能一次也不执行。

### 9.2 打印 1 到 10

```c
int i = 1;

while (i <= 10)
{
    printf("%d ", i);
    ++i;
}

printf("\n");
```

一个计数循环通常包含：

- 初始化：`int i = 1`；
- 判断：`i <= 10`；
- 调整：`++i`。

忘记调整会导致死循环。

### 9.3 while(1)

```c
while (1)
{
    // 重复执行
}
```

由于 1 始终为真，这是无限循环。它不一定是错误，服务器事件循环、菜单循环和持续读取任务都可能有意使用无限循环，并通过 `break`、`return`、信号或外部状态退出。

### 9.4 逆序打印整数各位

假设输入是正整数：

```c
unsigned long long number = 0;

if (scanf("%llu", &number) != 1 || number == 0)
{
    printf("请输入正整数\n");
    return 1;
}

while (number != 0)
{
    printf("%llu ", number % 10);
    number /= 10;
}

printf("\n");
```

原理：

- `number % 10` 取得最低位；
- `number / 10` 去掉最低位。

注意，逆序打印不是“数值反转”。如果输入 1200，逐位输出会包含两个前导的 0；若存入反转后的整数 21，则原来的 0 不再保留。

### 9.5 以输入结果控制循环

```c
int value = 0;

printf("请输入整数，输入结束时停止：\n");

while (scanf("%d", &value) == 1)
{
    printf("读取到：%d\n", value);
}
```

这种写法把“读取成功”直接作为循环条件。

如果用户输入了不能转换的普通字符，`scanf` 会返回 0，而且错误字符仍可能留在输入流中。复杂交互程序更适合使用 `fgets` 读取整行，再用 `strtol` 解析。

## 十、for 循环

### 10.1 基本语法

```c
for (initialization; condition; adjustment)
{
    loop_body;
}
```

执行顺序：

1. 初始化，只执行一次；
2. 判断条件；
3. 条件为假，结束循环；
4. 条件为真，执行循环体；
5. 执行调整表达式；
6. 回到条件判断。

### 10.2 打印 1 到 10

```c
for (int i = 1; i <= 10; ++i)
{
    printf("%d ", i);
}
```

与计数有关的初始化、判断和调整集中在一行，通常比对应的 `while` 更容易维护。

### 10.3 循环变量的作用域

```c
for (int i = 0; i < 10; ++i)
{
    printf("%d\n", i);
}

// 这里不能再使用 i
```

在 `for` 初始化部分定义的变量，其作用域限制在整个 `for` 语句内。

### 10.4 三个表达式都可以省略

```c
for (;;)
{
    // 无限循环
}
```

省略条件相当于条件始终为真。虽然三个部分都可以省略，但两个分号不能省略。

也可以把调整放进循环体：

```c
int i = 0;

for (; i < 10;)
{
    printf("%d\n", i);
    ++i;
}
```

语法允许不代表可读性一定更好。

### 10.5 计算 1 到 100 中 3 的倍数之和

直接产生 3 的倍数：

```c
int sum = 0;

for (int value = 3; value <= 100; value += 3)
{
    sum += value;
}

printf("%d\n", sum);  // 1683
```

相比遍历 1 到 100 再判断 `value % 3 == 0`，这种写法更直接地表达了数据序列。

### 10.6 循环边界

遍历长度为 `length` 的数组：

```c
for (size_t i = 0; i < length; ++i)
{
    printf("%d\n", array[i]);
}
```

合法下标是 0 到 `length - 1`，所以条件是 `i < length`，不是 `i <= length`。

边界错误常见形式：

- 少执行一次；
- 多执行一次；
- 数组越界；
- 空数组时仍访问第一个元素。

### 10.7 无符号倒序循环陷阱

错误写法：

```c
for (size_t i = length - 1; i >= 0; --i)
{
}
```

`size_t` 是无符号类型，`i >= 0` 永远为真。减到 0 后再次递减会回绕成一个很大的值。

常见正确写法：

```c
for (size_t i = length; i-- > 0;)
{
    printf("index = %zu\n", i);
}
```

这里先比较旧值是否大于 0，再完成递减。

### 10.8 while 与 for 的选择

通常使用 `for`：

- 循环次数或下标范围明确；
- 初始化、判断、调整关系紧密；
- 遍历数组或固定区间。

通常使用 `while`：

- 迭代次数事先未知；
- 由输入、状态或事件决定是否继续；
- 主要逻辑不是简单计数。

它们在很多场景可以互相改写，选择重点是让循环意图清晰。

## 十一、do...while 循环

### 11.1 基本语法

```c
do
{
    loop_body;
} while (condition);
```

末尾的分号不能省略。

`do...while` 先执行循环体，再判断条件，所以循环体至少执行一次。

### 11.2 打印 1 到 10

```c
int i = 1;

do
{
    printf("%d ", i);
    ++i;
} while (i <= 10);
```

### 11.3 统计整数位数

即使数字是 0，也应该有一位，所以 `do...while` 很合适：

```c
long long number = 0;
int digits = 0;

if (scanf("%lld", &number) != 1)
{
    printf("输入无效\n");
    return 1;
}

do
{
    ++digits;
    number /= 10;
} while (number != 0);

printf("位数：%d\n", digits);
```

这个方法对负数也能统计十进制数字数量，并且不需要先取绝对值，避免最小负数无法转换为对应正数的问题。

### 11.4 菜单循环

菜单至少需要显示一次，也适合 `do...while`：

```c
int choice = 0;

do
{
    printf("1. 查询\n");
    printf("2. 修改\n");
    printf("0. 退出\n");
    printf("请选择：");

    if (scanf("%d", &choice) != 1)
    {
        printf("输入无效\n");
        return 1;
    }

    switch (choice)
    {
        case 1:
            printf("执行查询\n");
            break;
        case 2:
            printf("执行修改\n");
            break;
        case 0:
            printf("程序结束\n");
            break;
        default:
            printf("没有这个选项\n");
            break;
    }
} while (choice != 0);
```

## 十二、break

### 12.1 break 终止当前循环

```c
for (int i = 1; i <= 10; ++i)
{
    if (i == 5)
    {
        break;
    }

    printf("%d ", i);
}
```

输出：

```text
1 2 3 4
```

执行 `break` 后，程序跳到循环结束后的第一条语句。

### 12.2 break 只跳出最内层

```c
for (int row = 0; row < 3; ++row)
{
    for (int column = 0; column < 3; ++column)
    {
        if (column == 1)
        {
            break;
        }

        printf("(%d, %d)\n", row, column);
    }
}
```

内层 `break` 只结束内层循环，外层继续下一轮。

### 12.3 switch 中的 break

`switch` 中的 `break` 结束的是当前 `switch`。

如果 `switch` 位于循环内部：

```c
while (running)
{
    switch (command)
    {
        case 'q':
            break;  // 只离开 switch，不离开 while
    }
}
```

如果希望退出外层循环，可以：

- 修改循环控制变量；
- 使用 `return` 结束函数；
- 封装函数并返回；
- 在确有需要时使用 `goto` 跳到统一出口。

## 十三、continue

### 13.1 continue 的作用

`continue` 跳过本轮剩余语句，开始下一轮循环。

```c
for (int i = 1; i <= 10; ++i)
{
    if (i % 2 == 0)
    {
        continue;
    }

    printf("%d ", i);
}
```

输出奇数：

```text
1 3 5 7 9
```

### 13.2 continue 在 while 中的位置

在 `while` 中，`continue` 直接跳到条件判断：

```text
condition
    │ true
    ▼
loop body ──continue──▶ condition
```

危险写法：

```c
int i = 1;

while (i <= 10)
{
    if (i == 5)
    {
        continue;
    }

    printf("%d ", i);
    ++i;
}
```

当 `i == 5` 时跳过 `++i`，`i` 永远是 5，程序陷入死循环。

改进：

```c
int i = 0;

while (i < 10)
{
    ++i;

    if (i == 5)
    {
        continue;
    }

    printf("%d ", i);
}
```

### 13.3 continue 在 for 中的位置

在 `for` 中，`continue` 跳到调整表达式，然后再判断条件：

```text
loop body ──continue──▶ adjustment ──▶ condition
```

```c
for (int i = 1; i <= 10; ++i)
{
    if (i == 5)
    {
        continue;
    }

    printf("%d ", i);
}
```

即使执行 `continue`，`++i` 仍然会执行，因此不会停在 5。

### 13.4 continue 在 do...while 中的位置

在 `do...while` 中，`continue` 跳到末尾的条件判断，而不是直接回到循环体开头：

```c
int i = 0;

do
{
    ++i;

    if (i == 5)
    {
        continue;
    }

    printf("%d ", i);
} while (i < 10);
```

### 13.5 break 与 continue 对比

| 关键字 | 作用 | 下一步位置 |
| --- | --- | --- |
| `break` | 彻底结束当前循环或 `switch` | 结构之后 |
| `continue` | 跳过本轮剩余语句 | 下一轮循环 |

`continue` 只能用于循环；`break` 可以用于循环和 `switch`。

## 十四、循环嵌套

### 14.1 基本形式

循环体中可以继续包含循环：

```c
for (int row = 1; row <= 3; ++row)
{
    for (int column = 1; column <= 4; ++column)
    {
        printf("(%d, %d) ", row, column);
    }

    printf("\n");
}
```

外层循环每执行一次，内层循环会完整执行一轮。

### 14.2 打印乘法表

```c
for (int i = 1; i <= 9; ++i)
{
    for (int j = 1; j <= i; ++j)
    {
        printf("%d*%d=%-2d ", j, i, i * j);
    }

    printf("\n");
}
```

### 14.3 嵌套循环的复杂度

如果外层执行 `n` 次，内层每次也执行 `n` 次，总执行次数约为：

```text
n × n = n²
```

时间复杂度为 `O(n²)`。

但不能看到两个循环就机械判断为 `O(n²)`：

```c
for (int i = 0; i < n; ++i)
{
}

for (int j = 0; j < n; ++j)
{
}
```

两个并列循环总成本是 `O(n + n) = O(n)`。

### 14.4 判断素数

正整数 `n > 1` 是素数，当且仅当它不能被 2 到其平方根之间的任何整数整除。

```c
int is_prime(int number)
{
    if (number < 2)
    {
        return 0;
    }

    for (int divisor = 2;
         divisor <= number / divisor;
         ++divisor)
    {
        if (number % divisor == 0)
        {
            return 0;
        }
    }

    return 1;
}
```

使用 `divisor <= number / divisor`，而不是 `divisor * divisor <= number`，可以避免乘法溢出。

打印 100 到 200 之间的素数：

```c
for (int number = 100; number <= 200; ++number)
{
    if (is_prime(number))
    {
        printf("%d ", number);
    }
}
```

相比试除到 `number - 1`，只试除到平方根明显更高效。

### 14.5 多层循环提前退出

使用标志变量：

```c
int found = 0;

for (int row = 0; row < rows && !found; ++row)
{
    for (int column = 0; column < columns; ++column)
    {
        if (matrix[row][column] == target)
        {
            found = 1;
            break;
        }
    }
}
```

如果搜索逻辑可以封装成函数，直接 `return` 往往更清晰：

```c
int contains(const int matrix[][4],
             int rows,
             int target)
{
    for (int row = 0; row < rows; ++row)
    {
        for (int column = 0; column < 4; ++column)
        {
            if (matrix[row][column] == target)
            {
                return 1;
            }
        }
    }

    return 0;
}
```

## 十五、goto 语句

### 15.1 基本语法

`goto` 可以跳转到同一个函数中的标签：

```c
printf("before\n");
goto next;

printf("这条语句被跳过\n");

next:
printf("after\n");
```

标签后需要跟一条语句。如果只想把标签放在逻辑位置，可以接空语句：

```c
cleanup:
    ;
```

### 15.2 为什么不建议随意使用

大量任意跳转会：

- 打乱自上而下的控制流；
- 让变量状态难以追踪；
- 增加维护和测试难度；
- 容易跳过必要初始化或清理。

普通分支和循环应优先使用 `if`、`switch`、`for`、`while`、`break`、`continue` 和函数返回。

### 15.3 合理用途一：跳出多层循环

```c
for (int i = 0; i < rows; ++i)
{
    for (int j = 0; j < columns; ++j)
    {
        if (fatal_error())
        {
            goto error;
        }
    }
}

printf("处理成功\n");
return 0;

error:
printf("处理失败\n");
return 1;
```

如果封装函数并直接返回更简单，优先使用函数；当重构代价较大、需要统一出口时，`goto` 也可以比多层标志变量更清楚。

### 15.4 合理用途二：C 语言资源清理

C 没有 C++ RAII。一个函数按顺序申请多个资源时，常使用向后的 `goto` 统一释放已经成功获得的资源：

```c
int process(void)
{
    FILE *input = fopen("input.txt", "r");
    if (input == NULL)
    {
        return 1;
    }

    FILE *output = fopen("output.txt", "w");
    if (output == NULL)
    {
        goto close_input;
    }

    if (copy_data(input, output) != 0)
    {
        goto close_output;
    }

    fclose(output);
    fclose(input);
    return 0;

close_output:
    fclose(output);
close_input:
    fclose(input);
    return 1;
}
```

这种写法的特点：

- 只向后跳到清理标签；
- 资源按申请的相反顺序释放；
- 每个错误路径不必重复相同清理代码；
- 跳转范围局限在一个函数内部。

### 15.5 goto 的限制

`goto` 只能跳转到同一个函数中的标签，不能跳到另一个函数。

还不能从变长数组作用域之外跳入该作用域，否则会绕过变长对象的建立规则。即使语法允许某种跳转，也不应借此绕过变量初始化和必要状态设置。

## 十六、综合示例：菜单式数字工具

下面的程序综合使用：

- `do...while` 菜单循环；
- `switch` 分支；
- `if` 条件；
- `for` 循环；
- `break`；
- 输入结果检查；
- 素数判断。

```c
#include <stdio.h>

static int is_prime(int number)
{
    if (number < 2)
    {
        return 0;
    }

    for (int divisor = 2;
         divisor <= number / divisor;
         ++divisor)
    {
        if (number % divisor == 0)
        {
            return 0;
        }
    }

    return 1;
}

int main(void)
{
    int choice = 0;

    do
    {
        printf("\n1. 判断奇偶\n");
        printf("2. 判断素数\n");
        printf("3. 打印 1 到 N\n");
        printf("0. 退出\n");
        printf("请选择：");

        if (scanf("%d", &choice) != 1)
        {
            printf("输入无效\n");
            return 1;
        }

        switch (choice)
        {
            case 1:
            {
                int number = 0;
                printf("请输入整数：");

                if (scanf("%d", &number) != 1)
                {
                    printf("输入无效\n");
                    return 1;
                }

                if (number % 2 == 0)
                {
                    printf("%d 是偶数\n", number);
                }
                else
                {
                    printf("%d 是奇数\n", number);
                }
                break;
            }

            case 2:
            {
                int number = 0;
                printf("请输入整数：");

                if (scanf("%d", &number) != 1)
                {
                    printf("输入无效\n");
                    return 1;
                }

                printf("%d%s素数\n",
                       number,
                       is_prime(number) ? " 是" : " 不是");
                break;
            }

            case 3:
            {
                int limit = 0;
                printf("请输入正整数 N：");

                if (scanf("%d", &limit) != 1 || limit <= 0)
                {
                    printf("N 必须是正整数\n");
                    return 1;
                }

                for (int i = 1; i <= limit; ++i)
                {
                    printf("%d%c", i, i == limit ? '\n' : ' ');
                }
                break;
            }

            case 0:
                printf("程序结束\n");
                break;

            default:
                printf("没有这个选项\n");
                break;
        }
    } while (choice != 0);

    return 0;
}
```

使用 GCC 编译：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic main.c -o main
```

## 十七、常见错误

### 17.1 使用 n % 2 == 1 判断所有奇数

错误：

```c
if (number % 2 == 1)
```

负奇数的余数可能是 -1。正确写法：

```c
if (number % 2 != 0)
```

### 17.2 忘记检查 scanf 返回值

如果转换失败，变量不会获得期望输入。应根据转换项目数量判断是否成功。

### 17.3 把 == 写成 =

```c
if (x = 3)
```

这是赋值，条件结果为 3，通常始终为真。开启编译警告并认真检查条件。

### 17.4 写数学式链式比较

错误：

```c
if (18 <= age <= 36)
```

正确：

```c
if (age >= 18 && age <= 36)
```

### 17.5 省略大括号后误判控制范围

缩进不影响语法，`if`、`else` 和循环在没有大括号时只控制一条语句。

### 17.6 悬空 else 匹配错误

`else` 与最近的未匹配 `if` 结合。使用大括号明确层次。

### 17.7 switch 漏写 break

如果不是有意贯穿，漏写 `break` 会继续执行后续分支。

### 17.8 认为 case 后必须留一个空格

空格只是代码风格。真正的语法要求是 `case` 后跟整数常量表达式和冒号。

### 17.9 switch 忽略负余数

`n % 3` 对负数可能得到 -1 或 -2。应补充负数 `case`，或者先规范化余数。

### 17.10 while 忘记更新循环变量

```c
int i = 0;

while (i < 10)
{
    printf("%d\n", i);
    // 忘记 ++i
}
```

条件永远不改变，形成死循环。

### 17.11 continue 跳过 while 的调整

如果调整语句位于 `continue` 后面，本轮会跳过它，可能导致循环变量永远不变。

### 17.12 for 数组边界写成 <=

长度为 `length` 的数组最后一个下标是 `length - 1`。遍历条件通常是 `i < length`。

### 17.13 size_t 倒序循环永远不结束

无符号值永远不小于 0。使用 `for (size_t i = length; i-- > 0;)` 等正确形式。

### 17.14 认为 break 能退出所有嵌套层

`break` 只退出最内层循环或 `switch`。多层退出应重新组织函数、使用标志或统一出口。

### 17.15 忘记 do...while 末尾分号

正确语法：

```c
do
{
} while (condition);
```

### 17.16 把多个自增和赋值塞入复杂条件

即使短路顺序明确，副作用过多也难以阅读和维护。拆成独立语句通常更可靠。

## 十八、常见面试问题

### 18.1 C 语言中什么是真，什么是假

0 为假，任何非 0 值为真。关系和逻辑表达式的结果为 `int` 类型的 0 或 1。

### 18.2 if 条件必须写成比较表达式吗

不必须。任何合法的标量表达式都可以作为控制条件，例如整数、浮点值和指针。实际代码应确保表达意图清晰。

### 18.3 if (x = 3) 为什么能编译

赋值本身是表达式，结果是赋入的值 3。由于 3 非 0，条件为真。

### 18.4 为什么不能写 1 < x < 10

它会按 `(1 < x) < 10` 计算，前半部分只得到 0 或 1。正确写法是 `1 < x && x < 10`。

### 18.5 && 和 || 有什么短路规则

- `A && B`：A 为假时不计算 B；
- `A || B`：A 为真时不计算 B。

并且 C 保证先计算左操作数。

### 18.6 条件运算符是否会同时计算两个分支

不会。条件为真只计算第二个操作数，条件为假只计算第三个操作数。

### 18.7 switch 支持哪些类型

控制表达式需要是整数类型或枚举类型。不能直接使用浮点数和字符串。

### 18.8 case 后可以写变量吗

普通变量不可以。`case` 需要整数常量表达式，并且同一个 `switch` 中的值不能重复。

### 18.9 default 必须放在最后吗

语法上不必须，但通常放在最后更符合阅读习惯。由于存在分支贯穿，放置位置仍会影响执行。

### 18.10 while、for 和 do...while 有什么区别

- `while`：先判断，次数未知时常用；
- `for`：先判断，计数和区间遍历时常用；
- `do...while`：先执行再判断，循环体至少执行一次。

### 18.11 continue 在三种循环中分别跳到哪里

- `while`：条件判断；
- `for`：调整表达式，然后条件判断；
- `do...while`：末尾条件判断。

### 18.12 break 可以跳出几层循环

只能跳出最内层的一层循环。位于 `switch` 中时结束当前 `switch`。

### 18.13 如何跳出多层循环

可以使用：

- 封装函数后 `return`；
- 标志变量；
- 调整外层循环条件；
- 在局部、清晰的场景中使用 `goto` 跳到统一出口。

### 18.14 为什么判断素数只需要试除到平方根

若 `n = a × b` 且 `a`、`b` 都大于平方根，则乘积会大于 `n`。所以一个合数必然至少有一个不超过平方根的因子。

### 18.15 goto 一定不能用吗

不是。任意乱跳会破坏结构，但在 C 中统一资源清理、处理错误出口或跳出多层结构时，受控的向后 `goto` 可能比重复清理代码更清晰。

## 十九、总结

分支和循环决定了程序如何“做选择”和“重复工作”。需要重点掌握：

1. C 语言中 0 为假、非 0 为真；
2. `if` 根据条件决定是否执行，`else if` 从上向下选择第一个真分支；
3. 建议始终使用大括号明确控制范围；
4. `else` 与最近的未匹配 `if` 结合；
5. `==` 是比较，`=` 是赋值；
6. 数学链式比较需要改成两个关系表达式和 `&&`；
7. `?:` 适合根据条件选择一个简单值；
8. `&&` 和 `||` 具有从左到右的短路求值；
9. `switch` 适合整数或枚举的离散值分支；
10. `case` 需要唯一的整数常量表达式；
11. `break` 阻止 `switch` 分支继续贯穿；
12. `while` 和 `for` 先判断，`do...while` 至少执行一次；
13. `break` 结束当前最内层循环或 `switch`；
14. `continue` 在不同循环中跳向不同位置；
15. 循环必须关注初始化、条件、调整和边界；
16. 嵌套循环的复杂度取决于实际执行次数；
17. `goto` 应限制在局部、清晰且确有价值的场景；
18. 所有依赖输入的分支都应先检查输入是否成功。

掌握这些规则后，后续学习数组、函数、指针和实际算法时，就能够把复杂任务拆解为清晰的条件、循环与数据处理步骤。
