import React from 'react';
import { getBlockProperties } from '@game/world/BlockConfig';
import { getTextureAtlasDataURL } from '@game/world/TextureAtlas';
import { ItemType } from '@type';
import { ItemRegistry } from '@game/item/ItemRegistry';
import { BlockItem } from '@game/item/Item';
import styles from './ItemIcon.module.scss';

interface ItemIconProps {
  /** 物品 ID（统一入口，替代原 blockId / itemId 双参数） */
  itemId?: ItemType;
  /** @deprecated 向后兼容别名，等同于 itemId */
  blockId?: ItemType;
  size?: number | string;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ blockId, itemId, size, className }) => {
  const id = itemId ?? blockId;
  if (!id) {
    return null;
  }

  const item = ItemRegistry.get(id);
  const cubeSize = typeof size === 'number' ? `${size}px` : size;

  // Resolve properties if it's a BlockItem to get complete configuration (including textureFaces)
  const blockProps = item instanceof BlockItem ? getBlockProperties(item.blockId) : null;
  const textureFaces = blockProps?.textureFaces ?? item.textureFaces;

  // Render as a 2D flat icon if it is not a placeable block item,
  // or if it uses a custom cross model (like saplings).
  if (!(item instanceof BlockItem) || item.droppedModelType === 'cross') {
    const atlasIndex = textureFaces?.side ?? textureFaces?.top ?? 32;
    let style: React.CSSProperties;
    try {
      const dataURL = getTextureAtlasDataURL();
      const tx = atlasIndex % 8;
      const ty = Math.floor(atlasIndex / 8);
      const px = tx === 0 ? 0 : (tx / 7) * 100;
      const py = ty === 0 ? 0 : (ty / 7) * 100;

      style = {
        width: '100%',
        height: '100%',
        backgroundImage: `url(${dataURL})`,
        backgroundSize: '800% 800%',
        backgroundPosition: `${px}% ${py}%`,
        backgroundColor: 'transparent',
        imageRendering: 'pixelated',
      };
    } catch (_e) {
      style = {
        width: '100%',
        height: '100%',
        backgroundColor: item.color || '#e07890',
        borderRadius: '2px',
      };
    }

    return (
      <div
        className={`${styles.cubeContainer} ${className || ''}`}
        style={{
          ...((cubeSize ? { width: cubeSize, height: cubeSize } : {}) as React.CSSProperties),
        }}
      >
        <div style={style} />
      </div>
    );
  }

  // Render as a 3D isometric block for standard BlockItems
  const activeBlockProps = blockProps!;

  const getFaceStyle = (face: 'top' | 'left' | 'right'): React.CSSProperties => {
    let atlasIndex: number | undefined;
    if (textureFaces) {
      if (face === 'top') {
        atlasIndex = textureFaces.top ?? textureFaces.side;
      } else {
        atlasIndex = textureFaces.side;
      }
    }

    if (atlasIndex !== undefined && atlasIndex >= 0) {
      try {
        const dataURL = getTextureAtlasDataURL();
        const tx = atlasIndex % 8;
        const ty = Math.floor(atlasIndex / 8);
        const px = tx === 0 ? 0 : (tx / 7) * 100;
        const py = ty === 0 ? 0 : (ty / 7) * 100;

        return {
          backgroundImage: `url(${dataURL})`,
          backgroundSize: '800% 800%',
          backgroundPosition: `${px}% ${py}%`,
          backgroundColor: 'transparent',
          border: activeBlockProps.border || 'none',
        };
      } catch (_e) {
        // Fallback to solid color
      }
    }

    return {
      backgroundColor: activeBlockProps.color || '#a1a1aa',
      border: activeBlockProps.border || 'none',
    };
  };

  return (
    <div
      className={`${styles.cubeContainer} ${className || ''}`}
      style={{
        ...((cubeSize ? { '--cube-size': cubeSize } : {}) as React.CSSProperties),
      }}
    >
      <div className={styles.cube}>
        <div className={`${styles.face} ${styles.faceTop}`} style={getFaceStyle('top')} />
        <div className={`${styles.face} ${styles.faceLeft}`} style={getFaceStyle('left')} />
        <div className={`${styles.face} ${styles.faceRight}`} style={getFaceStyle('right')} />
      </div>
    </div>
  );
};

/** @deprecated 向后兼容导出，请使用 ItemIcon */
export const BlockIcon = ItemIcon;
