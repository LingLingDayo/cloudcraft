# 区块可见性流送

本模块负责把“玩家可能看见的区块”转换为受限、可取消的生成与网格任务。运行时只保留拓扑可见区块及其一层安全缓冲，避免把完整渲染距离球体全部提交给 Worker。

## 数据流

1. `world.worker.ts` 在生成区块或构建网格时调用 `buildChunkVisibilitySummary`。
2. `ChunkVisibilityResolver` 从相机所在区块开始，结合矩形视锥候选与 portal 拓扑执行广度传播。
3. `directVisible` 保存通过视锥和拓扑传播直接可见的区块；`active` 在其外侧增加一层 `safetyBufferRadius`，用于遮挡方块被破坏后的无缝显示。
4. `WorldChunkManager` 只为 `active` 集合排队，并按玩家距离调度生成和网格任务。

## Portal 摘要

`ChunkVisibilitySummary` 是与区块体素分离的版本化数据载体：

- `openFacesMask` 使用 6 位记录透明连通分量接触到的区块边界面。
- `portalMask` 使用 15 位记录六个边界面两两之间是否存在透明连通路径。
- `chunkRevision` 将摘要绑定到产生它的区块版本。
- `schemaVersion` 用于拒绝旧结构摘要；修改摘要编码时必须同步提升版本。

透明性统一读取方块属性，不在流送模块硬编码方块类型。摘要洪泛属于区块级 CPU 工作，生产路径必须在 Worker 中执行。

## 未知摘要策略

缺失、版本不符或 revision 过期的摘要一律视为“未知”。未知区块允许传播，采用保守加载而不是错误裁剪；Worker 返回有效摘要后，`World` 只标记可见性缓存失效，下一次解析才收紧集合。

摘要变化本身不得推进 `streamingEpoch`。只有重新解析后 `active` 集合实际变化，epoch 才会增长，因此无拓扑影响的摘要更新不会取消有效任务。

## 相机量化与缓存

`GameManager` 持有一个复用的 `THREE.Vector3` 和一个复用的 `ChunkStreamingView` 普通对象。动画循环只更新相机位置、forward、弧度 FOV 与 aspect，不创建临时视图对象。

解析缓存由以下输入共同决定：

- 相机所在区块；
- 渲染半径；
- 量化后的 yaw/pitch；
- 定点化的 FOV/aspect；
- 以 4 个方块为边长量化的相机 X/Y/Z position bucket；
- 显式拓扑失效标记。

`ChunkStreamingViewCache` 是上述量化签名的唯一所有者：`WorldChunkManager` 只通过 `shouldResolve()` 判断是否重算，通过 `invalidate()` 响应摘要变化，并在 `clearCache()` 时对称调用 `clear()`。缓存模块不得依赖 World、Worker 或 Zustand。

Yaw bucket 采用环形归一化，`+pi` 与 `-pi` 是同一方向。相机仍位于相同 position bucket 且其他量化参数未变化时，不重复执行拓扑解析；同一 chunk 内跨 position bucket 仍必须解析。

实际裁剪使用相机 forward、right、up 标量基向量，将区块包围球分别与水平、垂直视锥平面做保守相交，不得退化为取最大 FOV 的外接圆锥。Manager 解析会把 position bucket 内最大三维位移作为额外球半径，保证 bucket 内任意精确视点的 `directVisible` 都包含在首次 `active` 中。相机近似垂直时使用稳定的备用轴构造 right；aspect、FOV、位置或方向无效时必须保守放行，避免错误卸载可见区块。

## 异步一致性

每个生成或网格任务在提交时捕获 `streamingEpoch`、区块 revision 与世界 seed。结果应用前必须同时满足：

- epoch 仍是当前 epoch；
- key 仍属于 `active`；
- revision 未变化；
- seed 未变化。

网格还使用 renderer version 防止同一 revision 内较晚提交的任务被旧结果覆盖。`applyChunkModifications` 比较实际体素字节：整批存在变化时只递增一次 revision 并丢弃旧摘要，重复应用相同数据不递增。生成结果应用存档修改后必须废弃基于原始体素的 Worker 摘要，并使用更新后的 revision 排队网格任务。`clearCache()` 会推进 epoch、清空队列和任务索引并卸载网格，尚未返回的 Worker 结果因此只能被丢弃。

## 调度与资源约束

生成和网格使用独立并发池，容量来自 `CHUNK_STREAMING_CONFIG.maxConcurrentGeneration` 与 `maxConcurrentMeshing`。一个池达到上限时，调度器仍尝试另一个池；两边都无可调度工作时立即退出，不能依赖时间预算推进来结束循环。Manager 提交前还必须读取 WorkerManager 的真实 idle slot，只允许任务直接进入空闲 worker，不把大量 epoch 任务堆入全局 FIFO。

每个任务以 `owner/type/key/epoch/revision/seed` 形成精确 identity。相同 identity 的 active/queued 请求共享 Promise；revision 或 seed 变化必须创建新 Promise，同时最新提交会 supersede 同 `owner/type/key/epoch` 下更旧的 queued 项，使每个 base key 最多保留一个 queued，已经 active 的旧任务不强杀。active 集合或 epoch 变化时，manager 取消自己 owner 下尚未 postMessage 的旧任务，被取消 Promise 统一以 `WorkerTaskCancelledError` 拒绝；已经进入 worker 的任务允许结束，再由 epoch/revision/seed guard 丢弃结果。

瞬时 generation/mesh 失败最多尝试 `maxWorkerTaskAttempts` 次。失败 item 只在 Promise settle 后重排到 manager 的下一帧队列，不创建 timer；成功、取消、过期、epoch 变化与 `clearCache()` 都清理对应尝试状态，达到上限才输出显式错误。

Worker 输出通过 `collectWorkerTransferables` 递归收集嵌套 TypedArray 的底层 `ArrayBuffer`，并按 buffer 去重，实现结果零拷贝传回。输入区块仍归 `World` 所有，网格任务不得转移并使其 detach。

无 `world.game`、显式 `sync`，或 WorkerManager 实际没有存活 worker 时保留同步回退，用于初始化、构造全部失败和测试。不能只用 `typeof Worker` 判断能力。零 live pool 的直接 `execute` 必须立即取消；`dispose()` 必须取消所有 active/queued callback 并清理 identity。worker 崩溃时必须先从池与 active 索引移除，再尝试重建；重建失败且池为空时拒绝全部无法调度的 queued Promise，仍有存活 worker则继续 FIFO，禁止向 terminated worker dispatch。direct mesh 的 supersede/cancel 属于正常控制流，不得记录成运行时错误。

## 扩展点

- 新透明或半透明方块：只扩展方块属性，摘要算法自动接入。
- 新 Worker 任务：扩展 `WorkerTaskPayloadMap`、`WorkerTaskResultMap` 和 Worker handler 注册，不修改现有任务契约。
- 新可见性策略：在 resolver 输入/结果边界内实现，保持 `directVisible` 与 `active` 语义不变。
- 新摘要格式：提升 schema version，并保持旧摘要按未知策略处理。
