---
title: MySQL 索引详解：InnoDB B+ 树、聚簇索引与优化实践
date: 2026-08-21 11:40:00
categories:
  - MySQL
tags:
  - MySQL
  - 索引
  - B+树
  - InnoDB
  - EXPLAIN
---

索引用额外空间与写入维护成本换取检索速度。理解 MySQL 索引不能停留在 `CREATE INDEX`：还要知道数据页、B+ 树、聚簇索引、回表、覆盖索引、最左前缀和执行计划之间的关系。

<!-- more -->

## 1. 没有索引会怎样

```sql
SELECT * FROM employee WHERE employee_no = 998877;
```

没有可用索引时，优化器可能执行全表扫描。数据量增大后，需要检查的页和记录不断增加。索引把查找范围从“大量数据页”缩小到少量树节点和目标叶子页。

代价包括：

- 索引占用磁盘与缓存；
- `INSERT`、`UPDATE`、`DELETE` 要维护索引；
- 索引过多增加优化器选择和运维成本；
- 不合理索引可能从未被使用。

## 2. 为什么数据库按页 I/O

磁盘和操作系统按块传输数据，数据库也不会每次只读一条记录。InnoDB 以页为基本管理和 I/O 单位，常见页大小为 16 KiB，并通过 Buffer Pool 缓存页。

读取一个页后，页内多条相邻记录都能被利用，这体现空间局部性。优化目标常常不是减少一次 CPU 比较，而是减少随机页访问与磁盘 I/O。

## 3. 为什么使用 B+ 树

B+ 树适合页式存储：

- 每个非叶节点能容纳大量键与子页指针，分支因子高；
- 树高低，查找需要的页访问少；
- 数据集中在叶子层；
- 叶子页按键值顺序相连，适合范围查询与排序扫描；
- 插入删除通过页分裂、合并和重平衡保持有序。

与二叉平衡树相比，B+ 树一个节点能使用整页容纳更多分支，显著降低树高。与 B 树相比，非叶节点不存完整行，可容纳更多目录项，叶子链也更利于范围访问。

## 4. 聚簇索引

InnoDB 每张表都有一个聚簇索引，叶子记录存放完整行：

1. 有主键时使用主键；
2. 没有主键时，选择第一个所有列均非空的唯一索引；
3. 两者都没有时，生成隐藏的聚簇索引。

因此每张 InnoDB 表最好显式定义短小、稳定的主键。

所谓“数据按主键组织”不等于 `SELECT *` 可以省略 `ORDER BY`。SQL 结果顺序仍必须由 `ORDER BY` 保证。

## 5. 二级索引与回表

InnoDB 二级索引叶子记录通常保存：

```text
二级索引键 + 主键值
```

查询二级索引未包含的列时：

1. 在二级索引找到主键；
2. 再用主键查聚簇索引获取完整行。

这称为回表：

```sql
CREATE INDEX idx_employee_name ON employee(name);
SELECT salary FROM employee WHERE name = 'Alice';
```

若索引改为：

```sql
CREATE INDEX idx_employee_name_salary ON employee(name, salary);
```

查询所需列都能从二级索引取得，可能形成覆盖索引，减少回表。覆盖索引不是独立索引类型，而是“某条查询被索引覆盖”的状态。

## 6. 联合索引与最左前缀

```sql
CREATE INDEX idx_orders_customer_status_time
ON orders(customer_id, status, created_at);
```

B+ 树首先按 `customer_id` 排序，再在相同客户内按 `status`，最后按时间排序。通常可以支持：

```sql
WHERE customer_id = ?
WHERE customer_id = ? AND status = ?
WHERE customer_id = ? AND status = ? AND created_at >= ?
```

单独按 `status` 或 `created_at` 查询通常不能完整利用该索引的有序前缀。

联合索引列顺序应结合：等值条件、范围条件、排序分组、选择性和覆盖需求决定，不是简单把“选择性最高”永远放第一位。

## 7. 范围条件与排序

