# 工序合成系统

`fabrication` 模块提供无网格配方、设施能力门禁和热键栏/背包原子事务。领域层保持纯 TypeScript；React 只负责展示可用配方，Zustand 负责持有当前设施上下文并提交合成结果。

## 模块职责

- `CraftingTypes.ts`：配方、材料选择器、能力、背包快照与失败原因等领域契约。
- `ProcessRecipeRegistry.ts`：配方唯一注册、定义校验与冻结。
- `InventoryTransaction.ts`：在克隆背包上完成扣料和产出插入，全部成功后才返回新状态。
- `CraftingService.ts`：查询配方、校验全部工序能力并调用背包事务。
- `CoreRecipes.ts`：核心能力标识与内置配方定义。
- `CraftingRuntime.ts`：接入 `ItemRegistry` 的运行时目录及手工能力集合。

## 配方契约

`IngredientSelector` 支持精确 `itemType` 或 `tag`。同时提供两者时采用交集语义：物品类型和标签必须同时匹配。输入与输出数量必须是正整数，非法定义会在注册阶段被拒绝。

每个 `ProcessStep.capability` 都必须存在于当前能力集合，配方才可执行。`durationSeconds` 当前仅是工序元数据；本模块执行的是即时合成，不负责计时、燃料消耗或任务队列。

## 原子事务

事务始终深拷贝每个物品堆叠，不修改调用方传入的数组或对象。输入分配会构建一个确定性的二分容量流网络：

1. 源节点到物品槽位的容量为该槽位数量。
2. 匹配选择器的槽位与需求节点相连，需求节点到汇点的容量为所需数量。
3. 使用 Edmonds-Karp 寻找完整最大流；只有总流量满足全部需求时才扣减工作副本。
4. 节点与边按热键栏、普通背包、槽位索引及配方需求顺序创建，因此相同输入始终得到相同分配。
5. 产出先合并同类未满堆叠，再按热键栏、普通背包顺序占用空槽。

容量流不会按物品数量逐件展开。设非空槽位数与需求数之和为 `V`、网络边数为 `E`，分配复杂度上界为 `O(V * E^2)`；当前玩家背包最多 63 个槽位，计算规模由槽位和配方输入数共同约束。任一输入不足或任一产出无法完整插入时，整个工作副本被丢弃，返回 `missing_ingredients` 或 `inventory_full`，原背包保持不变。

## 能力与状态边界

`playerSlice` 是当前合成能力的唯一权威来源：

- 未打开设施时，只授予 `HAND_CRAFTING_CAPABILITIES`。
- 打开设施后，只使用该设施写入的 `craftingCapabilities`；空数组不会回退为手工能力。
- `craftRecipe(recipeId)` 不接受调用方能力参数，避免 UI 或其他调用者自行提权。
- 关闭或切换背包、关闭容器时必须清空 `activeFixtureId` 和能力列表。

`Inventory` 根据 `activeFixtureId` 派生实际页签。设施活动期间始终显示生存背包和合成面板，不通过 effect 同步本地页签，也不允许创意页签覆盖设施上下文。桌面端的 `CraftingPanel` 位于背包右侧，窄屏时降级为纵向布局；它仅展示当前能力完整支持的配方，每条配方以一个主产出格呈现。悬浮或键盘聚焦配方格时才展示完整产出、材料清单和材料状态，点击材料齐备的格子提交合成，材料不足的格子保留可发现性但不会提交事务。

## 扩展流程

1. 在 `CoreRecipes.ts` 或独立内容包中声明配方，并通过 `ProcessRecipeRegistry` 注册。
2. 新标签统一由 `ItemRegistry` 提供，并同步补充本地化名称。
3. 新设施能力由设施组件写入 store，禁止在组件中临时拼接或伪造能力。
4. 修改选择器、事务或能力规则时，更新 `Crafting.test.ts`、store 目录测试和视图目录测试。

目录级验证命令：

```powershell
npm run test:run -- src/game/fabrication src/store src/components/views
```
