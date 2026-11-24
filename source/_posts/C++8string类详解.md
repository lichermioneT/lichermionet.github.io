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

	const char* str = str1.c_str();
	while (*str)
	{
		cout << *str << " ";
		++str;
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

string& insert(size_t pos, char ch); // 自定义便捷接口
string& insert(size_t pos, const char* str);
string& erase(size_t pos, size_t len = npos);

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

## 2.6查找

```c++
#include <iostream>
#include <string>
using namespace std;

void split(const string& str)
{
	size_t p1 = str.find(':');
	if (p1 != string::npos)
	{
		cout << str.substr(0,p1) << endl;
	}

	p1 += 3;

	size_t p2 = str.find('/', p1);
	if (p2 != string::npos)
	{
		cout << str.substr(p1, p2 - p1) << endl;
	}

	cout << str.substr(p2 + 1) << endl << endl;
}

int main()
{
	// 资源 域名 资源
	string str1("https://licee.top/categories/cpp/");
	string str2("https://github.com/lichermioneT");
	string str3("https://chat.deepseek.com/a/chat/s/3e735590-cde0-4600-8714-b74c43b3ebd8");

	size_t pos1 = str1.find('.');
	size_t pos2 = str2.find('.');
	size_t pos3 = str3.find('.');

	cout << str1.substr(pos1) << endl;
	cout << str2.substr(pos2) << endl;
	cout << str3.substr(pos3) << endl << endl;

	split(str1);
	split(str2);
	split(str3);

	return 0;
}
```

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str1("licxx");
	string str2("licc");

	cout << (str1 < "aac") << endl;
	cout << ("baf" < str2) << endl;
	cout << (str1 < str2) << endl;
 
	return 0;
}
```

```c++
#include <iostream>
#include <string>
using namespace std;

int main()
{
	string str1("licxx");
	string str2("licc");
	
	getline(cin, str1);
	cout << str1 << endl;
 
	return 0;
}
```

# 3. string类的模拟实现



```c++
#include <iostream>
#include <string>
#include <cstring>
using std::ostream;
using std::istream;
using std::cout;
using std::endl;

namespace lic
{
	class string
	{
		friend ostream& operator<<(ostream& out, const string& str);
	public:
		string ()
			:_str(new char[1])
			,_size(0)
			,_capacity(0)
		{ 
			_str[_size] = '\0';
		}

		string(const char* str)
			:_str(new char[strlen(str) + 1])
			,_size(strlen(str))
			,_capacity(strlen(str))
		{
			memcpy(_str, str, _size + 1);
		}

#if 0
		string(const string& str)
			:_str(new char[strlen(str._str) + 1])
			,_size(strlen(str._str))
			,_capacity(strlen(str._str))
		{
			memcpy(_str, str._str, _size + 1);
		}

		string& operator=(const string& str)
		{
			if (this != &str) // 防止自己给自己赋值
			{
				char* temp = new char[strlen(str._str) + 1];
				memcpy(_str, str._str, strlen(str._str) + 1);

				delete[] _str;

				_str = temp;
				_size = str._size;
				_capacity = str._capacity;

			}

			return *this;
		}
#endif
		string(const string& str)
			:_str(nullptr)
			,_size(0)
			,_capacity(0)
		{
			string temp(str._str);
			std::swap(_str, temp._str);
			std::swap(_size, temp._size);
			std::swap(_capacity, temp._capacity);
		}

		string& operator=(const string& str)
		{
			if (this != &str)
			{
				string temp(str._str);
				std::swap(_str, temp._str);
				std::swap(_size, temp._size);
				std::swap(_capacity, temp._capacity);
			}
			
			return *this;
		}


		~string()
		{
			delete[] _str;
			_size = _capacity = 0;
		}

		size_t size() const
		{
			return _size;
		}

		size_t capacity() const
		{
			return _capacity;
		}

		char& operator[](size_t i)
		{
			return _str[i];
		}

		const char& operator[](size_t i) const
		{
			return _str[i];
		}

		const char* c_str() const
		{
			return _str;
		}

		using iterator = char*;
		using const_iterator = const char*;

		iterator begin()
		{
			return _str;
		}

		iterator end()
		{
			return _str + _size;
		}

		const_iterator begin() const
		{
			return _str;
		}

		const_iterator end() const
		{
			return _str + _size;
		}

		void reserve(size_t n)
		{
			if (n > _capacity)
			{
				char* temp = new char[n + 1];
				strcpy(temp, _str);
				delete[] _str;

				_str = temp;
				_capacity = n;
			}
		}

