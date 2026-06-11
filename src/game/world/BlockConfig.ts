import { BlockType, BLOCK_TYPES, SoundType } from '@type';
import type { BlockModel } from './block/BlockModel';
export { BlockType, BLOCK_TYPES };

export interface BlockProperties {
  id: BlockType;
  name: string;
  translationKey?: string;    // 统一的本地化翻译 Key
  isSolid: boolean;           // 是否为实体，供物理碰撞检测使用 (如玩家是否可以穿过)
  isTransparent: boolean;     // 是否为透明/透光方块 (光线穿过、网格绘制时是否剔除邻面)
  isLiquid: boolean;          // 是否为液体 (如水、岩浆等)
  hardness: number;           // 挖掘硬度 (-1表示不可破坏如基岩，0表示即时破坏，1.0为泥土，2.0为石头等)
  affectedByGravity: boolean; // 是否受重力影响 (如沙子、红沙、砾石在没有支撑时会下落)
  lightLevel: number;         // 光照亮度等级：0-15 (如南瓜灯/火把/荧石为15)
  isInteractable: boolean;    // 是否可交互 (如箱子、门、熔炉、拉杆等)
  opacity: number;            // 渲染不透明度：0.0到1.0 (如水 0.8，空气 0.0，玻璃 0.3，普通方块 1.0)
  soundType: SoundType;       // 破坏/放置/行走音效类型
  showBreakCracks?: boolean;  // 破坏过程中是否显示裂纹，默认 true
  color?: string;             // UI preview color (hex string like '#56a032' or rgba)
  colorHex?: number;          // 3D particle/material color (number like 0x56a032)
  particleEffect?: string;    // Custom particle effect ID (e.g. 'cloudcraft:leaf', 'cloudcraft:sand', etc.)
  border?: string;            // UI preview border (optional)
  allowVegetationBase?: boolean; // 是否允许在此方块上方生成或种植植被/树木/植物 (作为植被生长地基)
  allowedBaseBlocks?: BlockType[]; // 该植被/植物方块只能放置/生长在指定的这些方块类型上
  textureFaces?: { top: number; bottom: number; side: number };
  droppedModelType?: 'block' | 'cross';
  isCollidable?: boolean;     // 是否参与物理碰撞，未指定时默认为 isSolid
  canSpawnOn?: boolean;       // 是否允许在其上方出生，未指定时默认为 isSolid && !isTransparent && !isLiquid
  lootTableId?: string;       // 新增 of LootTable 绑定 ID，例如 'cloudcraft:blocks/oak_leaves'
  lootTable?: {
    itemType: string;
    probability: number;
    minCount?: number;
    maxCount?: number;
  }[];
  collisionBoxes?: { min: [number, number, number]; max: [number, number, number] }[];
  model?: BlockModel;         // 3D 几何渲染模型
}


// ─── AIR 默认属性（propertiesResolver 初始化前的回退值）───

const AIR_PROPERTIES: BlockProperties = {
  id: BLOCK_TYPES.AIR,
  name: '空气',
  isSolid: false,
  isTransparent: true,
  isLiquid: false,
  hardness: 0,
  affectedByGravity: false,
  lightLevel: 0,
  isInteractable: false,
  opacity: 0.0,
  soundType: 'none',
  showBreakCracks: false,
  color: 'transparent',
  colorHex: 0x000000,
};

// ─── Properties Resolver 模式 ─────────────────────────────

// 初始回退为 AIR，BlockRegistry 模块加载时会立即覆盖为完整 resolver
let propertiesResolver: (blockId: number) => BlockProperties = () => AIR_PROPERTIES;

export function setPropertiesResolver(resolver: (blockId: number) => BlockProperties) {
  propertiesResolver = resolver;
}

// ─── BlockType key 缓存（供 translationKey 查找）──────────

let blockTypeKeysCache: Record<number, string> | null = null;

function getCachedBlockTypeKey(blockType: number): string {
  if (!blockTypeKeysCache) {
    blockTypeKeysCache = {};
    Object.entries(BLOCK_TYPES).forEach(([key, value]) => {
      blockTypeKeysCache![value as number] = key.toLowerCase();
    });
  }
  return blockTypeKeysCache[blockType] || 'air';
}

// ─── 公共查询接口 ──────────────────────────────────────────

export function getBlockProperties(blockId: number): BlockProperties & { translationKey: string } {
  const props = propertiesResolver(blockId & 0x3F);

  let translationKey = props.translationKey;
  if (!translationKey) {
    translationKey = getCachedBlockTypeKey(props.id);
  }

  return {
    ...props,
    translationKey,
    isCollidable: props.isCollidable ?? props.isSolid,
    canSpawnOn: props.canSpawnOn ?? (props.isSolid && !props.isTransparent && !props.isLiquid)
  };
}

/**
 * 校验某个方块类型（如花、草等植物）是否可以种植/生长在指定的底座方块类型上
 */
export function canBlockGrowOn(plantId: number, baseId: number): boolean {
  const plantProps = getBlockProperties(plantId);
  if (plantProps.allowedBaseBlocks) {
    return plantProps.allowedBaseBlocks.includes(baseId as BlockType);
  }
  const baseProps = getBlockProperties(baseId);
  return baseProps.allowVegetationBase === true;
}
