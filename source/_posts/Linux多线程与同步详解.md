---
title: Linux多线程与同步详解：pthread、互斥锁、条件变量与线程池
date: 2026-08-20 15:30:00
categories:
  - Linux
tags:
  - Linux
  - 多线程
  - pthread
  - 互斥锁
  - 条件变量
  - 线程池
---

线程是进程内部的执行流。多个线程共享同一进程的大部分资源，因此创建和切换成本通常低于进程，但共享也会带来数据竞争、死锁、丢失唤醒和生命周期管理等问题。

本文以 POSIX Threads 为主线，讲解线程创建、退出、等待、分离，以及互斥锁、条件变量、信号量、读写锁、生产者消费者模型和线程池设计。

<!-- more -->

## 一、进程与线程

### 1.1 线程是什么

线程可以理解为进程内部的一条执行路线。一个进程至少包含一个线程，即执行 `main` 的主线程。

Linux 内核使用任务结构调度执行流，用户通常通过 pthread 接口创建 POSIX 线程。不要简单把线程理解成“只有一小段代码的进程”，更重要的是它与同进程线程之间的资源共享关系。

### 1.2 线程共享什么

同一进程中的线程通常共享：

- 虚拟地址空间中的代码段、全局区和堆；
- 打开的文件描述符；
- 当前工作目录和根目录；
- 用户与组身份；
- 信号处置方式；
- 大部分进程级资源。

线程各自拥有：

- 栈；
- 寄存器上下文和程序计数器；
- 调度状态；
- 线程 ID；
- 信号掩码；
- `errno`；
- 线程局部存储。

### 1.3 线程的优点

1. 同一地址空间内交换数据方便；
2. 创建和切换通常比进程轻量；
3. 能在多核 CPU 上并行执行；
4. 一个线程等待 I/O 时，其他线程仍可工作；
5. 适合线程池、流水线和后台任务。

### 1.4 线程的代价

1. 一个线程非法访问内存可能终止整个进程；
2. 共享数据需要同步；
3. 锁竞争会降低性能；
4. 时序错误难以复现；
5. 线程过多会增加栈内存、调度和缓存开销；
6. 同一进程内部缺乏进程级故障隔离。

## 二、pthread 基础

头文件与编译选项：

```c
#include <pthread.h>
```

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic thread.c -pthread -o thread
```

推荐使用 `-pthread`，它不只是链接库，还会启用与线程相关的编译配置。

pthread 函数大多直接返回错误码，不一定设置 `errno`：

```c
int rc = pthread_create(...);
if (rc != 0) {
    fprintf(stderr, "pthread_create: %s\n", strerror(rc));
}
```

## 三、创建线程

```c
int pthread_create(pthread_t *thread,
                   const pthread_attr_t *attr,
                   void *(*start_routine)(void *),
                   void *arg);
```

参数：

- `thread`：接收线程标识；
- `attr`：线程属性，传 `NULL` 使用默认属性；
- `start_routine`：线程入口函数；
- `arg`：传给入口函数的指针。

### 3.1 基本示例

```c
#define _POSIX_C_SOURCE 200809L

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct task_arg {
    int id;
    const char *message;
};

static void *worker(void *argument)
{
    const struct task_arg *arg = argument;
    printf("worker %d: %s\n", arg->id, arg->message);

    int *result = malloc(sizeof(*result));
    if (result != NULL) {
        *result = arg->id * 2;
    }
    return result;
}

