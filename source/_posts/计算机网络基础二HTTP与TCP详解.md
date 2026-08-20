---
title: 计算机网络基础（二）：HTTP报文与TCP可靠传输机制
date: 2026-08-20 16:00:00
categories:
  - Linux
tags:
  - 计算机网络
  - HTTP
  - TCP
  - 滑动窗口
  - 拥塞控制
---

应用层决定“数据表达什么”，传输层解决“怎样把字节交给另一端的应用”。HTTP 与 TCP 正好对应这两层的典型问题：HTTP 规定请求和响应的语义，TCP 提供可靠、有序、双向的字节流。

本文先分析 HTTP/1.1 报文，再深入 TCP 首部、三次握手、四次挥手、确认重传、滑动窗口、流量控制与拥塞控制。

<!-- more -->

## 一、应用层协议的作用

应用层协议需要规定：

- 消息类型；
- 字段格式和编码；
- 一条消息的边界；
- 请求与响应的对应关系；
- 错误码；
- 状态如何保存；
- 版本如何演进。

如果客户端直接把 C 结构体写到网络：

```c
struct request {
    int a;
    int b;
};
```

会遇到大小端、整数宽度、结构体填充、版本兼容以及 TCP 无消息边界等问题。因此跨平台协议应定义稳定的线上格式，而不是把本机内存布局当协议。

## 二、URL 的组成

```text
https://example.com:8443/articles?id=42#comments
```

| 部分 | 示例 | 含义 |
| --- | --- | --- |
| scheme | `https` | 使用的方案 |
| host | `example.com` | 主机名 |
| port | `8443` | 端口，可省略默认值 |
| path | `/articles` | 资源路径 |
| query | `id=42` | 查询参数 |
| fragment | `comments` | 客户端片段，不随普通 HTTP 请求发送 |

URI 中某些字节用 `%HH` 表示。通用百分号编码中空格是 `%20`；HTML 表单的 `application/x-www-form-urlencoded` 常把空格编码为 `+`。不要把“`+` 等于空格”扩展到所有 URI 场景。

## 三、HTTP 的基本性质

HTTP 是请求/响应式应用层协议。

- HTTP/1.1 和 HTTP/2 通常运行在 TCP 上；
- HTTP/3 运行在 QUIC 上，QUIC 通常承载于 UDP；
- HTTPS 表示 HTTP 通过 TLS 获得机密性、完整性与身份认证。

HTTP/1.1 是文本式消息，HTTP/2 和 HTTP/3 使用二进制帧，但方法、状态码和字段等核心语义相互继承。

## 四、HTTP/1.1 请求

```http
POST /api/sum HTTP/1.1
Host: example.com
Content-Type: application/json
Content-Length: 13
Connection: keep-alive

{"a":1,"b":2}
```

逻辑结构：

```text
请求行 + CRLF
若干头字段，每行以 CRLF 结束
一个空行
可选消息体
```

请求行：

```text
方法 SP 请求目标 SP HTTP版本 CRLF
```

HTTP/1.1 线上换行使用 CRLF，头部以连续两个 CRLF 结束。

## 五、HTTP/1.1 响应

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 9
Connection: keep-alive

