# 设施系统架构规范（Fixtures）

设施是独立于体素网格的世界对象，用于箱子、火炉、构装台等需要实例状态、交互能力和独立渲染生命周期的内容。设施不能写入 `World` 的方块数组；体素只负责地形，`WorldFixtureManager` 负责设施占用、状态和存档。

## 1. 模块职责

- `FixtureDefinitions.ts`：声明核心设施定义，并创建冻结后的核心注册表。
- `FixtureRegistry.ts`：注册和查询定义，验证 footprint 与组件契约。
- `WorldFixtureManager.ts`：管理放置、旋转占用、组件实例、移除、存档恢复和视图生命周期。
- `FixtureInteraction.ts`：把组件组合解析为容器或工作台交互描述。
- `ThreeFixtureView.ts`：创建可射线命中的 Three.js 对象，共享并释放几何体与材质。
- `FixtureTypes.ts`：定义注册态、运行态、存档 carrier 与端口类型。

## 2. 定义与能力组件

`FixtureDefinition` 是不可变的类型定义。每个定义必须满足以下约束：

- `footprint` 至少包含一个整数网格坐标，且坐标不能重复。
- 同一种组件每个定义最多出现一次；当前管理 API 不支持多个同类型组件寻址。
- `container` 与 `fuel` 的槽位数必须是正整数。
- `crafting` 与 `processor` 至少声明一个非空且不重复的 capability ID。

运行时通过组件组合能力，不通过设施 ID 分支行为：

- `container`：持有固定容量的物品槽位。
- `fuel`：持有固定容量的燃料槽位。
- `crafting`：提供即时制作能力。
- `processor`：提供处理能力并持有处理进度。

核心定义为：箱子（27 槽容器）、火炉（3 槽容器、1 槽燃料、加热处理能力）、构装台（9 槽容器及构装能力）。

## 3. 放置、占用与生命周期

`WorldFixtureManager.place` 先验证锚点为整数网格坐标、朝向为 `0..3`，非法输入返回 `invalid_placement`，且不能调用世界端口或 ID 工厂。随后旋转 footprint，再依次检查设施占用层和 `FixtureWorldPort.canOccupy`。放置成功后才创建组件状态、登记实例并挂载视图。ID 工厂必须生成非空唯一 ID；冲突属于生命周期不变量错误，不得覆盖旧实例。

视图挂载失败时，管理器必须回滚实例和 footprint，并调用 `detach` 补偿可能发生的部分挂载。`remove` 必须对称释放 footprint 占用并调用 `FixtureViewPort.detach`。`dispose` 会移除所有实例，然后调用视图的 `dispose`。`ThreeFixtureView` 按定义共享 geometry/material；单个实例移除时只脱离场景，视图销毁时统一释放 GPU 资源。

`setContainerSlots` 只接受与注册容量完全一致的槽位数组。非空槽位必须使用已知 `ItemType`，且数量必须为正整数；校验失败返回 `false` 并保留原状态。

设施射线检测会临时收紧调用方 `Raycaster.far`，并保证正常或异常路径都恢复原值。体素与设施同时命中时，由 `resolveWorldInteractionTarget` 选择距离更近的目标。

`core/GameFixtureRuntime` 负责把核心设施注册表、世界占位查询和 Three 视图装配为 GameManager 可用的运行时；`core/FixtureInteractionCoordinator` 负责最近目标、选择框、打开设施、创造模式拆除和放置朝向。设施模块本身不得依赖 React 组件或 GameManager。

## 4. 存档 Carrier 契约

`FixtureSnapshot` 使用版本化 carrier，不直接复用完整运行时组件：

- 保存设施 ID、定义 ID、锚点、朝向和组件顺序。
- `container` / `fuel` 只保存槽位，`processor` 只保存进度，`crafting` 不保存派生状态。
- capability 始终从当前注册定义重建，存档不能注入或固化过期能力。

恢复前必须完整验证 schema、ID、整数坐标、朝向、定义存在性、组件种类/数量、槽位容量、物品堆叠、重复 ID、重叠占用和世界阻挡。所有设施先在临时 Map 中完成验证和重建，只有整个快照有效时才进入提交阶段。

提交阶段同时管理领域 Map 与视图生命周期。任一旧视图卸载或新视图挂载失败时，必须先恢复旧 `fixtures` / `occupancy`，再卸载全部新设施视图并重新挂载旧视图。视图补偿成功时抛出以原提交错误为 `cause` 的错误；补偿也失败时使用 `AggregateError` 汇总提交与补偿错误。无论视图补偿结果如何，领域 Map 都必须保持恢复前状态。

## 5. 测试与验证

设施测试按职责拆分：`Fixtures.test.ts` 覆盖管理器事务与快照，`FixtureRegistry.test.ts` 覆盖定义和交互描述，`ThreeFixtureView.test.ts` 覆盖射线检测与 GPU 生命周期；共享测试定义集中在 `FixtureTestFixtures.ts`。常规修改至少运行：

```powershell
npm run test:run -- src/game/fixtures
```

交付前同时执行项目规定的 `npm run lint`、`npx tsc -b` 和 `npm run build`。
