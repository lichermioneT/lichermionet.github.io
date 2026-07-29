---
title: C++ 多态详解：从虚函数到虚函数表
date: 2026-07-28
updated: 2026-07-29
description: 系统梳理 C++ 多态的构成条件、虚函数、虚函数表、抽象类与常见问题。
categories:
  - C++
tags:
  - C++
  - 继承
  - 多态
  - 虚函数
  - 虚函数表
comments: false
---

## 一、多态的基本概念

多态（Polymorphism）可以理解为：**同一个接口，由不同对象执行时，表现出不同的行为。**

例如，普通人、学生和军人都需要执行“买票”这一行为，但具体规则不同：

- 普通人：全价买票；
- 学生：半价买票；
- 军人：优先买票。

从程序设计的角度看，我们希望调用者只依赖统一的基类接口，而不需要针对每一种派生类分别编写判断逻辑。

```cpp
#include <iostream>

class Person
{
public:
    virtual void buyTicket() const
    {
        std::cout << "普通人：全价买票\n";
    }

    virtual ~Person() = default;
};

class Student : public Person
{
public:
    void buyTicket() const override
    {
        std::cout << "学生：半价买票\n";
    }
};

class Soldier : public Person
{
public:
    void buyTicket() const override
    {
        std::cout << "军人：优先买票\n";
    }
};

void buy(Person& person)
{
    person.buyTicket();
}

int main()
{
    Person person;
    Student student;
    Soldier soldier;

    buy(person);
    buy(student);
    buy(soldier);

    return 0;
}
```

运行结果：

```text
普通人：全价买票
学生：半价买票
军人：优先买票
```

`buy()` 函数接收的始终是 `Person&`，但最终调用哪个版本的 `buyTicket()`，由引用实际绑定的对象类型决定。

---

## 二、构成运行时多态的条件

C++ 中构成运行时多态通常需要满足三个条件：

1. 派生类和基类之间存在继承关系；
2. 基类声明虚函数，派生类对该虚函数进行重写；
3. 通过基类的指针或引用调用虚函数。

```cpp
class Base
{
public:
    virtual void func()
    {
        std::cout << "Base::func()\n";
    }

    virtual ~Base() = default;
};

class Derived : public Base
{
public:
    void func() override
    {
        std::cout << "Derived::func()\n";
    }
};

int main()
{
    Derived derived;
    Base* ptr = &derived;
    Base& ref = derived;

    ptr->func();
    ref.func();
}
```

输出：

```text
Derived::func()
Derived::func()
```

如果缺少虚函数，或者没有通过基类指针、引用调用，就不会形成这种典型的运行时多态。

---

## 三、虚函数与虚函数重写

### 3.1 什么是虚函数

在类的非静态成员函数前添加 `virtual`，该函数就成为虚函数：

```cpp
class Base
{
public:
    virtual void func()
    {
        std::cout << "Base::func()\n";
    }
};
```

`virtual` 表示：通过基类指针或引用调用该函数时，应该根据对象的实际类型决定调用哪个函数。

### 3.2 什么是虚函数重写

派生类重新实现基类中的虚函数，称为重写（Override），也常被称为覆盖。

一般情况下，派生类函数需要与基类虚函数保持：

- 函数名相同；
- 参数列表相同；
- `const`、引用限定符等函数限定一致；
- 返回类型相同，或者满足协变规则；
- 派生类的异常说明不能比基类更宽松。

```cpp
class Base
{
public:
    virtual void func(int value) const
    {
        std::cout << "Base: " << value << '\n';
    }
};

class Derived : public Base
{
public:
    void func(int value) const override
    {
        std::cout << "Derived: " << value << '\n';
    }
};
```

派生类重写虚函数时可以不再写 `virtual`，因为从基类继承下来的虚函数仍然保持虚函数属性。不过，现代 C++ 更推荐使用 `override`：

```cpp
void func(int value) const override;
```

这样一旦函数签名写错，编译器会立即报错。

### 3.3 常见的重写失败

