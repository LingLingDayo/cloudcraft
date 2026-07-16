# 生物与实体架构规范

`entities` 负责可更新世界实体的领域模型、生物行为状态、运动能力组合、物种定义与版本化快照。该模块不得把具体物种判断散落到 `AnimalManager` 或渲染循环中。

## 分层职责

- `Entity` 定义实体身份、位置、速度、生命值和持久化入口。
- `Animal` 组合 `BehaviorStateMachine` 与 `MovementModeController`，统一执行行为决策、运动求解和表现同步；可选挂载 `SpeciesCombatProfile` 驱动对人类的捕猎 HFSM。
- `behavior` 提供支持父状态的 HFSM。状态进入、更新、退出和**声明式转移**必须由状态机调度；物种应优先 `registerTransition`，禁止在全局管理器分支。
- `movement` 提供运动模式注册表与优先级选择器。地面、游泳、飞行等能力通过模式组合，而非物种继承层级实现。
- `sensing` 提供视线（`hasBlockLineOfSight`）、局部植被采样与人类目标解析，供生成与战斗共用。
- `species` 保存物种工厂、生成权重、栖息地偏好、运动模式列表与可选战斗档案；运行期只依赖 `SpeciesDefinition`。
- `EntitySnapshot` 是存档数据载体，存储层不得直接序列化 Three.js 对象或行为实例。

工厂入口仅为 `SpeciesRegistry`（经 `AnimalManager` 注入）。已废弃的静态 `EntityRegistry` 不再使用。

## 生物扩展契约

新增物种时必须：

1. 新增继承 `Animal` 的物种类，构造时将物种 `movementModeIds`（及可选 `combat` / 自定义 `movementModeRegistry`）传给基类。
2. 在 `CoreSpecies` 或独立扩展包中注册 `SpeciesDefinition`，通过栖息地权重控制生成。
3. 使用 HFSM 状态表达捕猎、逃跑、休息等行为；禁止在全局管理器中增加物种类型分支。
4. 若 `hostileToHumans: true`，必须提供完整 `SpeciesCombatProfile`（与 `hostileToHumans: false` 互斥）；战斗参数由 `Animal` 底座消费，物种文件只负责外观与动画。
5. 将需要恢复的行为状态、计时器与运动模式写入实体 `customData`，并保持对旧字段缺失的兼容。
6. 为生成选择、状态转换、运动模式优先级、视线/栖息与快照恢复增加目录级测试。

`Pig` 与 `Leopard` 均遵循该契约：构造函数接收运动模式集合；`Leopard` 通过 `combat` 启用 stalking/attacking 声明式转移。未来物种不得要求底座识别其类名。

## 运动模式扩展

`MovementMode` 通过 `canActivate(context)` 声明当前环境是否可用，通过 `update(context, deltaSeconds)` 修改复用的运动上下文。

**选择优先级由物种配置的 `movementModeIds` 从前到后决定**（先匹配先激活），与核心注册表的 register 顺序无关。互斥条件应保证同一时刻至多一个模式激活。

扩展方式：

1. 实现新模式并赋予稳定 ID。
2. 使用 `registerCoreMovementModes` + 自定义注册，或 `createExtendedMovementModeRegistry(extraModes)` 得到可注入注册表。
3. 在物种 `create` 时通过 `AnimalOptions.movementModeRegistry` 注入；**不要**修改已冻结的 `coreMovementModeRegistry`。
4. 物种 `movementModeIds` 中声明该 ID 的优先顺序。

核心 `Animal` 更新管线与其它物种文件在“仅新增模式实现”场景下无需修改。

## 敌对与视线

- `hostileToHumans` + `combat` 由注册表在 `register` 时校验一致性。
- 捕猎距离判定可叠加 `requireLineOfSight`：不透明可碰撞方块阻断感知；树叶/植株不阻断。
- 惊慌（`panicked`）由伤害强制切入，声明式转移的 `when` 必须排除惊慌态，避免被攻击后立刻重回追击。

## 生命周期与性能红线

- 高频 `update()` 禁止创建临时向量、集合或闭包；运动上下文和尺寸对象由生物实例复用。
- HFSM lineage 与运动模式实例必须在注册或配置变更时解析并缓存；逐帧更新只遍历缓存，禁止重新构造数组、`Set` 或查询注册表。
- `Animal.dispose()` 必须调用 HFSM 的 `dispose()` 退出当前状态；`AnimalManager` 释放几何体和材质时必须对共享引用去重，拥有监听器或计时器的扩展实体也必须在 `dispose` 提供对称释放路径。
- 实体遍历期间不得直接修改实体集合，新增和移除应由管理器在安全边界统一处理。
- 快照只保存稳定字符串 ID 和纯数据，不保存注册表句柄、类实例或渲染资源；瞬时字段（如 `activeMovementModeId`）不得写入存档。
- `customData` 只能包含有限数字、字符串、布尔值、`null`、数组和普通对象组成的递归 `EntitySnapshotValue`，不得使用 `any`、Three.js 对象或循环引用。
- 创建快照时必须深拷贝扩展数据；恢复前必须一次性校验 Schema、实体数组、唯一 ID、数值范围、扩展数据结构以及全部物种注册。未知物种必须报告物种 ID 与实体 ID，并在创建任何新动物、修改当前动物集合或挂载场景对象前使整次恢复失败。
- 通过预检后，恢复先在场景外暂存全部动物并完成反序列化，再统一挂载和替换旧集合。构造、反序列化或挂载失败时必须移除已挂载对象并对全部已暂存动物调用统一资源释放入口；统一存档边界会把该错误作为原始 `cause` 触发世界、设施、实体、天气与玩家状态补偿回滚。
- 统一存档边界兼容 `0.2.x` 的裸 `SerializedEntityData[]`：恢复前先迁移为 Schema 1 `EntitySnapshot`，将旧 `pig` 类型映射为 `cloudcraft:pig`，并将 `customData.aiState` 迁移为 `behaviorStateId`。该迁移只存在于持久化边界，不得在 `Pig` 或物种注册表中保留双 ID API。
- 行为恢复必须持久化 `aiTimer`（及敌对物种的 `attackCooldownSeconds`）；缺省惊慌计时器时补满惊慌时长，避免读档后首帧状态失真。