int main(void)
{
    pthread_t thread;
    struct task_arg arg = { .id = 21, .message = "hello" };

    int rc = pthread_create(&thread, NULL, worker, &arg);
    if (rc != 0) {
        fprintf(stderr, "pthread_create: %s\n", strerror(rc));
        return EXIT_FAILURE;
    }

    void *raw_result = NULL;
    rc = pthread_join(thread, &raw_result);
    if (rc != 0) {
        fprintf(stderr, "pthread_join: %s\n", strerror(rc));
        return EXIT_FAILURE;
    }

    int *result = raw_result;
    if (result != NULL) {
        printf("result = %d\n", *result);
        free(result);
    }

    return EXIT_SUCCESS;
}
```

### 3.2 参数生命周期

传给线程的 `arg` 只是一个指针。必须确保线程使用它时对象仍然存在。

常见错误：

```c
for (int i = 0; i < 4; ++i) {
    pthread_create(&threads[i], NULL, worker, &i);
}
```

所有线程得到的是同一个 `i` 的地址，并且读取时值可能已经变化。可以为每个线程准备独立数组元素或动态对象。

## 四、线程标识

```c
pthread_t pthread_self(void);
int pthread_equal(pthread_t t1, pthread_t t2);
```

`pthread_t` 是实现定义的“不透明类型”，不要假设它一定是整数、地址或 Linux 内核 TID。

比较两个 pthread 标识应使用 `pthread_equal`，不要依赖 `==` 的可移植性。

Linux 内核线程 ID 可通过 `gettid()` 获得，但它与 `pthread_t` 不是同一个概念。

## 五、线程退出

工作线程常见退出方式：

1. 入口函数 `return`；
2. 调用 `pthread_exit`；
3. 被其他线程请求取消；
4. 整个进程通过 `exit`、`_exit`、`return main` 或致命信号结束。

```c
void pthread_exit(void *retval);
```

返回值不能指向已经失效的线程栈局部变量：

```c
/* 错误：函数返回后 local 已失效 */
int local = 42;
return &local;
```

可以返回：

- 动态分配对象，由 `join` 方释放；
- 生命周期足够长的共享对象；
- 经 `intptr_t` 谨慎编码的小整数，但可读性通常不如结构体。

主线程调用 `pthread_exit(NULL)` 可结束主线程而让其他线程继续，但多数应用更推荐明确 `join` 所有工作线程。

## 六、等待与分离

### 6.1 `pthread_join`

```c
int pthread_join(pthread_t thread, void **retval);
```

`join` 的作用：

- 等待目标线程终止；
- 获取线程返回值；
- 回收 joinable 线程资源。

一个 joinable 线程应由且仅由一个线程执行 `join`。

### 6.2 `pthread_detach`

```c
int pthread_detach(pthread_t thread);
```

分离线程退出后由系统自动回收，不能再 `join`。适合真正不需要返回值、且程序能可靠管理整体退出的后台任务。

“每个连接创建一个 detached 线程”虽然简单，但高并发下会产生大量线程。实际服务器通常使用线程池或事件驱动模型。

## 七、线程取消

```c
int pthread_cancel(pthread_t thread);
```

取消不是无条件强杀。默认是延迟取消：目标线程执行到取消点时才响应。

如果线程持锁或管理资源，需要用清理处理器或 RAII 确保取消时释放资源。随意启用异步取消会让程序在任意指令位置停止，极难保证一致性。

工程中更推荐协作式停止：

1. 设置停止标志；
2. 唤醒条件变量或事件；
3. 让线程自行离开循环；
4. `join` 等待退出。

## 八、数据竞争与临界区

### 8.1 基本概念

- **临界资源**：多个执行流共同访问的资源；
- **临界区**：访问临界资源的代码区域；
- **互斥**：同一时刻只允许一个执行流进入关键区域；
- **原子操作**：从并发观察角度不可分割的操作；
- **数据竞争**：多个线程并发访问同一内存位置，至少一个是写，并且缺少适当同步。

在 C/C++ 内存模型中，数据竞争会导致未定义行为，不只是“结果偶尔少加几次”。

### 8.2 `i++` 为什么不是并发原子操作

普通 `i++` 通常包含读取、计算和写回。两个线程可能读取同一个旧值，然后分别写回，造成更新丢失。

解决方式取决于业务：

- 使用互斥锁保护复合不变量；
- 使用 C11/C++ 原子类型处理简单计数；
- 把数据限制在线程内部；
- 通过消息队列转移所有权。

## 九、互斥锁

### 9.1 初始化和销毁

静态初始化：

```c
pthread_mutex_t mutex = PTHREAD_MUTEX_INITIALIZER;
```

动态初始化：

```c
pthread_mutex_t mutex;
pthread_mutex_init(&mutex, NULL);
pthread_mutex_destroy(&mutex);
```

动态初始化的锁在不再使用且没有线程持有或等待时销毁。

### 9.2 加锁与解锁

```c
pthread_mutex_lock(&mutex);

/* 临界区 */