下面的代码没有形成重写：

```cpp
class Base
{
public:
    virtual void func() const {}
};

class Derived : public Base
{
public:
    void func() {}  // 缺少 const，不是重写，而是隐藏
};
```

如果写成：

```cpp
void func() override {}
```

编译器会提示该函数没有重写任何基类虚函数。因此，只要本意是重写，就应该主动添加 `override`。

---

## 四、重写的两个特殊情况

### 4.1 协变返回类型

通常，派生类重写函数的返回类型应与基类一致。但是，当基类虚函数返回某个类的指针或引用时，派生类可以返回对应派生类型的指针或引用，这种规则称为协变。

```cpp
class Animal
{
public:
    virtual Animal* clone() const
    {
        return new Animal(*this);
    }

    virtual ~Animal() = default;
};

class Dog : public Animal
{
public:
    Dog* clone() const override
    {
        return new Dog(*this);
    }
};
```

这里：

- 基类返回 `Animal*`；
- 派生类返回 `Dog*`；
- `Dog` 是 `Animal` 的派生类。

因此，二者仍然构成虚函数重写。

### 4.2 析构函数的重写

基类和派生类的析构函数名称看起来不同：

```cpp
~Base();
~Derived();
```

但是编译器会对析构函数进行特殊处理。如果基类析构函数是虚函数，派生类析构函数会对它进行重写。

```cpp
class Base
{
public:
    virtual ~Base()
    {
        std::cout << "~Base()\n";
    }
};

class Derived : public Base
{
public:
    ~Derived() override
    {
        std::cout << "~Derived()\n";
    }
};
```

---

## 五、为什么基类析构函数通常要声明为虚函数

如果一个类可能被当作多态基类使用，并且对象可能通过基类指针被删除，那么基类析构函数必须是虚函数。

```cpp
class Base
{
public:
    virtual ~Base()
    {
        std::cout << "~Base()\n";
    }
};

class Derived : public Base
{
public:
    Derived()
        : data_(new int[100])
    {
    }

    ~Derived() override
    {
        delete[] data_;
        std::cout << "~Derived()\n";
    }

private:
    int* data_;
};

int main()
{
    Base* ptr = new Derived;
    delete ptr;
}
```

正确的析构顺序是：

```text
~Derived()
~Base()
```

如果 `Base::~Base()` 不是虚函数，通过 `Base*` 删除实际类型为 `Derived` 的对象会产生**未定义行为**。最常见的后果是派生类析构函数没有被正确执行，进而造成资源泄漏。

因此，多态基类通常写成：

```cpp
virtual ~Base() = default;
```

更完整地说，面向继承设计的基类析构函数通常应满足下面两种形式之一：

- `public virtual`：允许通过基类指针安全删除对象；
- `protected non-virtual`：明确禁止外部通过基类指针删除对象。

---

## 六、为什么多态通常必须通过基类指针或引用实现

这是理解 C++ 多态的关键。

### 6.1 指针和引用保留对象的实际类型

```cpp
Derived derived;
Base* ptr = &derived;
Base& ref = derived;
```

虽然 `ptr` 和 `ref` 的静态类型分别是 `Base*` 和 `Base&`，但它们指向或绑定的对象仍然是完整的 `Derived` 对象。

调用虚函数时，程序可以从实际对象中取得虚函数表信息，并找到 `Derived` 重写后的函数。

### 6.2 值传递可能发生对象切片

```cpp
void call(Base base)
{
    base.func();
}

Derived derived;
call(derived);
```

将 `Derived` 对象按值传递给 `Base` 形参时，只会复制其中的基类部分，派生类部分被丢弃，这种现象称为**对象切片（Object Slicing）**。

进入 `call()` 后，`base` 已经是一个独立的 `Base` 对象，因此无法再表现出原来 `Derived` 对象的多态行为。

### 6.3 直接使用对象调用时，类型通常已经确定

```cpp
Base base;
Derived derived;

base.func();
derived.func();
```

