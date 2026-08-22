---
title: MySQL 数据库操作：创建、字符集、修改、备份与恢复
date: 2026-08-21 10:20:00
categories:
  - MySQL
tags:
  - MySQL
  - 数据库操作
  - 字符集
  - 备份恢复
---

数据库级操作主要负责命名空间、默认字符集与排序规则、备份恢复和连接观察。语法本身不难，真正容易出错的是字符集选择、危险删除、备份范围和恢复验证。

<!-- more -->

## 1. 创建数据库

推荐显式写出字符集和排序规则：

```sql
CREATE DATABASE IF NOT EXISTS shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

`IF NOT EXISTS` 能避免已存在时报错，但不会检查现有数据库的定义是否与期望一致。因此部署脚本还应验证：

```sql
SHOW CREATE DATABASE shop;
```

标识符如果与关键字冲突，可使用反引号，但最好从命名阶段避免：

```sql
CREATE DATABASE `order`;
```

## 2. 查看与选择数据库

```sql
SHOW DATABASES;
USE shop;
SELECT DATABASE();
```

`USE` 只改变当前连接的默认数据库，不影响其他会话。业务代码中也可以使用全限定名避免歧义：

```sql
SELECT id, name FROM shop.product;
```

## 3. 字符集与排序规则

### 3.1 查看配置

```sql
SHOW CHARACTER SET LIKE 'utf8mb4';
SHOW COLLATION WHERE Charset = 'utf8mb4';

SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
```

字符集解决“如何编码”，排序规则解决“如何比较”。例如大小写是否敏感会直接影响唯一约束：在不区分大小写的排序规则下，`Alice` 和 `alice` 可能被视为相等。

### 3.2 连接字符集

服务器、数据库和表的字符集正确，不代表客户端连接一定正确。可在连接后确认：

```sql
SET NAMES utf8mb4;
```

更推荐在驱动或连接参数中设置字符集，而不是依赖每次手写 `SET NAMES`。

## 4. 修改数据库默认定义

```sql
ALTER DATABASE shop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

这通常只改变数据库后续新建对象的默认值，不会自动转换既有表和列。转换表要显式执行并评估锁、空间和索引长度：

```sql
ALTER TABLE product
  CONVERT TO CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

大表转换可能耗时并占用大量额外空间，应先在测试环境评估。

## 5. 删除数据库

```sql
DROP DATABASE IF EXISTS shop_test;
```

删除数据库通常不可通过普通 `ROLLBACK` 撤销。执行前至少确认：

```sql
SELECT DATABASE();
SHOW CREATE DATABASE shop_test;
```

生产环境应使用最小权限账户、变更审批和可恢复备份，而不是只依赖 `IF EXISTS`。

## 6. 使用 mysqldump 逻辑备份

备份单库：

```bash
mysqldump -h 127.0.0.1 -u backup_user -p \
  --single-transaction --routines --triggers --events \
  --databases shop > shop.sql
```

关键点：

- `--single-transaction` 适合 InnoDB 一致性快照，不应在备份期间执行会破坏一致性的 DDL；
- 存储过程、事件等对象要用对应选项纳入；
- 命令行不要明文写密码；
- 逻辑备份速度和恢复速度会受数据量影响。

只备份某些表：

```bash
mysqldump -u backup_user -p shop product orders > shop_tables.sql
```

## 7. 恢复

如果备份包含 `CREATE DATABASE` 和 `USE`：

```bash
mysql -u restore_user -p < shop.sql
```

如果只备份了表：

```bash
mysql -u restore_user -p shop < shop_tables.sql
```

恢复完成不能只看命令退出码，还应核对：

- 表、视图、触发器和例程是否齐全；
- 行数、关键汇总和校验值是否合理；
- 账户权限是否符合预期；
- 应用能否通过真实查询运行；
- 字符集、时区和 SQL mode 是否一致。

## 8. 查看连接

```sql
SHOW PROCESSLIST;
SHOW FULL PROCESSLIST;
```

它们可观察线程 ID、用户、来源、状态和正在执行的语句。连接数异常时，还应结合：

```sql
SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';
```

高连接数不一定意味着应立即增大上限，也可能是连接泄漏、慢 SQL、锁等待或连接池配置错误。

## 9. 一个安全的初始化脚本

```sql
CREATE DATABASE IF NOT EXISTS app_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE app_db;

CREATE TABLE IF NOT EXISTS schema_version (
    version_no INT PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO schema_version(version_no, description)
VALUES (1, 'initial schema');
```

真正的迁移系统还应保证版本唯一、失败可定位、已执行脚本不可随意改写，并对不可逆 DDL 设计回退方案。

## 10. 常见误区

- 认为修改数据库默认字符集会转换全部旧表；
- 只关注字符集，不关注排序规则；
- 把 `utf8` 与 `utf8mb4` 混为一谈；
- 备份时遗漏视图、存储过程、触发器或事件；
- 从未做过恢复演练；
- 使用文件复制代替一致性备份，却没有理解表空间和日志要求；
- 在命令行参数中暴露密码；
- 误把连接上限不足当作唯一原因，忽略慢查询和锁等待。

数据库操作的目标不是“命令执行成功”，而是让字符编码、对象定义、备份范围和恢复结果都可验证。
