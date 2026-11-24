---
title: C++ vector详解：接口、扩容、迭代器失效与模拟实现
date: 2026-08-15 22:30:00
categories:
  - C++
tags:
  - C++
  - STL
  - vector
  - 动态数组
  - 迭代器失效
  - 内存管理
order: 9 
---

# 1.vector的使用

## 1.1基本操作

```c++
#include <iostream>
#include <vector>
using namespace std;

void print(const vector<int> v)
{
	for (auto e : v)
	{
		cout << e << " ";
	}
	cout << endl;
}

int main()
{
	vector<int> v(10, 1);          // 10个1
	vector<int> v1{ 1,2,3,4,5,6 }; // 初始化
	vector<int> v2(v1);            // 拷贝构造

	print(v);
	print(v1);
	print(v2);

	return 0;
}
```

**输出**

```
1 1 1 1 1 1 1 1 1 1
1 2 3 4 5 6
1 2 3 4 5 6
```



## 1.2迭代器

**vector的随机迭代器**

```c++
#include <iostream>
#include <vector>
using namespace std;

int main()
{
// 1.下标
	vector<int> v1{ 1,2,3,4,5,6 };
	for (size_t i = 0; i < v1.size(); i++)
	{
		v1[i] *= 10;
	}

	for (size_t i = 0; i < v1.size(); i++)
	{
		cout << v1[i] << " ";
	}
	cout << endl;

// 2.迭代器
	vector<int>::iterator it = v1.begin();
	while (it != v1.end())
	{
		cout << *it << " ";
		++it;
	}
	cout << endl;

	vector<int>::const_iterator it2 = v1.cbegin();
	while (it2 != v1.cend())
	{
		cout << *it2 << " ";
		++it2;
	}
	cout << endl;

	vector<int>::const_reverse_iterator it3 = v1.crbegin();
	while (it3 != v1.crend())
	{
		cout << *it3 << " ";
		++it3;
	}
	cout << endl;

	vector<int>::reverse_iterator it4 = v1.rbegin();
	while (it4 != v1.rend())
	{
		cout << *it4 << " ";
		++it4;
	}
	cout << endl;

	return 0;
}
```



## 1.3空间

```c++
#include <iostream>
#include <vector>
using std::cout;
using std::endl;
using std::ostream;
using std::istream;
using std::vector;

int main()
{
	vector<int> v1{ 1,2,3,4,5,6 };
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);
	v1.push_back(1);

	cout << v1.size() << endl;
	cout << v1.capacity() << endl;

	v1.reserve(1000);                // 预定1000个空间
	cout << v1.size() << endl;
	cout << v1.capacity() << endl;

	v1.resize(10, 2);                // 有效元素为10个
	cout << v1.size() << endl;
	cout << v1.capacity() << endl;

	return 0;
}
```



## 1.4插入

**`vector` 的 `insert` 和 `erase` 与 `string` 最大的区别是：**vector 使用迭代器指定插入和删除的位置，而不是下标。

```c++
#include <iostream>
#include <vector>
using std::cout;
using std::endl;
using std::ostream;
using std::istream;
using std::vector;

int main()
{
	vector<int> v1{ 1,2,3,4,5,6 };
	v1.insert(v1.begin(), 10);
	v1.insert(v1.begin(), 10,1);

	for (auto& each : v1)
	{
		cout << each << " ";
	}
	cout << endl;

	vector v{ 1,2,4,5 };

	v1.insert(v1.begin(), v.begin(), v.begin() + 4);
	for (auto& each : v1)
	{
		cout << each << " ";
	}

	return 0;
}
```

```c++
#include <iostream>
#include <vector>
using std::cout;
using std::endl;
using std::ostream;
using std::istream;
using std::vector;

int main()
{
	vector<int> v1{ 1,2,3,4,5,6 };

	v1.erase(v1.begin());
	for (auto& each : v1)
	{
		cout << each << " ";
	}
	cout << endl;

	v1.erase(v1.begin(), v1.begin() + 2);
	for (auto& each : v1)
	{
		cout << each << " ";
	}
	cout << endl;

	return 0;
}
```

**记忆口诀：插入指向新元素，删除指向下一位。**

```c++
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main()
{
	vector<int> v1{ 1,2,3,4,5,6,7,8,9,10 };

	vector<int>::iterator it = find(v1.begin(), v1.end(), 3);
	if (it != v1.end())
	{
		cout << *it << endl;
	}

	return 0;
}
```

```c++
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main()
{
	vector<int> v1{ 1,2,3,4,5,6,7,8,9,10 };

	vector<int>::iterator it = v1.begin();
	while (it != v1.end())
	{
		if (*it % 2 == 0)
		{
			it = v1.erase(it);
		}
		else
		{
			++it;
		}
	}

	for (auto e : v1)
	{
		cout << e << " ";
	}
	cout << endl;

	return 0;
}
```

# 2.实现vector

