import React from 'react';
import { getBlockProperties } from '@game/world/BlockConfig';
import { getTextureAtlasDataURL } from '@game/world/TextureAtlas';
import { BLOCK_TYPES } from '@game/world/World';

/**
 * 获取方块贴图在 UI 槽位渲染中的 CSS 样式对象
 * 自动根据 TextureAtlas 定位 16x16 像素切片，还原精致像素风格
 */
export function getBlockIconStyle(blockId: number): React.CSSProperties {
  // 屏蔽空气方块
  if (blockId === BLOCK_TYPES.AIR) {
    return {
      backgroundColor: 'transparent',
      border: 'none',
    };
  }

  const props = getBlockProperties(blockId);
  const atlasIndex = props.textureFaces?.side ?? props.textureFaces?.top ?? props.textureFaces?.bottom;

  if (atlasIndex !== undefined && atlasIndex >= 0) {
    try {
      const dataURL = getTextureAtlasDataURL();
      const tx = atlasIndex % 8;
      const ty = Math.floor(atlasIndex / 8);
      // CSS Sprite percentage positioning: (index / (total_tiles - 1)) * 100
      const px = tx === 0 ? 0 : (tx / 7) * 100;
      const py = ty === 0 ? 0 : (ty / 7) * 100;

      return {
        backgroundImage: `url(${dataURL})`,
        backgroundSize: '800% 800%',
        backgroundPosition: `${px}% ${py}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        border: props.border || 'none',
        backgroundColor: 'transparent',
      };
    } catch (e) {
      console.warn('Failed to retrieve texture atlas data URL, falling back to flat color', e);
    }
  }

  // 兜底返回原有的纯色值
  return {
    backgroundColor: props.color || '#a1a1aa',
    border: props.border || 'none',
  };
}
