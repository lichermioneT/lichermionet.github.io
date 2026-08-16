---
title: C与C++内存管理详解：malloc、new、delete与RAII
date: 2026-08-15 21:00:00
categories:
  - C++
tags:
  - C
  - C++
  - 内存管理
  - malloc
  - new
  - delete
  - placement new
  - RAII
---

内存管理贯穿C与C++程序的整个生命周期。变量存放在哪里、对象何时开始存在、动态内存由谁释放、构造失败时怎样回收空间，这些问题直接影响程序的正确性、性能与稳定性。

本文从进程虚拟地址空间讲起，系统比较`malloc/calloc/realloc/free`与`new/delete`，分析`operator new/operator delete`、对象数组、定位`new`、异常安全、内存泄漏与RAII，并通过可编译示例观察对象构造和析构过程。

<!-- more -->

## 一、先区分几个容易混淆的概念

### 1.1 内存、存储与对象

一段可用字节不一定已经包含一个合法的C++对象。

```cpp
void* raw = std::malloc(sizeof(std::string));
```

此时获得的是原始存储，`std::string`构造函数尚未执行，不能直接把它当作已经存在的字符串对象使用。

C++对象通常涉及两个层次：

1. 获得满足大小和对齐要求的存储；
2. 在存储中开始对象生命周期并完成初始化。

释放时则反过来：

1. 结束对象生命周期，执行必要的析构；
2. 归还存储。

### 1.2 栈、堆与存储期

日常开发常说“栈对象”和“堆对象”，但C++标准更关注对象的存储期：

- 自动存储期；
- 静态存储期；
- 线程存储期；
- 动态存储期。

编译器可能把自动变量放入寄存器、优化掉或重排，因此“局部变量一定实际位于硬件栈中”不是语言层面的绝对保证。

### 1.3 虚拟地址不等于物理内存

现代操作系统通常为每个进程提供独立的虚拟地址空间。程序看到的是虚拟地址，操作系统再通过页表把虚拟页映射到物理内存、文件或交换空间。

因此：

- 成功保留一大段虚拟地址不代表所有物理页已经实际分配；
- 地址空间足够不代表分配一定成功；
- 内存上限还受进程限制、容器限制、系统提交策略等影响。

## 二、典型进程虚拟地址空间

### 2.1 常见区域

一个常见的用户态进程地址空间可能包含：

```text
高地址
┌─────────────────────────┐
│ 栈及线程栈              │
├─────────────────────────┤
│ 内存映射区、共享库      │
├─────────────────────────┤
│ 动态分配区域            │
├─────────────────────────┤
│ BSS：未显式初始化静态数据│
├─────────────────────────┤
│ 数据段：已初始化静态数据 │
├─────────────────────────┤
│ 只读数据、代码          │
└─────────────────────────┘
低地址
```

这只是便于理解的典型布局，不是C或C++标准强制规定的固定图。

### 2.2 “栈向下、堆向上”不是标准保证

许多传统平台上的主线程栈向低地址增长，传统`brk`堆向高地址增长，但：

- C/C++语言标准不规定增长方向；
- 大块动态分配可能直接使用内存映射；
- 不同线程有各自的栈；
- 分配器可以维护多个arena和缓存；
- 地址空间随机化会改变实际位置。

面试时可以先说明常见实现，再强调这是操作系统和ABI细节。

### 2.3 变量与对象分别在哪里

```cpp
int globalValue = 1;
static int staticGlobalValue = 2;

void test()
{
    static int staticLocalValue = 3;
    int localValue = 4;

    int numbers[10] = {};
    char localText[] = "abcd";
    const char* literalPointer = "abcd";

    int* dynamicPointer =
        static_cast<int*>(std::malloc(4 * sizeof(int)));

    std::free(dynamicPointer);
}
```

常见实现中可以这样理解：

| 名称 | 自身的存储期或典型区域 | 它指向或包含的数据 |
| --- | --- | --- |
| `globalValue` | 静态存储期，数据区域 | 整数值 |
| `staticGlobalValue` | 静态存储期 | 整数值 |
| `staticLocalValue` | 静态存储期 | 整数值 |
| `localValue` | 自动存储期 | 整数值 |
| `numbers` | 自动存储期 | 10个连续`int` |
| `localText` | 自动存储期 | 可修改字符数组 |
| `literalPointer` | 指针本身是自动变量 | 指向静态存储期字符串字面量 |
| `dynamicPointer` | 指针本身是自动变量 | 指向动态分配的存储 |

指针变量放在哪里与它指向的数据放在哪里是两个问题。

### 2.4 字符数组与字符串字面量

```cpp
char text[] = "abcd";
```

`text`是包含5个字符的数组：