对象的静态类型已经明确，编译器通常可以直接确定调用目标，不需要通过基类接口进行动态分派。

所以：

- 基类指针或引用提供统一接口；
- 实际对象保留派生类型信息；
- 虚函数负责在运行时选择最终实现。

三者共同构成运行时多态。

---

## 七、`override` 与 `final`

### 7.1 `override`

`override` 用于检查派生类函数是否真正重写了基类虚函数：

```cpp
class Car
{
public:
    virtual void drive() const {}
    virtual ~Car() = default;
};

class Benz : public Car
{
public:
    void drive() const override
    {
        std::cout << "Benz：舒适\n";
    }
};
```

如果函数名、参数或 `const` 限定不一致，编译器会报错。

### 7.2 `final`

`final` 修饰虚函数时，表示该函数不能继续被重写：

```cpp
class Car
{
public:
    virtual void drive() {}
};

class Benz : public Car
{
public:
    void drive() final {}
};
```

`final` 也可以修饰整个类，表示该类不能继续被继承：

```cpp
class Benz final : public Car
{
};
```

建议：

- 派生类重写虚函数时使用 `override`；
- 确实需要终止重写或继承链时再使用 `final`。

---

## 八、重载、重写与隐藏的区别

这三个概念非常容易混淆。

| 对比项 | 重载（Overload） | 重写（Override） | 隐藏（Hide） |
| --- | --- | --- | --- |
| 作用域 | 同一作用域 | 基类与派生类 | 基类与派生类 |
| 是否需要继承 | 不需要 | 需要 | 需要 |
| 函数名 | 相同 | 相同 | 相同 |
| 参数列表 | 必须不同 | 通常必须相同 | 可以相同，也可以不同 |
| 基类函数是否必须为虚函数 | 无基类要求 | 必须是虚函数 | 不要求 |
| 是否体现运行时多态 | 否 | 是 | 否 |

### 8.1 重载

```cpp
void print(int value);
void print(double value);
void print(const std::string& value);
```

函数名相同、参数列表不同，编译器在编译阶段选择合适的函数。

### 8.2 重写

```cpp
class Base
{
public:
    virtual void func() {}
};

class Derived : public Base
{
public:
    void func() override {}
};
```

基类函数是虚函数，派生类提供相同接口的实现。

### 8.3 隐藏

```cpp
class Base
{
public:
    void func(int) {}
};

class Derived : public Base
{
public:
    void func(double) {}
};
```

`Derived::func(double)` 会隐藏基类中所有同名的 `func`。

如果希望派生类作用域中继续保留基类的重载，可以写：

```cpp
class Derived : public Base
{
public:
    using Base::func;

    void func(double) {}
};
```

---

## 九、抽象类与纯虚函数

### 9.1 纯虚函数

在虚函数声明末尾添加 `= 0`，该函数就成为纯虚函数：

```cpp
class Shape
{
public:
    virtual double area() const = 0;
    virtual void printName() const = 0;
    virtual ~Shape() = default;
};
```

### 9.2 抽象类

包含纯虚函数的类称为抽象类。抽象类不能直接实例化：

```cpp
Shape shape;  // 编译错误
```

抽象类的主要作用是：

- 抽取所有派生类都应遵守的公共接口；
- 强制派生类实现关键行为；
- 让调用者依赖抽象，而不是依赖具体类型；
- 为运行时多态提供统一入口。

```cpp
class Circle : public Shape
{
public:
    explicit Circle(double radius)
        : radius_(radius)
    {
    }

    double area() const override
    {
        return 3.1415926 * radius_ * radius_;
    }

    void printName() const override
    {
        std::cout << "Circle\n";
    }

private:
    double radius_;
};
```

如果派生类没有实现继承下来的全部纯虚函数，那么该派生类仍然是抽象类。

### 9.3 纯虚析构函数

析构函数可以声明为纯虚函数，但即使是纯虚析构函数，也必须提供函数定义：

```cpp
class Base
{
public:
    virtual ~Base() = 0;
};

Base::~Base() = default;
```

