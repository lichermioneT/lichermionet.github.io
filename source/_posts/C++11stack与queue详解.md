---
title: C++ stack、queue与priority_queue详解：容器适配器与deque
date: 2026-08-15 22:50:00
categories:
  - C++
tags:
  - C++
  - STL
  - stack
  - queue
  - priority_queue
  - deque
  - 容器适配器
order: 11

---

# 1.stack

**stack没有迭代器**

```c++
#include <iostream>
#include <stack>
using namespace std;

void test()
{
	stack<int> st;
	st.push(1);
	st.push(2);
	st.push(3);
	st.push(4);
	st.push(5);

	while (!st.empty())
	{
		cout << st.top() << " ";
		st.pop();
	}
	cout << endl;
}

int main()
{
	test();

	return 0;
}
```

# 2.queue

```c++
#include <iostream>
#include <queue>
using namespace std;

void test()
{
	queue<int> q;
	q.push(1);
	q.push(2);
	q.push(3);
	q.push(4);
	q.push(5);

	while (!q.empty())
	{
		cout << q.front() << " ";
		q.pop();
	}
	cout << endl;
}

int main()
{
	test();

	return 0;
}
```

# 3.priority_queue

```c++
#include <iostream>
#include <queue>
#include <functional>
#include <vector>
using namespace std;

int main()
{
	priority_queue<int, vector<int>, greater<int>> pq; // 默认大的
	pq.push(1);
	pq.push(4);
	pq.push(17);
	pq.push(88);
	pq.push(210);
	pq.push(-10);
	pq.push(-120);
	
	while (!pq.empty())
	{
		cout << pq.top() << " ";
		pq.pop();
	}

	return 0;
}
```

```c++
#include <iostream>
#include <functional>
#include <algorithm>
#include <vector>
using namespace std;

// 仿函数，对象重载()了的
// 优先级队列，底层通过仿函数，进行控制大小堆，实现的
template<class T>
struct Less
{
    bool operator()(const T& x1, const T& x2)
    {
        return x1 < x2;
    }
};

template<class T>
struct Greater
{
    bool operator()(const T& x1, const T& x2)
    {
        return x1 > x2;
    }
};

template<class T, class Container = vector<T>, class Compare = less<T>>
class priority_queue
{
private:
    void adJustUp(int child)
    {
        int parent = (child - 1) / 2;
        Compare com;
        while (child > 0)
        {
            //if(_con[child] > _con[parent])
            if (com(_con[parent], _con[child]))
            {
                swap(_con[parent], _con[child]);
                child = parent;
                parent = (child - 1) / 2;
            }
            else
            {
                break;
            }
        }
    }
    void  adJustDown(int root)
    {
        Compare com;
        int parent = root;
        int child = parent * 2 + 1;
        while (child < _con.size())
        {
            /*
             *if(child + 1 < _con.size() && _con[child + 1] > _con[child])
             */
            if (child + 1 < _con.size() && com(_con[child], _con[child + 1]))
            {
                ++child;
            }

            /*
             *if(_con[child] > _con[parent])
             */
            if (com(_con[parent], _con[child]))
            {
                swap(_con[child], _con[parent]);
                parent = child;
                child = parent * 2 + 1;
            }
            else
            {
                break;
            }
        }
    }
public:
    void push(const T& x) // 向上调整算法
    {
        _con.push_back(x);
        adJustUp(_con.size() - 1);
    }

    void pop()
    {
        swap(_con[0], _con[_con.size() - 1]);
        _con.pop_back();
        adJustDown(0);
    }

    T& top()
    {
        return _con[0];
    }

    size_t size() const
    {
        return _con.size();
    }

    bool empty() const
    {
        return _con.empty();
    }
private:
    Container _con;
};

void test1()
{
    priority_queue<int> pq;
    pq.push(1);
    pq.push(3);
    pq.push(9);
    pq.push(5);
    pq.push(7);
    pq.push(4);
    pq.push(6);
    pq.push(1);
    pq.push(0);
    while (!pq.empty())
    {
        cout << pq.top() << " ";
        pq.pop();
    }
    cout << endl;
}

int main()
{
    test1();

	return 0;
}
```

# 4.适配器

**stack适配**

```c++
#include <iostream>
#include <vector>
#include <list>
using namespace std;

namespace lic
{
	template<class T, class Container>
	class stack
	{
	public:
		void push(const T& value)
		{
			_con.push_back(value);
		}

		void pop()
		{
			_con.pop_back();
		}

		size_t size() const
		{
			return _con.size();
		}

		bool empty() const
		{
			return _con.empty();
		}

		T& top()
		{
			return _con.back();
		}

	private:
		Container _con;
	};

	void test()
	{
		//stack<int, vector<int>> s;
		stack<int, list<int>> s;
		s.push(1);
		s.push(2);
		s.push(3);
		s.push(4);
		s.push(5);

		while (!s.empty())
		{
			cout << s.top() << " ";
			s.pop();
		}
		cout << endl;
	}
}

int main()
{
	lic::test();

	return 0;
}
```

**queue适配**

```c++
#include <iostream>
#include <vector>
#include <list>
using namespace std;

namespace lic
{
	template<class T, class Container>
	class queue
	{
	public:
		void push(const T& value)
		{
			_con.push_back(value);
		}

		void pop()
		{
			_con.pop_front();  // vecotr没有这个接口
		}

		size_t size() const
		{
			return _con.size();
		}

		bool empty() const
		{
			return _con.empty();
		}

		T& front()
		{
			return _con.front();
		}

		T& back()
		{
			return _con.back();
		}

	private:
		Container _con;
	};

	void test()
	{
		//queue<int, vector<int>> s;	
		queue<int, list<int>> s;
		s.push(1);
		s.push(2);
		s.push(3);
		s.push(4);
		s.push(5);

		while (!s.empty())
		{
			cout << s.front() << " ";
			s.pop();
		}
		cout << endl;
	}
}

int main()
{
	lic::test();

	return 0;
}
```

**deque 新容器**

**deque的缺点就是 随机访问的时候，效率太低了的。**

```
```



