```text
'a' 'b' 'c' 'd' '\0'
```

可以修改数组内容：

```cpp
text[0] = 'A';
```

而：

```cpp
const char* pointer = "abcd";
```

`pointer`指向字符串字面量。字符串字面量不能被程序修改，C++中应使用`const char*`，而不是旧代码中的`char*`。

## 三、`sizeof`与`strlen`

### 3.1 数组大小

```cpp
int numbers[10] = {};
```

```cpp
sizeof(numbers) == 10 * sizeof(int)
```

如果当前平台`sizeof(int) == 4`，结果是40字节，但可移植代码不应把`int`大小永远写死为4。

### 3.2 字符数组

```cpp
char text[] = "abcd";
```

```cpp
sizeof(text)  // 5，包含'\0'
strlen(text)  // 4，不包含'\0'
```

### 3.3 字符指针

```cpp
const char* pointer = "abcd";
```

```cpp
sizeof(pointer) // 指针本身的大小
strlen(pointer) // 指向字符串的长度，即4
```

64位数据模型中指针常为8字节，32位中常为4字节，但具体值由平台决定。

### 3.4 数组传参会退化

```cpp
void function(int values[])
{
    std::cout << sizeof(values) << '\n';
}
```

形参`values`实际是`int*`，`sizeof(values)`得到指针大小，不是原数组大小。

需要长度时应显式传入，或使用`std::array`、`std::vector`、模板数组引用等更安全接口。

## 四、C语言动态内存管理

### 4.1 `malloc`

```c
#include <stdlib.h>

int* values = malloc(10 * sizeof(*values));
if (values == NULL)
{
    /* 分配失败 */
}
```

`malloc`的特点：

- 参数是需要的字节数；
- 返回`void*`；
- 失败时返回空指针；
- 成功时返回满足相应基本对齐要求的存储；
- 分配内容未初始化，读取前必须先写入有效值；
- 不调用C++构造函数。

在C语言中，`void*`可以隐式转换为对象指针，不建议强制转换`malloc`返回值，因为强转可能掩盖忘记包含`<stdlib.h>`等错误。

### 4.2 C++中使用`malloc`

C++不允许`void*`隐式转换为其他对象指针：

```cpp
int* values = static_cast<int*>(
    std::malloc(10 * sizeof(int))
);
```

但普通C++业务代码更应优先使用标准容器和RAII，而不是手工`malloc`。

### 4.3 `calloc`

```c
int* values = calloc(10, sizeof(*values));
```

`calloc`接收元素个数和单个元素大小，并把分配得到的所有字节清零。

对于现代常见平台的整数类型，全零字节表示整数零。但从抽象标准角度，不应把“全比特零”无条件推广到所有可能类型的语义零值。

### 4.4 `realloc`

```c
int* resized = realloc(values, 20 * sizeof(*values));
```

`realloc`尝试调整已有分配块大小：

- 可能原地扩展；
- 可能申请新块、复制原内容并释放旧块；
- 新旧范围重叠部分的数据会被保留；
- 扩大的新区域内容未初始化；
- 返回地址可能改变。

### 4.5 `realloc`的安全写法

错误写法：

```c
values = realloc(values, newCount * sizeof(*values));
```

如果失败，`realloc`返回`NULL`，直接覆盖`values`会丢失原指针，造成泄漏。

正确写法：

```c
int* temporary = realloc(values,
                         newCount * sizeof(*values));

if (temporary != NULL)
{
    values = temporary;
}
else
{
    /* 原values仍然有效，按业务处理失败 */
}
```

成功时旧指针可能已经失效，只能继续使用新返回值；失败时旧分配保持有效。

### 4.6 防止大小乘法溢出

```c
size_t bytes = count * sizeof(*values);
```

如果`count`非常大，乘法可能溢出并变成较小数值，随后写入`count`个元素会越界。

```c
if (count > SIZE_MAX / sizeof(*values))
{
    /* 大小溢出 */
}
else
{
    values = malloc(count * sizeof(*values));
}
```

使用`SIZE_MAX`通常需要合适的标准头文件，例如`<stdint.h>`或`<stdint.h>`相关实现支持；在C++中可使用`std::numeric_limits<std::size_t>::max()`。

### 4.7 `free`

```c
free(values);
values = NULL;
```

规则：

- 只能释放空指针，或由兼容分配函数返回且尚未释放的指针；
- `free(NULL)`安全且无操作；
- 不能释放局部数组、全局对象或字符串字面量；
- 不能重复释放；
- 释放后不能继续解引用旧指针。

把一个局部指针设为空只能避免该变量继续误用，其他指向同一块存储的别名仍然可能悬空。

