---
title: Linux 日常总结
date: 2026-10-16 22:53:00
categories:
  - Linux
tags:
order: 16
---

# 1 C++ 代码的四个编译步骤

```bash
g++ -E main.cpp -o main.i

g++ -S main.i -o main.s

g++ -c main.s -o main.o

g++ main.o -o a.out
```

**E: Expand 展开**

**S : assembly  只编译到汇编**

**c : complie 编译 + 汇编**

**总结 ESc选项 和 iso 后缀**

