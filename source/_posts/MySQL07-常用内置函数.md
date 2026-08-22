---
title: MySQL 常用内置函数：日期、字符串、数学与条件表达式
date: 2026-08-21 11:10:00
categories:
  - MySQL
tags:
  - MySQL
  - 内置函数
  - 日期函数
  - 字符串函数
---

内置函数让 SQL 能完成日期计算、字符串处理、数学运算、空值替换和条件映射。使用时不仅要记住返回值，还要关注时区、字符与字节、确定性、`NULL` 传播和索引可用性。

<!-- more -->

## 1. 日期时间函数

```sql
SELECT CURRENT_DATE,
       CURRENT_TIME,
       CURRENT_TIMESTAMP,
       NOW(6);
```

常用计算：

```sql
SELECT DATE_ADD('2026-08-21', INTERVAL 10 DAY);
SELECT DATE_SUB('2026-08-21', INTERVAL 1 MONTH);
SELECT DATEDIFF('2026-09-01', '2026-08-21');
SELECT TIMESTAMPDIFF(HOUR, '2026-08-21 10:00:00', '2026-08-21 15:30:00');
```

提取日期部分：

```sql
SELECT YEAR(created_at), MONTH(created_at), DAY(created_at)
FROM orders;
```

### 1.1 可索引的时间范围

不推荐在被索引列上包函数：

```sql
-- 可能无法有效使用 created_at 普通索引
WHERE DATE(created_at) = '2026-08-21'
```

改为半开区间：

```sql
WHERE created_at >= '2026-08-21 00:00:00'
  AND created_at <  '2026-08-22 00:00:00'
```

### 1.2 时区

```sql
SELECT @@session.time_zone, @@global.time_zone;
SELECT CONVERT_TZ(ts, '+00:00', '+08:00');
```

时区命名转换依赖服务器时区表。应用应明确存储与展示时区，不能默认所有客户端处于同一地区。

## 2. 字符串函数

```sql
SELECT CHAR_LENGTH('你好abc'); -- 字符数
SELECT LENGTH('你好abc');      -- 当前字符集编码后的字节数
```

拼接与截取：

```sql
SELECT CONCAT(first_name, ' ', last_name);
SELECT CONCAT_WS('-', year_no, month_no, day_no);
SELECT SUBSTRING('abcdef', 2, 3);  -- bcd
SELECT LEFT('abcdef', 2), RIGHT('abcdef', 2);
```

清理与替换：

```sql
SELECT TRIM('  hello  ');
SELECT REPLACE('a-b-c', '-', '/');
SELECT LOWER('MySQL'), UPPER('MySQL');
```

`LOWER`/`UPPER` 与比较结果受字符集和排序规则影响。对用户名、邮箱等是否区分大小写，应在数据模型层明确，而不是临时调用函数。

## 3. 数学函数

```sql
SELECT ABS(-10), CEIL(3.2), FLOOR(3.8);
SELECT ROUND(3.14159, 2), TRUNCATE(3.14159, 2);
SELECT POW(2, 10), SQRT(16), MOD(10, 3);
SELECT RAND();
```

`ROUND` 是舍入，`TRUNCATE` 是直接截断。随机排序：

```sql
SELECT * FROM large_table ORDER BY RAND() LIMIT 10;
```

对大表通常代价很高，因为需要为大量行生成随机值并排序。更适合使用预计算随机键、采样表或根据主键范围抽样。

## 4. 空值函数

```sql
SELECT COALESCE(phone, mobile, '未填写');
SELECT IFNULL(discount, 0);
SELECT NULLIF(divisor, 0);
```

安全除法：

```sql
SELECT numerator / NULLIF(divisor, 0) AS ratio;
```

`COALESCE` 返回第一个非 `NULL` 值，标准 SQL 兼容性通常比 `IFNULL` 更好。

## 5. 条件表达式

```sql
SELECT name,
       CASE
         WHEN score >= 90 THEN 'A'
         WHEN score >= 80 THEN 'B'
         WHEN score >= 60 THEN 'C'
         ELSE 'D'
       END AS grade
FROM exam_result;
```

MySQL 也有 `IF(condition, true_value, false_value)`，但复杂分支使用 `CASE` 更清晰、更可移植。

## 6. 哈希与编码函数

```sql
SELECT SHA2('message', 256);
SELECT TO_BASE64('hello'), FROM_BASE64('aGVsbG8=');
```

哈希函数不能代替密码哈希。用户密码应由专用算法和成熟身份系统处理，例如 Argon2、bcrypt 或 scrypt，并使用随机盐和合适成本参数。不要使用 `MD5`、`SHA1` 或单次 `SHA2` 直接保存密码。

## 7. JSON 函数

```sql
SELECT JSON_EXTRACT(payload, '$.user.id');
SELECT payload->>'$.user.name' AS user_name FROM event_log;
SELECT JSON_SET(payload, '$.processed', TRUE) FROM event_log;
```

高频查询的 JSON 路径可通过生成列建立索引，但应先确认目标版本支持和执行计划。

## 8. 函数与索引

以下条件常使普通索引难以直接利用：

```sql
WHERE LOWER(email) = 'user@example.com'
WHERE YEAR(created_at) = 2026
WHERE price + 10 > 100
```

可选方案：

- 把函数移到常量一侧或改写成范围；
- 使用与业务一致的排序规则；
- 在支持的版本使用函数索引；
- 建立生成列并对其索引。

任何方案都应通过 `EXPLAIN` 验证。

## 9. 常见错误

- 混淆 `LENGTH` 字节数与 `CHAR_LENGTH` 字符数；
- 对时间列包 `DATE()` 后抱怨索引失效；
- 忽略会话时区；
- 用格式化后的日期字符串参与业务计算；
- 用 `ORDER BY RAND()` 随机抽取大表；
- 认为 `NULL` 会自动当作 0；
- 使用普通哈希函数保存密码；
- 在 `WHERE` 中大量计算，却没有检查执行计划。

函数让 SQL 更有表达力，但函数放置的位置往往决定能否使用索引。先保证语义正确，再结合执行计划优化。
