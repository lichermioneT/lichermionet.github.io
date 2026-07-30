---
title: C语言数据类型和变量：从内存表示到格式化输入输出
date: 2026-07-30 10:00:00
categories:
  - C语言
tags:
  - C语言
  - 数据类型
  - 变量
  - 运算符
  - scanf
  - printf
---

## 前言

程序处理的每一份数据都有类型。类型不仅决定一段数据叫什么，更决定：

- 需要多少存储空间；
- 可以表示怎样的值；
- 数据在内存中如何解释；
- 可以参与哪些运算；
- 输入和输出时应使用什么格式。

例如，`int` 通常用来保存整数，`double` 用来保存带小数的数据，`char` 用来保存字符编码。即使内存中的若干位完全相同，使用不同类型解释，也可能得到不同结果。

本文围绕 C 语言的数据类型和变量展开，并继续介绍与数据运算密切相关的内容：

- 内置数据类型；
- `signed` 与 `unsigned`；
- 类型大小与取值范围；
- `sizeof` 运算符；
- 变量的定义、作用域和生命周期；
- 算术、赋值与单目运算符；
- 强制类型转换；
- `printf` 格式化输出；
- `scanf` 格式化输入；
- 整型提升、溢出和输入安全等常见问题。

> 本文示例以常见的 C11/C17 编译环境为背景。C 标准并未规定所有类型必须占用固定字节数，因此不要把某一台机器上的结果当成所有平台的保证。

## 一、为什么 C 语言需要数据类型

计算机最终保存的是二进制位。仅看到一串二进制，程序并不知道它应该被解释成整数、浮点数、字符还是地址。

数据类型相当于给这段二进制附加了一套解释规则。

例如：

```c
int age = 20;
double price = 19.9;
char grade = 'A';
```

这三个变量分别表达：

- `age` 是整数；
- `price` 是浮点数；
- `grade` 是字符。

编译器会根据类型决定：

1. 为变量准备多大的存储空间；
2. 怎样生成读写该变量的机器指令；
3. 表达式运算时是否需要类型转换；
4. 哪些写法可能丢失精度或超出范围；
5. 调用 `printf`、`scanf` 等函数时应怎样传递和解释数据。

因此，类型是理解 C 语言内存模型和表达式规则的起点。

## 二、C 语言的基本数据类型

### 2.1 类型概览

C 语言常用的基本类型可以分成下面几组。

| 类别 | 类型 | 常见用途 |
| --- | --- | --- |
| 字符型 | `char`、`signed char`、`unsigned char` | 字符、小整数、原始字节 |
| 整型 | `short`、`int`、`long`、`long long` 及其无符号版本 | 整数、计数、状态 |
| 浮点型 | `float`、`double`、`long double` | 实数、科学计算 |
| 布尔型 | `_Bool` | 真或假 |
| 空类型 | `void` | 无返回值、无具体类型 |

C 语言还可以在基本类型之上构造：

- 数组；
- 指针；
- 结构体；
- 联合体；
- 枚举；
- 函数类型。

这些内容会在后续章节中继续展开。

### 2.2 字符类型

`char` 是 C 语言中用于表示字符和最小可寻址存储单位的类型。

```c
char ch = 'A';
```

字符常量 `'A'` 在执行字符集中对应一个整数编码。在 ASCII 兼容环境中，`'A'` 的编码是 65。

字符类型有三种写法：

```c
char a = 'A';
signed char b = -10;
unsigned char c = 255;
```

需要特别注意：

- `signed char` 一定是有符号字符类型；
- `unsigned char` 一定是无符号字符类型；
- 普通 `char` 是否有符号，由编译器和目标平台决定；
- `char`、`signed char` 和 `unsigned char` 是三个不同的类型。

如果程序确实需要保存负数，不要依赖普通 `char` 的默认符号性，应明确使用 `signed char`。如果要处理原始字节，`unsigned char` 通常更合适。

### 2.3 整数类型

C 语言提供不同宽度的整数类型：

```c
short s = 10;
int i = 20;
long l = 30L;
long long ll = 40LL;
```

完整写法还可以带上 `signed`：

```c
signed short s1 = -10;
signed int i1 = -20;
signed long l1 = -30L;
signed long long ll1 = -40LL;
```

在不写 `signed` 或 `unsigned` 时，`short`、`int`、`long` 和 `long long` 默认是有符号类型。因此：

```c
int n;
signed int n2;
```

这两个变量的类型相同。

C 标准只保证整数类型的宽度关系满足：

```text
sizeof(char) <= sizeof(short) <= sizeof(int)
             <= sizeof(long) <= sizeof(long long)
```

相邻类型可以占用相同大小。例如，在许多平台上 `short` 是 2 字节、`int` 是 4 字节，但 `long` 究竟是 4 字节还是 8 字节取决于数据模型。

### 2.4 浮点类型

C 语言有三种主要浮点类型：

```c
float f = 3.14F;
double d = 3.14;
long double ld = 3.14L;
```

浮点字面量默认是 `double`。后缀的作用如下：

| 后缀 | 字面量类型 | 示例 |
| --- | --- | --- |
| `F` 或 `f` | `float` | `3.14F` |
| 无后缀 | `double` | `3.14` |
| `L` 或 `l` | `long double` | `3.14L` |

浮点数需要区分两个概念：

- **范围**：最大、最小能表示到什么数量级；
- **精度**：能可靠保存多少位有效数字。

`double` 通常比 `float` 有更高精度，但浮点数本质上仍然是有限精度的近似表示。

例如：

```c
#include <stdio.h>

int main(void)
{
    double x = 0.1;
    double y = 0.2;

    printf("%.17f\n", x + y);
    return 0;
}
```

