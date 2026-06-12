import React, { useState } from 'react';
import type { SettingsConfig, SettingsData, SettingsGroup } from './types';
import { DynamicControl } from './DynamicControl';
import { SettingsUtils } from './utils';
import { ConfirmationDialog } from '../ConfirmationDialog';
import styles from './SettingsModal.module.scss';

export interface SettingsRendererProps<
  TData extends SettingsData,
  TContext = unknown,
> {
  data: TData;
  onUpdate: (updates: Partial<TData>) => void;
  settingsConfig: SettingsConfig<TData, TContext>;
  context: TContext;
}

export function SettingsRenderer<TData extends SettingsData, TContext = unknown>({
  data,
  onUpdate,
  settingsConfig,
  context,
}: SettingsRendererProps<TData, TContext>) {
  const { groups = [], readonlyControls = [] } = settingsConfig;

  // 记录折叠状态
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of groups) {
      if (group.defaultCollapsed !== undefined) {
        initial[group.id] = group.defaultCollapsed;
      }
    }
    return initial;
  });

  // 待确认重置的分组
  const [resetConfirmGroup, setResetConfirmGroup] = useState<SettingsGroup<TData, TContext> | null>(null);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleGroupResetClick = (e: React.MouseEvent, group: SettingsGroup<TData, TContext>) => {
    e.stopPropagation();
    setResetConfirmGroup(group);
  };

  const handleConfirmReset = () => {
    if (resetConfirmGroup) {
      const resetData = SettingsUtils.extractDefaults([resetConfirmGroup]);
      if (Object.keys(resetData).length > 0) {
        onUpdate(resetData);
      }
      setResetConfirmGroup(null);
    }
  };

  return (
    <div className={styles.rendererContainer}>
      {groups.map((group) => {
        // 1. 判断分组可见性
        if (!SettingsUtils.isVisible(group, data, context)) {
          return null;
        }

        const isCollapsible = group.defaultCollapsed !== undefined;
        const isCollapsed = isCollapsible ? !!collapsedGroups[group.id] : false;

        return (
          <div key={group.id} className={styles.groupWrapper}>
            {/* 分组头部 */}
            <div
              className={styles.groupHeader}
              onClick={() => isCollapsible && toggleGroup(group.id)}
            >
              <div className={styles.groupTitleContainer}>
                <span
                  className={styles.groupTitleIndicator}
                  style={{ backgroundColor: group.color || '#ffff55' }}
                />
                <h4 className={styles.groupTitle} style={{ color: group.color || '#ffff55' }}>
                  {group.title}
                </h4>
              </div>

              <div className={styles.groupActions}>
                {group.isShowReset !== false && (
                  <button
                    type="button"
                    className={styles.groupResetIcon}
                    title="重置该分组"
                    onClick={(e) => handleGroupResetClick(e, group)}
                  >
                    ⟲
                  </button>
                )}
                {isCollapsible && (
                  <span className={styles.groupChevron}>
                    {isCollapsed ? '▼' : '▲'}
                  </span>
                )}
              </div>
            </div>

            {/* 分组内容 */}
            {!isCollapsed && (
              <div className={styles.groupContent}>
                {group.controls.map((control) => {
                  const isReadOnly = readonlyControls.includes(control.key);

                  return (
                    <DynamicControl
                      key={control.key}
                      control={control}
                      component={data}
                      context={context}
                      onUpdate={onUpdate}
                      disabled={isReadOnly}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* 分组重置的二次确认弹窗 */}
      <ConfirmationDialog
        isOpen={!!resetConfirmGroup}
        title="确认重置"
        message={`确定要将 "${resetConfirmGroup?.title || ''}" 中的所有设置重置为默认值吗？`}
        confirmLabel="确定"
        cancelLabel="取消"
        confirmVariant="danger"
        cancelVariant="secondary"
        onConfirm={handleConfirmReset}
        onCancel={() => setResetConfirmGroup(null)}
      />
    </div>
  );
}
