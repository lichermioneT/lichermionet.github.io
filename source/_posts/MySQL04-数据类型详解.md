---
title: MySQL 数据类型详解：整数、小数、字符串与日期时间
date: 2026-08-21 10:40:00
categories:
  - MySQL
tags:
  - MySQL
  - 数据类型
  - DECIMAL
  - VARCHAR
---

数据类型决定取值范围、精度、存储开销、比较规则和可用操作。选型不当可能造成金额误差、时间混乱、索引膨胀或隐式转换。本文按业务语义梳理常见类型，而不是只罗列范围表。

<!-- more -->

## 1. 整数类型

| 类型 | 有符号范围（概略） | 字节数 |
| --- | ---: | ---: |
| `TINYINT` | -128 ～ 127 | 1 |
| `SMALLINT` | -32768 ～ 32767 | 2 |
| `MEDIUMINT` | 约 ±838 万 | 3 |
| `INT` | 约 ±21 亿 | 4 |
| `BIGINT` | 约 ±922 亿亿 | 8 |

使用 `UNSIGNED` 后下界变为 0，上界约翻倍：

```sql
CREATE TABLE counter (
    id BIGINT UNSIGNED PRIMARY KEY,
    retry_count TINYINT UNSIGNED NOT NULL DEFAULT 0
);
```

选择类型应考虑未来增长和跨语言映射。`BIGINT UNSIGNED` 的上界可能超过某些语言有符号 64 位整数范围。

旧资料中的 `INT(11)` 数字不是存储长度，也不会限制为 11 位；整数显示宽度已不应作为设计依据。

## 2. `BIT`

`BIT(M)` 保存位值，`M` 通常为 1～64：

```sql
CREATE TABLE feature_flag (
    mask BIT(8) NOT NULL
);

INSERT INTO feature_flag VALUES (b'00000101');
SELECT mask + 0 FROM feature_flag;
```

单个布尔状态通常使用 `BOOLEAN`（`TINYINT(1)` 的同义写法）更便于驱动映射；多个独立开关若需要频繁查询，拆成列也可能更清晰。

## 3. 浮点与定点小数

### 3.1 `FLOAT` 与 `DOUBLE`

浮点类型保存近似值，适合测量值、科学计算和允许误差的场景：

```sql
CREATE TABLE sensor_data (
    temperature DOUBLE NOT NULL
);
```

不能用 `=` 可靠比较经过计算的浮点结果，应使用误差范围。

### 3.2 `DECIMAL(M,D)`

`DECIMAL` 保存精确定点数，适合金额、费率等：

```sql
CREATE TABLE payment (
    amount DECIMAL(18, 2) NOT NULL,
    tax_rate DECIMAL(7, 6) NOT NULL
);
```

`M` 是总有效位数，`D` 是小数位数。`DECIMAL(18,2)` 的整数部分最多 16 位。应用层也要使用十进制定点类型，避免先在 `double` 中产生误差再写入。

## 4. `CHAR` 与 `VARCHAR`

### 4.1 `CHAR(M)`

适合长度基本固定的字符串，如固定格式国家码或散列文本。它按字符数定义长度，但具体字节数受字符集影响。

### 4.2 `VARCHAR(M)`

适合长度变化明显的字符串：

```sql
CREATE TABLE profile (
    nickname VARCHAR(100) NOT NULL,
    bio VARCHAR(1000) NULL
) CHARACTER SET utf8mb4;
```

`M` 表示字符数上限，不是字节数。整行大小、字符集和内部长度字段仍会限制可用长度。不要无依据地把所有字符串都定义为 `VARCHAR(65535)`，这会影响校验、内存和索引设计。

### 4.3 `TEXT` 与 `BLOB`

- `TEXT` 存字符数据并参与字符集/排序规则；
- `BLOB` 存二进制字节，不做字符比较。

大字段会影响行访问、临时表和网络传输。文件是否应直接存数据库，要结合事务一致性、对象存储、访问模式和备份成本决定。

## 5. 日期与时间

| 类型 | 语义 | 常见用途 |
| --- | --- | --- |
| `DATE` | 日期 | 生日、结算日 |
| `TIME` | 时间或时长 | 营业时间、持续时间 |
| `DATETIME` | 不自动做时区转换的日期时间 | 业务本地时间 |
| `TIMESTAMP` | 存储时按 UTC、会话显示时转换 | 创建/更新时间 |
| `YEAR` | 年份 | 年度字段 |

```sql
CREATE TABLE event_log (
    happened_at DATETIME(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);
```

系统设计必须明确：数据库保存的是 UTC 时刻、用户所在时区的本地时间，还是纯日期。不要把时间格式化字符串当作真正的时间类型。

## 6. `ENUM` 与 `SET`

```sql
CREATE TABLE ticket (
    priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
    labels SET('bug', 'feature', 'urgent') NULL
);
```

`ENUM` 适合小且稳定的单选集合；`SET` 可同时选择多个成员。它们修改成员集合需要 DDL，并且与其他数据库兼容性较弱。频繁变化或需要额外属性的状态，通常更适合字典表或关联表。

## 7. JSON

```sql
CREATE TABLE api_event (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    payload JSON NOT NULL,
    event_type VARCHAR(50)
      GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(payload, '$.type'))) STORED,
    INDEX idx_event_type (event_type)
);
```

JSON 适合结构半固定、扩展字段较多的场景，但不应代替清晰的关系模型。经常过滤、连接或约束的属性最好有显式列，必要时使用生成列或多值索引等版本支持的能力。

## 8. `NULL` 与空值

`NULL` 表示未知或不适用，它不等于 0、空字符串或空日期：

```sql
SELECT * FROM users WHERE phone IS NULL;
SELECT * FROM users WHERE phone IS NOT NULL;
```

`phone = NULL` 的结果不是 `TRUE`，因此不能用于空值判断。是否允许 `NULL` 应由业务语义决定，而不是一律禁止或一律允许。

## 9. 隐式转换风险

```sql
-- phone 是 VARCHAR 时，不要用数字常量比较
SELECT * FROM users WHERE phone = '13800138000';
```

字符串列与数字比较可能触发类型转换，造成错误匹配或索引失效。参数类型应与列类型保持一致。

## 10. 选型清单

- 金额：`DECIMAL`；
- 计数与标识：按范围选整数，并确认是否需要 `UNSIGNED`；
- 完整 Unicode：`utf8mb4`；
- 固定/可变字符串：依据真实长度与访问模式选 `CHAR`/`VARCHAR`；
- 二进制：`BINARY`/`VARBINARY`/`BLOB`；
- 时间：先定义时区语义，再选 `DATE`、`DATETIME` 或 `TIMESTAMP`；
- 状态集合：稳定时可考虑 `ENUM`，常变时用普通列或字典表；
- 半结构化扩展：JSON，但核心查询字段仍显式建模。

数据类型不是为了“尽量省几个字节”，而是为了准确表达业务含义，并让数据库能够正确校验、比较和索引。
