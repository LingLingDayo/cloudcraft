import React, { useState, useEffect } from 'react';
import { useGameStore } from '@store/useGameStore';
import { Dialog } from '@components/common/Dialog';
import { BLOCK_TYPES } from '@game/world/BlockConfig';
import type { HotbarItem } from '@store/types';
import type { GameManager } from '@game/core/GameManager';
import styles from './Inventory.module.scss';

declare global {
  interface Window {
    gameInstance?: GameManager;
  }
}

// Available blocks list
const ALL_BLOCKS = [
  { id: BLOCK_TYPES.GRASS, name: '草方块', color: '#56a032', border: 'none' },
  { id: BLOCK_TYPES.DIRT, name: '泥土', color: '#825a3c', border: 'none' },
  { id: BLOCK_TYPES.STONE, name: '石头', color: '#787878', border: 'none' },
  { id: BLOCK_TYPES.WOOD, name: '原木', color: '#78552d', border: 'none' },
  { id: BLOCK_TYPES.LEAF, name: '树叶', color: '#2d7823', border: 'none' },
  { id: BLOCK_TYPES.BRICK, name: '红砖', color: '#b85c38', border: 'none' },
  { id: BLOCK_TYPES.GLASS, name: '玻璃', color: 'rgba(150, 230, 255, 0.35)', border: '1.5px solid #96e6ff' },
  { id: BLOCK_TYPES.WATER, name: '水', color: 'rgba(40, 110, 220, 0.75)', border: 'none' },
  { id: BLOCK_TYPES.SAND, name: '沙子', color: '#dccd8c', border: 'none' },
  { id: BLOCK_TYPES.COAL, name: '煤矿石', color: '#2c2c2c', border: 'none' },
  { id: BLOCK_TYPES.IRON, name: '铁矿石', color: '#d0b090', border: 'none' },
  { id: BLOCK_TYPES.DIAMOND, name: '钻石矿', color: '#5cdcfa', border: '1.5px solid #2db4d2' },
  { id: BLOCK_TYPES.CHEST, name: '箱子', color: '#78552d', border: '2px solid #5a3c1e' },
  { id: BLOCK_TYPES.LEVER, name: '拉杆', color: '#555555', border: 'none' },
];

interface HeldItem {
  type: number;
  count: number;
  source: 'hotbar' | 'inventory' | 'creative';
  sourceIndex: number;
}