因为销毁派生类对象时，最终仍然需要执行基类析构函数。

---

## 十、接口继承与实现继承

### 10.1 实现继承

普通成员函数被派生类继承后，派生类可以直接复用其实现：

```cpp
class Base
{
public:
    void show()
    {
        std::cout << "Base::show()\n";
    }
};
```

这种方式关注的是“复用已有代码”。

### 10.2 接口继承

纯虚函数或需要重写的虚函数更强调接口约束：

```cpp
class Renderer
{
public:
    virtual void render() = 0;
    virtual ~Renderer() = default;
};
```

派生类继承的是“必须提供 `render()` 行为”这一约定。

实际设计中，不要因为“以后可能会用到”就把所有成员函数都声明为虚函数。只有当类需要承担多态基类职责时，才应建立清晰的虚接口。

---

## 十一、多态的底层原理

需要注意：C++ 标准只规定多态行为，不强制编译器必须使用某一种底层实现。不过，主流编译器通常使用：

- 虚函数表（Virtual Table，简称 vtable）；
- 虚函数表指针（常称 vptr）。

### 11.1 虚函数表中存放什么

虚函数本身和普通成员函数一样，通常位于程序的代码区域。

虚函数表中存放的不是完整函数，而是与虚函数相关的入口地址或调度信息。虚函数表的具体布局由编译器和 ABI 决定。

### 11.2 对象中存放什么

具有虚函数的对象通常包含一个隐藏的虚函数表指针：

```text
Base 对象
├── vptr  ──────> Base 的虚函数表
└── 普通数据成员

Derived 对象
├── Base 子对象
│   ├── vptr ───> Derived 对应的虚函数表
│   └── Base 数据成员
└── Derived 数据成员
```

因此，带有虚函数的对象通常会比只包含普通数据成员的对象多出至少一个指针大小的存储开销。

在 32 位环境中，一个指针通常为 4 字节；在 64 位环境中，一个指针通常为 8 字节。不过，对象的最终大小还会受到内存对齐、多继承和 ABI 等因素影响，应该以实际平台上的 `sizeof` 结果为准。

### 11.3 派生类虚函数表的形成

从便于理解的角度，可以把派生类虚函数表的形成过程概括为：

1. 继承基类的虚函数接口；
2. 派生类重写某个虚函数后，对应表项指向派生类实现；
3. 派生类新增的虚函数也会进入派生类相关的虚函数表结构。

```cpp
class Base
{
public:
    virtual void func1()
    {
        std::cout << "Base::func1()\n";
    }

    virtual void func2()
    {
        std::cout << "Base::func2()\n";
    }

    void func3()
    {
        std::cout << "Base::func3()\n";
    }
};

class Derived : public Base
{
public:
    void func1() override
    {
        std::cout << "Derived::func1()\n";
    }

    virtual void func4()
    {
        std::cout << "Derived::func4()\n";
    }
};
```

可以进行概念上的理解：

```text
Base 对应的虚函数表
├── Base::func1
└── Base::func2

Derived 对应的虚函数表
├── Derived::func1   // 覆盖对应虚函数入口
├── Base::func2      // 没有重写，继续使用基类实现
└── Derived::func4   // 派生类新增虚函数
```

`func3()` 不是虚函数，因此不参与虚函数动态分派。

> 上面的结构是为了帮助理解。虚函数表是否位于只读数据区、表中还包含哪些 RTTI 或偏移信息、表尾是否存在空指针等，都属于编译器和 ABI 的实现细节，不能当作 C++ 标准保证。

---

## 十二、一次虚函数调用是怎样完成的

假设存在以下代码：

```cpp
void call(Base& base)
{
    base.func1();
}

Derived derived;
call(derived);
```

从概念上看，调用过程如下：

1. `base` 绑定到实际的 `Derived` 对象；
2. 程序从对象的基类子对象中取得虚函数表指针；
3. 根据 `func1()` 对应的表项找到最终调用入口；
4. 该入口对应 `Derived::func1()`；
5. 执行派生类重写后的函数。

