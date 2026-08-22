---
title: MySQL 事务详解：ACID、隔离级别、MVCC、锁与死锁
date: 2026-08-21 11:50:00
categories:
  - MySQL
tags:
  - MySQL
  - 事务
  - MVCC
  - 隔离级别
  - InnoDB
---

事务把多条逻辑相关的 SQL 组成一个整体：要么全部提交，要么全部回滚。真正困难的部分是并发事务如何互相影响，以及 InnoDB 如何通过锁、undo log、MVCC 和日志在一致性与性能之间取得平衡。

<!-- more -->

## 1. 为什么需要事务

转账需要同时扣减付款方余额并增加收款方余额：

```sql
UPDATE account SET balance = balance - 100 WHERE id = 1;
UPDATE account SET balance = balance + 100 WHERE id = 2;
```

如果第一条成功、第二条失败，数据库会进入错误状态。事务把二者纳入同一边界：

```sql
START TRANSACTION;

UPDATE account
SET balance = balance - 100
WHERE id = 1 AND balance >= 100;

-- 应用必须检查受影响行数是否为 1
UPDATE account
SET balance = balance + 100
WHERE id = 2;

COMMIT;
-- 任意步骤失败则 ROLLBACK;
```

事务不能自动理解业务成功条件。余额不足、收款账户不存在等都需要应用检查并决定回滚。

## 2. ACID

### 2.1 原子性 Atomicity

事务中的操作要么全部生效，要么全部撤销。InnoDB 借助 undo log 等机制支持回滚。

### 2.2 一致性 Consistency

事务把数据库从一个满足约束的状态带到另一个满足约束的状态。它是最终目标，需要数据库约束、事务机制和正确业务逻辑共同保证。

### 2.3 隔离性 Isolation

并发事务的中间状态不能以不允许的方式互相干扰。不同隔离级别在一致性与并发性能之间做不同取舍。

### 2.4 持久性 Durability

事务提交后，即使服务器故障，结果也应能够恢复。InnoDB 使用 redo log、刷盘策略等保证持久性；最终强度仍受配置和硬件影响。

## 3. 开始、提交和回滚

```sql
START TRANSACTION;
-- 或 BEGIN;

SAVEPOINT before_step;
UPDATE ...;
ROLLBACK TO SAVEPOINT before_step;

COMMIT;
-- 或 ROLLBACK;
```

提交后不能再通过普通 `ROLLBACK` 撤销。保存点只在当前事务内有效，不是跨事务恢复工具。

## 4. 自动提交

```sql
SELECT @@session.autocommit;
SET SESSION autocommit = 0;
SET SESSION autocommit = 1;
```

默认 `autocommit=1` 时，每条未处于显式事务中的语句形成自己的事务。执行 `START TRANSACTION` 后，必须显式 `COMMIT` 或 `ROLLBACK` 结束。

长期关闭自动提交很容易产生被遗忘的长事务，通常更推荐明确使用事务边界。

## 5. 隐式提交

许多 DDL 和账户管理语句会在执行前后隐式提交，例如常见的 `CREATE TABLE`、`ALTER TABLE`、`DROP TABLE`。不要假设把 DDL 放进 `START TRANSACTION` 就能像普通 DML 一样回滚。

部署脚本应根据目标版本官方文档确认哪些语句会隐式提交。

## 6. 并发异常

| 异常 | 含义 |
| --- | --- |
| 脏读 | 读到其他事务尚未提交的数据 |
| 不可重复读 | 同一事务两次读取同一行，值发生变化 |
| 幻读 | 同一条件两次读取，满足条件的行集合发生变化 |
| 丢失更新 | 并发写入互相覆盖，某次修改消失 |

“不可重复读关注修改、幻读关注行集合变化”是便于理解的概括，精确行为还与一致性读、锁定读、访问索引和具体语句有关。

## 7. 四种隔离级别

