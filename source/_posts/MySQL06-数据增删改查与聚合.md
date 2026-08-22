---
title: MySQL 数据增删改查：SELECT、过滤、排序、分页与聚合
date: 2026-08-21 11:00:00
categories:
  - MySQL
tags:
  - MySQL
  - CRUD
  - SELECT
  - GROUP BY
  - 聚合函数
---

CRUD 是 SQL 的基本功，但可靠查询远不止背诵 `SELECT`。列清单、空值逻辑、确定性排序、安全更新、分页方式和聚合顺序都会影响正确性与性能。

<!-- more -->

## 1. 准备表

```sql
CREATE TABLE exam_result (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    chinese DECIMAL(5,2) NULL,
    math DECIMAL(5,2) NULL,
    english DECIMAL(5,2) NULL,
    qq VARCHAR(20) NULL,
    CONSTRAINT chk_scores CHECK (
      (chinese BETWEEN 0 AND 100 OR chinese IS NULL) AND
      (math BETWEEN 0 AND 100 OR math IS NULL) AND
      (english BETWEEN 0 AND 100 OR english IS NULL)
    )
);
```

## 2. `INSERT`

始终显式写列名：

```sql
INSERT INTO exam_result(name, chinese, math, english)
VALUES
  ('孙悟空', 78, 95, 82),
  ('曹孟德', 88, 72, 90);
```

插入查询结果：

```sql
INSERT INTO excellent_student(name, total_score)
SELECT name, chinese + math + english
FROM exam_result
WHERE chinese + math + english >= 260;
```

### 2.1 冲突更新

```sql
INSERT INTO daily_counter(day_key, visit_count)
VALUES (CURRENT_DATE, 1) AS new
ON DUPLICATE KEY UPDATE visit_count = daily_counter.visit_count + new.visit_count;
```

语法细节随版本演进，部署前应在目标版本验证。`REPLACE` 的语义接近“冲突时删除旧行再插入”，可能触发自增、外键和触发器副作用，不能简单当作普通更新。

## 3. `SELECT`

```sql
SELECT id, name, math
FROM exam_result;
```

生产代码尽量避免 `SELECT *`：它增加无用传输，对表结构变化敏感，也可能妨碍覆盖索引。

表达式和别名：

```sql
SELECT name,
       chinese + math + english AS total_score
FROM exam_result;
```

如果任一成绩为 `NULL`，加法结果也是 `NULL`。可按业务使用：

```sql
COALESCE(chinese, 0) + COALESCE(math, 0) + COALESCE(english, 0)
```

## 4. `WHERE` 条件

```sql
SELECT name, english
FROM exam_result
WHERE english < 60;

SELECT name, chinese
FROM exam_result
WHERE chinese BETWEEN 80 AND 90;

SELECT name, math
FROM exam_result
WHERE math IN (58, 59, 98, 99);

SELECT name
FROM exam_result
WHERE name LIKE '孙%';
```

通配符：`%` 匹配任意长度，`_` 匹配一个字符。前导通配符如 `LIKE '%abc'` 通常难以利用普通 B+ 树索引。

### 4.1 三值逻辑

SQL 条件可能得到 `TRUE`、`FALSE` 或 `UNKNOWN`：

```sql
WHERE qq IS NULL
WHERE qq IS NOT NULL
```

不能写 `qq = NULL`。`NOT IN` 的子查询若含 `NULL` 也可能使结果出乎预期，常用 `NOT EXISTS` 更清晰。

## 5. 去重与排序

```sql
SELECT DISTINCT math FROM exam_result;

SELECT name, math, english, chinese
FROM exam_result
ORDER BY math DESC, english ASC, chinese ASC, id ASC;
```

排序方向默认 `ASC`。分页或业务逻辑依赖顺序时，应增加唯一键作为最终排序条件，否则同分记录的相对顺序不确定。

## 6. 分页

偏移分页：

```sql
SELECT id, name
FROM exam_result
ORDER BY id
LIMIT 20 OFFSET 40;
```

深分页需要扫描并丢弃大量前置记录。按稳定索引游标翻页通常更高效：

```sql
SELECT id, name
FROM exam_result
WHERE id > 100000
ORDER BY id
LIMIT 20;
```

组合排序要使用组合游标条件，并保持与 `ORDER BY` 一致。

## 7. `UPDATE`

```sql
UPDATE exam_result
SET math = 80
WHERE name = '孙悟空';
```

更新前先用同一 `WHERE` 做查询，并尽量使用主键或唯一键定位：

```sql
START TRANSACTION;
SELECT id, name, math FROM exam_result WHERE id = 1 FOR UPDATE;
UPDATE exam_result SET math = 80 WHERE id = 1;
COMMIT;
```

没有 `WHERE` 会更新全表。生产工具可开启安全更新模式，但最终仍要靠审查、权限、事务和备份。

## 8. `DELETE` 与 `TRUNCATE`

```sql
DELETE FROM exam_result WHERE id = 1;
DELETE FROM exam_result;          -- 删除全部行
TRUNCATE TABLE exam_result;       -- DDL 方式清空表
```

`TRUNCATE` 不支持 `WHERE`，通常会重置自增计数并产生隐式提交。需要可控事务语义时不能盲目替代 `DELETE`。

## 9. 聚合函数

```sql
SELECT COUNT(*) AS rows_count,
       COUNT(qq) AS non_null_qq,
       COUNT(DISTINCT qq) AS distinct_qq,
       SUM(math) AS math_sum,
       AVG(math) AS math_avg,
       MIN(math) AS math_min,
       MAX(math) AS math_max
FROM exam_result;
```

- `COUNT(*)` 统计行；
- `COUNT(column)` 忽略 `NULL`；
- `SUM`、`AVG`、`MIN`、`MAX` 也通常忽略 `NULL`；
- 空输入上的聚合返回值要结合函数验证。

## 10. `GROUP BY` 与 `HAVING`

```sql
SELECT class_id,
       COUNT(*) AS student_count,
       AVG(math) AS avg_math
FROM exam_result
WHERE math IS NOT NULL
GROUP BY class_id
HAVING COUNT(*) >= 10
ORDER BY avg_math DESC;
```

逻辑处理顺序可近似理解为：

```text
FROM/JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT
-> ORDER BY -> LIMIT
```

`WHERE` 过滤分组前的行，`HAVING` 过滤分组后的结果。能在 `WHERE` 提前过滤的条件不要都放到 `HAVING`。

开启 `ONLY_FULL_GROUP_BY` 时，`SELECT` 中未聚合的列必须与分组键存在确定关系，避免返回任意值。

## 11. 执行计划

```sql
EXPLAIN
SELECT name, math
FROM exam_result
WHERE math >= 90
ORDER BY math DESC
LIMIT 20;
```

重点观察访问类型、可能索引、实际使用索引、扫描行数估计和额外操作。执行计划只是估计；复杂问题还应结合 `EXPLAIN ANALYZE`、慢日志和真实负载。

## 12. 常见错误

- 不写列名进行全列插入；
- 把 `NULL` 与空字符串混为一谈；
- 分页时没有确定性 `ORDER BY`；
- 深分页仍使用巨大 `OFFSET`；
- 直接执行无 `WHERE` 的更新或删除；
- 用 `REPLACE` 却忽略“删除再插入”语义；
- 聚合查询混用非分组列；
- 只看 SQL 结果，不看索引与执行计划；
- 拼接用户输入形成 SQL，造成注入风险。

CRUD 的正确目标是：结果确定、边界明确、错误可处理、执行计划可解释。