### 4.8 不要对一般C++对象使用`realloc`

`realloc`按原始字节处理存储，不会调用构造、移动和析构函数。

```cpp
std::string* strings = /* ... */;
// 不要用realloc扩展一般std::string对象数组
```

对于具有非平凡生命周期的C++对象，应使用`std::vector`、正确的分配器或显式构造迁移逻辑。

## 五、C++的`new`与`delete`

### 5.1 单个内置类型

```cpp
int* first = new int;      // 默认初始化，值不确定
int* second = new int(10); // 初始化为10
int* third = new int{};    // 值初始化为0

delete first;
delete second;
delete third;
```

`new`不是“自动把内存清零”。初始化结果取决于类型与初始化语法。

### 5.2 动态数组

```cpp
int* first = new int[10];   // 元素值不确定
int* second = new int[10]{}; // 元素值初始化为0

delete[] first;
delete[] second;
```

单对象与数组必须匹配：

```text
new T       <-> delete pointer
new T[n]    <-> delete[] pointer
```

混用属于未定义行为，即使元素是`int`并且某次运行没有崩溃也不合法。

### 5.3 自定义类型

```cpp
class Widget
{
public:
    Widget()
    {
        std::cout << "Widget()\n";
    }

    ~Widget()
    {
        std::cout << "~Widget()\n";
    }
};

Widget* pointer = new Widget;
delete pointer;
```

`new Widget`会在获得存储后调用构造函数，`delete`会先调用析构函数再释放存储。

### 5.4 对象数组

```cpp
Widget* widgets = new Widget[3];
delete[] widgets;
```

通常表现为：

1. 获得足够存储；
2. 按下标从小到大构造元素；
3. `delete[]`按相反顺序析构元素；
4. 释放数组存储。

如果构造第`k`个元素时抛出异常，已经成功构造的前面元素会被析构，数组存储也会按规则回收。

### 5.5 数组长度信息

实现为了正确析构数组，可能在分配块旁保存元素数量等元数据，俗称array cookie。

但cookie的存在、位置与格式属于实现细节。程序不能通过数组指针可移植地推断元素个数，必须自行保存长度或使用容器。

### 5.6 `delete nullptr`

```cpp
Widget* pointer = nullptr;
delete pointer;

Widget* array = nullptr;
delete[] array;
```

两者都安全且无操作，因此析构或清理代码通常不需要先写多余的空指针判断。

### 5.7 分配失败

普通`new`失败时默认抛出`std::bad_alloc`：

```cpp
try
{
    int* data = new int[hugeCount];
    delete[] data;
}
catch (const std::bad_alloc& error)
{
    std::cerr << error.what() << '\n';
}
```

使用`std::nothrow`时返回空指针：

```cpp
#include <new>

int* data = new (std::nothrow) int[hugeCount];
if (data == nullptr)
{
    // 处理失败
}
```

普通代码不一定要在分配点捕获`bad_alloc`；如果当前层无法恢复，可以让异常传播到统一错误处理边界。

## 六、`malloc/free`与`new/delete`对比

| 对比项 | `malloc/free` | `new/delete` |
| --- | --- | --- |
| 语言来源 | C标准库函数 | C++表达式/运算符语法 |
| 大小 | 手动传字节数 | 由类型与数量计算 |
| 返回类型 | `void*` | 对应类型指针 |
| 构造函数 | 不调用 | `new`表达式调用 |
| 析构函数 | 不调用 | `delete`表达式调用 |
| 默认失败方式 | 返回空指针 | 抛出`std::bad_alloc` |
| 初始化 | 原始字节，`calloc`清零 | 按C++初始化语法执行 |
| 扩容 | `realloc` | 没有对应的`renew` |
| 自定义分配 | 替换/封装分配器 | 可重载分配函数 |

共同点是：它们都可能从某种动态存储来源获得空间，手工使用时都需要匹配释放。

现代C++的首选通常不是裸`new/delete`，而是容器、智能指针和RAII对象。

## 七、不要混用分配与释放家族

下面都是错误的：

```text
int* first = static_cast<int*>(std::malloc(sizeof(int)));
delete first;

int* second = new int;
std::free(second);

int* third = new int[10];
delete third;
```

必须按来源匹配：

```text
malloc/calloc/realloc -> free
new                    -> delete
new[]                  -> delete[]
::operator new         -> ::operator delete
::operator new[]       -> ::operator delete[]
```

定位`new`是一个特殊组合，后文单独说明。

## 八、`operator new`与`operator delete`

### 8.1 `new`表达式与`operator new`不是一回事

```cpp
Widget* pointer = new Widget(10);
```

这是`new`表达式，它大致完成：

