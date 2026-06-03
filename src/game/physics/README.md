# 物理系统 (Physics System)

本目录承载了 Minicraft 的三维物理碰撞与实体运动机制。为了在维持极致运行帧率（60FPS+）的同时支持后续可能引入的复杂物理刚体玩法，物理系统采用了 **「自研体素物理 + 局部物理引擎辅助」** 的混合架构。

## 目录结构说明

```text
src/game/physics/
├── Physics.ts                  # 统一物理管理器入口 (核心调度器与全局接口)
├── Physics.test.ts             # 物理模块单元测试
├── voxel/
│   └── VoxelPhysics.ts         # 自研体素物理 (AABB vs Grid，控制玩家与生物核心移动)
└── rigidbody/
    ├── RapierPhysicsPlaceholder.ts # WASM 刚体物理引擎 (Rapier) 占位接口
    └── README.md               # Rapier 物理引擎的集成指南与优化方案
```

---

## 混合物理架构设计

### 1. 自研体素物理 (`voxel/VoxelPhysics.ts`)
*   **适用场景**：玩家、生物（Mobs）的日常行走、跳跃、重力加速、攀爬和水下游泳。
*   **算法原理**：基于 AABB (Axis-Aligned Bounding Box) 与三维网格（Grid）进行碰撞检测。每次更新分别在 X、Z、Y 轴方向上应用速度，如果发现穿透则沿着对应轴回退并消除该轴向速度。
*   **性能特征**：碰撞查询的时间复杂度为 $O(1)$，无外部依赖，零内存垃圾产生，保证沙盒物理体验的绝对流畅与纯正手感。

### 2. 局部辅助物理 (`rigidbody/RapierPhysicsPlaceholder.ts`)
*   **适用场景**：复杂抛体（如弓箭轨迹）、爆炸碎块刚体碰撞、物理约束绳索、矿车载具等。
*   **集成技术**：设计为接入 **Rapier.js (WASM)** 的底层占位。
*   **设计原则**：该物理世界仅在需要的时候实例化。对于需要复杂物理的动态实体，我们会把其附近的体素方块动态添加为 Rapier 中的 `StaticCollider`，物理步进结束后同步回网格渲染坐标。从而避免对海量静态方块做无效的物理计算。

---

## 核心接口说明 (`Physics.ts`)

为了确保重构不影响现有的游戏业务和测试，`Physics` 暴露了与重构前完全一致的 API 接口：

| 方法/属性 | 描述 | 承接方 |
| :--- | :--- | :--- |
| `playerSize` | 玩家的包围盒大小配置 | `Physics` (可动态修改) |
| `gravity` | 物理世界重力加速度 | `Physics` (可动态修改) |
| `terminalVelocity` | 垂直落体的终端速度 | `Physics` |
| `isSolid(blockId)` | 判定方块是否为可碰撞的实体方块 | `VoxelPhysics` |
| `getPlayerBox(position)` | 获取实体当前位置对应的 AABB Box3 | `VoxelPhysics` |
| `checkInWater(position)` | 检测当前位置是否处于液体内部 | `VoxelPhysics` |
| `update(...)` | 每一帧物理 Tick 的更新入口 | 依次调度 `VoxelPhysics` 与 `rigidbodyPhysics` |
