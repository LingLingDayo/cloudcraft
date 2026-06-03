import React, { useState, useEffect } from 'react';
import { useGameStore } from '@store/useGameStore';
import { Dialog } from '@components/common/Dialog';
import { BLOCK_TYPES, type BlockType, getBlockProperties } from '@game/world/BlockConfig';
import type { HotbarItem } from '@store/types';
import type { GameManager } from '@game/core/GameManager';
import styles from './Inventory.module.scss';

declare global {
  interface Window {
    gameInstance?: GameManager;
  }
}

// Available blocks list
const ALL_BLOCKS: BlockType[] = [
  BLOCK_TYPES.GRASS,
  BLOCK_TYPES.DIRT,
  BLOCK_TYPES.STONE,
  BLOCK_TYPES.WOOD,
  BLOCK_TYPES.LEAF,
  BLOCK_TYPES.BRICK,
  BLOCK_TYPES.GLASS,
  BLOCK_TYPES.WATER,
  BLOCK_TYPES.SAND,
  BLOCK_TYPES.COAL,
  BLOCK_TYPES.IRON,
  BLOCK_TYPES.DIAMOND,
  BLOCK_TYPES.CHEST,
  BLOCK_TYPES.LEVER,
  BLOCK_TYPES.BIRCH_WOOD,
  BLOCK_TYPES.BIRCH_LEAVES,
  BLOCK_TYPES.SPRUCE_WOOD,
  BLOCK_TYPES.SPRUCE_LEAVES,
];

interface HeldItem {
  type: BlockType;
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
    blockId?: BlockType
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
    return getBlockProperties(type).color || '#a1a1aa';
  };

  const getBlockBorder = (type: number): string => {
    return getBlockProperties(type).border || 'none';
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
                {ALL_BLOCKS.map((blockId, idx) => {
                  const props = getBlockProperties(blockId);
                  return (
                    <div
                      key={blockId}
                      className={styles.itemSlot}
                      onClick={() => handleSlotClick('creative', idx, blockId)}
                      title={props.name}
                    >
                      <div
                        className={styles.itemPreview}
                        style={{
                          backgroundColor: props.color || '#a1a1aa',
                          border: props.border || 'none',
                        }}
                      />
                    </div>
                  );
                })}
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
