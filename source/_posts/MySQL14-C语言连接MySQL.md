---
title: C 语言连接 MySQL：Connector/C、结果集与安全查询
date: 2026-08-21 12:20:00
categories:
  - MySQL
tags:
  - MySQL
  - C语言
  - Connector/C
  - libmysqlclient
  - Prepared Statement
---

MySQL C API 通过 `libmysqlclient` 提供对客户端/服务器协议的底层访问。完整流程包括初始化、配置连接、执行 SQL、区分结果集与受影响行数、释放资源和关闭连接。业务代码还必须解决凭据、超时、字符集、SQL 注入和断线处理问题。

<!-- more -->

## 1. 安装与编译

不同发行版的软件包名称可能是 MySQL Connector/C、MySQL Client Development 或兼容的 MariaDB Connector/C。优先使用 `pkg-config` 获取参数：

```bash
pkg-config --cflags --libs mysqlclient
pkg-config --cflags --libs mariadb
```

编译：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic main.c \
  $(pkg-config --cflags --libs mysqlclient) -o mysql_demo
```

如果运行时找不到动态库，应通过系统包、`ldconfig`、rpath 或规范的部署环境解决。临时设置 `LD_LIBRARY_PATH` 可用于测试，但不应成为无法追踪的生产依赖。

## 2. 基本调用流程

```text
mysql_library_init
mysql_init
mysql_options
mysql_real_connect
mysql_real_query / mysql_query
mysql_store_result / mysql_use_result
mysql_fetch_row
mysql_free_result
mysql_close
mysql_library_end
```

单线程程序可由 `mysql_init` 间接完成库初始化，但显式调用更清晰；多线程程序应在线程创建前完成全局初始化，并遵守目标客户端库的线程规则。

## 3. 连接

```c
MYSQL *conn = mysql_init(NULL);
if (conn == NULL) {
    /* 客户端内存初始化失败 */
}

if (mysql_real_connect(conn, host, user, password, database,
                       port, NULL, 0) == NULL) {
    fprintf(stderr, "connect failed: %s\n", mysql_error(conn));
}
```

参数含义依次是连接句柄、主机、用户名、密码、默认数据库、端口、Unix socket 和客户端标志。

业务程序不要硬编码凭据，可从受控环境变量、配置中心或密钥管理系统读取。生产远程连接还应配置 TLS 和连接/读写超时。

## 4. 执行查询

`mysql_query()` 接收以 `\0` 结尾的 SQL；`mysql_real_query()` 额外接收长度，适合明确长度或包含二进制数据的查询：

```c
const char *sql = "SELECT id, name FROM users ORDER BY id LIMIT 10";
if (mysql_real_query(conn, sql, (unsigned long)strlen(sql)) != 0) {
    fprintf(stderr, "query failed: %s\n", mysql_error(conn));
}
```

## 5. 结果集

```c
MYSQL_RES *result = mysql_store_result(conn);
```

- `mysql_store_result()` 把全部结果取到客户端，后续读取方便，但大结果集占用内存；
- `mysql_use_result()` 流式取行，内存小，但取完之前连接不能执行新查询，且处理过慢会占用服务端资源。

读取元数据和行：

```c
unsigned int column_count = mysql_num_fields(result);
MYSQL_FIELD *fields = mysql_fetch_fields(result);

MYSQL_ROW row;
while ((row = mysql_fetch_row(result)) != NULL) {
    unsigned long *lengths = mysql_fetch_lengths(result);
    for (unsigned int i = 0; i < column_count; ++i) {
        if (row[i] == NULL) {
            printf("NULL");
        } else {
            printf("%.*s", (int)lengths[i], row[i]);
        }
    }
}
```

不能用 `strlen(row[i])` 处理可能包含 `\0` 的二进制列；应使用 `mysql_fetch_lengths()`。SQL `NULL` 在 `MYSQL_ROW` 中表现为 C 空指针。

## 6. `mysql_store_result()` 返回 NULL

返回 `NULL` 可能有两种含义：

1. 语句本来就不返回结果集，如 `UPDATE`；
2. 本应返回结果集，但发生错误。

用 `mysql_field_count()` 区分：

```c
MYSQL_RES *result = mysql_store_result(conn);
if (result == NULL) {
    if (mysql_field_count(conn) == 0) {
        printf("affected rows: %llu\n",
               (unsigned long long)mysql_affected_rows(conn));
    } else {
        fprintf(stderr, "result error: %s\n", mysql_error(conn));
    }
}
```

## 7. 一份完整可运行的查询程序

```c
#include <mysql.h>

#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char *env_or(const char *name, const char *fallback)
{
    const char *value = getenv(name);
    return value != NULL && value[0] != '\0' ? value : fallback;
}