```sql
SELECT @@session.transaction_isolation;

SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

| 隔离级别 | 脏读 | 不可重复读 | 并发特征 |
| --- | --- | --- | --- |
| READ UNCOMMITTED | 可能 | 可能 | 隔离最弱 |
| READ COMMITTED | 避免 | 可能 | 每次一致性读通常获取新 Read View |
| REPEATABLE READ | 避免 | 避免 | MySQL InnoDB 默认；事务内复用快照 |
| SERIALIZABLE | 避免 | 避免 | 隔离最强，并发成本最高 |

旧资料常使用 `@@tx_isolation`，现代 MySQL 应使用 `transaction_isolation`。

## 8. 快照读与当前读

普通 `SELECT` 在常见隔离级别下通常是一致性快照读，不加记录锁：

```sql
SELECT * FROM account WHERE id = 1;
```

锁定读读取最新可用记录并加锁：

```sql
SELECT * FROM account WHERE id = 1 FOR UPDATE;
SELECT * FROM account WHERE id = 1 FOR SHARE;
```

`UPDATE`、`DELETE` 等也属于当前读。快照读与当前读看到的版本可能不同，因此同一事务中不要混淆它们的语义。

## 9. MVCC 与版本链

InnoDB 聚簇索引记录包含事务相关隐藏信息，并通过 undo log 保存旧版本。更新一行时，可以把旧值组织成版本链。

普通快照读根据 Read View 判断某个版本是否对当前事务可见：

- 修改版本的事务是否早已提交；
- 是否是当前事务自己的修改；
- 创建快照时该事务是否仍活跃；
- 版本事务 ID 与可见范围的关系。

不可见时沿 undo 版本链继续寻找更早的可见版本。MVCC 让读操作通常不必与写操作互相阻塞，但它不是“完全没有锁”。

## 10. RC 与 RR 的 Read View 区别

- **READ COMMITTED**：通常每次一致性读创建新的 Read View，因此能看到其他事务在两次读取之间提交的修改；
- **REPEATABLE READ**：同一事务第一次一致性读建立快照，后续一致性读复用它，因此获得可重复读效果。

如果事务使用 `START TRANSACTION WITH CONSISTENT SNAPSHOT`，可以在开始时显式建立一致性快照（具体行为取决于引擎和隔离级别）。

## 11. 记录锁、间隙锁与 Next-Key 锁

InnoDB 通过索引记录加锁：

- **记录锁**：锁住索引记录；
- **间隙锁**：锁住索引记录之间的间隙，防止插入；
- **Next-Key 锁**：记录锁与前方间隙锁的组合。

在 REPEATABLE READ 下，范围扫描常使用 Next-Key 锁减少幻行。使用唯一索引等值定位唯一记录时，锁范围通常更小。

如果没有合适索引，语句可能扫描并锁定大量记录，严重降低并发：

```sql
UPDATE orders SET status = 'expired'
WHERE expire_at < NOW() AND status = 'pending';
```

索引设计不仅影响查询性能，也影响锁定范围。

## 12. 丢失更新与原子修改

危险的“读—改—写”：

```text
读取库存 10
应用计算 10 - 1
写回 9
```

两个事务并发时可能覆盖。优先使用单条原子更新：

```sql
UPDATE product
SET stock = stock - 1
WHERE id = ? AND stock > 0;
```

再检查受影响行数。如果业务必须先读取复杂状态，可使用 `SELECT ... FOR UPDATE` 并保持事务短小。

## 13. 死锁

两个事务以不同顺序获取资源可能互相等待：

```text
事务 A 锁住行 1，等待行 2
事务 B 锁住行 2，等待行 1
```

InnoDB 会检测死锁并回滚一个事务。应用必须把死锁当作可重试错误：回滚整个事务，经过有上限的退避后重新执行。

降低死锁概率：

- 多个事务按一致顺序访问资源；
- 为条件建立合适索引，减少扫描与锁范围；
- 缩短事务，避免网络调用和用户交互；
- 一次处理适量记录；
- 正确处理错误码 1213 和锁等待超时；
- 使用 `SHOW ENGINE INNODB STATUS` 等信息分析。

## 14. 长事务的危害

长事务会：

- 长时间持有锁；
- 阻止旧版本及时清理，使 undo 膨胀；
- 增大复制延迟和恢复成本；
- 占用连接并放大故障影响。

事务中不要等待用户输入、调用远程接口或处理大文件。先准备数据，再快速进入事务完成数据库修改。

## 15. 一致的转账模板

```sql
START TRANSACTION;

SELECT id, balance
FROM account
WHERE id IN (1, 2)
ORDER BY id
FOR UPDATE;

UPDATE account
SET balance = balance - 100
WHERE id = 1 AND balance >= 100;

UPDATE account
SET balance = balance + 100
WHERE id = 2;

INSERT INTO transfer_log(from_id, to_id, amount)
VALUES (1, 2, 100);

COMMIT;
```

应用需要检查账户数量、每条更新的受影响行数和所有错误；任一条件不满足就回滚。`ORDER BY id` 有助于统一锁顺序，但执行计划和实际锁行为仍需验证。

## 16. 常见误区

- 认为事务能自动保证业务逻辑正确；
- 忘记检查受影响行数；
- 事务中执行远程调用；
- 认为普通 `SELECT` 一定加锁；
- 认为 MVCC 能解决所有写写冲突；
- 以为提交后还能回滚；
- 随意修改全局隔离级别，忽略只影响新会话；
- 只会解释脏读，却不了解锁定读、版本链和 Read View；
- 遇到死锁直接报错给用户，不做事务级重试。

事务设计的核心是边界：哪些操作必须一起成功、哪些资源按什么顺序锁定、失败时如何回滚和重试。边界越清晰，系统越可靠。

## 17. 参考

- [MySQL 8.4 SET TRANSACTION](https://dev.mysql.com/doc/refman/8.4/en/set-transaction.html)
- [InnoDB 锁与语句](https://dev.mysql.com/doc/refman/8.4/en/innodb-locks-set.html)
- [InnoDB Deadlocks](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks.html)