某些环境会输出接近：

```text
0.30000000000000004
```

这不是 `printf` 出错，而是许多十进制小数无法用有限个二进制位精确表示。

### 2.5 布尔类型

C99 引入了 `_Bool`：

```c
_Bool finished = 1;
_Bool failed = 0;
```

给 `_Bool` 赋值时：

- 0 会转换为 0；
- 任意非 0 值都会转换为 1。

引入 `<stdbool.h>` 后，可以使用更直观的写法：

```c
#include <stdbool.h>

bool finished = true;
bool failed = false;
```

其中 `bool`、`true` 和 `false` 由头文件提供，底层仍然基于 `_Bool`。

### 2.6 void 类型

`void` 表示“没有具体的值或类型”。

常见场景包括：

1. 函数没有返回值：

   ```c
   void print_menu(void);
   ```

2. 函数明确不接收参数：

   ```c
   int main(void);
   ```

3. 通用对象指针：

   ```c
   void *data;
   ```

不能定义一个普通的 `void` 变量，因为编译器无法为“没有具体类型”的对象确定大小：

```c
// 错误：void 对象没有可确定的大小
void value;
```

## 三、sizeof：获取对象或类型的大小

### 3.1 sizeof 是运算符

`sizeof` 用来获得一个类型或对象占用多少字节。它是 C 语言运算符，不是函数。

对类型使用时，类型名必须放在括号中：

```c
sizeof(char)
sizeof(int)
sizeof(double)
```

对表达式或变量使用时，括号通常可以省略：

```c
int value = 10;

sizeof value
sizeof(value)
```

为了让代码更清晰，很多项目仍然会统一保留括号。

### 3.2 sizeof 的结果类型是 size_t

`sizeof` 的结果类型是 `size_t`。它是一种无符号整数类型，定义在 `<stddef.h>` 等标准头文件中。

使用 `printf` 输出 `size_t` 时，正确的格式说明符是 `%zu`：

```c
#include <stdio.h>

int main(void)
{
    printf("sizeof(char)   = %zu\n", sizeof(char));
    printf("sizeof(short)  = %zu\n", sizeof(short));
    printf("sizeof(int)    = %zu\n", sizeof(int));
    printf("sizeof(long)   = %zu\n", sizeof(long));
    printf("sizeof(float)  = %zu\n", sizeof(float));
    printf("sizeof(double) = %zu\n", sizeof(double));
    return 0;
}
```

不要用 `%d` 或 `%zd` 随意代替 `%zu`：

- `%d` 要求参数类型是 `int`；
- `%zd` 对应 `size_t` 的有符号版本；
- `%zu` 才与无符号的 `size_t` 匹配。

格式说明符与实际参数类型不匹配，会产生未定义行为。

### 3.3 sizeof 中的普通表达式通常不执行

对于不是变长数组的普通表达式，`sizeof` 只分析表达式的类型，不会实际执行表达式：

```c
#include <stdio.h>

int main(void)
{
    int n = 10;
    size_t bytes = sizeof(n++);

    printf("bytes = %zu\n", bytes);
    printf("n = %d\n", n);  // n 仍然是 10
    return 0;
}
```

这是因为编译器通常可以在编译阶段确定结果。

进阶提醒：如果操作数的类型是变长数组，计算 `sizeof` 时可能需要在运行期求值。初学阶段先记住“普通表达式通常不执行”，以后学习变长数组时再补充这一例外。

### 3.4 C 语言中的“一个字节”

C 标准保证：

```c
sizeof(char) == 1
```

但这并不等价于标准保证一个字节一定有 8 位。一个字节包含多少位，可以查看 `<limits.h>` 中的 `CHAR_BIT`：

```c
#include <limits.h>
#include <stdio.h>

int main(void)
{
    printf("CHAR_BIT = %d\n", CHAR_BIT);
    return 0;
}
```

绝大多数现代通用平台的 `CHAR_BIT` 是 8，但编写严谨的可移植代码时，应理解“C 字节”和“固定 8 位字节”的概念区别。

### 3.5 常见平台上的典型大小

下面只是常见实现的示例，不是 C 标准的统一规定。

| 类型 | Windows x64 常见大小 | Linux x86-64 常见大小 |
| --- | ---: | ---: |
| `char` | 1 | 1 |
| `short` | 2 | 2 |
| `int` | 4 | 4 |
| `long` | 4 | 8 |
| `long long` | 8 | 8 |
| `float` | 4 | 4 |
| `double` | 8 | 8 |
| `long double` | 8 | 通常 16 |
| 指针 | 8 | 8 |

Windows x64 常见的是 LLP64 数据模型，Linux x86-64 常见的是 LP64 数据模型，所以 `long` 的大小经常不同。

可移植程序应该：

- 用 `sizeof` 获取实际大小；
- 用 `<limits.h>` 和 `<float.h>` 获取范围与精度；
- 需要精确位宽时考虑 `<stdint.h>` 提供的类型。

## 四、signed、unsigned 与取值范围

### 4.1 有符号和无符号

整数类型可以分为：

- 有符号类型：可以表示负数、0 和正数；
- 无符号类型：只能表示 0 和正数。

```c
signed int temperature = -5;
unsigned int population = 1000U;
```

对于 `short`、`int`、`long` 和 `long long`，不写 `signed` 时默认有符号：

```c
int a = -10;
signed int b = -10;
```

### 4.2 N 位整数的典型范围

在现代二进制补码实现中，如果一个整数类型有 N 个值位与符号表示规则，则常见范围为：

- N 位无符号整数：0 到 `2^N - 1`；
- N 位有符号整数：`-2^(N-1)` 到 `2^(N-1) - 1`。

以常见的 32 位 `int` 为例：

