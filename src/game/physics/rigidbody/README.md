# 局部物理辅助引擎集成方案 (Rapier.js)

本目录作为未来集成高性能局部刚体物理引擎 **Rapier.js** 的占位结构与接口规范。

## 为什么引入 Rapier.js
为了解决自研体素物理（AABB Voxel Physics）无法低成本支持的复杂刚体仿真场景：
- **复杂弹射物与抛体**：带有旋转、风阻及高精度抛物线轨迹的投掷物（如弓箭、雪球、炮弹）。
- **非立方体刚体**：任意网格碰撞体（Mesh Collider）的掉落物、物理回弹爆炸碎屑。
- **物理关节与约束**：滑轮、吊桥绳索、粘性活塞拉扯链条。
- **动力学载具**：复杂的动力矿车、车辆或船只。

---

## 混合架构设计

物理系统采用 **自研体素物理为主，局部刚体引擎为辅** 的分层设计：

```
                    ┌─────────────────────────┐
                    │     GameManager / Mobs  │
                    └────────────┬────────────┘
                                 │ update(dt)
                                 ▼
                    ┌─────────────────────────┐
                    │      Physics Manager    │
                    └──────┬───────────┬──────┘
                           │           │
            ┌──────────────┘           └──────────────┐
            ▼                                         ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│      VoxelPhysics       │               │      RapierPhysics      │
│  (自研体素碰撞/角色移动) │               │   (WASM 刚体物理引擎)   │
└─────────────────────────┘               └─────────────────────────┘
```

1. **VoxelPhysics (体素物理)**:
   - 托管玩家、怪物的移动与重力。
   - 实现无滞后、极高帧率的网格 AABB 碰撞。
2. **RapierPhysics (刚体辅助物理)**:
   - 管理一个平行的 Rapier WASM 物理世界。
   - 托管高级物理交互刚体。
   - 通过**动态 Collider 注入**：仅把处于受重力刚体周围 $3 \times 3 \times 3$ 范围内的固态体素方块，作为静态 `Collider` 注册入 Rapier 世界，随着刚体运动动态更新/释放 Collider，确保 Rapier 世界的 Collider 数量维持在极低水平（$< 100$ 个）。

---

## 集成指引与步骤

要在本项目中正式启用 Rapier.js 物理引擎，请遵循以下流程：

### 1. 安装依赖
```bash
npm install @dimforge/rapier3d-compat
# 或者使用 yarn
yarn add @dimforge/rapier3d-compat
```

### 2. 异步初始化 WASM
在 `RapierPhysicsPlaceholder.ts` 中引入并初始化：
```typescript
import RAPIER from '@dimforge/rapier3d-compat';

export class RapierPhysics {
  private world!: RAPIER.World;
  private isInitialized = false;

  public async init() {
    // 异步加载 WASM 编译产物
    await RAPIER.init();
    
    // 创建物理世界，设置重力方向
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    this.isInitialized = true;
  }
}
```

### 3. 主循环 Tick 同步
在 `Physics.ts` 的 `update` 方法中，调用辅助引擎的更新：
```typescript
public update(..., dt: number) {
  // 1. 先执行 Voxel 核心物理
  this.voxelPhysics.update(...);

  // 2. 更新 Rapier 物理步进
  this.rigidbodyPhysics.update(dt);
}
```
在辅助引擎的 `update(dt)` 中执行：
```typescript
public update(dt: number) {
  if (!this.isInitialized) return;
  // 步进物理世界
  this.world.timestep = dt;
  this.world.step();
  
  // 同步物理刚体的位置与姿态到 Three.js Mesh
  this.syncRigidbodies();
}
```

### 4. 动态体素碰撞体同步（关键优化）
为了让 Rapier 刚体能和 3D 方块产生碰撞，不需要将整个世界导入 Rapier，只需在需要物理模拟的实体周围，按需添加静态 Collider：
```typescript
public updateDynamicColliders(entityPosition: THREE.Vector3) {
  // 1. 清理上一帧范围内临时创建的静态体素 Collider
  this.clearTempColliders();

  // 2. 获取实体周边 3x3x3 范围内的实体方块坐标
  const bounds = this.getNearbySolidBlocks(entityPosition);

  // 3. 将这些方块批量注册为 Rapier 静态盒子 Collider
  for (const block of bounds) {
    let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
      .setTranslation(block.x + 0.5, block.y + 0.5, block.z + 0.5);
    
    const collider = this.world.createCollider(colliderDesc);
    this.tempColliders.push(collider);
  }
}
```
