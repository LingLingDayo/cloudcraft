# 动态材质与掉落体架构规范

`dynamics` 将具有连续运动表现的体素从静态世界网格中短暂分离，并在落地后写回世界。当前沙子是第一个实现；后续砾石、粉末等材料必须通过注册定义接入，不得修改模拟调度底座。

## 分层职责

- `DynamicMaterialRegistry` 注册稳定定义 ID、关联方块 ID、可替换方块集合、重力和终端速度，并在启动后冻结。
- `FallingVoxelSimulation` 只依赖 `FallingVoxelWorldPort`，负责脱离、定步长积分、跨格碰撞扫描和落地写回。
- `DynamicMaterialSystem` 组合模拟与可选表现端口，统一提供激活、逐帧更新和释放生命周期。
- `ThreeFallingVoxelView` 按方块材质复用 `InstancedMesh`，同步连续位置，不参与碰撞或世界写入。
- `DynamicMaterialSnapshot` 定义与运行时对象物理隔离的版本化活动体 carrier。
- `CoreDynamicMaterials` 负责装配内置定义和扩展包追加定义，并在装配完成后统一冻结。

## 扩展契约

新增可掉落方块时，在扩展包声明一个 `DynamicMaterialDefinition`，通过 `createCoreDynamicMaterialRegistry(additionalDefinitions)` 装配并注入 `World` 即可。定义必须使用唯一稳定 ID，并显式列出所有方块 ID、可替换方块、重力和终端速度。注册冲突、一个方块映射到多个定义或冻结后写入必须立即失败。

世界方块更新只调用 `DynamicMaterialSystem.tryActivate()`，不得判断沙子或其他具体方块类型。模拟成功脱离后立即把源体素替换为空气，并用源坐标去重；落地时只通过世界端口恢复体素，使区块 revision、网格重建和存档仍走统一世界写入链路。

## 连续模拟与渲染约束

- 大帧时间必须拆成不超过固定上限的积分步，并扫描下落路径跨过的全部格子，避免高速穿透。
- 同一源坐标在活动体落地前不得重复激活。
- `FallingVoxelWorldPort.isInWorldBounds()` 是越界回收的唯一边界来源；离开世界的活动体必须立即释放 body 与源坐标，禁止永久参与逐帧积分。
- 表现层使用按材质分组的固定容量实例缓冲；逐帧同步复用变换对象，不创建独立 Mesh。
- 超出单材质实例容量时只影响额外表现，不得中断领域模拟或丢失落地方块。
- 模拟规则不得依赖 Three.js、DOM、React 或 Zustand。

## 生命周期红线

`DynamicMaterialSystem.reset()` 清空活动体并同步空视图，但保留可复用 GPU 资源；切换世界 Seed 和加载缺少动态字段的旧存档必须调用该边界。`dispose()` 在 reset 后继续释放表现端口。`ThreeFallingVoxelView.dispose()` 必须从场景移除所有实例网格，释放共享几何体和每种材质，并允许在正常世界卸载路径中安全调用。

活动体快照使用 Schema 1，保存方块 ID、连续位置/速度与原始源坐标。恢复必须先完整校验结构、重复源、世界边界和注册定义，全部有效后才替换运行态；恢复过程不得写入静态世界。World 存档必须携带该快照，避免源体素已变为空气时退出造成材料永久丢失。

新增动态材质必须覆盖注册冲突、脱离去重、不同帧步长、跨格碰撞、落地写回和清理行为的目录级测试。