- `unsigned int`：0 到 4,294,967,295；
- `int`：-2,147,483,648 到 2,147,483,647。

编写程序时不要手写这些数值来猜测平台范围，应使用标准宏。

### 4.3 使用 limits.h 查询整数范围

`<limits.h>` 定义了整数类型的范围宏：

```c
#include <limits.h>
#include <stdio.h>

int main(void)
{
    printf("CHAR_BIT  = %d\n", CHAR_BIT);
    printf("CHAR_MIN  = %d\n", CHAR_MIN);
    printf("CHAR_MAX  = %d\n", CHAR_MAX);
    printf("INT_MIN   = %d\n", INT_MIN);
    printf("INT_MAX   = %d\n", INT_MAX);
    printf("UINT_MAX  = %u\n", UINT_MAX);
    printf("LONG_MIN  = %ld\n", LONG_MIN);
    printf("LONG_MAX  = %ld\n", LONG_MAX);
    printf("LLONG_MAX = %lld\n", LLONG_MAX);
    return 0;
}
```

常见宏包括：

| 类型 | 最小值宏 | 最大值宏 |
| --- | --- | --- |
| `char` | `CHAR_MIN` | `CHAR_MAX` |
| `signed char` | `SCHAR_MIN` | `SCHAR_MAX` |
| `unsigned char` | 0 | `UCHAR_MAX` |
| `short` | `SHRT_MIN` | `SHRT_MAX` |
| `unsigned short` | 0 | `USHRT_MAX` |
| `int` | `INT_MIN` | `INT_MAX` |
| `unsigned int` | 0 | `UINT_MAX` |
| `long` | `LONG_MIN` | `LONG_MAX` |
| `unsigned long` | 0 | `ULONG_MAX` |
| `long long` | `LLONG_MIN` | `LLONG_MAX` |
| `unsigned long long` | 0 | `ULLONG_MAX` |

### 4.4 使用 float.h 查询浮点能力

`<float.h>` 提供浮点类型的范围和精度信息：

```c
#include <float.h>
#include <stdio.h>

int main(void)
{
    printf("FLT_DIG  = %d\n", FLT_DIG);
    printf("DBL_DIG  = %d\n", DBL_DIG);
    printf("FLT_MIN  = %e\n", FLT_MIN);
    printf("FLT_MAX  = %e\n", FLT_MAX);
    printf("DBL_MIN  = %e\n", DBL_MIN);
    printf("DBL_MAX  = %e\n", DBL_MAX);
    return 0;
}
```

其中：

- `FLT_DIG`：`float` 能可靠保留的十进制有效数字位数；
- `DBL_DIG`：`double` 能可靠保留的十进制有效数字位数；
- `FLT_MIN`：最小的正规格化正 `float`；
- `FLT_MAX`：最大的有限 `float`；
- `DBL_MIN`、`DBL_MAX`：`double` 的对应值。

注意，`FLT_MIN` 不是最负的 `float`。最负的有限值可以写成 `-FLT_MAX`。

### 4.5 固定宽度整数

如果协议、文件格式或硬件寄存器明确要求 8 位、16 位、32 位或 64 位整数，可以查看 `<stdint.h>`：

```c
#include <stdint.h>

int32_t score = -100;
uint64_t file_size = 1024;
```

`int32_t` 只有在实现确实提供恰好 32 位的有符号整数类型时才会定义。若只要求“至少 32 位”，还可以使用 `int_least32_t`。

普通业务计数不必一律改成固定宽度类型；`int`、`size_t` 等类型往往更符合接口语义。

### 4.6 无符号运算会按模回绕

无符号整数运算按 `2^N` 取模：

```c
#include <limits.h>
#include <stdio.h>

int main(void)
{
    unsigned int value = UINT_MAX;
    value = value + 1U;

    printf("%u\n", value);  // 0
    return 0;
}
```

这种行为由标准定义，但“行为有定义”不代表业务逻辑一定正确。长度计算、循环下标和内存大小相减时，仍然要防止意外回绕。

### 4.7 有符号整数溢出是未定义行为

下面的代码不能被理解为“必然从最大值绕到最小值”：

```c
int value = INT_MAX;
value = value + 1;  // 有符号溢出：未定义行为
```

编译器可以假设合法程序不会发生有符号溢出，并据此进行优化。因此在加法前应检查：

```c
if (a > 0 && b > INT_MAX - a)
{
    // a + b 会溢出
}
else
{
    int sum = a + b;
}
```

实际代码还需要同时处理负数方向的下溢。

## 五、变量：定义、初始化与赋值

### 5.1 什么是变量

变量是程序中一个有名字的对象。它具有：

- 类型；
- 名称；
- 值；
- 存储位置；
- 作用域；
- 生命周期。

基本定义形式为：

```c
类型 变量名;
```

例如：

```c
int age;
double salary;
char grade;
```

### 5.2 初始化与赋值的区别

变量创建时给出初始值叫初始化：

```c
int score = 90;
```

变量已经存在后再修改值叫赋值：

```c
score = 95;
```

虽然二者都使用 `=`，发生的时机和语义并不完全相同。

建议尽可能在定义变量时初始化：

```c
int count = 0;
double total = 0.0;
char choice = 'N';
```

未初始化的局部自动变量具有不确定值。读取这种不确定值可能产生未定义行为：

```c
int value;
printf("%d\n", value);  // 错误：不要读取未初始化的局部变量
```

### 5.3 变量命名规则

C 标识符由字母、数字和下划线组成，并且不能以数字开头。

合法名称：

```c
int age;
int student_count;
int value2;
int _temporary;
```

非法名称：

```c
// int 2value;      // 不能以数字开头
// int student-id;  // 不能包含减号
// int double;      // 不能使用关键字
```