export const Inventory: React.FC = () => {
  const isInventoryOpen = useGameStore((state) => state.isInventoryOpen);
  const closeInventory = useGameStore((state) => state.closeInventory);
  const gameMode = useGameStore((state) => state.gameMode);
  
  const hotbar = useGameStore((state) => state.hotbar);
  const inventory = useGameStore((state) => state.inventory);
  const activeSlot = useGameStore((state) => state.activeSlot);

  // Tab selection in Creative Mode: 'creative' or 'survival'
  const [activeTab, setActiveTab] = useState<'creative' | 'survival'>(
    gameMode === 'creative' ? 'creative' : 'survival'
  );

  // Tracking dragging/held item
  const [heldItem, setHeldItem] = useState<HeldItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Update mouse position for floating held item preview
  useEffect(() => {
    if (!isInventoryOpen) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isInventoryOpen]);

  // Handle putting back the held item on close
  const putHeldItemBack = (item: HeldItem) => {
    if (item.source === 'creative') return; // items generated from creative mode can just be discarded

    const currentStore = useGameStore.getState();
    const nextHotbar = [...currentStore.hotbar];
    const nextInventory = [...currentStore.inventory];

    let placed = false;

    // 1. Try to place it back in the original slot if empty
    if (item.source === 'hotbar' && nextHotbar[item.sourceIndex] === null) {
      nextHotbar[item.sourceIndex] = { type: item.type, count: item.count };
      placed = true;
    } else if (item.source === 'inventory' && nextInventory[item.sourceIndex] === null) {
      nextInventory[item.sourceIndex] = { type: item.type, count: item.count };
      placed = true;
    }

    // 2. Try to find any other empty slot in hotbar first, then inventory
    if (!placed) {
      const hbEmptyIdx = nextHotbar.findIndex((x) => x === null);
      if (hbEmptyIdx !== -1) {
        nextHotbar[hbEmptyIdx] = { type: item.type, count: item.count };
        placed = true;
      } else {
        const invEmptyIdx = nextInventory.findIndex((x) => x === null);
        if (invEmptyIdx !== -1) {
          nextInventory[invEmptyIdx] = { type: item.type, count: item.count };
          placed = true;
        }
      }
    }

    // 3. Fallback: Drop on the ground in front of the player
    if (!placed) {
      const gameInstance = window.gameInstance;
      if (gameInstance && gameInstance.droppedItems && gameInstance.player) {
        const dropPos = gameInstance.player.position.clone();
        gameInstance.droppedItems.spawnItem(item.type, dropPos);
      }
    }

    // Update Zustand store
    const activeItem = nextHotbar[currentStore.activeSlot];
    const selectedBlock = activeItem ? activeItem.type : BLOCK_TYPES.AIR;
    useGameStore.setState({
      hotbar: nextHotbar,
      inventory: nextInventory,
      selectedBlock,
    });
  };

  const handleClose = () => {
    if (heldItem) {
      putHeldItemBack(heldItem);
      setHeldItem(null);
    }
    closeInventory();
    // Relock pointer in game controls
    window.gameInstance?.controls?.requestLock?.();
  };

  // Safe helper to update Zustand store states
  const syncStore = (
    nextHotbar: (HotbarItem | null)[],
    nextInventory: (HotbarItem | null)[]
  ) => {
    const activeItem = nextHotbar[activeSlot];
    const selectedBlock = activeItem ? activeItem.type : BLOCK_TYPES.AIR;
    useGameStore.setState({
      hotbar: nextHotbar,
      inventory: nextInventory,
      selectedBlock,
    });
  };

  // Click slot handler
  const handleSlotClick = (
    zone: 'hotbar' | 'inventory' | 'creative',
    index: number,
    blockId?: number
  ) => {
    const nextHotbar = [...hotbar];
    const nextInventory = [...inventory];

    if (zone === 'creative') {
      const clickedBlockId = blockId!;
      // Left click on creative item
      if (!heldItem) {
        // Pick up a full stack (64)
        setHeldItem({
          type: clickedBlockId,
          count: 64,
          source: 'creative',
          sourceIndex: index,
        });
      } else {
        // If holding something, clear it and pick up the new item
        setHeldItem({
          type: clickedBlockId,
          count: 64,
          source: 'creative',
          sourceIndex: index,
        });
      }
      return;
    }

    const currentItem = zone === 'hotbar' ? nextHotbar[index] : nextInventory[index];

    // Case 1: Held item is empty
    if (!heldItem) {
      if (currentItem) {
        // Pick up item from slot
        setHeldItem({
          type: currentItem.type,
          count: currentItem.count,
          source: zone,
          sourceIndex: index,
        });
        if (zone === 'hotbar') {
          nextHotbar[index] = null;
        } else {
          nextInventory[index] = null;
        }
        syncStore(nextHotbar, nextInventory);
      }
    } 
    // Case 2: Holding an item
    else {
      // Slot is empty - place the held item
      if (!currentItem) {
        if (zone === 'hotbar') {
          nextHotbar[index] = { type: heldItem.type, count: heldItem.count };
        } else {
          nextInventory[index] = { type: heldItem.type, count: heldItem.count };
        }
        syncStore(nextHotbar, nextInventory);
        setHeldItem(null);
      } 
      // Slot has items
      else {
        // Same type - merge counts (creative has no limits, survival merges up to max or just adds up)
        if (currentItem.type === heldItem.type) {
          const newCount = currentItem.count + heldItem.count;
          if (zone === 'hotbar') {
            nextHotbar[index] = { type: currentItem.type, count: newCount };
          } else {
            nextInventory[index] = { type: currentItem.type, count: newCount };
          }
          syncStore(nextHotbar, nextInventory);
          setHeldItem(null);
        } 
        // Different type - swap held item with slot item
        else {
          const temp = { ...currentItem };
          if (zone === 'hotbar') {
            nextHotbar[index] = { type: heldItem.type, count: heldItem.count };
          } else {
            nextInventory[index] = { type: heldItem.type, count: heldItem.count };
          }
          syncStore(nextHotbar, nextInventory);
          setHeldItem({
            type: temp.type,
            count: temp.count,
            source: zone,
            sourceIndex: index,
          });
        }
      }
    }
  };

  // Right-click slot handler (Quick move item between Hotbar and Inventory)
  const handleRightClick = (
    zone: 'hotbar' | 'inventory',
    index: number,
    e: React.MouseEvent
  ) => {
    e.preventDefault(); // Prevent standard browser menu
    if (heldItem) return; // Do not quick move while holding an item

    const nextHotbar = [...hotbar];
    const nextInventory = [...inventory];
    const item = zone === 'hotbar' ? nextHotbar[index] : nextInventory[index];

    if (!item) return;

    if (zone === 'hotbar') {
      // Find empty slot in inventory
      const emptyIdx = nextInventory.findIndex((x) => x === null);
      if (emptyIdx !== -1) {
        nextInventory[emptyIdx] = { ...item };
        nextHotbar[index] = null;
      }
    } else {
      // Find empty slot in hotbar
      const emptyIdx = nextHotbar.findIndex((x) => x === null);
      if (emptyIdx !== -1) {
        nextHotbar[emptyIdx] = { ...item };
        nextInventory[index] = null;
      }
    }

    syncStore(nextHotbar, nextInventory);
  };

  const getBlockColor = (type: number): string => {
    const found = ALL_BLOCKS.find((b) => b.id === type);
    return found ? found.color : '#a1a1aa';
  };

  const getBlockBorder = (type: number): string => {
    const found = ALL_BLOCKS.find((b) => b.id === type);
    return found ? found.border : 'none';
  };

  if (!isInventoryOpen) return null;

  return (
    <>
      <Dialog 
        title={gameMode === 'creative' ? '创造模式物品栏' : '背包'} 
        onClose={handleClose}
        width={412}
      >
        <div className={styles.container}>
          {/* Creative Mode Tabs */}
          {gameMode === 'creative' && (
            <div className={styles.tabContainer}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'creative' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('creative')}
              >
                物品大全
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'survival' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('survival')}
              >
                快捷/背包
              </button>
            </div>
          )}

          {/* Tab 1: All Items List (Creative Only) */}
          {gameMode === 'creative' && activeTab === 'creative' && (
            <div className={styles.creativeSection}>
              <p className={styles.hint}>点击生成物品到手中，再放入下方快捷栏</p>
              <div className={styles.creativeGrid}>
                {ALL_BLOCKS.map((block, idx) => (
                  <div
                    key={block.id}
                    className={styles.itemSlot}
                    onClick={() => handleSlotClick('creative', idx, block.id)}
                    title={block.name}
                  >
                    <div
                      className={styles.itemPreview}
                      style={{
                        backgroundColor: block.color,
                        border: block.border,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Survival Style Inventory (Default for Survival, Tab 2 for Creative) */}
          {activeTab === 'survival' && (
            <div className={styles.survivalSection}>
              <div className={styles.labelRow}>主背包 (Inventory)</div>
              <div className={styles.inventoryGrid}>
                {inventory.map((item, idx) => (
                  <div
                    key={`inv-${idx}`}
                    className={styles.itemSlot}
                    onClick={() => handleSlotClick('inventory', idx)}
                    onContextMenu={(e) => handleRightClick('inventory', idx, e)}
                  >
                    {item ? (
                      <>
                        <div
                          className={styles.itemPreview}
                          style={{
                            backgroundColor: getBlockColor(item.type),
                            border: getBlockBorder(item.type),
                          }}
                        />
                        {item.count > 0 && gameMode !== 'creative' && (
                          <span className={styles.itemCount}>{item.count}</span>
                        )}
                      </>
                    ) : (
                      <div className={styles.emptyItem} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Common Area: Divider + Hotbar (1x9) */}
          <div className={styles.divider} />

          <div className={styles.hotbarSection}>
            <div className={styles.labelRow}>快捷栏 (Hotbar)</div>
            <div className={styles.hotbarGrid}>
              {hotbar.map((item, idx) => (
                <div
                  key={`hot-${idx}`}
                  className={`${styles.itemSlot} ${idx === activeSlot ? styles.activeSlotBorder : ''}`}
                  onClick={() => handleSlotClick('hotbar', idx)}
                  onContextMenu={(e) => handleRightClick('hotbar', idx, e)}
                >
                  {item ? (
                    <>
                      <div
                        className={styles.itemPreview}
                        style={{
                          backgroundColor: getBlockColor(item.type),
                          border: getBlockBorder(item.type),
                        }}
                      />
                      {item.count > 0 && gameMode !== 'creative' && (
                        <span className={styles.itemCount}>{item.count}</span>
                      )}
                    </>
                  ) : (
                    <div className={styles.emptyItem} />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.footerHint}>
            提示：右键槽位可在背包与快捷栏之间快速移动物品
          </div>
        </div>
      </Dialog>

      {/* Floating item dragging representation */}
      {heldItem && (
        <div
          className={styles.heldItemFloat}
          style={{
            top: mousePos.y - 18,
            left: mousePos.x - 18,
          }}
        >
          <div
            className={styles.itemPreview}
            style={{
              backgroundColor: getBlockColor(heldItem.type),
              border: getBlockBorder(heldItem.type),
            }}
          />
          {heldItem.count > 0 && gameMode !== 'creative' && (
            <span className={styles.itemCount}>{heldItem.count}</span>
          )}
        </div>
      )}
    </>
  );
};