1. 调用合适的分配函数获得原始存储；
2. 在存储中调用`Widget`构造函数；
3. 返回指向已构造对象的指针。

而：

```cpp
void* raw = ::operator new(sizeof(Widget));
```

只获得原始存储，不会自动构造`Widget`。

### 8.2 标准不要求底层必须调用`malloc`

许多标准库实现的全局`operator new`最终使用`malloc`或操作系统分配器，但C++标准不强制这种实现方式。

可移植结论是：

- 成功时返回满足要求的原始存储；
- 普通抛异常版本失败时抛出`std::bad_alloc`；
- `operator delete`接收相应指针并释放存储。

不要把某个版本CRT源码中的内部调用当作所有平台的语言规则。

### 8.3 直接使用全局分配函数

```cpp
#include <new>

void* raw = ::operator new(1024);
::operator delete(raw);
```

这与`malloc/free`一样只管理原始存储，不会构造或析构具体对象。

### 8.4 构造函数抛异常时

```cpp
Widget* pointer = new Widget(arguments);
```

如果存储分配成功但构造函数抛出异常，`new`表达式会调用匹配的释放函数回收那块存储，然后继续传播异常。

对象没有成功完成构造，因此不会对该未完成对象执行普通析构函数；已经完成构造的基类和成员子对象会按异常展开规则销毁。

### 8.5 `delete`表达式的主要步骤

```cpp
delete pointer;
```

对于非空有效指针，大致过程是：

1. 调用对象析构函数；
2. 调用匹配的释放函数归还对象存储。

指针必须来自兼容的`new`表达式并且尚未释放，否则行为未定义。

### 8.6 `std::new_handler`

全局分配函数在失败时可能调用当前`new_handler`：

```cpp
#include <new>

void handleOutOfMemory()
{
    throw std::bad_alloc();
}

int main()
{
    std::set_new_handler(handleOutOfMemory);
}
```

一个有意义的处理器应当：

- 释放预留内存；
- 降低资源使用；
- 安装新的处理器；
- 抛出异常；
- 或终止程序。

如果什么条件也不改变就返回，分配器可能不断重试。

## 九、类专属`operator new/delete`

### 9.1 基本形式

```cpp
class Node
{
public:
    static void* operator new(std::size_t size)
    {
        std::cout << "Node allocation: " << size << '\n';
        return ::operator new(size);
    }

    static void operator delete(void* pointer) noexcept
    {
        std::cout << "Node deallocation\n";
        ::operator delete(pointer);
    }

private:
    int _value = 0;
};
```

```cpp
Node* node = new Node;
delete node;
```

查找分配函数时会考虑类专属版本。

### 9.2 典型用途

- 固定大小对象池；
- 高频小对象分配优化；
- 调试与统计；
- 特殊硬件或共享内存；
- 框架级分配策略。

### 9.3 类专属分配函数仍只管理存储

`Node::operator new`不负责调用`Node`构造函数。它返回原始存储后，`new Node`表达式继续执行构造。

`Node::operator delete`也不负责主动调用析构函数；`delete node`表达式会先完成析构，再进入释放函数。

### 9.4 构造失败时需要匹配释放函数

如果类定义了特殊形式的`operator new`，应同时考虑构造失败时编译器如何找到匹配的`operator delete`，否则可能造成复杂的资源问题。

生产级重载还需要考虑：

- 数组版本；
- 对齐要求；
- 不抛异常版本；
- 线程安全；
- 大小参数；
- C++14的sized deallocation；
- C++17的过对齐分配。

### 9.5 不要为了练习随意替换全局分配器

全局`operator new/delete`影响范围很大，还可能被运行库、第三方库和静态初始化使用。没有完整的线程安全、递归保护、对齐和错误处理设计时，不应在普通项目中随意替换。

## 十、`new[]`与`delete[]`实现要点

### 10.1 数组分配函数

```cpp
Widget* array = new Widget[count];
```

实现会调用合适的`operator new[]`获取足够存储，再构造各元素。

标准不保证`operator new[]`一定通过普通`operator new`实现，也不保证`operator delete[]`一定调用普通`operator delete`。它们是可以独立替换或重载的分配函数。

### 10.2 部分构造失败

假设构造第4个元素时抛出异常：

```text
元素0：已构造
元素1：已构造
元素2：已构造
元素3：构造抛出
```

语言会析构已经成功构造的元素2、1、0，然后释放数组存储。调用者不会拿到数组指针。

### 10.3 为什么不能用`free`释放对象数组

`free`不会执行元素析构，也不遵循`new[]`分配元数据和对应释放函数的规则。即使底层实现碰巧使用相同系统堆，混用仍然是未定义行为。

## 十一、定位`new`（placement new）

