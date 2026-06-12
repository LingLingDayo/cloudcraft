/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SettingsGroup, SettingsData } from './types';

export const SettingsUtils = {
  /**
   * 判断一个配置项（分组、控件或选项）是否可见
   */
  isVisible<TData extends SettingsData, TContext>(
    item: {
      hidden?: (data: TData, context: TContext) => boolean;
      visible?: (data: TData, context: TContext) => boolean;
    },
    data: TData,
    context: TContext,
  ): boolean {
    if (item.hidden && item.hidden(data, context)) {
      return false;
    }
    if (item.visible && !item.visible(data, context)) {
      return false;
    }
    return true;
  },

  /**
   * 从配置分组列表中提取出所有控件的默认值，从而拼装出初始的 settings 数据对象
   */
  extractDefaults<TData extends SettingsData, TContext>(
    groups: SettingsGroup<TData, TContext>[],
  ): TData {
    const defaults = {} as Record<string, any>;

    for (const group of groups) {
      for (const ctrl of group.controls) {
        // ui-computed-info 和 button 这种不储存状态
        if (ctrl.type === 'ui-computed-info' || ctrl.type === 'button') {
          continue;
        }

        if ('defaultValue' in ctrl && ctrl.defaultValue !== undefined) {
          defaults[ctrl.key] = ctrl.defaultValue;
        } else if (ctrl.type === 'boolean') {
          defaults[ctrl.key] = false;
        } else if (ctrl.type === 'select') {
          const selectCtrl = ctrl as any;
          defaults[ctrl.key] = selectCtrl.isMultiple ? [] : '';
        } else {
          defaults[ctrl.key] = '';
        }
      }
    }

    return defaults as TData;
  },
};