		void resize(size_t n, char ch = '\0')
		{
			if (n < _size)
			{
				_size = n;
				_str[_size] = '\0';
			}
			else if(n > _size)
			{
				reserve(n);
				for (size_t i = _size; i < n; ++i)
				{
					_str[i] = ch;
				}
				_size = n;
				_str[_size] = 0;
			}
		}

		void insert(size_t pos, char ch)
		{
			if(pos <= _size)
			{
				if (_size == _capacity)
				{
					size_t newCapacity = _capacity == 0 ? 2 : _capacity * 2;
					reserve(newCapacity);
				}

				for (size_t i = _size; i > pos; --i)
				{
					_str[i] = _str[i - 1];
				}

				_str[pos] = ch;
				++_size;
				_str[_size] = 0;
			}
		}

		// 1. 插入字符串
		void insert(size_t pos, const char* str)
		{
			if (pos > _size)
				return;

			size_t len = strlen(str);
			reserve(_size + len);

			// 从后往前移动，包括 '\0'
			for (size_t i = _size + 1; i > pos; --i)
			{
				_str[i + len - 1] = _str[i - 1];
			}

			// 插入新字符串
			for (size_t i = 0; i < len; ++i)
			{
				_str[pos + i] = str[i];
			}

			_size += len;
		}

		// 2. 删除字符串
		void erase(size_t pos, size_t len = npos)
		{
			if (pos >= _size)
				return;

			if (len > _size - pos)
			{
				len = _size - pos;
			}

			// 将后面的字符向前移动，包括 '\0'
			for (size_t i = pos; i <= _size - len; ++i)
			{
				_str[i] = _str[i + len];
			}

			_size -= len;
		}

		// 3. 查找字符
		size_t find(char ch, size_t pos = 0) const
		{
			for (size_t i = pos; i < _size; ++i)
			{
				if (_str[i] == ch)
					return i;
			}

			return npos;
		}

		// 4. 查找字符串
		size_t find(const char* str, size_t pos = 0) const
		{
			if (pos > _size)
				return npos;

			size_t len = strlen(str);

			for (size_t i = pos; len <= _size - i; ++i)
			{
				if (memcmp(_str + i, str, len) == 0)
					return i;
			}

			return npos;
		}

		void push_back(char ch)
		{
			if (_size == _capacity)
			{
				size_t newCapacity = _capacity == 0 ? 2 : _capacity * 2;
				reserve(newCapacity);
			}
			_str[_size++] = ch;
			_str[_size] = '\0'; // 必须补上

		}

		void append(const char* str)
		{
			size_t len = strlen(str);
			if (_size + len > _capacity)
			{
				reserve(_size + len);
			}

			strcpy(_str + _size, str);
			_size += len;
		}

		string& operator+=(char ch)
		{
			this->push_back(ch);
			return *this;
		}

		string& operator+=(const char* str)
		{
			this->append(str);
			return *this;
		}

		bool operator==(const string& str) const
        {
            return strcmp(_str, str._str) == 0;
        }

        bool operator!=(const string& str) const
        {
            return !(*this == str);
        }

        bool operator<(const string& str) const
        {
            return strcmp(_str, str._str) < 0;
        }

        bool operator>(const string& str) const
        {
            return str < *this;
        }

        bool operator<=(const string& str) const
        {
            return !(*this > str);
        }

        bool operator>=(const string& str) const
        {
            return !(*this < str);
        }

	public:
		static size_t npos;
	private:
		char* _str;
		size_t _size;
		size_t _capacity;
	};

	size_t string::npos = -1;

	ostream& operator<<(ostream& out, const string& str)
	{
		for (int i = 0; i < str.size(); ++i)
		{
			out << str[i];
		}
		return out;
	}

	istream& operator>>(istream& out, string& str);
}

int main()
{

	lic::string str("lic");
	str.push_back('1');
	str.append("234");
	str += '5';
	str += "6789";
	cout << str << endl;

	return 0;
}

void test1()
{
	lic::string str1;
	lic::string str2("licher");
	lic::string str3(str2);
	str1 = str2;

	cout << str1 << endl;
	cout << str2 << endl;
	cout << str3 << endl;
	cout << str1.c_str() << endl;
	cout << str2.c_str() << endl;
	cout << str3.c_str() << endl;

	// 支持迭代器就支持范围for
	lic::string str4("licherrafafad");
	for (auto& e : str4)
	{
		cout << e;
	}
	cout << endl;

	lic::string::iterator it = str4.begin();
	while (it != str4.end())
	{
		cout << *it;
		++it;
	}
	cout << endl;
}
```