{"sum":3}
```

状态行：

```text
HTTP版本 SP 状态码 SP 原因短语 CRLF
```

原因短语主要供人阅读，程序应依据三位状态码判断。

## 六、HTTP 方法

| 方法 | 典型用途 | 安全方法 | 幂等 |
| --- | --- | --- | --- |
| `GET` | 获取资源表示 | 是 | 是 |
| `HEAD` | 获取与 GET 对应的头部语义 | 是 | 是 |
| `POST` | 提交数据或触发处理 | 否 | 通常不是 |
| `PUT` | 创建或整体替换目标资源 | 否 | 是 |
| `PATCH` | 部分修改 | 否 | 不保证 |
| `DELETE` | 删除资源 | 否 | 是 |
| `OPTIONS` | 查询通信选项 | 是 | 是 |
| `CONNECT` | 建立隧道 | 否 | 否 |

“安全”表示定义意图为只读，不代表完全没有日志或计费副作用。“幂等”表示重复执行的预期效果等同于执行一次，不代表每次响应字节完全相同。

## 七、HTTP 状态码

| 范围 | 含义 |
| --- | --- |
| `1xx` | 信息性响应 |
| `2xx` | 成功 |
| `3xx` | 重定向 |
| `4xx` | 客户端请求问题 |
| `5xx` | 服务器处理问题 |

常见状态：

| 状态码 | 名称 | 含义 |
| --- | --- | --- |
| `200` | OK | 请求成功 |
| `201` | Created | 成功创建资源 |
| `204` | No Content | 成功但无响应体 |
| `301` | Moved Permanently | 永久重定向 |
| `302` | Found | 临时重定向的常见用法 |
| `304` | Not Modified | 协商缓存命中 |
| `400` | Bad Request | 请求格式或语义错误 |
| `401` | Unauthorized | 需要认证 |
| `403` | Forbidden | 拒绝执行请求 |
| `404` | Not Found | 资源未找到 |
| `405` | Method Not Allowed | 方法不适用于目标资源 |
| `413` | Content Too Large | 请求内容过大 |
| `429` | Too Many Requests | 请求过于频繁 |
| `500` | Internal Server Error | 服务端内部错误 |
| `502` | Bad Gateway | 网关从上游收到无效响应 |
| `503` | Service Unavailable | 服务暂时不可用 |
| `504` | Gateway Timeout | 网关等待上游超时 |

`502` 才是 Bad Gateway，`504` 是 Gateway Timeout。

## 八、常见 HTTP 字段

| 字段 | 作用 |
| --- | --- |
| `Host` | 指定目标主机与可选端口 |
| `Content-Type` | 消息体的媒体类型 |
| `Content-Length` | 消息体的十进制字节长度 |
| `Transfer-Encoding` | HTTP/1.1 传输编码，如 chunked |
| `Connection` | 当前连接的逐跳控制选项 |
| `Location` | 重定向目标或新资源位置 |
| `Cookie` | 客户端发送 Cookie |
| `Set-Cookie` | 服务端要求保存 Cookie |
| `Authorization` | 认证凭据 |
| `Accept` | 客户端可接受的媒体类型 |
| `User-Agent` | 客户端软件信息 |
| `Referer` | 请求来源 URI，历史拼写就是 `Referer` |
| `Cache-Control` | 缓存策略 |
| `ETag` | 表示的验证器 |

字段名大小写不敏感，但字段值语义取决于具体字段定义。

## 九、HTTP 消息边界

TCP 只提供字节流，HTTP 解析器必须自行判断消息何时完整。

### 9.1 首部边界

持续读取直到找到“两个连续 CRLF”，并限制：

- 最大首部长度；
- 最大字段数量；
- 单字段长度；
- 读取超时。

### 9.2 Content-Length

如果消息允许且带有合法 `Content-Length`，应继续读取指定字节数。它表示字节数，不是字符数：

```cpp
std::string body = u8"你好";
std::size_t content_length = body.size();
```

### 9.3 Chunked 编码

HTTP/1.1 的 chunked 编码由十六进制块长度、块数据和终止块组成。解析器必须处理扩展、尾字段和大小限制，不能把块大小行当成消息体。

### 9.4 连接关闭

某些响应可以用连接关闭界定消息体结束，但这会妨碍连接复用。应优先遵循协议规定的明确消息边界。

### 9.5 请求走私风险

代理与后端对 `Content-Length`、`Transfer-Encoding` 或重复字段解释不同，可能造成 HTTP request smuggling。生产环境优先采用成熟 HTTP 库，并严格拒绝歧义报文。

## 十、favicon.ico

浏览器可能自动发起：

```http
GET /favicon.ico HTTP/1.1
```

这是新的独立请求，不是服务器重复解析了原请求。服务端可以返回图标、`404` 或合适的空响应。

## 十一、Cookie 与 Session

HTTP 本身是无状态协议，应用可通过 Cookie 携带会话标识：

```http
Set-Cookie: session_id=opaque-token; Path=/; Secure; HttpOnly; SameSite=Lax
```

后续请求：

```http
Cookie: session_id=opaque-token
```

安全建议：

- 会话 ID 使用密码学安全随机数；
- 使用 `Secure`、`HttpOnly` 和合适的 `SameSite`；
- 服务端保存过期与撤销状态；
- 不在 Cookie 中直接存放口令或敏感明文。

## 十二、持久连接

HTTP/1.1 默认支持持久连接。服务端需要维护：

- 输入缓冲区；
- 已解析消息长度；
- 剩余未解析字节；
- 输出缓冲区；
- keep-alive 条件；
- 空闲超时与最大请求数；
- 请求和响应顺序。

“读到一些字节就响应并关闭”只能作为极简实验，不能代表完整 HTTP/1.1 服务器。

## 十三、TCP 提供什么

TCP 向应用提供：

- 连接导向；
- 可靠传输；
- 按序交付；
- 字节流；
- 全双工；
- 流量控制；
- 拥塞控制。

TCP 不提供：

- 应用消息边界；
- 业务事务语义；
- 默认加密和身份认证；
- 永不掉线的保证；
- 对端业务已经处理数据的证明。

## 十四、TCP 首部字段

| 字段 | 作用 |
| --- | --- |
| 源端口、目的端口 | 分用到通信端点 |
| 序列号 | 当前段第一个数据字节的序号 |
| 确认号 | 期望收到的下一个序号 |
| 数据偏移 | TCP 首部长度 |
| 标志位 | SYN、ACK、FIN、RST、PSH、URG、ECE、CWR |
| 窗口 | 接收方通告的可接收数据量 |
| 校验和 | 检查首部、数据和伪首部 |
| 选项 | MSS、窗口扩大、时间戳、SACK 等 |

TCP 校验和是 16 位反码和，不是 CRC。以太网 FCS 常使用 CRC，这是不同层次的校验机制。

## 十五、序列号与确认

TCP 为字节流中的字节编号。若接收方已经连续收到序号到 `5000` 的字节，它可返回：

```text
ACK = 5001
```

表示下一个期望字节是 `5001`。TCP 主要使用累计确认。

ACK 只表示对端 TCP 已接收相应字节，不代表对端业务已写数据库或完成事务。

## 十六、重传机制

### 16.1 超时重传

发送方为未确认数据维护重传计时器，根据测得的 RTT 与波动估计 RTO。超时后重传并执行相应退避。

现代 TCP 不能简化为“固定按 500 ms 的整数倍重传”。

### 16.2 快速重传

中间段丢失而后续段到达时，接收方会重复确认当前缺口。经典快速重传在收到足够重复 ACK 后重传缺失数据，不必等待 RTO。

现代实现还可能结合 SACK、RACK 等机制改进恢复。

## 十七、三次握手

```text
客户端 -> 服务器：SYN，seq=x
服务器 -> 客户端：SYN+ACK，seq=y，ack=x+1
客户端 -> 服务器：ACK，ack=y+1
```

核心作用：

1. 确认双向通信路径基本可用；
2. 同步初始序列号；
3. 协商 MSS、窗口扩大、SACK permitted、时间戳等选项；
4. 建立双方 TCP 状态。

典型流程不是两次，因为服务器需要确认客户端已经收到服务器的初始序列号；也不固定为四次，因为服务器的 SYN 和对客户端 SYN 的 ACK 可以合并。

## 十八、listen 与连接队列

Linux 监听端涉及未完成握手状态和已完成握手、等待 `accept` 的连接队列。

`listen` 的 `backlog` 主要影响等待应用接收的连接队列提示上限，实际值还受 `somaxconn`、SYN 队列、SYN cookies 和内核版本影响。

因此：

- `backlog` 不是总并发连接数上限；
- 不要把实验中的 `backlog + 1` 当成跨系统定律；
- 应结合 `ss`、内核指标和压测判断队列溢出。

```bash
sysctl net.core.somaxconn
ss -lnt
```

## 十九、四次挥手

```text
A -> B：FIN
B -> A：ACK
B -> A：FIN
A -> B：ACK
```

TCP 是全双工协议。A 不再发送，不代表 B 也立即完成发送，因此两个方向独立关闭。

如果 B 的 ACK 与 FIN 合并，抓包中可能只看到三段，但状态机语义没有改变。

## 二十、TCP 重要状态

服务端常见路径：

```text
LISTEN -> SYN-RECEIVED -> ESTABLISHED
ESTABLISHED -> CLOSE-WAIT -> LAST-ACK -> CLOSED
```

主动关闭方常见路径：

```text
ESTABLISHED -> FIN-WAIT-1 -> FIN-WAIT-2
            -> TIME-WAIT -> CLOSED
