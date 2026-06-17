import React, { useState, useEffect } from 'react';
import { useGameStore } from '@store/useGameStore';
import { Dialog } from '@components/common/Dialog';

import { useTranslation } from '@i18n';
import type { HotbarItem } from '@store/types';
import styles from './Inventory.module.scss';
import { useGame } from '@context/GameContext';
import { BlockIcon } from './ItemIcon';
import { ItemType } from '@type';
import { ItemRegistry } from '@game/item/ItemRegistry';

// Available items list for creative mode
const ALL_ITEMS: ItemType[] = Object.values(ItemType);

interface HeldItem {
  type: ItemType;
  count: number;
  source: 'hotbar' | 'inventory' | 'creative';
  sourceIndex: number;
}

export const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const gameInstance = useGame();
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

  // Tracking hovered item for description tooltip
  const [hoveredItem, setHoveredItem] = useState<{
    type: ItemType;
    x: number;
    y: number;
  } | null>(null);

  // Active selected hotbar slot in inventory popup
  const [selectedHotbarSlot, setSelectedHotbarSlot] = useState<number | null>(null);

  useEffect(() => {
    if (!isInventoryOpen) {
      const frameId = requestAnimationFrame(() => {
        setHoveredItem(null);
        setSelectedHotbarSlot(null);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [isInventoryOpen]);

  const handleMouseEnterSlot = (type: ItemType, e: React.MouseEvent) => {
    setHoveredItem({
      type,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseMoveSlot = (type: ItemType, e: React.MouseEvent) => {
    setHoveredItem({
      type,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseLeaveSlot = () => {
    setHoveredItem(null);
  };

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
      if (gameInstance && gameInstance.droppedItems && gameInstance.player) {
        const dropPos = gameInstance.player.position.clone();
        gameInstance.droppedItems.spawnItem(item.type, dropPos);
      }
    }

    // Update Zustand store
    const activeItem = nextHotbar[currentStore.activeSlot];
    const selectedItem = activeItem ? activeItem.type : null;
    useGameStore.setState({
      hotbar: nextHotbar,
      inventory: nextInventory,
      selectedItem,
    });
  };

  const handleClose = () => {
    if (heldItem) {
      putHeldItemBack(heldItem);
      setHeldItem(null);
    }
    setHoveredItem(null);
    setSelectedHotbarSlot(null);
    closeInventory();
    // Relock pointer in game controls
    gameInstance?.controls?.requestLock?.();
  };

  const handleSlotClickWithTooltip = (
    zone: 'hotbar' | 'inventory' | 'creative',
    index: number,
    blockId?: ItemType
  ) => {
    handleSlotClick(zone, index, blockId);
    handleMouseLeaveSlot();
  };

  const handleRightClickWithTooltip = (
    zone: 'hotbar' | 'inventory',
    index: number,
    e: React.MouseEvent
  ) => {
    handleRightClick(zone, index, e);
    handleMouseLeaveSlot();
  };

  // Safe helper to update Zustand store states
  const syncStore = (
    nextHotbar: (HotbarItem | null)[],
    nextInventory: (HotbarItem | null)[]
  ) => {
    const activeItem = nextHotbar[activeSlot];
    const selectedItem = activeItem ? activeItem.type : null;
    useGameStore.setState({
      hotbar: nextHotbar,
      inventory: nextInventory,
      selectedItem,
    });
  };

  // Click slot handler
  const handleSlotClick = (
    zone: 'hotbar' | 'inventory' | 'creative',
    index: number,
    blockId?: ItemType
  ) => {
    const nextHotbar = [...hotbar];
    const nextInventory = [...inventory];

    if (zone === 'hotbar') {
      setSelectedHotbarSlot(index);
      useGameStore.setState({ activeSlot: index });
    }

    if (zone === 'creative') {
      const clickedBlockId = blockId!;
      const maxStackSize = ItemRegistry.get(clickedBlockId).maxStackSize;
      // Left click on creative item
      if (!heldItem) {
        // Pick up a full stack (maxStackSize)
        setHeldItem({
          type: clickedBlockId,
          count: maxStackSize,
          source: 'creative',
          sourceIndex: index,
        });
      } else {
        // If holding something, clear it and pick up the new item
        setHeldItem({
          type: clickedBlockId,
          count: maxStackSize,
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
          const maxStackSize = ItemRegistry.get(currentItem.type).maxStackSize;
          if (gameMode === 'creative') {
            const newCount = currentItem.count + heldItem.count;
            if (zone === 'hotbar') {
              nextHotbar[index] = { type: currentItem.type, count: newCount };
            } else {
              nextInventory[index] = { type: currentItem.type, count: newCount };
            }
            syncStore(nextHotbar, nextInventory);
            setHeldItem(null);
          } else {
            const canFit = maxStackSize - currentItem.count;
            if (canFit > 0) {
              const toAdd = Math.min(heldItem.count, canFit);
              const newCount = currentItem.count + toAdd;
              const remaining = heldItem.count - toAdd;
              if (zone === 'hotbar') {
                nextHotbar[index] = { type: currentItem.type, count: newCount };
              } else {
                nextInventory[index] = { type: currentItem.type, count: newCount };
              }
              syncStore(nextHotbar, nextInventory);
              if (remaining > 0) {
                setHeldItem({
                  ...heldItem,
                  count: remaining,
                });
              } else {
                setHeldItem(null);
              }
            }
          }
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

  if (!isInventoryOpen) return null;

  return (
    <>
      <Dialog 
        title={gameMode === 'creative' ? t('inventory.titleCreative') : t('inventory.titleSurvival')} 
        onClose={handleClose}
        width={480}
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
                {t('inventory.tabAllItems')}
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'survival' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('survival')}
              >
                {t('inventory.tabHotbarInventory')}
              </button>
            </div>
          )}

          {/* Tab 1: All Items List (Creative Only) */}
          {gameMode === 'creative' && activeTab === 'creative' && (
            <div className={styles.creativeSection}>
              <p className={styles.hint}>{t('inventory.hintCreative')}</p>
              <div className={styles.creativeGrid}>
                {ALL_ITEMS.map((itemId, idx) => {
                  return (
                    <div
                      key={itemId}
                      className={styles.itemSlot}
                      onClick={() => handleSlotClickWithTooltip('creative', idx, itemId)}
                      onMouseEnter={(e) => handleMouseEnterSlot(itemId, e)}
                      onMouseMove={(e) => handleMouseMoveSlot(itemId, e)}
                      onMouseLeave={handleMouseLeaveSlot}
                    >
                      <BlockIcon itemId={itemId} size={26} className={styles.itemPreview} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Survival Style Inventory (Default for Survival, Tab 2 for Creative) */}
          {activeTab === 'survival' && (
            <div className={styles.survivalSection}>
              <div className={styles.labelRow}>{t('inventory.labelInventory')}</div>
              <div className={styles.inventoryGrid}>
                {inventory.map((item, idx) => (
                  <div
                    key={`inv-${idx}`}
                    className={styles.itemSlot}
                    onClick={() => handleSlotClickWithTooltip('inventory', idx)}
                    onContextMenu={(e) => handleRightClickWithTooltip('inventory', idx, e)}
                    onMouseEnter={(e) => item && handleMouseEnterSlot(item.type, e)}
                    onMouseMove={(e) => item && handleMouseMoveSlot(item.type, e)}
                    onMouseLeave={item ? handleMouseLeaveSlot : undefined}
                  >
                    {item ? (
                      <>
                        <BlockIcon blockId={item.type} size={26} className={styles.itemPreview} />
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

          {/* Bottom Common Area: Hotbar (1x9) */}
          <div className={styles.hotbarSection}>
            <div className={styles.labelRow}>{t('inventory.labelHotbar')}</div>
            <div className={styles.hotbarGrid}>
              {hotbar.map((item, idx) => (
                <div
                  key={`hot-${idx}`}
                  className={`${styles.itemSlot} ${idx === selectedHotbarSlot ? styles.activeSlotBorder : ''}`}
                  onClick={() => handleSlotClickWithTooltip('hotbar', idx)}
                  onContextMenu={(e) => handleRightClickWithTooltip('hotbar', idx, e)}
                  onMouseEnter={(e) => item && handleMouseEnterSlot(item.type, e)}
                  onMouseMove={(e) => item && handleMouseMoveSlot(item.type, e)}
                  onMouseLeave={item ? handleMouseLeaveSlot : undefined}
                >
                  {item ? (
                    <>
                      <BlockIcon blockId={item.type} size={26} className={styles.itemPreview} />
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
            {t('inventory.hintRightClick')}
          </div>
        </div>
      </Dialog>

      {/* Floating item dragging representation */}
      {heldItem && (
        <div
          className={styles.heldItemFloat}
          style={{
            top: mousePos.y - 20,
            left: mousePos.x - 20,
          }}
        >
          <BlockIcon blockId={heldItem.type} size={30} className={styles.itemPreview} />
          {heldItem.count > 0 && gameMode !== 'creative' && (
            <span className={styles.itemCount}>{heldItem.count}</span>
          )}
        </div>
      )}

      {/* Item Description Tooltip */}
      {hoveredItem && !heldItem && (() => {
        let tooltipLeft = hoveredItem.x + 12;
        let tooltipTop = hoveredItem.y + 12;
        // Overflow checks
        if (hoveredItem.x + 220 > window.innerWidth) {
          tooltipLeft = hoveredItem.x - 220;
        }
        if (hoveredItem.y + 100 > window.innerHeight) {
          tooltipTop = hoveredItem.y - 100;
        }
        return (
          <div
            className={styles.tooltip}
            style={{
              top: tooltipTop,
              left: tooltipLeft,
            }}
          >
            <div className={styles.tooltipTitle}>{t(`items.${hoveredItem.type}`)}</div>
            <div className={styles.tooltipDesc}>{t(`itemDescriptions.${hoveredItem.type}`)}</div>
          </div>
        );
      })()}
    </>
  );
};
