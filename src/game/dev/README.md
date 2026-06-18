# CloudCraft 调试接口指南 (DevConsole)

为了方便开发者和浏览器 Agent 在开发环境（dev）下快速调试项目和测试 Bug，项目在全局挂载了 `window.__cloudcraft__` 命名空间。

> [!NOTE]
> 该调试接口仅在开发环境下启用。在生产环境构建（Production Build）时，所有调试代码均会通过 Vite 与打包工具的树摇（Tree Shaking）机制被完全剥离，不会污染生产环境。

---

## 1. 快速开始

在浏览器控制台（Console）中，输入以下命令可以获取所有可用调试命令的自描述列表：

```javascript
window.__cloudcraft__.meta.help();
```

该命令将以结构化表格的形式输出所有命令的命名空间、调用方式以及描述。

---

## 2. API 命名空间详解

调试接口分为六大域（Namespace）：`meta`、`player`、`world`、`time`、`render`、`store`。

### 2.1 Meta (元数据接口)
- **`window.__cloudcraft__.meta.help()`**
  - **功能**：在控制表中打印命令帮助表。
- **`window.__cloudcraft__.meta.version`**
  - **功能**：只读属性，返回当前游戏版本（例如 `"0.3.0"`）。
- **`window.__cloudcraft__.meta.seed()`**
  - **功能**：返回当前世界生成时所使用的种子（Seed）字符串。

### 2.2 Player (玩家控制接口)
- **`window.__cloudcraft__.player.teleport(x, y, z)`**
  - **功能**：将玩家瞬间传送至指定的 X, Y, Z 三维坐标。
  - **参数**：`x` (数字), `y` (数字), `z` (数字)。
- **`window.__cloudcraft__.player.teleportToBiome(biomeId)`**
  - **功能**：以玩家当前位置为中心，在约 5000 格半径范围内寻找最近的目标生态群系并传送。
  - **参数**：`biomeId` (字符串)。可选值有：`"forest"`、`"taiga"`、`"desert"`、`"jungle"`、`"plateau"`、`"stony_peaks"`、`"plains"`。
- **`window.__cloudcraft__.player.teleportToLandform(landformId)`**
  - **功能**：以玩家当前位置为中心，在约 5000 格半径范围内寻找最近的目标地形并传送。
  - **参数**：`landformId` (字符串)。可选值有：`"ocean"`、`"plains"`、`"hills"`、`"plateau"`、`"mountains"`。
- **`window.__cloudcraft__.player.setHealth(value)`**
  - **功能**：设置玩家的当前生命值。
  - **参数**：`value` (数字，取值范围 `[0, 10]`)。若设为 `0` 则会触发扣血死亡重生流程。
- **`window.__cloudcraft__.player.setHunger(value)`**
  - **功能**：设置玩家的当前饥饿值。
  - **参数**：`value` (数字，取值范围 `[0, 20]`)。
- **`window.__cloudcraft__.player.setFlying(enabled)`**
  - **功能**：开启或关闭玩家的飞行状态（注意：飞行状态仅在创造模式下有效，如果当前是生存模式，会自动切换为创造模式）。
  - **参数**：`enabled` (布尔值)。
- **`window.__cloudcraft__.player.getStatus()`**
  - **功能**：获取玩家当前状态快照。
  - **返回值**：
    ```typescript
    {
      position: { x: number, y: number, z: number },
      velocity: { x: number, y: number, z: number },
      life: number,
      hunger: number,
      isFlying: boolean,
      onGround: boolean
    }
    ```
- **`window.__cloudcraft__.player.respawn()`**
  - **功能**：强制玩家立刻在世界出生点重生。

### 2.3 World (世界编辑接口)
- **`window.__cloudcraft__.world.getBlock(x, y, z)`**
  - **功能**：获取指定坐标处的方块 ID。
  - **参数**：`x` (数字), `y` (数字), `z` (数字)。
- **`window.__cloudcraft__.world.setBlock(x, y, z, blockType)`**
  - **功能**：在指定坐标放置或破坏方块。
  - **参数**：`x` (数字), `y` (数字), `z` (数字), `blockType` (数字，参照方块配置 ID)。
- **`window.__cloudcraft__.world.fill(x1, y1, z1, x2, y2, z2, blockType)`**
  - **功能**：批量用指定的方块类型填充一个长方体区域。
  - **参数**：两组三维坐标及 `blockType`。
  - **限制**：为了防止单次填充方块数过多导致渲染和物理线程卡死，单次填充的方块总数最大限制为 **8192** 个。