pthread_mutex_unlock(&mutex);
```

其他接口：

```c
pthread_mutex_trylock(&mutex);
pthread_mutex_timedlock(&mutex, &deadline);
```

`trylock` 失败不应进入忙等死循环，除非已经证明这比阻塞或事件通知更合适。

### 9.3 缩小临界区

锁内只放必须一起保护的共享状态，不要轻易在持锁时执行：

- 长时间 I/O；
- 网络请求；
- `sleep`；
- 不受控制的回调；
- 复杂内存分配；
- 再次获取未知锁。

临界区过大会降低并发度，过小又可能破坏业务不变量。应围绕“不变量”确定锁边界，而不是机械地只锁一行。

## 十、死锁

典型死锁：

```text
线程 A 持有锁 1，等待锁 2
线程 B 持有锁 2，等待锁 1
```

预防策略：

1. 所有代码遵守统一的锁顺序；
2. 避免持锁调用外部回调；
3. 减少嵌套锁；
4. 必要时使用 `trylock` 或带超时锁；
5. 用 RAII 保证异常和提前返回时解锁；
6. 在设计文档中记录锁保护的数据与顺序。

C++ 可使用：

```cpp
std::scoped_lock lock(mutex_a, mutex_b);
```

它能以避免死锁的方式同时获取多个互斥量。

## 十一、条件变量

互斥锁保护共享状态，条件变量让线程在“条件不满足”时休眠，并在状态变化后被唤醒。

```c
int pthread_cond_wait(pthread_cond_t *cond,
                      pthread_mutex_t *mutex);
int pthread_cond_signal(pthread_cond_t *cond);
int pthread_cond_broadcast(pthread_cond_t *cond);
```

### 11.1 为什么 `wait` 必须配合互斥锁

`pthread_cond_wait` 会原子完成：

1. 释放互斥锁；
2. 进入等待；
3. 被唤醒后重新获取互斥锁；
4. 返回调用者。

这样避免“释放锁后、真正睡眠前”错过通知。

### 11.2 为什么必须使用 `while`

正确模式：

```c
pthread_mutex_lock(&mutex);

while (!condition_is_true()) {
    pthread_cond_wait(&condition, &mutex);
}

/* 在锁保护下消费条件对应的资源 */

pthread_mutex_unlock(&mutex);
```

不能只用 `if`，原因包括：

- 允许虚假唤醒；
- 多个等待者被唤醒后，条件可能先被其他线程消费；
- 通知只是“状态可能变化”，共享状态才是真正条件。

## 十二、完整的有界阻塞队列示例

下面用互斥锁和两个条件变量实现单生产者、单消费者模型。设计同样支持扩展到多个生产者和消费者。

```c
#define _POSIX_C_SOURCE 200809L

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

enum { CAPACITY = 8, ITEM_COUNT = 30 };

struct queue {
    int data[CAPACITY];
    size_t head;
    size_t tail;
    size_t size;
    int closed;
    pthread_mutex_t mutex;
    pthread_cond_t not_empty;
    pthread_cond_t not_full;
};

static void fail_pthread(int error, const char *operation)
{
    if (error != 0) {
        fprintf(stderr, "%s: %s\n", operation, strerror(error));
        exit(EXIT_FAILURE);
    }
}

static void queue_init(struct queue *q)
{
    q->head = 0;
    q->tail = 0;
    q->size = 0;
    q->closed = 0;
    fail_pthread(pthread_mutex_init(&q->mutex, NULL), "mutex init");
    fail_pthread(pthread_cond_init(&q->not_empty, NULL), "not_empty init");
    fail_pthread(pthread_cond_init(&q->not_full, NULL), "not_full init");
}

static void queue_destroy(struct queue *q)
{
    fail_pthread(pthread_cond_destroy(&q->not_empty), "not_empty destroy");
    fail_pthread(pthread_cond_destroy(&q->not_full), "not_full destroy");
    fail_pthread(pthread_mutex_destroy(&q->mutex), "mutex destroy");
}

static int queue_push(struct queue *q, int value)
{
    fail_pthread(pthread_mutex_lock(&q->mutex), "push lock");

    while (q->size == CAPACITY && !q->closed) {
        fail_pthread(pthread_cond_wait(&q->not_full, &q->mutex), "push wait");
    }

    if (q->closed) {
        fail_pthread(pthread_mutex_unlock(&q->mutex), "push unlock");
        return 0;
    }

    q->data[q->tail] = value;
    q->tail = (q->tail + 1U) % CAPACITY;
    ++q->size;

    fail_pthread(pthread_cond_signal(&q->not_empty), "signal not_empty");
    fail_pthread(pthread_mutex_unlock(&q->mutex), "push unlock");
    return 1;
}