工程代码还应遵循一致的命名风格，并避开实现保留标识符。尤其不要随意创建以下名称：

- 文件作用域中以下划线开头的标识符；
- 以下划线加大写字母开头的标识符；
- 以两个下划线开头的标识符。

### 5.4 局部变量

在函数或复合语句内部定义的变量通常称为局部变量：

```c
void test(void)
{
    int count = 10;
    printf("%d\n", count);
}
```

`count` 的名字只在它所在的块中可见。离开该块后，不能再通过这个名字访问它。

### 5.5 全局变量

在所有函数外定义的变量通常称为全局变量：

```c
#include <stdio.h>

int global_count = 100;

void print_count(void)
{
    printf("%d\n", global_count);
}
```

全局变量具有静态存储期，程序开始时完成初始化，并一直存在到程序结束。

全局变量使用方便，但也会扩大共享状态，增加模块之间的耦合。能通过函数参数和返回值清晰表达的数据，通常不必放到全局变量中。

### 5.6 同名变量与遮蔽

局部变量可以遮蔽外层同名变量：

```c
#include <stdio.h>

int number = 1000;

int main(void)
{
    int number = 10;
    printf("%d\n", number);  // 输出 10
    return 0;
}
```

在 `main` 内，名字 `number` 优先表示局部变量。

遮蔽在语法上合法，但容易让读者误判变量来源。除非有明确理由，否则应尽量避免在嵌套作用域中重复使用相同名称。

### 5.7 作用域与生命周期不是一回事

作用域回答的是：

> 在代码的哪些位置可以通过这个名字访问对象？

生命周期或存储期回答的是：

> 这个对象从什么时候存在，到什么时候结束？

例如，普通局部变量通常具有块作用域和自动存储期；使用 `static` 修饰的局部变量仍只有块作用域，但具有静态存储期：

```c
#include <stdio.h>

void visit(void)
{
    static int count = 0;
    ++count;
    printf("%d\n", count);
}

int main(void)
{
    visit();  // 1
    visit();  // 2
    visit();  // 3
    return 0;
}
```

### 5.8 “栈区、堆区、静态区”是一种常见实现模型

教学中经常把程序内存简化为：

- 栈区：保存函数调用信息和许多局部自动变量；
- 堆区：保存动态分配的对象；
- 静态存储区：保存全局变量和静态变量。

这种模型有助于建立直觉，但 C 标准描述的是对象的存储期，并不强制编译器必须把某类变量放入名为“栈”的物理区域。优化后的变量甚至可能只存在于寄存器中。

因此，更严谨的学习顺序是：

1. 先理解作用域、链接属性和存储期；
2. 再结合具体平台理解栈、堆和可执行文件布局。

## 六、常量与不应修改的值

### 6.1 字面常量

直接写在代码中的值称为字面常量：

```c
10
3.14
'A'
"hello"
```

不同后缀可以影响字面量的类型：

```c
100U     // unsigned int
100L     // long
100LL    // long long
3.14F    // float
3.14L    // long double
```

### 6.2 const 限定

`const` 表示不应通过该对象修改值：

```c
const double pi = 3.141592653589793;
```

随后再写：

```c
// pi = 3.0;  // 错误
```

需要注意，C 语言中的 `const` 对象并不在所有语境下都是“编译期整数常量”。例如，要求整数常量表达式的场景可以考虑枚举常量或宏。

### 6.3 枚举常量

枚举适合表达一组有关联的整数常量：

```c
enum
{
    BUFFER_SIZE = 128,
    MAX_RETRY = 3
};
```

### 6.4 宏常量

预处理宏也可以定义常量：

```c
#define MAX_STUDENTS 100
```

宏只是预处理阶段的文本替换，没有普通变量那样的类型信息。简单常量可以使用，但要避免编写缺少括号、重复求值的复杂函数式宏。

## 七、算术运算符

### 7.1 五种基本算术运算

C 语言常见的双目算术运算符如下：

| 运算符 | 含义 | 示例 |
| --- | --- | --- |
| `+` | 加法 | `a + b` |
| `-` | 减法 | `a - b` |
| `*` | 乘法 | `a * b` |
| `/` | 除法 | `a / b` |
| `%` | 取余 | `a % b` |

示例：

```c
int a = 10;
int b = 3;

int sum = a + b;
int difference = a - b;
int product = a * b;
int quotient = a / b;
int remainder = a % b;
```

### 7.2 整数除法

当除号两边都是整数时，执行整数除法，小数部分直接舍弃：

```c
int result = 7 / 2;  // 3
```

这里不是四舍五入，而是向 0 截断。

```c
int a = 7 / 2;    // 3
int b = -7 / 2;   // -3
```

如果希望得到浮点结果，至少有一个操作数必须是浮点类型：

```c
double x = 7.0 / 2.0;       // 3.5
double y = (double)7 / 2;    // 3.5
```

下面的强制转换位置太晚：

```c
double z = (double)(7 / 2);  // 先得到整数 3，再转换成 3.0
```

### 7.3 取余运算

`%` 只适用于整数类型：

```c
int remainder = 17 % 5;  // 2
```

不能对浮点数直接使用 `%`：

```c
// double r = 5.5 % 2.0;  // 错误
```

现代 C 标准中，整数除法向 0 截断，余数满足：

```text
(a / b) * b + a % b == a
```

因此：

```c
-7 / 3   // -2
-7 % 3   // -1
```

余数的符号与被除数一致，或者结果为 0。

### 7.4 除数不能为 0

整数除以 0 或对 0 取余会产生未定义行为：

```c
// int x = 10 / 0;
// int y = 10 % 0;
```

除法前应检查：

