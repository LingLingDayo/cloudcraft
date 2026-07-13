# 游戏基础契约模块

`foundation` 提供不包含任何具体玩法的基础契约，供各领域模块组合使用。该目录不得依赖 React、Zustand、Three.js、DOM、IndexedDB 或 Web Worker 实例。

## 类型化定义注册表

`DefinitionRegistry` 管理带稳定字符串 ID 的不可变定义。注册阶段拒绝重复 ID；启动校验完成后必须调用 `freeze()`，运行中禁止继续修改内容集合。存档持久化字符串 ID，紧凑数字句柄只能作为运行时优化。

## 生命周期内核

`RuntimeKernel` 根据 `RuntimeSystem.dependencies` 进行拓扑排序，按依赖顺序初始化和更新，并按相反顺序释放。初始化失败时已初始化系统会立即回收；释放阶段会尝试处理所有系统后再汇总异常。

## 缓冲领域事件

`BufferedDomainEventBus` 的 `publish()` 只写入当前事件缓冲区，`flush()` 才执行订阅者。事件处理过程中产生的新事件留到下一次 `flush()`，避免在实体或设施遍历期间重入修改集合。高频物理计算不得通过该总线逐对象派发。

## 快照契约

所有持久化数据使用 `SnapshotEnvelope`，至少携带上下文 ID、Schema 版本、Codec ID 与 Revision。领域实体只输出纯数据快照，不实现存储介质相关逻辑；Codec 与 Migrator 由持久化适配层注册。