```sql
WHERE customer_id = 10
  AND created_at >= '2026-08-01'
ORDER BY created_at
```

索引 `(customer_id, created_at)` 可以先等值定位客户，再按时间做范围扫描并天然有序。

联合索引中遇到范围条件后，后续列通常不能继续用于缩小同一段索引范围，但某些条件仍可能通过索引条件下推过滤。最终以执行计划为准。

## 8. 索引失效或利用不足的常见情况

- 在索引列上做函数或计算；
- 字符串列与数字参数比较，触发隐式转换；
- `LIKE '%keyword'` 使用前导通配符；
- 联合索引跳过最左列；
- 返回比例太高，优化器认为全表扫描更便宜；
- 排序方向、列顺序与索引不匹配；
- 统计信息不准确；
- 使用 `OR` 组合缺乏索引的条件。

“没有使用某个索引”不一定是失效，也可能是成本模型判断不用更便宜。

## 9. 创建和删除索引

```sql
CREATE INDEX idx_orders_created_at ON orders(created_at);

ALTER TABLE users
  ADD UNIQUE INDEX uk_users_email (email);

SHOW INDEX FROM orders;

DROP INDEX idx_orders_created_at ON orders;
```

主键：

```sql
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE users DROP PRIMARY KEY;
```

修改主键对 InnoDB 可能意味着重建聚簇组织，属于高风险 DDL。

## 10. 前缀索引与全文索引

长字符串可以考虑前缀索引：

```sql
CREATE INDEX idx_article_title_prefix ON article(title(32));
```

前缀过短选择性差，过长又增加空间。前缀索引不能覆盖完整列值，排序能力也有限。

全文检索：

```sql
CREATE FULLTEXT INDEX ft_article_body ON article(title, body);

SELECT id, title
FROM article
WHERE MATCH(title, body) AGAINST ('database' IN NATURAL LANGUAGE MODE);
```

中文分词、复杂相关性和大规模搜索通常还需评估专用搜索系统。

## 11. `EXPLAIN`

```sql
EXPLAIN
SELECT id, created_at
FROM orders
WHERE customer_id = 10 AND status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

重点字段：

| 字段 | 关注点 |
| --- | --- |
| `type` | 访问方式，如 `const`、`ref`、`range`、`index`、`ALL` |
| `possible_keys` | 理论可选索引 |
| `key` | 实际选择索引 |
| `key_len` | 使用的索引键长度 |
| `rows` | 估计扫描行数 |
| `filtered` | 条件过滤比例估计 |
| `Extra` | 覆盖索引、临时表、文件排序等信息 |

`type=index` 仍可能是全索引扫描，不等于高效。`Using filesort` 也不必然写磁盘，只表示使用额外排序算法。

MySQL 8.0 可使用：

```sql
EXPLAIN ANALYZE SELECT ...;
```

它会实际执行查询并给出估计与真实耗时/行数，不能对危险写语句随意使用。

## 12. 索引设计流程

1. 从真实慢查询与业务访问模式出发；
2. 明确过滤、连接、排序和返回列；
3. 设计少量高价值联合索引；
4. 使用与列类型一致的参数；
5. 用 `EXPLAIN`/`EXPLAIN ANALYZE` 验证；
6. 在真实数据分布和并发下测试；
7. 观察写放大、缓存与磁盘成本；
8. 定期识别重复、冗余和长期未使用索引。

## 13. 常见误区

- 每列都建一个单列索引；
- 认为索引越多越好；
- 把主键值设计得很长，忽略它会进入二级索引；
- 把联合索引理解为多个独立单列索引；
- 只看 `key` 非空，不看扫描行数和回表；
- 误以为覆盖索引是一种固定索引类型；
- 认为表有索引就不会锁很多行；锁范围还受实际扫描索引范围影响；
- 没有 `ORDER BY` 却依赖索引返回顺序。

索引优化的本质是减少需要访问的页与行，同时控制维护成本。必须围绕具体查询设计，而不是围绕字段列表设计。