```c
if (divisor != 0)
{
    int result = dividend / divisor;
}
```

浮点除以 0 的具体结果还会受到实现是否支持 IEC 60559 浮点语义等因素影响，业务程序同样不应把“除以 0”当成普通计算路径。

### 7.5 整型提升

`char` 和 `short` 参与许多算术运算时，会先进行整型提升，通常提升为 `int`：

```c
unsigned char a = 200;
unsigned char b = 100;

int sum = a + b;  // 运算通常以 int 进行，结果为 300
```

这说明表达式结果的类型不一定与操作数表面写出的类型相同。

### 7.6 有符号和无符号混合运算

混合使用有符号与无符号整数时，会发生通常算术转换。某些情况下，负的有符号数会被转换成一个很大的无符号数：

```c
#include <stdio.h>

int main(void)
{
    int a = -1;
    unsigned int b = 1U;

    if (a < b)
    {
        printf("a < b\n");
    }
    else
    {
        printf("a >= b\n");
    }

    return 0;
}
```

结果可能与初学者的直觉相反。因此：

- 尽量不要在同一个表达式中随意混合有符号和无符号值；
- 比较前先确认双方范围和语义；
- 不要为了“数值不会为负”就机械地把所有变量改成无符号类型。

## 八、赋值运算符

### 8.1 基本赋值

`=` 把右侧表达式的结果存入左侧对象：

```c
int a = 10;
a = 20;
```

这里的 `=` 不是数学中的“相等”，相等比较使用 `==`：

```c
if (a == 20)
{
    // a 等于 20
}
```

### 8.2 连续赋值

赋值运算符从右向左结合：

```c
int a;
int b;
int c;

a = b = c = 0;
```

执行效果可以理解为先给 `c` 赋值，再把赋值表达式的结果继续赋给 `b` 和 `a`。

连续赋值适合简单初始化，但复杂表达式应拆开，避免降低可读性。

### 8.3 复合赋值

常用复合赋值运算符：

| 写法 | 大致含义 |
| --- | --- |
| `a += b` | `a = a + b` |
| `a -= b` | `a = a - b` |
| `a *= b` | `a = a * b` |
| `a /= b` | `a = a / b` |
| `a %= b` | `a = a % b` |

示例：

```c
int score = 10;

score += 5;  // 15
score *= 2;  // 30
score -= 6;  // 24
score /= 3;  // 8
```

复合赋值并非任何情况下都只是字符层面的缩写。左操作数只求值一次，并且会按复合赋值规则完成转换。涉及指针、窄整数或带副作用的左值时，这一点尤其重要。

## 九、单目运算符

### 9.1 前置自增与后置自增

`++` 使变量增加 1：

```c
int n = 10;

++n;  // 前置自增
n++;  // 后置自增
```

如果整个表达式只用于让变量加 1，两种写法最终效果相同。

当表达式值被使用时，两者有区别：

```c
int a = 10;
int b = ++a;  // a 先变为 11，b 得到 11

int x = 10;
int y = x++;  // y 先得到 10，x 再变为 11
```

### 9.2 前置自减与后置自减

`--` 使变量减少 1：

```c
int n = 10;

--n;
n--;
```

前置和后置的区别与 `++` 相同。

### 9.3 不要在同一表达式中多次修改同一对象

下面的写法不是“高深技巧”，而是应当避免的危险代码：

```c
// 不要这样写
i = i++;
printf("%d %d\n", i++, i++);
```

如果对同一对象的多个访问和修改之间缺少标准要求的顺序关系，程序可能产生未定义行为。

可靠写法是把步骤拆开：

```c
printf("%d\n", i);
++i;

printf("%d\n", i);
++i;
```

### 9.4 单目正号和负号

`+` 和 `-` 也可以作为单目运算符：

```c
int a = 10;
int b = -a;  // -10
int c = +a;  // 10
```

单目负号会计算相反数，但对最小的有符号整数取负可能溢出：

```c
// 若 value == INT_MIN，则 -value 可能无法由 int 表示
int result = -value;
```

## 十、强制类型转换

### 10.1 基本语法

显式类型转换的语法为：

```c
(目标类型)表达式
```

例如：

```c
double value = 3.14;
int number = (int)value;
```

从浮点数转换为整数时，小数部分向 0 截断，所以 `number` 得到 3。

### 10.2 强制转换不会自动修改原变量

```c
double value = 3.14;
int number = (int)value;
```

这里 `value` 仍然是 `double`，值仍然约为 3.14；只有转换表达式的结果是 `int`。

### 10.3 用转换避免整数除法

```c
int completed = 3;
int total = 4;

double ratio = (double)completed / total;
```

`completed` 先转换成 `double`，另一侧也会参与浮点运算，最终得到 0.75。

如果写成：

```c
double ratio = (double)(completed / total);
```

整数除法已经先得到 0，转换后只是 0.0。

### 10.4 转换可能丢失信息

以下转换都需要谨慎：

- `double` 转 `int`：丢失小数部分；
- 宽整数转窄整数：可能无法表示原值；
- 负整数转无符号类型：按模转换为较大的无符号值；
- 浮点数转整数时，若截断后的值超出目标类型范围，行为未定义。

不要仅为了消除编译警告就随意添加强制转换。正确顺序应是：

1. 判断转换在业务上是否合理；
2. 检查源值是否处于目标类型范围内；
3. 再进行明确转换。

## 十一、printf 格式化输出

### 11.1 printf 的基本形式

`printf` 声明在 `<stdio.h>` 中：

```c
#include <stdio.h>

int main(void)
{
    int age = 18;
    printf("age = %d\n", age);
    return 0;
}
```

格式字符串中的普通字符直接输出，以 `%` 开头的格式说明用于解释后续参数。