- **`window.__cloudcraft__.world.getInfo()`**
  - **功能**：获取当前世界运行统计。
  - **返回值**：`{ seed: string, loadedChunks: number }`（包含当前已加载的区块数量）。
- **`window.__cloudcraft__.world.save()`**
  - **功能**：手动序列化当前世界的修改部分，并返回存档 JSON 字符串。

### 2.4 Time (环境与时间接口)
- **`window.__cloudcraft__.time.get()`**
  - **功能**：获取当前的游戏时间（单位：秒）。
- **`window.__cloudcraft__.time.set(value)`**
  - **功能**：设置游戏当前的绝对时间（单位：秒，将在一天周期内自动取模循环）。
  - **参数**：`value` (数字)。
- **`window.__cloudcraft__.time.setWeather(id)`**
  - **功能**：瞬间改变游戏天气。
  - **参数**：`id` (可选值：`"clear"` | `"rain"` | `"storm"`)。
- **`window.__cloudcraft__.time.setDimension(id)`**
  - **功能**：瞬间传送或切换维度。
  - **参数**：`id` (可选值：`"overworld"` | `"nether"` | `"cave"`)。

### 2.5 Render (渲染性能控制接口)
- **`window.__cloudcraft__.render.setRenderDistance(n)`**
  - **功能**：设置渲染区块距离并重新加载周边区域。
  - **参数**：`n` (数字，取值范围 `[2, 16]`)。
- **`window.__cloudcraft__.render.setFov(n)`**
  - **功能**：调整相机的视角（Field of View）。
  - **参数**：`n` (数字，取值范围 `[30, 120]`)。
- **`window.__cloudcraft__.render.setShadowQuality(quality)`**
  - **功能**：调整阴影的柔和渲染品质。
  - **参数**：`quality` (可选值：`"simple"` | `"fancy"`)。
- **`window.__cloudcraft__.render.getStats()`**
  - **功能**：获取渲染和性能相关的底层统计数据。
  - **返回值**：
    ```typescript
    {
      fps: number,         // 游戏实时 FPS
      drawCalls: number,   // 每帧 Draw Calls 数量
      triangles: number,   // 每帧渲染三角形总数
      geometries: number,  // 显存中的几何体数量
      textures: number     // 显存中的纹理数量
    }
    ```

### 2.6 Store (状态中心接口)
- **`window.__cloudcraft__.store.get()`**
  - **功能**：获取整个游戏 Zustand Store 的当前状态快照。
  - **返回值**：返回 `GameStoreState` 对象。
- **`window.__cloudcraft__.store.setGameMode(mode)`**
  - **功能**：切换游戏模式。
  - **参数**：`mode` (可选值：`"adventure"` | `"creative"`)。
- **`window.__cloudcraft__.store.giveItem(itemType, count)`**
  - **功能**：在玩家的主物品快捷栏（Hotbar）中塞入指定数量的物品/方块道具。
  - **参数**：`itemType` (字符串，必须是合法的 ItemType 类型，如 `"stone"`, `"grass"` 等)，`count` (数字，可选，默认 `1`)。
  - **返回值**：布尔值（表示是否添加成功）。

---

## 3. 内部实现与目录结构

为保持代码的高可维护性和模块化设计，`DevConsole` 相关的实现代码被拆分在以下目录结构中：

- [DevConsole.ts](/src/game/dev/DevConsole.ts)：声明 `CloudcraftDevConsole` 接口，定义对外暴露的方法签名，并作为中央组合器。
- [commands/](/src/game/dev/commands)：存放具体指令的业务逻辑实现。
  - [meta.ts](/src/game/dev/commands/meta.ts)：元数据、版本及种子查询等。
  - [player.ts](/src/game/dev/commands/player.ts)：玩家传送、生命值/饥饿值设定、飞行等。
  - [world.ts](/src/game/dev/commands/world.ts)：方块查询与设置、区域填充、世界序列化。
  - [time.ts](/src/game/dev/commands/time.ts)：游戏时间控制、维度/天气切换。
  - [render.ts](/src/game/dev/commands/render.ts)：视场角（FOV）、渲染距离、阴影品质和渲染统计。
  - [store.ts](/src/game/dev/commands/store.ts)：Zustand 状态获取、游戏模式切换及物品发放。
- [DevConsole.test.ts](/src/game/dev/DevConsole.test.ts)：覆盖调试控制台全命名空间的自动化单元测试。

