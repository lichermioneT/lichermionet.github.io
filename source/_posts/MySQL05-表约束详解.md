---
title: MySQL 表约束详解：让非法数据无法进入数据库
date: 2026-08-21 10:50:00
categories:
  - MySQL
tags:
  - MySQL
  - 表约束
  - 主键
  - 外键
  - 唯一约束
---

约束把业务规则写进表结构，使数据库成为数据完整性的最后防线。应用校验能改善用户体验，但无法代替 `NOT NULL`、主键、唯一键、外键和 `CHECK` 对所有写入入口的统一保护。

<!-- more -->

## 1. `NOT NULL`

```sql
CREATE TABLE user_profile (
    id BIGINT UNSIGNED NOT NULL,
    nickname VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NULL
);
```

`NOT NULL` 表示列必须有值。它不禁止空字符串，因此若空字符串也非法，需要应用校验或 `CHECK`：

```sql
nickname VARCHAR(100) NOT NULL,
CONSTRAINT chk_nickname_nonempty CHECK (CHAR_LENGTH(TRIM(nickname)) > 0)
```

## 2. 默认值

```sql
status TINYINT UNSIGNED NOT NULL DEFAULT 1,
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

默认值只在插入时省略该列或显式使用 `DEFAULT` 时生效。显式插入 `NULL` 是否允许，仍由空属性决定。

不要用一个虚假默认值掩盖“业务上其实不知道”。例如未知生日应该是 `NULL`，而不是 `1970-01-01`。

## 3. 列注释

```sql
status TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=正常, 2=禁用'
```

`COMMENT` 是元数据，不会自动验证值是否合法。枚举语义仍应通过 `CHECK`、引用表或明确的类型约束实现。

## 4. `ZEROFILL` 为什么不适合业务格式

旧资料常演示 `INT ZEROFILL`，它只是显示层补零，并不改变存储值；现代 MySQL 中整数显示宽度与 `ZEROFILL` 已不应作为新设计依赖。

订单号、邮编、手机号等不是用于算术的值，应使用字符串：

```sql
postal_code VARCHAR(20) NOT NULL
```

格式化应由查询表达式或应用展示层完成。

## 5. 主键

主键要求唯一且非空，一张表只能有一个主键，但主键可以由多列组成：

```sql
CREATE TABLE order_item (
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    PRIMARY KEY (order_id, product_id)
);
```

InnoDB 将主键作为聚簇索引键，二级索引叶子记录也会保存主键值，因此主键宜稳定、短小，避免频繁更新。

## 6. `AUTO_INCREMENT`

```sql
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY
```

自增保证数据库生成新的序号，但不保证：

- 连续无缺口；
- 按提交顺序严格递增；
- 删除后自动复用；
- 能代表业务含义。

事务回滚、并发插入和失败语句都可能留下缺口。自增 ID 适合作为代理主键，不适合当作精确计数器。

## 7. 唯一约束

```sql
CONSTRAINT uk_users_email UNIQUE (email)
```

唯一约束是并发环境中防止重复的可靠手段。应用层“先查再插”存在竞态条件，最终仍要处理数据库返回的重复键错误。

MySQL 唯一索引通常允许多个 `NULL`，因为 `NULL` 不被视为彼此相等。若业务要求最多一个空值，需要重新建模或使用其他约束策略。

## 8. 外键

```sql
CREATE TABLE orders (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    CONSTRAINT fk_orders_customer
      FOREIGN KEY (customer_id) REFERENCES customer(id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT
) ENGINE = InnoDB;
```

外键保证子表引用的父记录存在，并定义父记录变化时的行为：

- `RESTRICT`/`NO ACTION`：存在引用时拒绝；
- `CASCADE`：级联更新或删除；
- `SET NULL`：把子表外键设为 `NULL`，要求该列可空。

级联删除可能一次影响大量记录，使用前要确认业务含义和锁范围。是否使用外键可结合架构和运维能力决定，但“不建外键”不等于“不需要引用完整性”。

## 9. `CHECK`

```sql
CREATE TABLE account (
    id BIGINT UNSIGNED PRIMARY KEY,
    balance DECIMAL(18, 2) NOT NULL,
    state VARCHAR(20) NOT NULL,
    CONSTRAINT chk_balance_nonnegative CHECK (balance >= 0),
    CONSTRAINT chk_state CHECK (state IN ('active', 'frozen', 'closed'))
);
```

MySQL 8.0.16 起会执行 `CHECK` 约束；旧版本可能只解析而不执行，因此迁移旧系统时必须确认服务器版本和历史数据。

约束表达式为 `TRUE` 或 `UNKNOWN` 时通过，为 `FALSE` 时失败，所以需要结合 `NOT NULL` 才能禁止空值绕过。

## 10. 综合建表示例

```sql
CREATE TABLE product (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(18, 2) NOT NULL,
    stock INT UNSIGNED NOT NULL DEFAULT 0,
    category_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_product_sku UNIQUE (sku),
    CONSTRAINT chk_product_price CHECK (price >= 0),
    CONSTRAINT fk_product_category
      FOREIGN KEY (category_id) REFERENCES category(id)
      ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
```

## 11. 添加与删除约束

```sql
ALTER TABLE product
  ADD CONSTRAINT uk_product_name UNIQUE (name);

ALTER TABLE product
  DROP INDEX uk_product_name;

ALTER TABLE product
  DROP FOREIGN KEY fk_product_category;

ALTER TABLE product
  DROP CHECK chk_product_price;
```

已有数据违反新约束时，添加操作会失败。应先查询并清理异常数据，再上线约束。

## 12. 常见误区

- 认为 `DEFAULT` 能替代 `NOT NULL`；
- 用 `ZEROFILL` 保存业务编号；
- 把自增值当作连续计数；
- 只在应用层检查唯一性；
- 误以为唯一索引不允许多个 `NULL`；
- 使用 `CHECK` 却没有确认旧版本是否执行；
- 外键两端的类型、符号位或字符集不一致；
- 无评估地使用级联删除；
- 通过关闭外键检查导入数据，却没有在之后验证完整性。

约束应描述“数据永远必须满足什么”，而不是某个页面当前如何校验。规则一旦进入数据库，所有脚本、服务和人工操作都必须遵守。