static int queue_pop(struct queue *q, int *value)
{
    fail_pthread(pthread_mutex_lock(&q->mutex), "pop lock");

    while (q->size == 0 && !q->closed) {
        fail_pthread(pthread_cond_wait(&q->not_empty, &q->mutex), "pop wait");
    }

    if (q->size == 0 && q->closed) {
        fail_pthread(pthread_mutex_unlock(&q->mutex), "pop unlock");
        return 0;
    }

    *value = q->data[q->head];
    q->head = (q->head + 1U) % CAPACITY;
    --q->size;

    fail_pthread(pthread_cond_signal(&q->not_full), "signal not_full");
    fail_pthread(pthread_mutex_unlock(&q->mutex), "pop unlock");
    return 1;
}

static void queue_close(struct queue *q)
{
    fail_pthread(pthread_mutex_lock(&q->mutex), "close lock");
    q->closed = 1;
    fail_pthread(pthread_cond_broadcast(&q->not_empty), "broadcast not_empty");
    fail_pthread(pthread_cond_broadcast(&q->not_full), "broadcast not_full");
    fail_pthread(pthread_mutex_unlock(&q->mutex), "close unlock");
}

static void *producer(void *argument)
{
    struct queue *q = argument;
    for (int i = 1; i <= ITEM_COUNT; ++i) {
        if (!queue_push(q, i)) {
            break;
        }
    }
    queue_close(q);
    return NULL;
}

static void *consumer(void *argument)
{
    struct queue *q = argument;
    long sum = 0;
    int value = 0;

    while (queue_pop(q, &value)) {
        sum += value;
    }

    printf("sum = %ld\n", sum);
    return NULL;
}

int main(void)
{
    struct queue q;
    queue_init(&q);

    pthread_t producer_thread;
    pthread_t consumer_thread;
    fail_pthread(pthread_create(&producer_thread, NULL, producer, &q),
                 "create producer");
    fail_pthread(pthread_create(&consumer_thread, NULL, consumer, &q),
                 "create consumer");

    fail_pthread(pthread_join(producer_thread, NULL), "join producer");
    fail_pthread(pthread_join(consumer_thread, NULL), "join consumer");

    queue_destroy(&q);
    return EXIT_SUCCESS;
}
```

编译运行：

```bash
gcc -std=c11 -Wall -Wextra -Wpedantic bounded_queue.c -pthread -o bounded_queue
./bounded_queue
```

## 十三、POSIX 信号量

```c
#include <semaphore.h>

int sem_init(sem_t *sem, int pshared, unsigned int value);
int sem_wait(sem_t *sem);
int sem_post(sem_t *sem);
int sem_destroy(sem_t *sem);
```

未命名信号量中：

- `pshared == 0`：在同一进程线程之间共享；
- `pshared != 0`：供进程间共享，但信号量对象必须放在真正的共享内存中，且平台支持该能力。

环形队列常使用两个计数信号量：

- `spaces`：剩余空槽数量，初值为容量；
- `items`：已有数据数量，初值为 0。

多生产者或多消费者还需保护读写下标，不能只依靠两个计数信号量就认为所有共享状态都安全。

## 十四、读写锁

读写锁允许：

- 多个读者同时持有读锁；
- 写者独占；
- 有写者时不允许其他读者或写者进入。

```c
pthread_rwlock_t lock = PTHREAD_RWLOCK_INITIALIZER;

pthread_rwlock_rdlock(&lock);
/* 只读访问 */
pthread_rwlock_unlock(&lock);

pthread_rwlock_wrlock(&lock);
/* 写访问 */
pthread_rwlock_unlock(&lock);
```

读写锁不一定比普通互斥锁快。只有读操作比例高、临界区足够长、锁竞争明显时才可能获益。具体的读者/写者公平策略具有实现差异，不能把“读者永远优先”当作可移植语义。

## 十五、线程安全与可重入

### 15.1 线程安全

多个线程并发调用时，函数能保持正确结果和共享状态一致性，可称为线程安全。

常见实现方式：

- 不共享可变状态；
- 使用互斥锁；
- 使用原子操作；
- 使用线程局部存储；
- 由调用者提供输出缓冲区。

### 15.2 可重入

函数在尚未执行完时又被再次调用，仍能正确工作，称为可重入。信号处理器可能造成异步重入，因此可重入要求通常比普通线程安全更严格。

一个使用互斥锁保护全局状态的函数可能线程安全，却不一定异步信号可重入：信号可能在同一线程持锁时打断它，处理器再次调用该函数会自锁死锁。

因此：

- 可重入通常意味着更强的状态隔离；
- 线程安全不自动等于信号处理器安全；
- “加锁后就是可重入”是错误说法。

## 十六、线程安全单例

旧式“双重检查 + `volatile` 指针”不能单独保证 C++ 内存模型下的安全发布。`volatile` 不建立线程间 happens-before 关系。

C++11 起，函数内静态对象的初始化由语言保证线程安全：

```cpp
class Config {
public:
    static Config& instance()
    {
        static Config object;
        return object;
    }

