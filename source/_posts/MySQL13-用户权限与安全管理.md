---
title: MySQL 用户与权限管理：账户、授权、回收与最小权限
date: 2026-08-21 12:10:00
categories:
  - MySQL
tags:
  - MySQL
  - 用户管理
  - 权限
  - 数据库安全
---

MySQL 账户由“用户名 + 来源主机”共同确定。安全管理的目标不是给应用一个能连接的账户，而是让每个服务、人员和自动化任务只拥有完成职责所需的最小权限，并且能够审计、轮换和回收。

<!-- more -->

## 1. 账户身份

```text
'app'@'localhost'
'app'@'10.0.0.%'
'app'@'%'
```

它们是三个不同账户。`'app'@'%'` 范围最宽，不应因配置方便而默认使用。

查看当前身份：

```sql
SELECT USER(), CURRENT_USER();
```

## 2. 创建用户

```sql
CREATE USER 'shop_app'@'10.0.0.%'
IDENTIFIED BY '由密钥系统生成的高强度密码';
```

密码不应硬编码在 SQL 仓库、源码或命令历史中。实际部署应通过密钥管理系统注入，并使用 TLS 保护远程连接。

使用服务器默认身份认证插件即可，除非兼容性评估明确要求其他插件。不要为了兼容旧客户端长期强制使用过时认证方案。

## 3. 查看账户

管理员可查看账户元数据：

```sql
SELECT user, host, plugin, account_locked, password_expired
FROM mysql.user;
```

普通业务账户不应获得读取系统授权表的权限。需要了解自身权限时使用：

```sql
SHOW GRANTS;
SHOW GRANTS FOR 'shop_app'@'10.0.0.%';
```

## 4. 授权

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON shop.*
TO 'shop_app'@'10.0.0.%';
```

只读账户：

```sql
CREATE USER 'shop_readonly'@'10.0.1.%' IDENTIFIED BY '...';
GRANT SELECT ON shop.* TO 'shop_readonly'@'10.0.1.%';
```

授权可以限定到全局、数据库、表、列或例程。应用通常不需要 `CREATE USER`、`GRANT OPTION`、`FILE`、`PROCESS` 等高危权限。

现代 MySQL 中 `GRANT` 不再承担创建用户和设置密码的职责，应先 `CREATE USER`，再 `GRANT`。

## 5. 回收权限

```sql
REVOKE DELETE
ON shop.*
FROM 'shop_app'@'10.0.0.%';
```

回收后检查：

```sql
SHOW GRANTS FOR 'shop_app'@'10.0.0.%';
```

不要依赖旧教程中的 `FLUSH PRIVILEGES` 作为每次 `GRANT`/`REVOKE` 的固定步骤。正常账户管理语句会使权限变更生效；只有绕过这些语句直接修改授权表等特殊情况才涉及重新加载，而且不推荐直接改表。

## 6. 修改密码与账户状态

```sql
ALTER USER 'shop_app'@'10.0.0.%'
IDENTIFIED BY '新的高强度密码';

ALTER USER 'shop_app'@'10.0.0.%' ACCOUNT LOCK;
ALTER USER 'shop_app'@'10.0.0.%' ACCOUNT UNLOCK;

ALTER USER 'shop_app'@'10.0.0.%' PASSWORD EXPIRE;
```

密码轮换应与连接池、灰度发布和回滚方案配合，避免瞬间造成全量连接失败。

## 7. 删除用户

```sql
DROP USER IF EXISTS 'shop_app'@'10.0.0.%';
```

离职、服务下线或临时任务结束后应及时回收账户。删除前确认该账户是否是视图、存储程序或事件的 `DEFINER`，否则对象可能失效。

## 8. 角色

MySQL 8.0 可使用角色集中管理权限：

```sql
CREATE ROLE 'shop_reader', 'shop_writer';

GRANT SELECT ON shop.* TO 'shop_reader';
GRANT SELECT, INSERT, UPDATE, DELETE ON shop.* TO 'shop_writer';

GRANT 'shop_reader' TO 'analyst'@'10.0.2.%';
SET DEFAULT ROLE 'shop_reader' TO 'analyst'@'10.0.2.%';
```

角色减少重复授权，但仍要定期审计角色本身是否过宽。

## 9. TLS 与来源限制

```sql
ALTER USER 'shop_app'@'10.0.0.%' REQUIRE SSL;
```

数据库账户的 `host` 限制不能替代防火墙、私有网络和 TLS。应组合使用：

- 只监听必要地址；
- 网络访问控制；
- TLS 证书校验；
- 最小权限账户；
- 密钥轮换；
- 登录和审计日志。

## 10. 应用账户实践

不同职责使用不同账户：

| 账户 | 权限 |
| --- | --- |
| 运行时应用 | 业务表所需 DML |
| 只读分析 | 指定库表 `SELECT` |
| 迁移工具 | 受控 DDL，限时启用 |
| 备份账户 | 备份所需最小权限 |
| 运维管理员 | 通过审计流程使用高权限 |

不要让应用长期使用 `root`，也不要多个服务共享同一个账户，否则无法隔离权限和追踪来源。

## 11. 常见误区

- 认为用户名相同就是同一账户，忽略 `host`；
- 所有应用都使用 `root`；
- 为方便直接授权 `*.*` 和 `ALL PRIVILEGES`；
- 在源码或镜像中保存密码；
- 把 `GRANT OPTION` 给普通业务账户；
- 远程连接不启用 TLS；
- 每次授权后机械执行 `FLUSH PRIVILEGES`；
- 删除账户前不检查 `DEFINER` 依赖；
- 账户创建后从不审计、不轮换、不回收。

数据库安全的核心是缩小爆炸半径：账户越专用、来源越受限、权限越少，单个凭据泄露造成的影响越可控。
