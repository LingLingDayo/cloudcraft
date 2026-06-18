# 项目目录结构与模块划分规范

为了确保 CloudCraft 作为一个中大型 WebGL 沙盒游戏能够高效扩展和维护，项目在代码层面进行了清晰的模块解耦与职责划分。所有开发人员在新增或修改文件时，必须严格遵守以下目录结构规范。

---

## 1. 整体目录结构

```text
src/
├── assets/          # 静态资源（纹理贴图、音效等）
├── components/      # React UI 组件
│   ├── common/      # 通用基础组件（按钮、滑块等）
│   └── views/       # 游戏页面视图（StartMenu, HUD, PauseMenu）
├── context/         # React 上下文提供者（如 GameContext，提供游戏实例引用）
├── game/            # 3D 游戏引擎核心逻辑 (纯 TypeScript)
│   ├── core/        # GameManager (引擎主控、渲染循环与生命周期管理)
│   ├── entities/    # 实体系统 (Player、Pig 等实体类)
│   ├── environment/ # 环境与天气系统 (天体昼夜、天气状态与环境渲染)
│   ├── item/        # 物品与道具系统 (Item 行为定义与注册表)
│   ├── loot/        # 掉落表系统 (LootTable 随机掉落机制与注册表)
│   ├── physics/     # 物理系统 (AABB 碰撞检测、重力)
│   ├── systems/     # 辅助系统 (Controls 输入绑定, Particles 粒子, Sound 音效)
│   └── world/       # 世界与地形生成 (World 区块管理, Noise 噪波, TextureAtlas 纹理合批)
├── hooks/           # 自定义 React Hooks (如 useBackToClose 交互钩子)
├── i18n/            # 国际化配置 (多语言本地化翻译)
├── store/           # Zustand 状态仓库 (slices 模式：game, player, debug)
├── styles/          # 全局 Sass 样式与主题定义
├── test/            # 测试配置与 setup 环境
├── types/           # 共享的 TypeScript 类型声明
└── utils/           # 通用工具函数 (设备检测、数学计算、配置处理等)
```

---

## 2. 核心模块职责说明

### 组件层 (src/components)
* **common/**: 存放无状态或低耦合的通用 UI 组件，如自定义的 Button、Slider、Modal 等。
* **views/**: 存放游戏核心生命周期阶段对应的 React 页面/面板，如游戏开始菜单（StartMenu）、运行中的 HUD 抬头显示（HUD）、暂停菜单（PauseMenu）等。

### 上下文管理 (src/context)
* 存放 React Context，提供游戏引擎实例与 React 树的单向通信桥梁（如 `GameContext`），确保各组件能方便且安全地引用 3D 游戏对象而不过度触发组件重新渲染。

### 3D 游戏引擎核心 (src/game)
* **core/**: `GameManager` 等主控逻辑，负责管理 Three.js 的初始化、渲染循环（AnimationFrame Loop）、引擎状态流转及各个子系统的生命周期。
* **entities/**: 游戏实体，如 Player（玩家类）、Pig（猪实体类）等，包含实体的移动更新、行为状态等。
* **environment/**: 环境与天气系统，管理天体移动（太阳、月亮、星空）、维度环境配置（DimensionConfig）及天气状态渲染（WeatherBlender, WeatherPresets）等。详细规范请参阅 [environment/README.md](./game/environment/README.md)。
* **item/**: 核心道具与物品配置，包含物品基类行为定义及 `ItemRegistry` 注册表，解耦方块与纯道具交互逻辑。详细规范请参阅 [item/README.md](./game/item/README.md)。
* **loot/**: 掉落表生成器，管理破坏方块或击杀实体时的掉落物品规则及 `LootTableRegistry`。
* **physics/**: 自研的 AABB 体素物理系统，负责实体的碰撞检测、多轴移动阻挡、下落重力物理等。详细规范请参阅 [physics/README.md](./game/physics/README.md)。
* **systems/**: 引擎的辅助系统：
  * `Controls`: 输入按键绑定与视角控制器。
  * `Particles`: 方块破坏等碎屑粒子发射器。
  * `Sound`:音效播放与咀嚼、破坏等合成音效调度。
* **world/**: 核心世界与地形生成系统：
  * `World`: 管理区块（Chunk）的加载、卸载与渲染网格更新。
  * `Noise`: 噪波算法生成高度图与生态分布。
  * `TextureAtlas`: 纹理贴图合并（Atlas），确保批量渲染性能。
  * 详细规范请参阅 [world/README.md](./game/world/README.md) 以及子模块 [world/pipeline/README.md](./game/world/pipeline/README.md)。

### 自定义 Hooks (src/hooks)
* 提供 React 全局或组件局部的通用 Hook，例如用于处理按键返回/关闭浮层的 `useBackToClose`。

### 国际化支持 (src/i18n)
* 管理游戏的多语言国际化配置，包含翻译文本的加载和切换逻辑。

### 状态管理库 (src/store)
* 采用 Zustand 存储。采用 slices 模式（如 game, player, debug 切片）将 React UI 与 3D 引擎的低频交互状态进行规范托管。详细规范请参阅 [store/README.md](./store/README.md)。

### 样式与测试环境 (src/styles & src/test)
* **styles/**: 全局样式与 SCSS 变量、主题配置。
* **test/**: 存放测试的全局配置文件（如 `setup.ts`），规范测试运行环境。

### 工具集与类型定义 (src/utils & src/types)
* **utils/**: 提取的项目级工具类，如设备平台检测、数学算法扩展及偏好设置处理。
* **types/**: 存放全项目共享的 TypeScript 接口与类型定义（如方块配置、游戏设置项等）。
