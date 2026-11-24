---
title: C++ list详解：双向链表、迭代器与节点操作
date: 2026-08-15 22:40:00
categories:
  - C++
tags:
  - C++
  - STL
  - list
  - 双向链表
  - 迭代器
  - 迭代器失效
order: 10 
---

# 1.list的基本使用

**list不支持 []**

```c++
#include <iostream>
#include <list>
using namespace std;

void print(const list<int>& ls)
{
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;
}

int main()
{
	list<int> ls1;
	list<int> ls2{ 1,2,3,4,5,6,7,8,9,20 };
	list<int> ls3(ls2);
	list<int> ls4(10, 2);
	list<int> ls5(ls2.begin(), ls2.end());

	print(ls1);
	print(ls2);
	print(ls3);
	print(ls4);
	print(ls5);

	cout << "迭代器遍历" << endl;
	list<int>::iterator it = ls2.begin();
	while (it != ls2.end())
	{
		cout << *it << " ";
		++it;	
	}
	cout << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{
	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}

	cout << ls.size() << endl;

	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	cout << ls.front() << endl;
	cout << ls.back() << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{
	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}

	for (int i = 20; i > 10; --i)
	{
		ls.push_front(i);
	}

	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;


	return 0;
}
```

```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{
	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}
	
	ls.insert(ls.begin(), 555);
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	ls.erase(ls.begin());
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;


	ls.resize(100, 558);
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{
	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}
	
	auto it = find(ls.begin(), ls.end(), 4);
	if (it != ls.end())
	{
		ls.insert(it, 88);
	}
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	it = find(ls.begin(), ls.end(), 88);
	if (it != ls.end())
	{
		ls.insert(it, 10, 2);
	}

	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	return 0;
}
```

```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{

	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}

	ls.sort();
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	ls.reverse();
	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	return 0;
}
```



```c++
#include <iostream>
#include <list>
using namespace std;

int main()
{

	list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}

	list<int>::iterator it = ls.begin();
	while (it != ls.end())
	{
		if (*it % 2 == 0)
		{
			it = ls.erase(it); // 删除了直接往后面移动
		}
		else
		{
			++it;
		}
	}

	for (auto& e : ls)
	{
		cout << e << " ";
	}
	cout << endl;

	return 0;
}
```



# 2.模拟实现

```
```



