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

interface FaceVisualProps {
  readonly color?: string;
  readonly border?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ blockId, itemId, size, className }) => {
  const id = itemId ?? blockId;
  if (!id) {
    return null;
  }

  const item = ItemRegistry.get(id);
  const cubeSize = typeof size === 'number' ? `${size}px` : size;

  // Resolve properties if it's a BlockItem to get complete configuration (including textureFaces)
  const blockProps = item.isBlockItem ? getBlockProperties((item as BlockItem).blockId) : null;
  const textureFaces = blockProps?.textureFaces ?? item.textureFaces;

  // 方块 / 设施等立体掉落物使用等距 3D 方块；cross 模型（树苗/食物）保持平面贴图
  const useIsometricCube = item.droppedModelType === 'block' && !!textureFaces;

  if (!useIsometricCube) {
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

  // 3D 等距方块：方块走 BlockProperties，设施等非方块物品回落到 item 自身视觉属性
  const faceVisual: FaceVisualProps = {
    color: blockProps?.color || item.color || '#a1a1aa',
    border: blockProps?.border || 'none',
  };

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
          border: faceVisual.border || 'none',
        };
      } catch (_e) {
        // Fallback to solid color
      }
    }

    return {
      backgroundColor: faceVisual.color || '#a1a1aa',
      border: faceVisual.border || 'none',
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
