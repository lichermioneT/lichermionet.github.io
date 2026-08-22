---
title: MySQL 数据表 DDL：创建、查看、修改与删除
date: 2026-08-21 10:30:00
categories:
  - MySQL
tags:
  - MySQL
  - DDL
  - CREATE TABLE
  - ALTER TABLE
---

表结构决定数据能够保存什么、哪些状态合法以及查询能否高效执行。DDL 语法不只是创建几个字段，还要考虑类型、约束、默认值、字符集、索引、上线成本和回滚方式。

<!-- more -->

## 1. 创建表

```sql
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(64) NOT NULL,
    email VARCHAR(255) NOT NULL,
    birthday DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
               ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci
  COMMENT = '用户表';
```

设计时应明确：

- 主键是否稳定、短小、非空；
- 字符串最大长度是否来自真实业务约束；
- 时间保存的是日期、时刻还是持续时间；
- 字段能否为 `NULL`；
- 唯一性和引用完整性是否应由数据库保证。

## 2. 查看表定义

```sql
SHOW TABLES;
DESC users;
SHOW COLUMNS FROM users;
SHOW CREATE TABLE users\G
SHOW TABLE STATUS LIKE 'users'\G
```

`DESC` 适合快速查看列；`SHOW CREATE TABLE` 才能完整看到引擎、字符集、索引、约束和服务器补全后的定义。

## 3. 添加列

```sql
ALTER TABLE users
  ADD COLUMN status TINYINT UNSIGNED NOT NULL DEFAULT 1
  COMMENT '1=正常, 2=禁用';
```

可以使用 `FIRST` 或 `AFTER column` 调整显示顺序，但列顺序通常不应影响应用逻辑。始终在 SQL 中显式写出列名，不要依赖 `SELECT *` 或物理顺序。

## 4. 修改列定义

`MODIFY` 只修改列定义，`CHANGE` 还可改名：

```sql
ALTER TABLE users
  MODIFY COLUMN username VARCHAR(100) NOT NULL;

ALTER TABLE users
  CHANGE COLUMN birthday birth_date DATE NULL;
```

MySQL 8.0 还支持更清晰的重命名语法：

```sql
ALTER TABLE users RENAME COLUMN birth_date TO birthday;
```

缩小长度、改类型、把可空改为非空前，应先检查现有数据是否可转换。否则 DDL 可能失败或在非严格模式下产生意外结果。

## 5. 删除列与重命名表

```sql
ALTER TABLE users DROP COLUMN status;
ALTER TABLE users RENAME TO app_users;
-- 或 RENAME TABLE users TO app_users;
```

删除列会永久丢失该列数据，并可能影响索引、视图、触发器和应用代码。上线前应搜索依赖并准备恢复方案。

## 6. 删除与清空表

```sql
DROP TABLE IF EXISTS temp_users;
TRUNCATE TABLE audit_staging;
DELETE FROM audit_staging;
```

三者语义不同：

| 操作 | 对象是否保留 | 可带 WHERE | 自增计数 | 事务与锁特征 |
| --- | --- | --- | --- | --- |
| `DELETE` | 保留 | 可以 | 通常不重置 | DML，逐行语义 |
| `TRUNCATE` | 保留 | 不可以 | 通常重置 | DDL，通常隐式提交 |
| `DROP TABLE` | 不保留 | 不适用 | 对象消失 | DDL，通常隐式提交 |

不能只用“谁更快”做选择，首先要确认需要的是删除部分记录、清空数据还是删除对象。

## 7. DDL 的上线风险

大表 `ALTER TABLE` 可能涉及：

- 元数据锁等待；
- 表重建和大量 I/O；
- 临时磁盘空间；
- 主从复制延迟；
- 长事务阻塞 DDL；
- 应用新旧版本兼容。

执行前可查看：

```sql
EXPLAIN ALTER TABLE users
  ADD COLUMN nickname VARCHAR(100) NULL;
```

具体是否支持 `INSTANT`、`INPLACE` 或需要 `COPY` 与版本、引擎和变更类型有关。不要在不了解执行算法时直接对生产大表操作。

## 8. 向后兼容的迁移思路

把“改列”拆成可兼容步骤：

1. 新增允许为空的新列；
2. 应用同时写旧列和新列；
3. 分批回填历史数据；
4. 校验数据一致；
5. 读流量切换到新列；
6. 稳定后再删除旧列。

这种 expand-contract 模式比一次破坏性变更更适合持续上线系统。

## 9. 表设计检查清单

- 每张 InnoDB 表是否有明确主键；
- 金额是否使用 `DECIMAL` 而不是浮点；
- 完整 Unicode 是否使用 `utf8mb4`；
- 必填字段是否 `NOT NULL`；
- 唯一约束和外键是否符合业务；
- 是否为主要查询准备合适索引；
- 是否避免把多个值塞进一个字符串列；
- 是否记录创建与更新时间；
- DDL 是否在目标版本和真实数据量上评估；
- 是否有备份、监控和回退计划。

好的表结构应把数据含义写进类型和约束，使非法状态尽量无法进入数据库，而不是把所有校验都推给应用。