### 11.1 基本概念

定位`new`在调用者提供的原始存储中构造对象，不负责新分配一块普通动态存储。

```cpp
#include <new>

void* raw = ::operator new(sizeof(Widget));
Widget* object = new (raw) Widget(arguments);
```

### 11.2 完整生命周期

```cpp
void* raw = ::operator new(sizeof(Widget));

Widget* object = nullptr;

try
{
    object = new (raw) Widget(arguments);
}
catch (...)
{
    ::operator delete(raw);
    throw;
}

object->~Widget();
::operator delete(raw);
```

定位`new`不会在对象销毁时自动知道应该把存储归还给谁，因此调用者必须：

1. 显式调用析构函数；
2. 使用与原始存储来源匹配的方式释放存储。

### 11.3 栈上原始缓冲区

```cpp
#include <new>

alignas(Widget) unsigned char storage[sizeof(Widget)];

Widget* object = new (storage) Widget(arguments);
object->~Widget();
```

`storage`具有自动存储期，不需要也不能对它调用`operator delete`。

`alignas(Widget)`非常重要，否则缓冲区地址可能不满足`Widget`的对齐要求。

### 11.4 为什么不能直接强转后使用

```text
void* raw = std::malloc(sizeof(Widget));
Widget* object = static_cast<Widget*>(raw);
object->function();
```

对于需要构造的类型，仅仅转换指针没有开始正常对象生命周期。必须在合适存储中执行构造。

### 11.5 显式析构语法

```cpp
object->~Widget();
```

这只执行析构函数，不释放存储。之后不能继续把原地址当作该对象使用，除非按对象生命周期规则重新构造。

### 11.6 使用场景

- 内存池；
- STL分配器；
- 容器预留存储；
- variant式存储；
- 高频对象复用；
- 共享内存中的对象布局。

### 11.7 过对齐类型

```cpp
struct alignas(64) CacheLineObject
{
    int value;
};
```

普通`malloc`在C++11中不一定满足扩展对齐类型的要求。处理过对齐类型需要平台对齐分配接口、自定义分配器，或C++17对齐分配支持。

## 十二、常见内存错误

### 12.1 内存泄漏

```cpp
void function()
{
    int* pointer = new int(10);
    // 忘记delete
}
```

函数结束后指针变量消失，但动态对象仍然占用资源，程序失去了释放它的正常路径。

### 12.2 重复释放

```text
delete pointer;
delete pointer;
```

第二次释放属于未定义行为。

把当前变量设为`nullptr`能避免它自己重复释放：

```cpp
delete pointer;
pointer = nullptr;
delete pointer; // 安全，无操作
```

但其他别名指针仍可能悬空。

### 12.3 释放后使用

```text
delete pointer;
std::cout << *pointer;
```

释放后继续访问属于use-after-free，是高危未定义行为。

### 12.4 越界访问

```text
int* values = new int[10];
values[10] = 1;
```

合法下标是0到9。越界可能破坏分配器元数据或其他对象。

### 12.5 释放方式不匹配

```text
new[]  -> delete
malloc -> delete
new    -> free
```

全部属于未定义行为。

### 12.6 返回局部对象地址

```text
int* wrong()
{
    int value = 10;
    return &value;
}
```

函数返回后局部对象生命周期结束，返回值是悬空指针。它不是堆泄漏，但同样属于严重生命周期错误。

### 12.7 未初始化内存读取

```text
int* value = new int;
std::cout << *value;
```

`new int`没有给整数确定值。应使用`new int{}`或在读取前赋值。

### 12.8 大小计算错误

```text
int* values = malloc(count);
```

如果意图分配`count`个`int`，应计算`count * sizeof(*values)`并检查溢出。

## 十三、内存泄漏与资源泄漏

### 13.1 什么是内存泄漏

程序已经不再需要某块动态内存，却没有释放它，或者已经失去能够释放它的指针，这就是内存泄漏。

泄漏不是物理内存“消失”，而是资源仍被进程占用却无法正常复用或归还。

### 13.2 长期运行服务为什么更怕泄漏

短命令行程序退出后，操作系统通常会回收进程资源；但后台服务可能运行数月。即使每个请求只泄漏几十字节，累计后也可能导致：

- 常驻内存不断增长；
- 分配延迟增加；
- 频繁换页；
- OOM终止；
- 服务响应变慢或不可用。

### 13.3 系统资源泄漏

不仅堆内存会泄漏，下面资源同样需要管理：

- 文件描述符；
- Socket；
- 管道；
- 互斥锁；
- 数据库连接；
- GPU资源；
- 共享内存；
- 线程和进程句柄。

资源耗尽可能比内存耗尽更快发生。