```

## 二十一、TIME_WAIT

主动关闭方通常等待 2MSL，主要为了：

1. 对端若未收到最后 ACK，可重发 FIN并再次得到应答；
2. 让旧连接的延迟报文消失，避免影响后续同五元组连接。

`tcp_fin_timeout` 主要与某些 FIN-WAIT-2 管理相关，不能简单等同于 TIME_WAIT 的 2MSL。

服务重启可以合理使用 `SO_REUSEADDR`，但不应把 TIME_WAIT 当作必须粗暴清除的垃圾状态。

## 二十二、CLOSE_WAIT

CLOSE_WAIT 表示内核已收到对端 FIN，但本地应用尚未关闭套接字。

少量短暂 CLOSE_WAIT 正常；大量长期堆积通常意味着：

- 忘记 `close`；
- 描述符仍被其他对象持有；
- 线程卡住；
- 异常路径泄漏。

```bash
ss -antp state close-wait
lsof -nP -p PID
```

## 二十三、滑动窗口

若每发一小段都等待 ACK，带宽时延积较大时吞吐会很低。滑动窗口允许在未收到逐段确认前连续发送一定范围的数据。

发送缓冲区可概念上分为：

1. 已确认，可释放；
2. 已发送，尚未确认；
3. 当前窗口允许发送；
4. 暂时不允许发送。

累计 ACK 到来后窗口向前滑动，新字节进入可发送范围。

## 二十四、流量控制

流量控制保护接收端。接收方通过窗口字段通告剩余接收能力，发送方控制在途数据量。

窗口扩大选项可对 16 位窗口字段应用协商的移位因子，以适应高带宽时延积网络。

接收窗口为 0 时，发送端会进行窗口探测，避免双方永久等待。

## 二十五、拥塞控制

拥塞控制保护网络。两个关键窗口：

- `rwnd`：接收方通告窗口；
- `cwnd`：发送方维护的拥塞窗口。

实际发送范围受二者较小值及其他状态约束：

```text
send_window ≈ min(rwnd, cwnd)
```

经典教学模型包括慢启动、拥塞避免、快速重传和快速恢复。现代 Linux 可使用 CUBIC、BBR 等不同算法，不能认为所有实现都严格遵循一张旧式锯齿图。

```bash
sysctl net.ipv4.tcp_congestion_control
sysctl net.ipv4.tcp_available_congestion_control
```

## 二十六、延迟确认与捎带确认

- **延迟确认**：接收端可能短暂等待，减少纯 ACK 报文或通告更合适的窗口；
- **捎带确认**：接收方正好有业务数据要发送时，在同一 TCP 段中携带 ACK。

应用不能依赖每段数据都立刻收到一个独立 ACK，也不能把 ACK 当作业务响应。

## 二十七、面向字节流与“粘包”

所谓“粘包”，本质是应用误以为 TCP 保留 `send` 边界。

解决方式：

- 固定长度；
- 分隔符；
- 长度字段；
- 完整协议解析。

接收循环：

```text
recv -> 追加到输入缓冲区
     -> 尝试解析完整消息
     -> 移除已消费部分
     -> 继续解析下一条
     -> 数据不足时等待下次可读