    Config(const Config&) = delete;
    Config& operator=(const Config&) = delete;

private:
    Config() = default;
};
```

需要显式一次性初始化时可使用 `std::call_once` 和 `std::once_flag`。

单例解决的是“只有一个实例”，不自动保证该实例内部成员函数线程安全。

## 十七、线程池设计

线程池通常包含：

1. 固定或可调数量的工作线程；
2. 任务队列；
3. 保护队列的互斥锁；
4. “有任务可取”的条件变量；
5. 容量限制或背压策略；
6. 停止标志；
7. 优雅关闭和强制关闭语义。

基本流程：

```text
提交者加锁 -> 任务入队 -> signal -> 解锁
工作线程加锁 -> while 队列空且未停止时 wait
              -> 取任务 -> 解锁 -> 执行任务
```

### 17.1 为什么任务要在锁外执行

如果工作线程持锁执行任务，其他线程无法取任务或提交任务，线程池会退化成串行执行。

### 17.2 停止策略

常见两种：

- **drain**：不再接收新任务，但处理完队列中已有任务；
- **cancel pending**：丢弃尚未开始的任务，运行中的任务协作停止。

析构函数必须明确采取哪种策略，不能让工作线程继续访问已经销毁的队列和互斥量。

### 17.3 队列必须有上限

无界队列在流量持续超过处理能力时会不断占用内存。生产服务器应设计：

- 最大任务数；
- 提交超时；
- 拒绝策略；
- 调用方降级或限流；
- 队列长度与等待时间监控。

## 十八、性能与调试

### 18.1 线程数不是越多越好

CPU 密集型任务的工作线程数通常接近可用 CPU 核数；I/O 密集型任务可以更多，但最终应通过负载测试确定。

过多线程会造成：

- 上下文切换增加；
- 栈内存增加；
- 缓存抖动；
- 锁竞争；
- 调度尾延迟上升。

### 18.2 常用工具

```bash
top -H -p PID
ps -L -p PID -o pid,tid,psr,stat,comm
gdb ./program
```

GDB 中：

```gdb
info threads
thread apply all bt
thread 3
```

检测数据竞争可以使用 ThreadSanitizer：

```bash
gcc -g -O1 -fsanitize=thread program.c -pthread -o program_tsan
./program_tsan
```

ThreadSanitizer 与 AddressSanitizer 通常不在同一次构建中组合使用。

## 十九、常见错误

1. 将同一个循环变量地址传给所有线程；
2. 返回线程栈局部变量地址；
3. 忘记 `join` 或 `detach`；
4. pthread 接口失败后只打印 `perror`，忽略其直接返回的错误码；
5. 用 `if` 代替 `while` 检查条件变量谓词；
6. 在持锁期间执行长时间 I/O 或外部回调；
7. 锁顺序不一致导致死锁；
8. 用 `volatile` 代替原子变量或互斥锁；
9. 线程池使用无界任务队列；
10. 销毁仍被线程使用的互斥锁、条件变量或任务对象。

## 二十、总结

1. 线程共享地址空间，通信方便，但故障隔离和并发安全更难。
2. pthread 创建成功后，应明确线程由谁 `join`，或何时 `detach`。
3. 互斥锁保护共享不变量，条件变量负责在状态不满足时高效等待。
4. 条件变量必须和互斥锁配合，并使用 `while` 重新检查谓词。
5. 信号量适合计数资源，读写锁适合经过验证的多读少写场景。
6. C++11 局部静态对象比“`volatile` 双重检查”更适合实现线程安全单例。
7. 线程池需要背压、停止语义、资源回收和可观测性，而不仅是“队列 + 若干线程”。

