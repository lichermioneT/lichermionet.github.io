---
title: C++ string类详解：接口、容量、查找与模拟实现
date: 2026-08-15 22:20:00
categories:
  - C++
tags:
  - C++
  - STL
  - string
  - 字符串
  - 深拷贝
  - 迭代器
order: 8 
---

# 1. 为什么学习string类？

**C语言中，字符串是以'\0'结尾的一些字符的集合，为了操作方便，C标准库中提供了一些str系列的库函数， 但是这些库函数与字符串是分离开的，不太符合OOP的思想，而且底层空间需要用户自己管理，稍不留神可 能还会越界访问。**

# 2. 标准库中的string类

## 2.1构造函数

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str1;
	string str2("hello");
	string str3(10, 'a');
	string str4(str3);     // 拷贝构造
	string str5 = "lic2";  // 临时对象，然后拷贝构造

	string str6("hello", 2); // 提取两个  字符串是提取几个
	string str7(str2, 2, 2); // 从2开始，然后取两个  string对象是提取后面的

	cout << str1 << endl;
	cout << str2 << endl;
	cout << str3 << endl;
	cout << str4 << endl;
	cout << str5 << endl;
	cout << str6 << endl;
	cout << str7 << endl;

	str1 = str5;
	return 0;
}
```

**基本操作**

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str1("licmionex");
	str1.push_back('1');
	str1 += '2';
	str1 += "34";

	cout << str1 << endl;

	string str2("12345");
	int value = 0;
	for (int i = 0; i < str2.size(); ++i)
	{
		value *= 10;
		value += str2[i] - '0';
	}
	cout << value << endl;

	return 0;
}
```

## 2.2遍历

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str1("hello");
	str1 += " ";
	str1 += "world";

// 1.operator[] 可读可写。推荐使用这个。
	for (int i = 0; i < str1.size(); ++i)
	{
		cout << str1[i] << " ";
	}
	cout << endl;

// 2.范围for：(底层原理，迭代器)
	for (const auto& e : str1)
	{
		cout << e << " ";
	}
	cout << endl;

// 3.迭代器 可读可写。
	// string的迭代器，string一个成员属性。突破类域就行了。
    // 四种迭代器
	string::iterator it = str1.begin();
	while (it != str1.end())
	{
		cout << *it << " ";
		++it;
	}
	cout << endl;

	string::const_iterator it2 = str1.cbegin();
	while (it2 != str1.cend())
	{
		cout << *it2 << " ";
		++it2;
	}
	cout << endl;

	string::const_reverse_iterator it3 = str1.crbegin();
	while (it3 != str1.crend())
	{
		cout << *it3 << " ";
		++it3;
	}
	cout << endl;

	// 可读可写
	string::reverse_iterator it4 = str1.rbegin();
	while (it4 != str1.rend())
	{
		cout << *it4 << " ";
		++it4;
	}
	cout << endl;

	return 0;
}
```

## 2.3字符串转换数字

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str("123456");
	int num = stoi(str);
	cout << num << endl;

	return 0;
}
```



## 2.4容量

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str("lichermionex");

	cout << "str.size: " << str.size() << endl;
	cout << "str.length: " << str.length() << endl;
	cout << "str.maxsize: " << str.max_size() << endl;
	cout << "str.capacity: " << str.capacity() << endl;

	str += "dddddddddddd";
	cout << "str.capacity: " << str.capacity() << endl;

	str.clear(); // 清空数据，容量不变

	cout << "str.empty():" << str.empty() << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str("lichermionex");

	str.reserve(120); // 预定空间

	for (int i = 0; i < 100; ++i)
	{
		if (str.size() == str.capacity())
		{
			cout << str.size() << endl;
		}

		str += 'a';
	}

	cout << str.capacity() << endl;

	string str2("hello world");
	str2.resize(5);
	str2.resize(20, 'a');

	cout << str2 << endl;

	return 0;
}
```

## 2.5插入

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string s;
	s.push_back('a');
	s.append("ddddddddd");
	s += '1';
	s += "234";

	s.insert(s.begin(), 'z');
	s.insert(0, "L"); // 注意字符串

	cout << s << endl;
	s.erase(2);
	cout << s << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string s = "hello world";

	// 从下标 5 开始，删除 6 个字符
	s.erase(5, 6);

	cout << s << endl; // hello

	string s1 = "abcdef";

	s1.erase(3);

	cout << s1 << endl; // abc

	string s2 = "abcdef";

	// 删除下标 2 对应的字符 'c'
	s2.erase(s2.begin() + 2);

	cout << s2 << endl; // abdef

	string s3 = "abcdef";

	// 删除下标 [1, 4) 的字符
	s3.erase(s3.begin() + 1, s3.begin() + 4);

	cout << s3 << endl; // aef
	return 0;

}
```





# 3. string类的模拟实现







