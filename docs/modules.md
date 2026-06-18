# CloudCraft 模块文档索引

为了便于开发者和 Agent 快速定位各个核心功能模块的开发规范与架构设计约束，特汇总本项目所有模块的 README 文档。

> [!IMPORTANT]
> 在修改、重构或为特定模块开发新特性前，**必须**首先阅读该模块主路径下的 `README.md`，并在开发完成后，根据实际代码逻辑与改动更新对应文档。

---

## 模块文档树

- [根目录模块架构规范](/src/README.md)
- [状态管理模块](/src/store/README.md) (`store`)
- [游戏引擎核心模块](/src/game/)
  - └── [调试控制台与暴露接口](/src/game/dev/README.md) (`game/dev`)
  - └── [环境与天气系统](/src/game/environment/README.md) (`game/environment`)
  - └── [道具与物品系统](/src/game/item/README.md) (`game/item`)
  - └── [物理与碰撞系统](/src/game/physics/README.md) (`game/physics`)
  - └── [世界与地形生成系统](/src/game/world/README.md) (`game/world`)
      - └── [区块生成管道流水线](/src/game/world/pipeline/README.md) (`game/world/pipeline`)

---

## 模块文档简述一览

| 模块名称 | 文档路径 | 主要职责与规范概述 |
| :--- | :--- | :--- |
| **项目目录结构** | [src/README.md](/src/README.md) | 全局目录结构划分、模块边界及核心模块职责定义。 |
| **状态管理** | [src/store/README.md](/src/store/README.md) | Zustand 状态管理切片（Slices）架构及 3D 引擎高频渲染与 UI 低频刷新的同步规范。 |
| **调试控制台** | [src/game/dev/README.md](/src/game/dev/README.md) | `window.__cloudcraft__` 挂载的调试控制台域（Meta, Player, World, Time, Render, Store）API 说明。 |
| **环境与天气** | [src/game/environment/README.md](/src/game/environment/README.md) | 维度静态配置、时间驱动逻辑、天气混合器与零 GC 渲染平滑过渡契约。 |
| **道具与物品** | [src/game/item/README.md](/src/game/item/README.md) | 纯道具 Item、BlockItem、FoodItem 多态分发机制与运行时注入解耦（Properties Resolver 模式）。 |
| **物理与碰撞** | [src/game/physics/README.md](/src/game/physics/README.md) | AABB 碰撞检测时序、分轴判断机制以及局部刚体引擎（Rapier.js）集成规范。 |
| **世界与地形** | [src/game/world/README.md](/src/game/world/README.md) | 温湿度/大陆度/侵蚀度多维正交噪波生成解耦、动态坡度检测与悬崖崖壁裸石填充机制。 |
| **└─ 区块流水线** | [src/game/world/pipeline/README.md](/src/game/world/pipeline/README.md) | 区块生成管道流水线（Stage）模式、上下文共享以及越界安全写入防护。 |
