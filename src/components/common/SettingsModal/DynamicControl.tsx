/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import type {
  ControlDefinition,
  SettingsData,
  SettingsPatch,
} from './types';
import { SettingsUtils } from './utils';
import {
  ControlLabel,
  ControlDescription,
  ControlError,
  TextInput,
  TextareaControl,
  SwitchControl,
  SliderControl,
  SelectControl,
  ButtonControl,
  ComputedInfoControl,
  CustomControl,
} from './controls';
import styles from './SettingsModal.module.scss';

const CONTROL_MAPPING: Record<string, React.FC<any>> = {
  'text': TextInput,
  'textarea': TextareaControl,
  'boolean': SwitchControl,
  'slider': SliderControl,
  'select': SelectControl,
  'button': ButtonControl,
  'ui-computed-info': ComputedInfoControl,
  'ui-custom': CustomControl,
};

interface DynamicControlProps<TData extends SettingsData, TContext = unknown> {
  control: ControlDefinition<TData, TContext>;
  component: TData;
  context: TContext;
  onUpdate: (updates: Partial<TData>) => void;
  disabled?: boolean;
}

export function DynamicControl<TData extends SettingsData, TContext = unknown>({
  control,
  component,
  context,
  onUpdate,
  disabled: externalDisabled,
}: DynamicControlProps<TData, TContext>) {
  const [error, setError] = useState<string | undefined>();

  // 1. 获取值（如果提供 valueGetter，则动态计算；否则读取字段数据）
  const value = control.valueGetter
    ? control.valueGetter(component, context)
    : component[control.key];

  // 2. 检查禁用状态
  const isSelfDisabled = control.disabled
    ? (typeof control.disabled === 'function' ? control.disabled(component) : control.disabled)
    : false;
  const isDisabled = externalDisabled || isSelfDisabled;

  // 3. 检查可见性
  if (!SettingsUtils.isVisible(control, component, context)) {
    return null;
  }

  // 4. 统一处理值变化
  const handleUpdate = (newValue: any) => {
    if (isDisabled) return;

    const ctrl = control as any;

    // A. 校验 (validate)
    if (ctrl.validate) {
      const result = ctrl.validate(newValue, component, context);
      if (result === false || typeof result === 'string') {
        setError(typeof result === 'string' ? result : '输入的值无效');
        return;
      }
    }

    setError(undefined);

    // B. 值转化 (valueSetter)
    let processedValue = newValue;
    if (ctrl.valueSetter) {
      processedValue = ctrl.valueSetter(newValue, component, context);
    }

    let updates = {
      [ctrl.key]: processedValue,
    } as SettingsPatch<TData>;

    // C. 副作用联动 (onValueChange)
    if (ctrl.onValueChange) {
      const sideEffects = ctrl.onValueChange(processedValue, component, context);
      if (sideEffects) {
        updates = { ...updates, ...sideEffects };
      }
    }

    onUpdate(updates as Partial<TData>);
  };

  // 获取控件组件
  const ControlComponent = CONTROL_MAPPING[control.type];
  if (!ControlComponent) return null;

  // 是否独占一行
  const isFullWidth =
    control.fullWidth ??
    ['textarea', 'slider', 'ui-computed-info', 'button', 'ui-custom'].includes(control.type);

  return (
    <div
      className={`${styles.controlWrapper} ${isFullWidth ? styles.fullWidth : styles.halfWidth} ${
        control.type === 'boolean' ? styles.booleanWrapper : ''
      } ${control.type === 'slider' ? styles.sliderWrapper : ''}`}
    >
      {/* 按钮、computed-info 与 ui-custom 除外，其它显示 label */}
      {control.type !== 'button' && control.type !== 'ui-computed-info' && control.type !== 'ui-custom' && (
        <ControlLabel label={control.label} tooltip={control.tooltip} disabled={isDisabled} />
      )}
      {control.description && <ControlDescription text={control.description} />}

      <ControlComponent
        control={control}
        value={value}
        disabled={isDisabled}
        error={error}
        onUpdate={handleUpdate}
        onRawUpdate={onUpdate}
        component={component}
        context={context}
      />

      {error && <ControlError text={error} />}
    </div>
  );
}
