import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import type { SettingsConfig, SettingsData } from './types';
import { SettingsRenderer } from './SettingsRenderer';
import { SettingsUtils } from './utils';
import { Button } from '../Button';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { useBackToClose } from '@hooks/useBackToClose';
import styles from './SettingsModal.module.scss';

export interface SettingsModalProps<
  TData extends SettingsData,
  TContext = unknown,
> {
  renderMode?: 'dialog' | 'panel';
  isOpen?: boolean;
  title?: string;
  data: TData;
  settingsConfig: SettingsConfig<TData, TContext>;
  context: TContext;
  isLiveUpdate?: boolean;
  isShowReset?: boolean;
  confirmText?: string;
  cancelText?: string;
  resetText?: string;
  isMaskClosable?: boolean;
  children?: React.ReactNode; // 顶部可选的自定义组件
  styleMode?: 'accordion' | 'classic';
  sidebarFooter?: React.ReactNode;
  closeOnBack?: boolean;

  onUpdate: (updates: Partial<TData>) => void;
  onClose?: (localData: TData, oldData: TData) => void;
  onConfirm?: (localData: TData, oldData: TData) => void;
  onReset?: (localData: TData, oldData: TData) => void;
}

export function SettingsModal<TData extends SettingsData, TContext = unknown>({
  renderMode = 'dialog',
  isOpen = false,
  title = '设置',
  data,
  settingsConfig,
  context,
  isLiveUpdate = true,
  isShowReset = true,
  confirmText = '确认',
  cancelText = '取消',
  resetText = '重置',
  isMaskClosable = false,
  children,
  styleMode = 'accordion',
  sidebarFooter,
  closeOnBack = true,
  onUpdate,
  onClose,
  onConfirm,
  onReset,
}: SettingsModalProps<TData, TContext>) {
  // 数据缓存，用来支持非 Live Update (即 Local Edit) 模式
  const [prevData, setPrevData] = useState<TData>(data);
  const [localData, setLocalData] = useState<TData>(data);

  // 监听外部 data 的改变同步 to 本地 data (React 官方推荐 of props-to-state 同步模式)
  if (data !== prevData) {
    setPrevData(data);
    setLocalData(data);
  }

  // 仅在 dialog 模式且打开时启用返回键关闭
  useBackToClose({
    onClose: () => handleCancel(),
    enabled: renderMode === 'dialog' && isOpen && closeOnBack
  });

  const hasPages = Array.isArray(settingsConfig.pages) && settingsConfig.pages.length > 0;
  const [prevPages, setPrevPages] = useState(settingsConfig.pages);
  const [activePageId, setActivePageId] = useState<string | undefined>(
    hasPages ? settingsConfig.pages![0].id : undefined
  );

  // 保持 activePageId 与 pages 同步 (React 官方推荐 of props-to-state 同步模式)
  if (settingsConfig.pages !== prevPages) {
    setPrevPages(settingsConfig.pages);
    if (hasPages && settingsConfig.pages) {
      const hasActive = settingsConfig.pages.some(p => p.id === activePageId);
      if (!hasActive) {
        setActivePageId(settingsConfig.pages[0].id);
      }
    } else {
      setActivePageId(undefined);
    }
  }

  // 全局重置二次确认弹窗的开关
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // 更新处理函数
  const handleUpdate = (updates: Partial<TData>) => {
    if (isLiveUpdate) {
      onUpdate(updates);
    } else {
      setLocalData((prev) => ({ ...prev, ...updates }));
    }
  };

  // 点击确认/保存
  const handleSave = () => {
    if (!isLiveUpdate) {
      onUpdate(localData);
    }
    onConfirm?.(localData, data);
  };

  // 点击取消
  const handleCancel = () => {
    if (!isLiveUpdate) {
      setLocalData(data);
    }
    onClose?.(localData, data);
  };

  // 触发全局重置
  const handleReset = () => {
    setIsResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    const allGroups = hasPages
      ? settingsConfig.pages!.flatMap(p => p.groups)
      : (settingsConfig.groups || []);
    const defaultData = SettingsUtils.extractDefaults(allGroups);
    if (isLiveUpdate) {
      onUpdate(defaultData);
    } else {
      setLocalData(defaultData);
    }
    onReset?.(defaultData, data);
    setIsResetConfirmOpen(false);
  };

  // 获取当前活跃的配置分组
  const activeGroups = useMemo(() => {
    return hasPages
      ? settingsConfig.pages!.find(p => p.id === activePageId)?.groups || []
      : settingsConfig.groups || [];
  }, [hasPages, settingsConfig, activePageId]);

  const activeSettingsConfig = useMemo(() => {
    return {
      ...settingsConfig,
      groups: activeGroups,
    };
  }, [settingsConfig, activeGroups]);

  // 渲染主体内容
  const mainContent = (
    <div className={styles.modalBody}>
      {hasPages && (
        <div className={styles.sidebar}>
          <div className={styles.tabList}>
            {settingsConfig.pages!.map((page) => (
              <button
                key={page.id}
                type="button"
                className={`${styles.tabBtn} ${
                  activePageId === page.id ? styles.activeTabBtn : ''
                }`}
                onClick={() => setActivePageId(page.id)}
              >
                {page.title}
              </button>
            ))}
          </div>
          {styleMode === 'classic' && sidebarFooter}
        </div>
      )}
      <div className={styles.contentArea}>
        {children}
        <SettingsRenderer
          data={isLiveUpdate ? data : localData}
          onUpdate={handleUpdate}
          settingsConfig={activeSettingsConfig}
          context={context}
          styleMode={styleMode}
        />
        {styleMode === 'classic' && (
          <div className={styles.classicFooter}>
            {isShowReset && (
              <Button variant="danger" onClick={handleReset} className={styles.resetBtn}>
                {resetText}
              </Button>
            )}
            <Button variant="secondary" onClick={handleCancel}>
              {isLiveUpdate ? '完成' : cancelText}
            </Button>
            {!isLiveUpdate && (
              <Button variant="primary" onClick={handleSave}>
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Panel 模式 (作为面板组件直接嵌入 DOM)
  if (renderMode === 'panel') {
    return (
      <div className={styles.panelContainer} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className={styles.dialogContent} style={{ flex: 1 }}>
          {mainContent}
        </div>
        {!isLiveUpdate && styleMode !== 'classic' && (
          <div className={styles.dialogFooter}>
            {isShowReset && (
              <Button variant="danger" onClick={handleReset} className={styles.resetBtn}>
                {resetText}
              </Button>
            )}
            <Button variant="secondary" onClick={handleCancel}>
              {cancelText}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {confirmText}
            </Button>
          </div>
        )}
        <ConfirmationDialog
          isOpen={isResetConfirmOpen}
          title="确认重置"
          message="确定要将所有设置重置为默认值吗？此操作无法撤回。"
          confirmLabel="全部重置"
          cancelLabel="取消"
          confirmVariant="danger"
          cancelVariant="secondary"
          onConfirm={handleConfirmReset}
          onCancel={() => setIsResetConfirmOpen(false)}
        />
      </div>
    );
  }

  // Dialog 模式且未打开，直接返回 null
  if (!isOpen) return null;

  // Dialog 模式，使用 Portal 挂载到 body 上
  return ReactDOM.createPortal(
    <div
      className={styles.dialogOverlay}
      onClick={() => isMaskClosable && handleCancel()}
    >
      <div
        className={`${styles.dialogWindow} ${styleMode === 'classic' ? styles.classic : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.dialogHeader}>
          <h3 className={styles.dialogTitle}>{title}</h3>
          <button type="button" className={styles.closeBtn} onClick={handleCancel}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.dialogContent}>
          {mainContent}
        </div>

        {/* Footer */}
        {styleMode !== 'classic' && (
          <div className={styles.dialogFooter}>
            {isShowReset && (
              <Button variant="danger" onClick={handleReset} className={styles.resetBtn}>
                {resetText}
              </Button>
            )}
            <Button variant="secondary" onClick={handleCancel}>
              {isLiveUpdate ? '关闭' : cancelText}
            </Button>
            {!isLiveUpdate && (
              <Button variant="primary" onClick={handleSave}>
                {confirmText}
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={isResetConfirmOpen}
        title="确认重置"
        message="确定要将所有设置重置为默认值吗？此操作无法撤回。"
        confirmLabel="全部重置"
        cancelLabel="取消"
        confirmVariant="danger"
        cancelVariant="secondary"
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetConfirmOpen(false)}
      />
    </div>,
    document.body
  );
}
