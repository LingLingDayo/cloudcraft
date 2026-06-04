import React from 'react';
import { getBlockProperties } from '@game/world/BlockConfig';
import { getTextureAtlasDataURL } from '@game/world/TextureAtlas';
import { BLOCK_TYPES } from '@game/world/World';
import styles from './BlockIcon.module.scss';

interface BlockIconProps {
  blockId: number;
  size?: number | string;
  className?: string;
}

export const BlockIcon: React.FC<BlockIconProps> = ({ blockId, size, className }) => {
  // If it's air, render nothing
  if (blockId === BLOCK_TYPES.AIR) {
    return null;
  }

  const props = getBlockProperties(blockId);
  const cubeSize = typeof size === 'number' ? `${size}px` : size;

  if (props.isItem || props.isCrossModel) {
    const atlasIndex = props.textureFaces?.side ?? props.textureFaces?.top ?? 32;
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
        backgroundColor: props.color || '#e07890',
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

  const textureFaces = props.textureFaces;

  // Function to get CSS styles for a specific face
  const getFaceStyle = (face: 'top' | 'left' | 'right'): React.CSSProperties => {
    // Determine which atlas index to use for the face
    let atlasIndex: number | undefined;
    if (textureFaces) {
      if (face === 'top') {
        atlasIndex = textureFaces.top ?? textureFaces.side;
      } else {
        // In Minecraft, left and right sides of the inventory block use the side texture
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
          border: props.border || 'none',
        };
      } catch (_e) {
        // Fallback to solid color if texture retrieval fails
      }
    }

    // Fallback to color properties
    return {
      backgroundColor: props.color || '#a1a1aa',
      border: props.border || 'none',
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