### 11.2 常用输出格式说明符

| 类型或用途 | `printf` 格式 | 示例 |
| --- | --- | --- |
| `int` | `%d` 或 `%i` | `printf("%d", n);` |
| `unsigned int` | `%u` | `printf("%u", n);` |
| `long` | `%ld` | `printf("%ld", n);` |
| `unsigned long` | `%lu` | `printf("%lu", n);` |
| `long long` | `%lld` | `printf("%lld", n);` |
| `unsigned long long` | `%llu` | `printf("%llu", n);` |
| `size_t` | `%zu` | `printf("%zu", size);` |
| `char` | `%c` | `printf("%c", ch);` |
| C 字符串 | `%s` | `printf("%s", text);` |
| `double` | `%f`、`%e`、`%g` | `printf("%f", x);` |
| `long double` | `%Lf`、`%Le`、`%Lg` | `printf("%Lf", x);` |
| 无符号十六进制 | `%x` 或 `%X` | `printf("%x", n);` |
| 无符号八进制 | `%o` | `printf("%o", n);` |
| 指针 | `%p` | `printf("%p", (void *)p);` |
| 百分号本身 | `%%` | `printf("100%%");` |

### 11.3 printf 中的 %f 与 %lf

调用可变参数函数 `printf` 时，`float` 实参会经过默认参数提升，变成 `double`。

因此：

```c
float f = 1.25F;
double d = 2.5;

printf("%f\n", f);
printf("%f\n", d);
```

两行都使用 `%f`。

在现代 C 的 `printf` 中，`%lf` 与 `%f` 对输出没有实际区别，`l` 对浮点转换不产生额外效果。为了减少与 `scanf` 混淆，建议输出 `double` 时统一使用 `%f`。

而 `long double` 必须使用大写 `L`：

```c
long double value = 3.14L;
printf("%Lf\n", value);
```

### 11.4 字段宽度

字段宽度可以控制最小输出宽度：

```c
printf("|%5d|\n", 12);   // 右对齐
printf("|%-5d|\n", 12);  // 左对齐
```

可能输出：

```text
|   12|
|12   |
```

宽度是最小宽度，不会截断更长的整数：

```c
printf("%2d\n", 12345);  // 仍然完整输出 12345
```

### 11.5 浮点精度

对 `%f` 来说，点号后的数字控制小数位数：

```c
double pi = 3.1415926;

printf("%.2f\n", pi);  // 3.14
printf("%.4f\n", pi);  // 3.1416
```

`printf` 会按输出规则进行舍入，但这不会改变变量本身保存的值。

宽度和精度可以组合：

```c
printf("|%10.2f|\n", 123.45);
```

其中 10 是最小字段宽度，2 是小数位数。

### 11.6 字符串精度

对 `%s` 来说，精度表示最多输出多少个字符：

```c
const char *text = "Hello, C";

printf("%.5s\n", text);  // Hello
```

这在展示字符串片段时很有用。

### 11.7 使用 * 动态指定宽度和精度

`*` 可以从参数中读取宽度或精度：

```c
int width = 10;
int precision = 3;
double value = 12.34567;

printf("%*.*f\n", width, precision, value);
```

参数顺序依次是：

1. 宽度；
2. 精度；
3. 要输出的值。

### 11.8 格式与参数必须严格匹配

`printf` 根据格式字符串解释可变参数。格式写错时，函数通常无法自动纠正：

```c
double price = 19.9;

// 错误：%d 需要 int，实际传入 double
// printf("%d\n", price);
```

格式不匹配属于未定义行为，可能表现为：

- 输出乱码；
- 输出错误数值；
- 偶尔“看起来正常”；
- 在不同优化级别或平台上得到不同结果；
- 程序崩溃。

应开启编译器警告，例如 GCC 或 Clang 的：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic main.c
```

## 十二、scanf 格式化输入

### 12.1 scanf 的基本形式

`scanf` 也声明在 `<stdio.h>` 中：

```c
#include <stdio.h>

int main(void)
{
    int age = 0;

    printf("请输入年龄：");
    if (scanf("%d", &age) == 1)
    {
        printf("age = %d\n", age);
    }
    else
    {
        printf("输入无效\n");
    }

    return 0;
}
```

`&age` 表示变量 `age` 的地址。`scanf` 需要地址，才能把读取到的数据写入对应变量。

### 12.2 为什么大多数变量前要加 &

函数参数传值时，直接传入 `age` 只是把当前值交给函数；`scanf` 无法通过这个副本修改原变量。

传入 `&age` 后，函数得到变量的存储地址，才可以写入。

字符数组配合 `%s` 时通常不再写 `&`：

```c
char name[20];
scanf("%19s", name);
```

数组名在这里会转换成指向首元素的指针。

### 12.3 常用输入格式说明符

`scanf` 的格式与 `printf` 相似，但不能机械照搬：

| 目标对象类型 | `scanf` 格式 | 实参类型 |
| --- | --- | --- |
| `int` | `%d` | `int *` |
| `unsigned int` | `%u` | `unsigned int *` |
| `short` | `%hd` | `short *` |
| `long` | `%ld` | `long *` |
| `long long` | `%lld` | `long long *` |
| `float` | `%f` | `float *` |
| `double` | `%lf` | `double *` |
| `long double` | `%Lf` | `long double *` |
| `char` | `%c` | `char *` |
| 字符数组 | `%s` | `char *` |

### 12.4 scanf 中 %f 与 %lf 不同

这一点与 `printf` 不同：

```c
float f = 0.0F;
double d = 0.0;