### 13.4 高内存占用不一定是泄漏

内存池、缓存、分配器arena和延迟归还策略可能让进程常驻内存保持较高，即使对象已经逻辑释放。

判断泄漏需要结合：

- 是否仍有正常所有权路径；
- 内存是否会被复用；
- 长时间压力下是否持续无界增长；
- 工具报告中的可达性和分配栈；
- 业务缓存上限。

## 十四、异常安全与RAII

### 14.1 手工清理的异常问题

```cpp
void function()
{
    int* values = new int[100];

    riskyOperation(); // 可能抛出异常

    delete[] values;
}
```

如果中间抛出异常，`delete[]`不会执行。

### 14.2 使用`std::vector`

```cpp
void function()
{
    std::vector<int> values(100);
    riskyOperation();
}
```

异常展开时`values`自动析构并释放内存。

### 14.3 使用`std::unique_ptr`

C++11：

```cpp
#include <memory>

std::unique_ptr<Widget> object(new Widget(arguments));
std::unique_ptr<Widget[]> array(new Widget[count]);
```

C++14以后优先使用：

```cpp
auto object = std::make_unique<Widget>(arguments);
```

`make_unique`不是C++11标准库功能，使用时要明确项目标准版本。

### 14.4 自定义删除器管理C资源

```cpp
#include <cstdio>
#include <memory>

struct FileCloser
{
    void operator()(std::FILE* file) const noexcept
    {
        if (file != nullptr)
        {
            std::fclose(file);
        }
    }
};

using FilePointer = std::unique_ptr<std::FILE, FileCloser>;

FilePointer file(std::fopen("data.txt", "rb"));
```

即使函数提前返回，文件也会自动关闭。

### 14.5 `shared_ptr`也可能产生逻辑泄漏

两个对象如果通过`std::shared_ptr`相互强引用，引用计数永远不会归零。

```text
A --shared_ptr--> B
A <--shared_ptr-- B
```

应根据所有权关系让一侧使用`std::weak_ptr`打破环。

RAII不是“用了智能指针就永远不会泄漏”，还需要正确建模所有权。

## 十五、内存检测工具

### 15.1 编译器警告

```bash
g++ -std=c++11 -Wall -Wextra -Wpedantic program.cpp
```

警告能发现部分错误，但无法覆盖所有运行时内存问题。

### 15.2 AddressSanitizer

```bash
g++ -std=c++11 -g -O1 \
  -fsanitize=address,undefined \
  -fno-omit-frame-pointer \
  program.cpp -o program

./program
```

常用于检测：

- 堆越界；
- 栈越界；
- 释放后使用；
- 重复释放；
- 部分内存泄漏；
- 多种未定义行为。

### 15.3 Valgrind

Linux下可以使用：

```bash
valgrind --leak-check=full \
         --show-leak-kinds=all \
         ./program
```

Valgrind通常不需要重新编译插桩，但运行速度明显变慢。

### 15.4 Windows工具

常见方案包括：

- Visual Studio诊断工具；
- CRT调试堆；
- AddressSanitizer支持；
- 第三方VLD等工具。

工具只能帮助定位，良好的所有权设计和RAII才是第一道防线。

## 十六、一次申请4 GiB内存的问题

### 16.1 4 GiB是多少

```cpp
const std::size_t fourGiB =
    static_cast<std::size_t>(1ULL << 32);
```

4 GiB等于`2^32`字节。`0xffffffff`只是`2^32 - 1`。

### 16.2 32位进程为什么通常不行

32位指针理论虚拟地址范围总共只有4 GiB，还要容纳：

- 程序代码；
- 共享库；
- 栈；
- 映射区；
- 内核保留区域；
- 其他动态分配。

因此几乎不可能获得一块连续4 GiB用户空间分配。

### 16.3 64位进程也不保证成功

64位地址空间足够大，但分配仍可能因以下原因失败：

- 物理内存和交换空间限制；
- 进程或容器内存上限；
- 地址空间碎片；
- 提交限制；
- 分配器限制；
- 操作系统策略。

### 16.4 分配成功不等于页面都已提交

某些系统采用内存过量承诺。`new char[fourGiB]`返回成功时，可能只是获得虚拟地址范围；真正逐页写入时才触发物理页分配，并可能在后续失败。

不要在普通开发机上为了验证概念盲目申请并写满4 GiB。

### 16.5 安全的概念演示

```cpp
#include <cstddef>
#include <iostream>
#include <limits>

int main()
{
    if (sizeof(std::size_t) < 8)
    {
        std::cout << "32-bit size_t cannot represent 4 GiB as a normal size\n";
        return 0;
    }

    const std::size_t fourGiB =
        static_cast<std::size_t>(1ULL << 32);

    std::cout << "4 GiB = " << fourGiB << " bytes\n";
}
```

