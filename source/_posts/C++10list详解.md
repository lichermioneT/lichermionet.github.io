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

```c++
#include <iostream>
using namespace std;

namespace lic
{

	// 1.node
	// list的节点，存放数据，存放前后一个指针。
	template<class T>
	struct __list_node
	{
		// 全缺省构造函数
		__list_node(const T& value = T())
		{
			_data = value;
			_next = _prev = nullptr;
		}

		__list_node<T>* _next; // 指向前一个node
		__list_node<T>* _prev; // 指后前一个node
		T _data;               // 存放的数据
	};

	// 2.iterator
	// 迭代器里面存放了node*，然后对node*进行一系列操作。
	template<class T, class Ref, class Ptr>
	struct __list_iterator
	{
		// 节点
		using Node = __list_node<T>;
		Node* _node;

		// 迭代器
		using Self = __list_iterator<T, Ref, Ptr>;

		__list_iterator(Node* node)
			:_node(node)
		{ }

		Ref operator*()
		{
			return _node->_data;
		}

		Ptr operator->()
		{
			return &_node->_data;
		}

		Self operator++()
		{
			_node = _node->_next;
			return *this;
		}

		Self& operator++(int)
		{
			Self temp(*this);
			++(*this);

			return temp;
		}

		Self& operator--()
		{
			_node = _node->_prev;
			return *this;
		}

		Self& operator--(int)
		{
			Self temp(*this);
			--(**this);

			return temp;
		}

		bool operator!=(const Self& it) const
		{
			return _node != it._node;
		}
	};

	// 3.list
	template<class T>
	class list
	{
		using Node = __list_node<T>;
	public:
		using iterator = __list_iterator<T, T&, T*>;
		using const_iterator = __list_iterator<T, const T&, const T*>;

		iterator begin() 
		{
			return iterator(_head->_next);
		}

		iterator end()
		{
			return iterator(_head);
		}

		const_iterator cbegin() const
		{
			return const_iterator(_head->_next);
		}

		const_iterator cend() const
		{
			return const_iterator(_head);
		}

		const_iterator begin() const
		{
			return cbegin();
		}

		const_iterator end() const
		{
			return cend();
		}

		// 带头双向，循环链表
		list() 
		{
			_head = new Node;
			_head->_next = _head;
			_head->_prev = _head;
		}

		list(const list<T>& ls)
		{
			_head = new Node;
			_head->_next = _head;
			_head->_prev = _head;

			for (auto e : ls)
			{
				push_back(e);
			}
		}

		list<T>& operator=(const list<T>& ls)
		{
			if (this != &ls)
			{
				clear();
				for (auto e : ls)
				{
					push_back(e);
				}
			}

			return *this;
		}

		~list()
		{
			clear();
			delete _head;
			_head = nullptr;
		}

		void clear()
		{
			iterator it = begin();
			while (it != end())
			{
				erase(it++);
			}
		}

		void push_back(const T& value)
		{
			Node* newNode = new Node(value);
			Node* tail = _head->_prev;

			_head->_prev = newNode;
			newNode->_next = _head;

			tail->_next = newNode;
			newNode->_prev = tail;
		}

		void pop_back()
		{
			if (_head->_next != _head)
			{
				Node* tail = _head->_prev;
				Node* tailprev = tail->_prev;

				delete tail;

				_head->_prev = tailprev;
				tailprev->_next = _head;
			}
		}

		void push_front(const T& value)
		{
			Node* newNode = new Node(value);
			Node* first = _head->_next;

			_head->_next = newNode;
			newNode->_prev = _head;

			newNode->_next = first;
			first->_prev = newNode;
		}

		void pop_front()
		{
			if (_head->_next != _head)
			{
				Node* first = _head->_next;
				Node* second = first->_next;

				delete first;

				_head->_next = second;
				second->_prev = _head;
			}
		}

		void insert(iterator pos, const T& value)
		{
			Node* newNode = new Node(value);
			Node* cur = pos._node;
			Node* prev = cur->_prev;

			// 新节点指向两边
			newNode->_prev = prev;
			newNode->_next = cur;

			// 两边的节点指回新节点
			prev->_next = newNode;
			cur->_prev = newNode;
		}

		void erase(iterator pos)
		{
			Node* cur = pos._node;
			if (cur == _head)
				return;

			Node* prev = cur->_prev;
			Node* next = cur->_next;

			prev->_next = next;
			next->_prev = prev;
			delete cur;
		}

	private:
		Node* _head;
	};
}

void print2(lic::list<int>& ls)
{
	lic::list<int>::const_iterator it = ls.cbegin();
	while (it != ls.cend())
	{
		cout << *it << " ";
		++it;
	}
	cout << endl;
}


int main()
{
	lic::list<int> ls;
	ls.push_back(1);
	ls.push_back(2);
	ls.push_back(3);
	ls.push_back(4);
	ls.push_back(5);

	print2(ls);
	lic::list<int> ls2(ls);
	print2(ls2);

	return 0;

}

void print(lic::list<int>& ls)
{
	lic::list<int>::iterator it = ls.begin();
	while (it != ls.end())
	{
		cout << *it << " ";
		++it;
	}
	cout << endl;
}

void test()
{
	lic::list<int> ls;
	ls.push_back(1);
	ls.push_back(2);
	ls.push_back(3);
	ls.push_back(4);
	ls.push_back(5);

	lic::list<int>::iterator it = ls.begin();
	while (it != ls.end())
	{
		cout << *it << " ";
		++it;
	}
	cout << endl;

}

void test3()
{
	lic::list<int> ls;
	for (int i = 0; i < 10; ++i)
	{
		ls.push_back(i);
	}
	print(ls);

	for (int i = 0; i < 10; ++i)
	{
		ls.pop_back();
		print(ls);
	}

	for (int i = 0; i < 10; ++i)
	{
		ls.push_front(i);
	}
	print(ls);

	for (int i = 0; i < 10; ++i)
	{
		ls.pop_front();
		print(ls);
	}
}

void test2()
{
	struct date
	{
		int year = 0;
		int month = 1;
		int day = 1;
	};

	lic::list<date> ls;
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());
	ls.push_back(date());

	lic::list<date>::iterator it = ls.begin();
	while (it != ls.end())
	{
		//cout << it->year << "-" << it->month << "-" << it->day << endl;

		date d = *it;
		cout << d.year << "-" << d.month << "-" << d.day << endl;
		++it;
	}
}
```