伪代码可以理解为：

```cpp
base.vptr[func1_index](&base);
```

这并不是真实可编写的 C++ 代码，只是对虚函数动态分派过程的简化表达。

---

## 十三、静态绑定与动态绑定

### 13.1 静态绑定

静态绑定也叫早绑定，调用目标在编译阶段就能确定。

常见例子：

- 普通函数调用；
- 函数重载；
- 非虚成员函数调用；
- 模板形成的编译期多态。

```cpp
void print(int);
void print(double);

print(10);  // 编译阶段确定调用 print(int)
```

### 13.2 动态绑定

动态绑定也叫晚绑定，程序运行时根据对象的实际类型选择最终函数。

```cpp
Base& ref = derived;
ref.func1();
```

只要形成有效的虚函数调用，最终目标通常需要根据实际对象确定。

### 13.3 编译器可能进行去虚化

“虚函数调用一定比普通函数慢”不是绝对结论。如果编译器能够证明对象的实际类型，它可能直接确定调用目标，这种优化称为去虚化（Devirtualization）。

因此，虚函数的主要代价通常包括：

- 对象可能需要额外保存虚函数表指针；
- 动态分派可能多一次间接访问；
- 间接调用可能限制某些内联优化；
- 多继承下还可能涉及 `this` 指针调整。

在多数普通业务场景中，应该优先关注设计是否清晰，而不是过早担心这点调用开销。

---

## 十四、单继承和多继承中的虚函数表

### 14.1 单继承

在常见单继承模型中，派生类对象包含一个基类子对象，通常可以复用该子对象中的虚函数表指针完成动态分派。

```cpp
class Base
{
public:
    virtual void func1() {}
    virtual void func2() {}
};

class Derived : public Base
{
public:
    void func1() override {}
    virtual void func3() {}
};
```

`Derived` 对象的虚函数表结构中会反映：

- `func1()` 已被重写；
- `func2()` 继续使用基类版本；
- `func3()` 是派生类新增虚函数。

### 14.2 多继承

如果派生类同时继承多个具有虚函数的基类，它的对象中通常包含多个基类子对象，每个多态基类子对象都可能带有自己的虚函数表指针。

```cpp
class Base1
{
public:
    virtual void func() {}
    virtual ~Base1() = default;
};

class Base2
{
public:
    virtual void func() {}
    virtual ~Base2() = default;
};

class Derived : public Base1, public Base2
{
public:
    void func() override {}
};
```

概念上的对象布局可能是：

```text
Derived 对象
├── Base1 子对象
│   ├── vptr1
│   └── Base1 数据
├── Base2 子对象
│   ├── vptr2
│   └── Base2 数据
└── Derived 数据
```

当 `Derived*` 转换为 `Base2*` 时，指针值可能发生偏移，使其指向 `Derived` 对象内部的 `Base2` 子对象。

```cpp
Derived object;

Derived* derivedPtr = &object;
Base1* base1Ptr = &object;
Base2* base2Ptr = &object;
```

常见布局下：

- `derivedPtr` 与 `base1Ptr` 的地址值可能相同；
- `base2Ptr` 可能指向对象内部更靠后的位置；
- 编译器负责完成必要的指针调整。

这些布局仍然是 ABI 相关实现细节，不应依赖强制类型转换手工解析虚表。

---

## 十五、虚函数与默认参数

虚函数的函数实现会动态绑定，但默认参数是静态绑定的。

```cpp
class A
{
public:
    virtual void func(int value = 1)
    {
        std::cout << "A -> " << value << '\n';
    }

    virtual ~A() = default;
};

class B : public A
{
public:
    void func(int value = 0) override
    {
        std::cout << "B -> " << value << '\n';
    }
};

int main()
{
    B object;
    A* ptr = &object;
    ptr->func();
}
```

输出：

```text
B -> 1
```

原因是：