该示例只计算大小，不实际消耗巨量内存。

## 十七、综合示例：RAII、对象数组与定位`new`

下面的程序同时展示：

- `std::unique_ptr`管理单对象和数组；
- `new[]`构造多个对象；
- `delete[]`逆序析构；
- 对齐的栈上原始存储；
- 定位`new`构造对象；
- 显式析构；
- 对象存活计数。

```cpp
#include <cstddef>
#include <iostream>
#include <memory>
#include <new>

class Tracker
{
public:
    explicit Tracker(int id = 0)
        : _id(id)
    {
        ++_liveCount;
        std::cout << "construct " << _id << '\n';
    }

    Tracker(const Tracker&) = delete;
    Tracker& operator=(const Tracker&) = delete;

    ~Tracker()
    {
        std::cout << "destroy " << _id << '\n';
        --_liveCount;
    }

    static int liveCount()
    {
        return _liveCount;
    }

private:
    int _id;
    static int _liveCount;
};

int Tracker::_liveCount = 0;

int main()
{
    {
        std::unique_ptr<Tracker> one(new Tracker(1));
        std::unique_ptr<Tracker[]> array(new Tracker[2]);

        std::unique_ptr<int[]> numbers(new int[4]{1, 2, 3, 4});
        int sum = 0;

        for (std::size_t index = 0; index < 4; ++index)
        {
            sum += numbers[index];
        }

        alignas(Tracker) unsigned char storage[sizeof(Tracker)];
        Tracker* placed = new (storage) Tracker(9);

        std::cout << "sum: " << sum << '\n';
        std::cout << "live before explicit destruction: "
                  << Tracker::liveCount() << '\n';

        placed->~Tracker();

        std::cout << "live after explicit destruction: "
                  << Tracker::liveCount() << '\n';
    }

    std::cout << "live after scope: "
              << Tracker::liveCount() << '\n';

    return 0;
}
```

预期输出：

```text
construct 1
construct 0
construct 0
construct 9
sum: 10
live before explicit destruction: 4
destroy 9
live after explicit destruction: 3
destroy 0
destroy 0
destroy 1
live after scope: 0
```

### 17.1 单对象RAII

`one`离开作用域时自动执行`delete`，即使中途抛出异常也不会泄漏。

### 17.2 数组RAII

`std::unique_ptr<Tracker[]>`会使用`delete[]`，两个数组元素按构造相反顺序析构。

### 17.3 动态整数数组初始化

```cpp
new int[4]{1, 2, 3, 4}
```

使用列表初始化给每个元素明确值，求和结果为10。

### 17.4 对齐存储

`alignas(Tracker)`保证字节数组起始地址满足`Tracker`对齐要求，仅有`sizeof(Tracker)`并不足以保证对齐。

### 17.5 定位构造与显式析构

定位`new`在`storage`中构造编号9的对象。因为存储不是普通`new`表达式获得的，不能对`placed`执行`delete`，只能显式析构；字节数组本身会随作用域结束自动回收。

## 十八、常见面试问题

### 18.1 C/C++程序的内存区域有哪些

常见进程实现可分为代码与只读数据、已初始化数据、BSS、动态分配区域、内存映射区和栈等。具体布局与增长方向由平台和操作系统决定，不是C++标准固定图。

### 18.2 指针在栈上，指向的数据一定也在栈上吗

不一定。指针变量本身可能具有自动存储期，但可以指向动态内存、静态对象、映射文件或其他有效对象。

### 18.3 `malloc`、`calloc`和`realloc`有什么区别

`malloc`按字节数分配未初始化存储；`calloc`接收数量与元素大小并清零所有字节；`realloc`调整已有分配大小，可能移动地址，失败时原分配仍有效。

### 18.4 `realloc`为什么要用临时指针接收

失败时它返回空指针但不会释放原块。直接覆盖原变量会丢失原地址并造成泄漏。

### 18.5 `malloc/free`与`new/delete`最核心的区别是什么

`malloc/free`只管理原始存储；`new/delete`表达式把存储分配与C++对象构造、析构语义结合起来。失败处理、类型信息和初始化语法也不同。

### 18.6 `new int`是否会初始化为零

不会保证。`new int`默认初始化，值不确定；`new int()`或`new int{}`会进行值初始化并得到零。

### 18.7 为什么`new[]`必须配合`delete[]`

数组表达式需要按规则析构所有元素，并使用匹配的数组释放函数和可能的实现元数据。混用属于未定义行为。

### 18.8 `new`和`operator new`有什么区别