```

## 二十八、TCP 与 UDP

| 问题 | TCP | UDP |
| --- | --- | --- |
| 消息边界 | 应用自行定义 | 保留数据报边界 |
| 丢包恢复 | TCP 内核实现 | 应用按需实现 |
| 顺序 | 按序字节流 | 可能乱序 |
| 拥塞控制 | 协议必需 | 应用协议应负责任实现 |
| 建连 | 维护连接状态 | 可直接发送 |
| 多播/广播 | 普通 TCP 不支持 | UDP 可配合 IP 多播/广播 |

选择协议要看业务目标，不是简单判断谁“更快”。

## 二十九、抓包观察

```bash
sudo tcpdump -ni any 'tcp port 9090'
sudo tcpdump -ni any -vvv -X 'host 192.0.2.10 and tcp'
```

Wireshark 过滤器：

```text
tcp.port == 9090
ip.addr == 192.0.2.10
http
tcp.analysis.retransmission
```

重点观察 SYN/ACK/FIN、序列号、确认号、窗口、重传与重复 ACK。

HTTPS 中 HTTP 内容已加密，普通抓包通常只能看到 TLS 记录和部分握手元数据。

## 三十、常见误区

1. HTTP 一定运行在 TCP 上：HTTP/3 运行在 QUIC 上；
2. 一次 `recv` 就是一条 HTTP 请求：TCP 不保留边界；
3. `Content-Length` 是字符数：它是字节数；
4. `504` 是 Bad Gateway：`502` 才是；
5. TCP 校验和是 CRC：它使用反码和；
6. ACK 表示业务完成：ACK 只反映 TCP 接收状态；
7. `backlog` 是总连接上限：错误；
8. TIME_WAIT 都是程序故障：它是正常可靠关闭机制；
9. CLOSE_WAIT 是内核清理太慢：长期堆积通常是应用未关闭；
10. TCP 可靠等于永不掉线：网络和进程仍会失败。

## 三十一、参考规范

- HTTP Semantics：<https://www.rfc-editor.org/rfc/rfc9110>
- HTTP/1.1：<https://www.rfc-editor.org/rfc/rfc9112>
- TCP：<https://www.rfc-editor.org/rfc/rfc9293>

## 三十二、总结

1. HTTP 定义请求方法、目标资源、字段、状态码和消息体语义。
2. HTTP/1.1 使用 CRLF 和明确消息边界，不能依赖一次 TCP 读取。
3. TCP 通过序列号、确认、重传和状态机提供可靠有序字节流。
4. 三次握手同步状态与选项，连接终止体现为双向独立关闭。
5. TIME_WAIT 保证关闭可靠性，CLOSE_WAIT 长期堆积通常是应用泄漏。
6. 滑动窗口提高吞吐，流量控制保护接收端，拥塞控制保护网络。
7. 应用仍需负责消息边界、业务确认、超时、安全与资源限制。