- 通过虚函数机制动态选择了 `B::func()`；
- 默认参数根据调用表达式中 `ptr` 的静态类型 `A*` 确定，因此使用 `A` 中的默认值 `1`。

为了避免产生这种反直觉行为，通常不建议为需要重写的虚函数设置不同的默认参数。

---

## 十六、常见问题

### 16.1 静态成员函数可以是虚函数吗

不能。

静态成员函数没有 `this` 指针，不依赖某个具体对象调用，因此无法通过对象中的虚函数表指针完成动态分派。

### 16.2 构造函数可以是虚函数吗

不能。

构造对象之前，完整的派生类对象尚未形成，无法借助一个已存在的完整对象进行虚调用。构造函数本身负责建立对象及其动态类型相关状态，所以不能依靠虚机制选择构造函数。

如果需要根据运行时条件创建不同派生类对象，可以使用工厂模式：

```cpp
std::unique_ptr<Base> createObject(ObjectType type);
```

### 16.3 析构函数可以是虚函数吗

可以。只要对象可能通过基类指针被删除，多态基类析构函数就应该是虚函数。

### 16.4 普通成员函数可以和虚函数同名吗

可以，但要注意重载、重写和隐藏规则。派生类中的同名函数可能隐藏基类中的全部同名重载。

### 16.5 内联函数可以是虚函数吗

可以在语法上同时声明为 `inline` 和 `virtual`。

但是，通过基类指针或引用进行真正的动态分派时，调用目标可能直到运行时才能确定，这会妨碍普通内联。若编译器能够确定实际类型并完成去虚化，仍然可能进行内联优化。

### 16.6 虚函数表什么时候生成

主流实现通常在编译和链接过程中生成类对应的虚函数表及相关信息，而不是每创建一个对象就重新生成一张表。同一具体类型的多个对象通常共享类对应的虚函数表。

### 16.7 虚函数表存在哪里

C++ 标准没有规定。主流编译器通常把虚函数表放在只读数据区域或与常量、类型信息相关的区域。对象内部保存的通常是指向相应表结构的指针。

### 16.8 虚函数可以是纯虚函数吗

可以。纯虚函数用于建立接口约束，使包含它的类成为抽象类。

### 16.9 纯虚函数能有函数体吗

可以在类外提供定义，但派生类通常仍需重写该纯虚函数后才能成为可实例化的具体类。

### 16.10 构造函数和析构函数中会正常表现出派生类多态吗

不会按完整派生对象的方式进行虚分派。

在基类构造和析构阶段，对象只被视为当前正在构造或析构的层级。此时调用虚函数，不会分派到尚未构造或已经析构的更深层派生类实现。因此，应避免在构造函数和析构函数中依赖虚函数实现跨层多态。

---

## 十七、一个完整的多态案例

```cpp
#include <iostream>
#include <memory>
#include <vector>

class Shape
{
public:
    virtual double area() const = 0;
    virtual void printName() const = 0;
    virtual ~Shape() = default;
};

class Circle : public Shape
{
public:
    explicit Circle(double radius)
        : radius_(radius)
    {
    }

    double area() const override
    {
        return 3.1415926 * radius_ * radius_;
    }

    void printName() const override
    {
        std::cout << "Circle";
    }

private:
    double radius_;
};

class Rectangle : public Shape
{
public:
    Rectangle(double width, double height)
        : width_(width),
          height_(height)
    {
    }

    double area() const override
    {
        return width_ * height_;
    }

    void printName() const override
    {
        std::cout << "Rectangle";
    }

private:
    double width_;
    double height_;
};

void printShape(const Shape& shape)
{
    shape.printName();
    std::cout << ", area = " << shape.area() << '\n';
}

int main()
{
    std::vector<std::unique_ptr<Shape>> shapes;

    shapes.push_back(std::unique_ptr<Shape>(new Circle(2.0)));
    shapes.push_back(std::unique_ptr<Shape>(new Rectangle(3.0, 4.0)));

    for (const auto& shape : shapes)
    {
        printShape(*shape);
    }

    return 0;
}
```