`new`是完整表达式，负责获取存储并构造对象；`operator new`是分配函数，只返回原始存储，不调用对象构造函数。

### 18.9 `delete`和`operator delete`有什么区别

`delete`表达式先执行对象析构，再调用释放函数；直接调用`operator delete`只归还原始存储，不会自动析构对象。

### 18.10 `operator new`一定调用`malloc`吗

不一定。很多实现这样做，但标准只规定其可观察语义，不规定必须基于`malloc`实现。

### 18.11 构造函数抛异常后分配的内存会泄漏吗

普通`new`表达式会调用匹配的释放函数回收已经获得的对象存储，已构造的成员和基类也会按异常展开规则销毁。类专属特殊分配重载仍需正确提供匹配释放形式。

### 18.12 什么是placement new

它在调用者提供的原始存储中开始对象生命周期并调用构造函数，不额外执行普通动态分配。调用者随后需要显式析构并按原存储来源进行回收。

### 18.13 定位`new`为什么需要考虑对齐

对象地址必须满足类型对齐要求。仅准备足够字节数不能保证地址对齐，可使用`alignas(T)`或合适的分配器。

### 18.14 什么是内存泄漏

已经不再需要的动态内存没有被释放，或程序丢失了释放它的所有权路径，导致资源持续被占用。

### 18.15 如何避免内存泄漏

优先使用RAII、标准容器、智能指针和明确所有权模型；配合代码审查、异常安全设计、编译器警告、Sanitizer和Valgrind等工具。

### 18.16 64位程序一次申请4 GiB一定成功吗

不一定。地址空间更大只是必要条件之一，还受物理内存、提交限制、容器配额、分配器、碎片和操作系统策略影响。

## 十九、编码建议

### 19.1 优先使用自动对象

```cpp
Widget widget;
```

能由作用域自动管理时，不要无意义地写成动态对象。

### 19.2 动态序列优先使用容器

```cpp
std::vector<int> values(count);
```

优于：

```cpp
int* values = new int[count];
```

容器会管理长度、容量、释放、复制、移动和异常安全。

### 19.3 独占对象优先使用`unique_ptr`

```cpp
std::unique_ptr<Widget> pointer(new Widget);
```

C++14以后优先使用`std::make_unique`。

### 19.4 共享所有权必须有真实语义

不要因为“不知道谁释放”就全部改成`shared_ptr`。共享所有权会增加控制块、原子计数和环引用风险。

### 19.5 裸指针优先表达非拥有观察

一个裸指针如果只是观察对象，应在接口和注释中说明它不负责释放。真正所有权交给RAII类型。

### 19.6 分配与释放靠近并封装

如果必须调用C接口，尽快把获得的资源包装进RAII对象，减少裸资源在业务代码中的传播范围。

### 19.7 不要依赖偶然运行结果

以下错误可能暂时“不崩”：

- `new[]`配`delete`；
- 读取未初始化值；
- 释放后访问；
- 重复释放；
- 访问越界。

它们仍然是未定义行为，优化级别、编译器或输入变化后可能立即暴露。

## 二十、总结

本篇的核心结论如下：

- 典型地址空间图是平台实现，不是C++标准固定布局；
- 指针变量的位置与指向对象的位置必须分开分析；
- `sizeof`查询对象或类型大小，`strlen`扫描字符串内容；
- `malloc`分配未初始化原始存储，`calloc`把字节清零；
- `realloc`可能改变地址，失败时原块仍有效，应使用临时指针；
- 大小乘法必须考虑`size_t`溢出；
- `new int`不保证为零，`new int{}`会值初始化；
- `new/delete`和`new[]/delete[]`必须严格匹配；
- `malloc/free`不能与`new/delete`交叉使用；
- `new`表达式负责分配与构造，`operator new`只负责原始存储；
- 标准不要求`operator new`必须通过`malloc`实现；
- 对象数组部分构造失败时，已构造元素会自动回滚；
- placement new在已有存储中构造对象，需要显式析构并正确处理存储来源；
- 原始存储必须同时满足对象的大小和对齐要求；
- 内存泄漏之外，还要关注文件、Socket和锁等系统资源泄漏；
- 高常驻内存不必然等于泄漏，应结合所有权、复用和增长趋势判断；
- RAII、标准容器和智能指针是现代C++预防资源泄漏的核心；
- AddressSanitizer、UndefinedBehaviorSanitizer和Valgrind用于发现问题，但不能代替正确设计；
- 64位地址空间允许表示4 GiB大小，但不保证实际分配或写入成功。

真正可靠的内存管理不是“记得在最后写`delete`”，而是让资源所有权在类型系统和对象生命周期中得到清晰表达，使清理动作自动、唯一并且具备异常安全性。