int main(void)
{
    const char *host = env_or("DB_HOST", "127.0.0.1");
    const char *user = env_or("DB_USER", "app_user");
    const char *password = getenv("DB_PASSWORD");
    const char *database = env_or("DB_NAME", "test");
    const char *port_text = env_or("DB_PORT", "3306");
    char *end = NULL;
    unsigned long parsed_port = strtoul(port_text, &end, 10);

    if (password == NULL || end == port_text || *end != '\0' ||
        parsed_port == 0 || parsed_port > 65535UL) {
        fputs("invalid configuration\n", stderr);
        return EXIT_FAILURE;
    }

    if (mysql_library_init(0, NULL, NULL) != 0) {
        fputs("mysql client library initialization failed\n", stderr);
        return EXIT_FAILURE;
    }

    MYSQL *conn = mysql_init(NULL);
    if (conn == NULL) {
        fputs("mysql_init failed\n", stderr);
        mysql_library_end();
        return EXIT_FAILURE;
    }

    unsigned int connect_timeout = 5;
    if (mysql_options(conn, MYSQL_OPT_CONNECT_TIMEOUT, &connect_timeout) != 0 ||
        mysql_options(conn, MYSQL_SET_CHARSET_NAME, "utf8mb4") != 0) {
        fprintf(stderr, "mysql_options failed: %s\n", mysql_error(conn));
        mysql_close(conn);
        mysql_library_end();
        return EXIT_FAILURE;
    }

    if (mysql_real_connect(conn, host, user, password, database,
                           (unsigned int)parsed_port, NULL, 0) == NULL) {
        fprintf(stderr, "connect failed: %s\n", mysql_error(conn));
        mysql_close(conn);
        mysql_library_end();
        return EXIT_FAILURE;
    }

    const char sql[] =
        "SELECT id, name FROM users ORDER BY id LIMIT 20";
    if (mysql_real_query(conn, sql, (unsigned long)(sizeof(sql) - 1)) != 0) {
        fprintf(stderr, "query failed: %s\n", mysql_error(conn));
        mysql_close(conn);
        mysql_library_end();
        return EXIT_FAILURE;
    }

    MYSQL_RES *result = mysql_store_result(conn);
    if (result == NULL) {
        fprintf(stderr, "result failed: %s\n", mysql_error(conn));
        mysql_close(conn);
        mysql_library_end();
        return EXIT_FAILURE;
    }

    unsigned int columns = mysql_num_fields(result);
    MYSQL_FIELD *fields = mysql_fetch_fields(result);
    for (unsigned int i = 0; i < columns; ++i) {
        printf("%s%s", i == 0 ? "" : "\t", fields[i].name);
    }
    putchar('\n');

    MYSQL_ROW row;
    while ((row = mysql_fetch_row(result)) != NULL) {
        unsigned long *lengths = mysql_fetch_lengths(result);
        if (lengths == NULL) {
            fprintf(stderr, "fetch lengths failed: %s\n", mysql_error(conn));
            mysql_free_result(result);
            mysql_close(conn);
            mysql_library_end();
            return EXIT_FAILURE;
        }
        for (unsigned int i = 0; i < columns; ++i) {
            printf("%s", i == 0 ? "" : "\t");
            if (row[i] == NULL) {
                fputs("NULL", stdout);
            } else {
                fwrite(row[i], 1, lengths[i], stdout);
            }
        }
        putchar('\n');
    }

    if (mysql_errno(conn) != 0) {
        fprintf(stderr, "fetch failed: %s\n", mysql_error(conn));
    }

    mysql_free_result(result);
    mysql_close(conn);
    mysql_library_end();
    return EXIT_SUCCESS;
}
```

## 8. Prepared Statement 防止 SQL 注入

绝不能这样拼接用户输入：

```c
snprintf(sql, sizeof(sql), "SELECT * FROM users WHERE name='%s'", input);
```

应使用预处理接口：

```c
MYSQL_STMT *stmt = mysql_stmt_init(conn);
const char sql[] = "SELECT id, name FROM users WHERE id = ?";
mysql_stmt_prepare(stmt, sql, sizeof(sql) - 1);

MYSQL_BIND parameter[1];
memset(parameter, 0, sizeof(parameter));
unsigned long long id = 100;
parameter[0].buffer_type = MYSQL_TYPE_LONGLONG;
parameter[0].buffer = &id;
parameter[0].is_unsigned = 1;
mysql_stmt_bind_param(stmt, parameter);
mysql_stmt_execute(stmt);
```

完整代码还必须绑定结果、检查每一步返回值并调用 `mysql_stmt_close()`。预处理参数只能替代“值”，不能替代表名、列名或排序方向；这些结构部分应使用固定白名单。

## 9. 事务 API

```c
mysql_autocommit(conn, 0);

if (mysql_query(conn, "UPDATE ...") != 0 ||
    mysql_query(conn, "INSERT ...") != 0) {
    mysql_rollback(conn);
} else if (mysql_commit(conn) != 0) {
    mysql_rollback(conn);
}

mysql_autocommit(conn, 1);
```

必须检查每次调用返回值。连接中断后的事务结果可能未知，不应盲目重放非幂等操作。

## 10. 多线程与连接池

- 每个并发线程/任务应独占一个活动连接，不能无锁共享同一 `MYSQL*`；
- 在线程创建前完成库级初始化；
- 连接池要验证连接健康、设置最大生命周期与空闲超时；
- 归还连接前回滚未结束事务并恢复会话状态；
- 不要依赖自动重连掩盖事务状态丢失。

## 11. 常见错误

- 把密码硬编码进源码；
- SQL 使用字符串拼接；
- 连接后没有设置字符集和超时；
- 不检查 API 返回值，只看是否崩溃；
- 忘记 `mysql_free_result`、`mysql_stmt_close` 或 `mysql_close`；
- 把 SQL `NULL` 当成字符串 `"NULL"`；
- 用 `strlen` 处理二进制结果；
- 使用 `mysql_use_result` 时长时间不读完；
- 多线程共享连接；
- 断线后自动重试写操作，造成重复提交。

## 12. 参考

- [MySQL 8.4 C API 基本接口](https://dev.mysql.com/doc/c-api/8.4/en/c-api-basic-interface-usage.html)
- [mysql_real_connect](https://dev.mysql.com/doc/c-api/8.4/en/mysql-real-connect.html)
- [mysql_use_result](https://dev.mysql.com/doc/c-api/8.4/en/mysql-use-result.html)