这个案例体现了：

- `Shape` 通过纯虚函数定义统一接口；
- `Circle` 和 `Rectangle` 分别实现接口；
- `printShape()` 只依赖抽象类；
- 容器通过智能指针保存不同派生类对象；
- 虚析构函数保证资源能够被正确释放；
- 新增其他图形时，不需要修改 `printShape()`。

---

## 十八、面试回答模板

### 18.1 什么是多态

多态是指通过统一的基类接口操作不同派生类对象时，同一个函数调用能够表现出不同的行为。C++ 运行时多态通常依靠继承、虚函数重写，以及基类指针或引用调用虚函数来实现。

### 18.2 多态的底层原理是什么

主流编译器通常使用虚函数表和虚函数表指针实现多态。含有虚函数的对象中通常保存虚函数表指针，虚函数表记录虚函数的调度入口。通过基类指针或引用调用虚函数时，程序根据实际对象对应的表项找到最终实现，因此可以在运行时调用派生类重写后的函数。

### 18.3 为什么必须通过基类指针或引用调用

基类指针或引用能够在提供统一静态接口的同时，继续指向或绑定完整的派生类对象。按值传递会复制基类部分并可能产生对象切片，丢失派生类状态，因此无法保留原对象的动态类型行为。

### 18.4 为什么基类析构函数要写成虚函数

如果通过基类指针删除派生类对象，只有基类析构函数是虚函数时，程序才能先执行派生类析构函数，再执行基类析构函数。否则会产生未定义行为，并可能导致派生类资源没有被释放。

### 18.5 重载、重写和隐藏有什么区别

- 重载：同一作用域中函数名相同、参数列表不同，在编译阶段选择；
- 重写：派生类重新实现基类虚函数，接口签名匹配，可形成运行时多态；
- 隐藏：派生类定义同名函数后，基类同名函数在派生类作用域中被遮蔽，不要求基类函数是虚函数。

---

## 十九、容易出错的写法

### 19.1 忘记虚析构函数

```cpp
class Base
{
public:
    ~Base() = default;  // 若作为多态基类使用，这里存在风险
};
```

应改为：

```cpp
virtual ~Base() = default;
```

### 19.2 重写时遗漏 `const`

```cpp
class Base
{
public:
    virtual void show() const {}
};

class Derived : public Base
{
public:
    void show() {}  // 没有重写 Base::show() const
};
```

应使用：

```cpp
void show() const override {}
```

### 19.3 使用值传递接收多态对象

```cpp
void process(Base object);
```

容易发生对象切片，应根据需求改为：

```cpp
void process(Base& object);
void process(const Base& object);
void process(Base* object);
```

### 19.4 手工解析虚函数表

通过强制类型转换读取对象内存、假设虚表末尾一定存在空指针，并逐项调用函数指针，都依赖特定编译器布局，甚至可能产生未定义行为。

这种代码最多用于特定环境下观察实现，不应该用于业务逻辑。

### 19.5 在虚函数中设置不同默认参数

虚函数动态绑定、默认参数静态绑定，二者混合后容易出现“调用了派生类函数，却使用基类默认参数”的结果，应尽量避免。

---

## 二十、总结

C++ 多态的核心可以概括为：

1. 基类定义统一的虚函数接口；
2. 派生类通过 `override` 提供不同实现；
3. 基类指针或引用保留完整派生类对象；
4. 运行时根据对象的实际类型进行动态绑定；
5. 主流编译器通常通过虚函数表和虚函数表指针完成动态分派；
6. 多态基类通常需要虚析构函数；
7. 按值传递可能发生对象切片，破坏多态；
8. 抽象类用于约束接口，不能直接实例化；
9. 重载、重写和隐藏必须区分清楚；
10. 虚表的具体内存布局属于编译器和 ABI 的实现细节。

最后记住一句话：

> **调用接口由指针或引用的静态类型决定，虚函数的最终实现由对象的实际类型决定。**
