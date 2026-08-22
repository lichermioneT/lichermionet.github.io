---
title: MySQL 连接查询：INNER JOIN、LEFT JOIN 与 RIGHT JOIN
date: 2026-08-21 11:30:00
categories:
  - MySQL
tags:
  - MySQL
  - JOIN
  - 内连接
  - 外连接
---

连接用于按关系把多张表的行组合起来。内连接只保留匹配行，外连接还会保留指定一侧的未匹配行。最常见错误不是语法，而是把过滤条件放错位置，意外把外连接变回内连接。

<!-- more -->

## 1. 示例数据

```sql
CREATE TABLE department (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE employee (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    department_id INT NULL
);
```

## 2. 内连接

```sql
SELECT e.id,
       e.name,
       d.name AS department_name
FROM employee AS e
INNER JOIN department AS d
  ON d.id = e.department_id;
```

只有连接条件成立的组合会出现在结果中。`INNER` 可以省略：

```sql
FROM employee AS e JOIN department AS d ON ...
```

旧式逗号连接虽然可用，但连接条件容易混入过滤条件甚至被遗漏：

```sql
-- 不推荐
FROM employee AS e, department AS d
WHERE e.department_id = d.id
```

## 3. 左外连接

```sql
SELECT e.id, e.name, d.name AS department_name
FROM employee AS e
LEFT JOIN department AS d
  ON d.id = e.department_id;
```

左表员工全部保留；没有匹配部门时，右表列补 `NULL`。

查找没有部门的员工：

```sql
SELECT e.id, e.name
FROM employee AS e
LEFT JOIN department AS d ON d.id = e.department_id
WHERE d.id IS NULL;
```

这是一种反连接写法，也可用 `NOT EXISTS`。

## 4. 右外连接

```sql
SELECT e.name, d.name AS department_name
FROM employee AS e
RIGHT JOIN department AS d
  ON d.id = e.department_id;
```

右表部门全部保留。任何右连接都能通过交换表顺序改写成左连接，团队通常统一使用 `LEFT JOIN`，阅读时更容易追踪“保留哪一侧”。

## 5. `ON` 与 `WHERE` 的关键区别

要求只匹配在职员工，但仍保留没有在职员工的部门：

```sql
SELECT d.name, e.name
FROM department AS d
LEFT JOIN employee AS e
  ON e.department_id = d.id
 AND e.status = 'active';
```

如果写成：

```sql
SELECT d.name, e.name
FROM department AS d
LEFT JOIN employee AS e ON e.department_id = d.id
WHERE e.status = 'active';
```

未匹配行的 `e.status` 是 `NULL`，会被 `WHERE` 过滤，效果接近内连接。

记忆方式：

- `ON` 决定两侧如何匹配；
- `WHERE` 过滤连接完成后的结果。

## 6. 一对多连接造成的行数放大

一个部门有多名员工，连接后部门会重复多行。这是关系语义，不是数据库“生成重复数据”。若只想统计：

```sql
SELECT d.id, d.name, COUNT(e.id) AS employee_count
FROM department AS d
LEFT JOIN employee AS e ON e.department_id = d.id
GROUP BY d.id, d.name;
```

必须使用 `COUNT(e.id)` 而非 `COUNT(*)`，否则无员工部门的补空行也会被统计为 1。

## 7. 多表连接

```sql
SELECT o.id,
       c.name AS customer_name,
       p.name AS product_name,
       oi.quantity
FROM orders AS o
JOIN customer AS c ON c.id = o.customer_id
JOIN order_item AS oi ON oi.order_id = o.id
JOIN product AS p ON p.id = oi.product_id
WHERE o.created_at >= '2026-08-01';
```

连接顺序由优化器决定，SQL 中的书写顺序不一定是执行顺序。连接列应有合适索引，且两侧类型、符号位和字符集应一致。

## 8. MySQL 中的全外连接

MySQL 没有直接的 `FULL OUTER JOIN` 语法，可按需求组合左连接和反向未匹配行：

```sql
SELECT a.id, a.value, b.value
FROM a LEFT JOIN b ON b.id = a.id
UNION ALL
SELECT b.id, a.value, b.value
FROM b LEFT JOIN a ON a.id = b.id
WHERE a.id IS NULL;
```

第二部分只取右侧独有行，避免重复已匹配记录。

## 9. 常见错误

- 忘记连接条件，产生笛卡尔积；
- 在 `WHERE` 过滤外连接右表，意外丢失未匹配行；
- 用 `DISTINCT` 掩盖多对多连接错误；
- 连接列类型不一致，触发隐式转换；
- 连接键无索引，导致大范围扫描；
- 使用 `COUNT(*)` 统计左连接右表数量；
- 列名不加表别名，产生歧义；
- 没有明确每侧是一对一、一对多还是多对多。

写连接前先画出关系和基数，再决定保留哪一侧、未匹配行如何处理。这样比背连接图更可靠。