scanf("%f", &f);   // %f 需要 float *
scanf("%lf", &d);  // %lf 需要 double *
```

如果格式与指针类型不匹配，`scanf` 会按错误的大小或表示方式写入内存，产生未定义行为。

可以这样记忆：

- `printf` 接收值：`float` 会提升成 `double`；
- `scanf` 接收指针：`float *` 不会变成 `double *`。

### 12.5 必须检查 scanf 的返回值

`scanf` 返回成功完成赋值的项目数量。

```c
int age = 0;
double height = 0.0;

int count = scanf("%d%lf", &age, &height);
```

如果两个值都成功读取，`count` 为 2。

可靠代码应检查返回值：

```c
if (scanf("%d%lf", &age, &height) != 2)
{
    printf("输入格式错误\n");
}
```

如果在任何转换发生前遇到输入结束或读取错误，`scanf` 会返回 `EOF`。不要把“变量最终看起来像 0”当作输入成功的证据。

### 12.6 格式字符串中的空白

`scanf` 格式字符串中的空白字符会匹配输入中的任意数量空白，包括 0 个，并会持续跳过空白直到遇到下一个非空白字符。

大多数数值转换和 `%s` 本身也会跳过前导空白。

但以下转换不会自动跳过前导空白：

- `%c`；
- `%[`；
- `%n`。

读取一个非空白字符时，经常写成：

```c
char choice = '\0';
scanf(" %c", &choice);
```

`%c` 前面的空格负责跳过先前残留的换行和其他空白。

### 12.7 使用 %s 时必须限制宽度

下面的写法可能造成数组越界：

```c
char name[11];
scanf("%s", name);  // 危险：输入长度不受限制
```

应限制最多读取的字符数：

```c
char name[11];
scanf("%10s", name);
```

`%10s` 最多读取 10 个字符，`scanf` 还会在末尾追加 `'\0'`，因此数组至少需要 11 个元素。

还要注意：

- `%s` 遇到空白就停止，不能直接读取带空格的一整行；
- 宽度限制只限制本次读取；
- 超出宽度的剩余字符仍留在输入流中，不会被自动丢弃。

读取整行文本通常更适合使用 `fgets`：

```c
#include <stdio.h>
#include <string.h>

int main(void)
{
    char line[100];

    if (fgets(line, sizeof line, stdin) != NULL)
    {
        line[strcspn(line, "\n")] = '\0';
        printf("你输入了：%s\n", line);
    }

    return 0;
}
```

### 12.8 赋值抑制

在转换说明中加入 `*`，可以读取并匹配内容，但不保存：

```c
int year = 0;
int month = 0;
int day = 0;

scanf("%d%*c%d%*c%d", &year, &month, &day);
```

这里的 `%*c` 会各读取并丢弃一个字符。

但它并不保证分隔符一定是 `-`。如果输入格式要求严格的短横线，应把短横线直接写入格式字符串：

```c
if (scanf("%d-%d-%d", &year, &month, &day) == 3)
{
    printf("%04d-%02d-%02d\n", year, month, day);
}
```

### 12.9 scanf 失败后不会自动清理错误输入

假设用户输入：

```text
abc
```

而程序执行：

```c
scanf("%d", &number);
```

转换会失败，字母通常仍然留在输入流中。若直接再次执行同样的 `scanf`，很可能再次失败。

对于交互式程序，更稳健的做法是：

1. 用 `fgets` 读取一整行；
2. 用 `strtol`、`strtod` 等函数解析；
3. 检查是否完整转换、是否超出范围。

`scanf` 适合格式明确、错误处理要求较简单的输入；复杂的人机交互不应只靠不断重试 `scanf`。

### 12.10 EOF 不是固定按键

`EOF` 是库函数使用的特殊返回值，不是文件里真实保存的某个普通字符。

在终端中触发输入结束的方式取决于系统、终端和当前输入状态，例如：

- Unix 风格终端常使用 Ctrl+D；
- Windows 控制台常使用 Ctrl+Z 后回车。

不应把某种平台上的按键次数写成跨平台规则。程序只需正确处理函数返回的 `EOF`。

## 十三、一个完整示例

下面的程序综合演示：

- 基本类型；
- `bool`；
- `sizeof` 和 `CHAR_BIT`；
- 整数范围；
- 显式类型转换；
- `printf` 的宽度与精度；
- `scanf` 返回值检查。

```c
#include <limits.h>
#include <stdbool.h>
#include <stdio.h>

int main(void)
{
    const int completed = 7;
    const unsigned int total = 20U;
    const double ratio = (double)completed / total;
    const bool passed = ratio >= 0.30;
    int input = 0;

    printf("C type demo\n");
    printf("CHAR_BIT = %d\n", CHAR_BIT);
    printf("sizeof(char)   = %zu\n", sizeof(char));
    printf("sizeof(int)    = %zu\n", sizeof(int));
    printf("sizeof(double) = %zu\n", sizeof(double));
    printf("INT_MIN = %d\n", INT_MIN);
    printf("INT_MAX = %d\n", INT_MAX);
    printf("progress = %u/%u = %.2f%%\n",
           (unsigned int)completed,
           total,
           ratio * 100.0);
    printf("passed = %s\n", passed ? "true" : "false");

    printf("请输入一个整数：");
    if (scanf("%d", &input) == 1)
    {
        printf("你输入的是：%d\n", input);
    }
    else
    {
        printf("输入无效\n");
        return 1;
    }

    return 0;
}
```

使用 GCC 编译：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic main.c -o main
```

运行结果中的类型大小由当前编译器和平台决定，不能假设一定与其他人的机器相同。

## 十四、常见错误总结

### 14.1 把某个平台的类型大小当成标准规定

错误认识：

> `long` 永远是 4 字节，`long double` 永远是 8 字节。

正确理解：

- 标准规定最低表示能力和类型间的宽度关系；
- 具体大小由实现决定；
- 应使用 `sizeof`、`<limits.h>` 和 `<float.h>` 查询。

### 14.2 使用 %d 输出 sizeof

错误：

```c
printf("%d\n", sizeof(int));
```

正确：

```c
printf("%zu\n", sizeof(int));
```

因为 `sizeof` 的结果是 `size_t`。

### 14.3 读取未初始化的局部变量

错误：

```c
int count;
printf("%d\n", count);
```

应在使用前完成初始化：

```c
int count = 0;
```

### 14.4 误以为普通 char 一定有符号

`char` 的符号性由实现决定。需要明确语义时使用：

```c
signed char signed_value;
unsigned char byte_value;
```

### 14.5 整数除法之后才转换

错误：

```c
double average = (double)(sum / count);
```

正确：

```c
double average = (double)sum / count;
```

前提是 `count` 不为 0。

### 14.6 随意混合有符号和无符号值

负整数可能先转换成很大的无符号数，使比较结果反直觉。应统一语义，并在必要时先做范围检查。

### 14.7 认为有符号整数必然回绕

无符号运算按模回绕；有符号溢出是未定义行为。二者不能混为一谈。

### 14.8 printf 和 scanf 共用同一套浮点格式规则

应记住：

```c
printf("%f", double_value);

scanf("%f", &float_value);
scanf("%lf", &double_value);
```

### 14.9 不检查 scanf 返回值

错误：

```c
scanf("%d", &age);
printf("%d\n", age);
```

正确：

```c
if (scanf("%d", &age) == 1)
{
    printf("%d\n", age);
}
```

### 14.10 使用无限宽的 %s

错误：

```c
char name[20];
scanf("%s", name);
```

改进：

```c
char name[20];
scanf("%19s", name);
```

若要读取含空格的整行，使用 `fgets`。

### 14.11 以为 %10s 会丢弃超长输入

`%10s` 最多把 10 个字符写入目标数组，后面的未读字符仍会留在输入流中。后续读取时必须考虑这些剩余内容。

### 14.12 在一个表达式中多次修改同一变量

不要写：

```c
i = i++;
printf("%d %d\n", i++, i++);
```

将修改拆成多个有明确先后关系的语句。

## 十五、复习问题

### 15.1 sizeof 是函数吗

不是。`sizeof` 是 C 语言运算符。

### 15.2 sizeof 的结果应该使用什么格式输出

`sizeof` 返回 `size_t`，用 `printf` 输出时使用 `%zu`。

### 15.3 sizeof(char) 为什么永远是 1

因为 C 标准把 `char` 占用的存储单位定义为一个字节。但一个 C 字节包含多少位应通过 `CHAR_BIT` 查看，并非语言层面绝对固定为 8 位。

### 15.4 char 一定等价于 signed char 吗

不一定。普通 `char` 的符号性由实现决定，并且 `char`、`signed char`、`unsigned char` 是三个不同类型。

### 15.5 为什么 7 / 2 的结果是 3

两个操作数都是整数，因此执行整数除法，小数部分向 0 截断。

### 15.6 怎样得到 3.5

让至少一个操作数成为浮点类型：

```c
double result = 7.0 / 2;
```

或者：

```c
double result = (double)7 / 2;
```

### 15.7 无符号溢出与有符号溢出有什么区别

- 无符号运算按 `2^N` 取模，回绕行为有定义；
- 有符号整数溢出是未定义行为。

### 15.8 前置 ++ 和后置 ++ 有什么区别

当表达式结果被使用时：

- `++i`：先自增，再产生新值；
- `i++`：先产生旧值，再完成自增。

如果只是单独一条自增语句，最终都让变量增加 1。

### 15.9 printf 输出 double 用 %f 还是 %lf

推荐使用 `%f`。现代 C 的 `printf` 中 `%lf` 与 `%f` 效果相同，但 `scanf` 中二者不同。

### 15.10 scanf 读取 double 用什么格式

使用 `%lf`，并传入 `double *`：

```c
double value;
scanf("%lf", &value);
```

### 15.11 scanf 的返回值表示什么

表示成功完成赋值的项目数量；若在任何转换前遇到输入结束或读取错误，则返回 `EOF`。

### 15.12 为什么 scanf("%c", &ch) 可能读到换行

因为 `%c` 不会自动跳过前导空白，前一次输入留下的换行也会被当作普通字符读取。若需要读取下一个非空白字符，可以使用 `" %c"`。

## 十六、总结

学习数据类型不能只背“`int` 是整数、`double` 是小数”。更重要的是理解类型参与了程序的每个关键环节：

1. 类型决定对象的表示方式和可用操作；
2. 类型的具体大小依赖实现，应使用 `sizeof` 查询；
3. `sizeof` 返回 `size_t`，用 `%zu` 输出；
4. `<limits.h>` 和 `<float.h>` 提供范围与精度信息；
5. 普通 `char` 的符号性由实现决定；
6. 无符号整数按模运算，有符号溢出则是未定义行为；
7. 局部变量与全局变量的作用域、存储期不同；
8. 整数除法会向 0 截断；
9. 混合类型运算会发生提升和转换；
10. 强制类型转换可能丢失信息，不能只用来压制警告；
11. `printf` 与 `scanf` 的格式必须和参数类型严格匹配；
12. 使用 `scanf` 时要检查返回值，读取字符串时要限制宽度；
13. 复杂交互输入通常更适合 `fgets` 配合解析函数。

掌握这些规则后，后续学习数组、指针、结构体、动态内存和文件操作时，就能更准确地理解“程序究竟在处理什么数据，以及这些数据怎样存在于内存中”。
