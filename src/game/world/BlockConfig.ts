import { BlockType, BLOCK_TYPES, SoundType } from '@type';
export { BlockType, BLOCK_TYPES };

// Mapping each block type's top, bottom, and side faces to tile indices in the 4x4 atlas grid (0 to 15)
export const BLOCK_FACES: Record<number, { top: number; bottom: number; side: number }> = {
  [BLOCK_TYPES.GRASS]: { top: 0, bottom: 2, side: 1 },
  [BLOCK_TYPES.DIRT]: { top: 2, bottom: 2, side: 2 },
  [BLOCK_TYPES.STONE]: { top: 3, bottom: 3, side: 3 },
  [BLOCK_TYPES.WOOD]: { top: 5, bottom: 5, side: 4 },
  [BLOCK_TYPES.LEAF]: { top: 6, bottom: 6, side: 6 },
  [BLOCK_TYPES.BRICK]: { top: 7, bottom: 7, side: 7 },
  [BLOCK_TYPES.GLASS]: { top: 8, bottom: 8, side: 8 },
  [BLOCK_TYPES.WATER]: { top: 9, bottom: 9, side: 9 },
  [BLOCK_TYPES.SAND]: { top: 10, bottom: 10, side: 10 },
  [BLOCK_TYPES.COAL]: { top: 11, bottom: 11, side: 11 },
  [BLOCK_TYPES.IRON]: { top: 12, bottom: 12, side: 12 },
  [BLOCK_TYPES.DIAMOND]: { top: 13, bottom: 13, side: 13 },
  [BLOCK_TYPES.CHEST]: { top: 5, bottom: 5, side: 5 }, // 借用木头贴图
  [BLOCK_TYPES.LEVER]: { top: 3, bottom: 3, side: 3 }, // 借用石头贴图
};

export interface BlockProperties {
  id: BlockType;
  name: string;
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
}

export const BLOCK_PROPERTIES: Record<number, BlockProperties> = {
  [BLOCK_TYPES.AIR]: {
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
  },
  [BLOCK_TYPES.GRASS]: {
    id: BLOCK_TYPES.GRASS,
    name: '草方块',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 0.6,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'grass',
  },
  [BLOCK_TYPES.DIRT]: {
    id: BLOCK_TYPES.DIRT,
    name: '泥土',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 0.5,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'grass',
  },
  [BLOCK_TYPES.STONE]: {
    id: BLOCK_TYPES.STONE,
    name: '石头',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 1.5,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'stone',
  },
  [BLOCK_TYPES.WOOD]: {
    id: BLOCK_TYPES.WOOD,
    name: '原木',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 2.0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'wood',
  },
  [BLOCK_TYPES.LEAF]: {
    id: BLOCK_TYPES.LEAF,
    name: '树叶',
    isSolid: true,
    isTransparent: true,
    isLiquid: false,
    hardness: 0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 0.5,
    soundType: 'grass',
  },
  [BLOCK_TYPES.BRICK]: {
    id: BLOCK_TYPES.BRICK,
    name: '红砖',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 2.0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'stone',
  },
  [BLOCK_TYPES.GLASS]: {
    id: BLOCK_TYPES.GLASS,
    name: '玻璃',
    isSolid: true,
    isTransparent: true,
    isLiquid: false,
    hardness: 0.3,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 0.3,
    soundType: 'glass',
    showBreakCracks: false,
  },
  [BLOCK_TYPES.WATER]: {
    id: BLOCK_TYPES.WATER,
    name: '水',
    isSolid: false,
    isTransparent: true,
    isLiquid: true,
    hardness: 0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 0.8,
    soundType: 'water',
    showBreakCracks: false,
  },
  [BLOCK_TYPES.SAND]: {
    id: BLOCK_TYPES.SAND,
    name: '沙子',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 0.5,
    affectedByGravity: true,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'sand',
  },
  [BLOCK_TYPES.COAL]: {
    id: BLOCK_TYPES.COAL,
    name: '煤矿石',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 3.0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'stone',
  },
  [BLOCK_TYPES.IRON]: {
    id: BLOCK_TYPES.IRON,
    name: '铁矿石',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 3.0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'stone',
  },
  [BLOCK_TYPES.DIAMOND]: {
    id: BLOCK_TYPES.DIAMOND,
    name: '钻石矿石',
    isSolid: true,
    isTransparent: false,
    isLiquid: false,
    hardness: 3.0,
    affectedByGravity: false,
    lightLevel: 0,
    isInteractable: false,
    opacity: 1.0,
    soundType: 'stone',
  },
};

// Let propertiesResolver fall back to local static BLOCK_PROPERTIES initially,
// then override it from BlockRegistry at runtime.
let propertiesResolver: (blockId: number) => BlockProperties = (blockId) => {
  return BLOCK_PROPERTIES[blockId] || BLOCK_PROPERTIES[BLOCK_TYPES.AIR];
};

export function setPropertiesResolver(resolver: (blockId: number) => BlockProperties) {
  propertiesResolver = resolver;
}

// Helper function to safely fetch properties of any block ID, defaulting to AIR properties
export function getBlockProperties(blockId: number): BlockProperties {
  return propertiesResolver(blockId);
}


