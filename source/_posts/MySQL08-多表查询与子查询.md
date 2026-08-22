---
title: MySQL 复合查询：多表查询、自连接、子查询与 UNION
date: 2026-08-21 11:20:00
categories:
  - MySQL
tags:
  - MySQL
  - 多表查询
  - 子查询
  - UNION
  - 自连接
---

复合查询把分散在多张表中的信息组合成一个结果。核心不是把 SQL 写得越长越好，而是明确表之间的关系、每一步产生多少行，以及空值、重复值和相关子查询会怎样影响结果。

<!-- more -->

## 1. 示例关系

```sql
CREATE TABLE department (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE employee (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    manager_id INT NULL,
    department_id INT NOT NULL,
    salary DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id) REFERENCES employee(id),
    CONSTRAINT fk_emp_dept FOREIGN KEY (department_id) REFERENCES department(id)
);
```

## 2. 多表查询与笛卡尔积

```sql
SELECT e.name, d.name AS department_name
FROM employee AS e
JOIN department AS d ON d.id = e.department_id;
```

如果遗漏连接条件：

```sql
SELECT * FROM employee AS e CROSS JOIN department AS d;
```

结果行数是两表行数之积。`CROSS JOIN` 本身并非错误，但多数业务查询产生巨大笛卡尔积是连接条件缺失的信号。

## 3. 自连接

同一张表以不同角色参与连接：

```sql
SELECT e.name AS employee_name,
       m.name AS manager_name
FROM employee AS e
LEFT JOIN employee AS m ON m.id = e.manager_id;
```

必须使用别名区分“员工”和“经理”。使用 `LEFT JOIN` 可以保留没有上级的顶层员工。

## 4. 标量子查询

查询工资高于平均值的员工：

```sql
SELECT id, name, salary
FROM employee
WHERE salary > (SELECT AVG(salary) FROM employee);
```

放在单值位置的子查询必须最多返回一行。返回多行会报错，空结果则通常转为 `NULL`，条件结果可能成为 `UNKNOWN`。

## 5. 多行子查询

### 5.1 `IN`

```sql
SELECT id, name
FROM employee
WHERE department_id IN (
    SELECT id FROM department WHERE name IN ('研发', '测试')
);
```

### 5.2 `EXISTS`

查找至少有一名员工的部门：

```sql
SELECT d.id, d.name
FROM department AS d
WHERE EXISTS (
    SELECT 1
    FROM employee AS e
    WHERE e.department_id = d.id
);
```

`EXISTS` 只关心是否存在，子查询中的 `SELECT 1` 表达这一意图。优化器可能把 `IN` 和 `EXISTS` 转换为相近执行计划，应使用 `EXPLAIN` 验证，而不是机械地认为某个关键字永远更快。

### 5.3 `NOT IN` 与 `NULL`

如果子查询结果包含 `NULL`，`NOT IN` 可能让全部比较变成未知：

```sql
SELECT d.id, d.name
FROM department AS d
WHERE NOT EXISTS (
    SELECT 1 FROM employee AS e WHERE e.department_id = d.id
);
```

需要排除存在关联行时，`NOT EXISTS` 往往更安全直观。

## 6. 相关子查询

查询工资高于本部门平均工资的员工：

```sql
SELECT e.id, e.name, e.salary
FROM employee AS e
WHERE e.salary > (
    SELECT AVG(x.salary)
    FROM employee AS x
    WHERE x.department_id = e.department_id
);
```

内部查询引用了外层 `e.department_id`。逻辑上它会针对外层行求值，优化器可能进行改写。缺少合适索引时，相关子查询可能很昂贵。

也可以先聚合再连接：

```sql
SELECT e.id, e.name, e.salary
FROM employee AS e
JOIN (
    SELECT department_id, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department_id
) AS a ON a.department_id = e.department_id
WHERE e.salary > a.avg_salary;
```

## 7. 派生表与 CTE

`FROM` 中的子查询称为派生表，必须有别名。MySQL 8.0 还可使用 CTE：

```sql
WITH dept_avg AS (
    SELECT department_id, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY department_id
)
SELECT e.name, e.salary, a.avg_salary
FROM employee AS e
JOIN dept_avg AS a ON a.department_id = e.department_id;
```

CTE 能提高可读性，但不保证一定物化或一定更快，仍由优化器和版本决定。

## 8. `UNION` 与 `UNION ALL`

```sql
SELECT email FROM customer
UNION
SELECT email FROM supplier;
```

`UNION` 会去重，`UNION ALL` 保留重复且通常更省成本：

```sql
SELECT email, 'customer' AS source FROM customer
UNION ALL
SELECT email, 'supplier' AS source FROM supplier;
```

两侧列数必须一致，对应列类型应兼容。最终列名通常由第一个查询决定。整体排序应写在最后：

```sql
(SELECT name, created_at FROM customer)
UNION ALL
(SELECT name, created_at FROM supplier)
ORDER BY created_at DESC
LIMIT 20;
```

## 9. 窗口函数替代部分子查询

MySQL 8.0 可用窗口函数计算部门内排名：

```sql
SELECT department_id, name, salary,
       DENSE_RANK() OVER (
         PARTITION BY department_id ORDER BY salary DESC
       ) AS salary_rank
FROM employee;
```

窗口函数不会像 `GROUP BY` 那样把多行折叠成一行，非常适合排名、累计值和分组内比较。

## 10. 优化与排错

- 为连接键和相关子查询条件建立合适索引；
- 先确认每一步的行数，防止多对多连接放大；
- 不要用 `DISTINCT` 掩盖错误连接造成的重复；
- 使用 `EXPLAIN` 检查连接顺序、访问类型和扫描行数；
- 只选择所需列，避免派生表携带大字段；
- 子查询、连接和 CTE 之间优先选择语义清晰的写法，再根据执行计划优化。

复合查询的第一原则是把关系写清楚。只要能回答“每张表扮演什么角色、连接键是什么、每侧最多匹配几行”，复杂 SQL 就不会失控。