```c++
#include <iostream>
#include <algorithm>
#include <string>
#include <cassert>
using namespace std;

namespace lic
{
	template<class T>
	class vector
	{
	public:
		using iterator = T*; 
	public:
		vector()
			:_start(nullptr)
			,_finish(nullptr)
			,_endofstorage(nullptr)
		{ }

		vector(const vector<T>& v)
		{
			_start = new T[v.capacity()];
			_finish = _start;
			_endofstorage = _start + v.capacity();

			for (size_t i = 0; i < v.size(); ++i)
			{
				*_finish = v[i];
				++_finish;
			}
		}

#if 0
		vector<T>& operator=(const vector<T>& v)
		{
			if (this != &v)
			{
				delete[] _start;
				_start = new T[v.capacity()];

				memcpy(_start, v._start, sizeof(T) * v.size()); // 按字节进行拷贝,浅拷贝
				_finish = _start + v.size();
				_endofstorage = _start + v.capacity();
			}

			return *this;
		}
#endif
		vector<T>& operator=(vector<T> v)
		{
			std::swap(_start, v._start);
			std::swap(_finish, v._finish);
			std::swap(_endofstorage, v._endofstorage);
			return *this;
		}

		~vector()
		{
			delete[] _start;
			_start = _finish = _endofstorage = nullptr;
		}

		void reserve(size_t n)
		{
			if (n > capacity())
			{
				size_t oldsize = size();

				T* temp = new T[n];
				if (_start)
				{
					//memcpy(temp, _start, sizeof(T) * size());  字节拷贝
					for (size_t i = 0; i < oldsize; ++i)
					{
						temp[i] = _start[i]; // 自定义对象的深拷贝
					}
					delete[] _start;
				}

				_start = temp;
				_finish = _start + oldsize;
				_endofstorage = _start + n;
			}
		}

		void resize(size_t n, const T& value = T())
		{
			if (n < size())
			{
				_finish = _start + n;
			}
			else
			{
				if (n > capacity())
				{
					reserve(n);
				}

				while (_finish < _start + n)
				{
					*_finish = value;
					++_finish;
				}
			}
		}

		void push_back(const T& value)
		{
			if (_finish == _endofstorage)
			{
				size_t newCapacity = capacity() == 0 ? 2 : capacity() * 2;
				reserve(newCapacity);
			}

			*_finish = value;
			++_finish;
		}

		void pop_back()
		{
			assert(_start < _finish);
			--_finish;
		}

		void insert(iterator pos, const T& value)
		{
			assert(pos <= _finish);

			if (_finish == _endofstorage)
			{
				size_t n = pos - _start;

				size_t newCapacity = capacity() == 0 ? 2 : capacity() * 2;
				reserve(newCapacity);

				pos = _start + n;
			}

			iterator end = _finish - 1;
			while (end >= pos)
			{
				*(end + 1) = *(end);
				--end;
			}
			*pos = value;
			++_finish;
		}

		iterator erase(iterator pos)
		{
			assert(pos < _finish);

			iterator it = pos;
			while (it < _finish)
			{
				*it = *(it + 1);
				++it;
			}

			--_finish;
			return pos;
		}

		size_t size()const
		{
			return _finish - _start;
		}

		size_t capacity() const
		{
			return _endofstorage - _start;
		}

		iterator begin()
		{
			return _start;
		}

		iterator end()
		{
			return _finish;
		}

		T& operator[](size_t i)
		{
			assert(i < size());
			return _start[i];
		}

		const T& operator[](size_t i) const
		{
			assert(i < size());
			return _start[i];
		}

	private:
		iterator _start;
		iterator _finish;
		iterator _endofstorage;
	};
}

int main()
{
	lic::vector<int> v;
	v.push_back(1);
	v.push_back(2);
	v.push_back(3);
	v.push_back(4);
	v.push_back(5);
	v.push_back(6);
	v.push_back(7);
	v.push_back(8);
	v.push_back(9);
	v.push_back(10);

	lic::vector<int>::iterator it = v.begin();
	while (it != v.end())
	{
		if (*it % 2 == 0)
		{
			it = v.erase(it);
		}
		else
		{
			++it;
		}
	}

	for (auto e : v)
	{
		cout << e << " ";
	}
	cout << endl;

	lic::vector<int> v2(v);
	for (auto e : v2)
	{
		cout << e << " ";
	}
	cout << endl;

	lic::vector<int> v3;
	v3 = v2;
	for (auto e : v3)
	{
		cout << e << " ";
	}
	cout << endl;


	lic::vector<string> v66;
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");
	v66.push_back("112");

	return 0;
}

void test()
{
	lic::vector<int> v;
	v.push_back(2);
	v.push_back(2);
	v.push_back(2);
	v.push_back(2);
	v.push_back(2);
	v.push_back(2);
	v.push_back(22);
	v.push_back(234);
	v.push_back(245454);

	for (auto e : v)
	{
		cout << e << " ";
	}
	cout << endl;

	lic::vector<int>::iterator it = v.begin();
	while (it != v.end())
	{
		*it *= 2;
		cout << *it << " ";
		++it;
	}
	cout << endl;

	for (size_t i = 0; i < v.size(); ++i)
	{
		v[i] /= 2;
		cout << v[i] << " ";
	}
	cout << endl;

}


void test2()
{
	lic::vector<int> v;
	v.push_back(1);
	v.push_back(2);
	v.push_back(3);
	v.push_back(4);
	v.push_back(5);
	for (auto e : v)
	{
		cout << e << " ";
	}
	cout << endl;


	v.insert(v.begin(), 222);
	v.insert(v.begin(), 333);
	v.insert(v.begin(), 444);
	v.insert(v.begin(), 555);
	for (auto e : v)
	{
		cout << e << " ";
	}
	cout << endl;
}
```







