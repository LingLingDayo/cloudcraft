/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { CSSProperties } from 'react';

export type SettingsData = Record<string, any>;
export type SelectOptionValue = string | number;
export type ComputedDisplayValue = string | number | null | undefined;

export type IfAny<T, Y, N> = 0 extends (1 & T) ? Y : N;

export type SettingsPatch<TData extends SettingsData = any> =
  IfAny<TData, any, Partial<TData> & Record<string, unknown>>;

export type SettingsPredicate<TData extends SettingsData = any, TContext = any> = (
  component: TData,
  context: TContext,
) => boolean;

export type SettingsDisabled<TData extends SettingsData = any> =
  | boolean
  | ((component: TData) => boolean);

export type SettingsValueGetter<
  TData extends SettingsData = any,
  TContext = any,
  TValue = any,
> = (component: TData, context: TContext) => TValue;

export type SettingsValidator<
  TData extends SettingsData = any,
  TContext = any,
  TValue = any,
> = (value: any, component: TData, context: TContext) => string | boolean | null | undefined;

export type SettingsValueSetter<
  TData extends SettingsData = any,
  TContext = any,
  TValue = any,
> = (value: TValue, component: TData, context: TContext) => any;

export type SettingsValueChangeHandler<
  TData extends SettingsData = any,
  TContext = any,
  TValue = any,
> = (newValue: any, component: TData, context: TContext) => SettingsPatch<TData>;

export type ControlType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'slider'
  | 'select'
  | 'button'
  | 'ui-computed-info';

export interface SelectOption<
  TData extends SettingsData = any,
  TContext = any,
  TValue extends SelectOptionValue = SelectOptionValue,
> {
  label: string;
  value: TValue;
  description?: string;
  hidden?: SettingsPredicate<TData, TContext>;
  visible?: SettingsPredicate<TData, TContext>;
}

export interface BaseControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
  TType extends ControlType = ControlType,
  TValue = unknown,
> {
  key: string;
  label?: string | null;
  type: TType;
  description?: string;
  tooltip?: string;
  fullWidth?: boolean;
  disabled?: SettingsDisabled<TData>;
  defaultValue?: TValue;
  hidden?: SettingsPredicate<TData, TContext>;
  visible?: SettingsPredicate<TData, TContext>;
  valueGetter?: SettingsValueGetter<TData, TContext>;
}

export interface ValueControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
  TType extends ControlType = ControlType,
  TValue = any,
> extends BaseControlDefinition<TData, TContext, TType, TValue> {
  validate?: SettingsValidator<TData, TContext, TValue>;
  valueSetter?: SettingsValueSetter<TData, TContext, TValue>;
  onValueChange?: SettingsValueChangeHandler<TData, TContext, TValue>;
}

export interface TextControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends ValueControlDefinition<TData, TContext, 'text', string | number> {
  placeholder?: string;
}

export interface TextareaControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends ValueControlDefinition<TData, TContext, 'textarea', string> {
  placeholder?: string;
  rows?: number;
  style?: CSSProperties;
}

export interface BooleanControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends ValueControlDefinition<TData, TContext, 'boolean', boolean> {}

export interface SliderControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends ValueControlDefinition<TData, TContext, 'slider', number> {
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends ValueControlDefinition<
    TData,
    TContext,
    'select',
    SelectOptionValue | SelectOptionValue[]
  > {
  options: SelectOption<TData, TContext>[];
  isMultiple?: boolean;
}

export interface ButtonControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends BaseControlDefinition<TData, TContext, 'button'> {
  buttonText?: string;
  onClick: (component: TData, context: TContext) => SettingsPatch<TData> | void;
}

export interface UiComputedInfoControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> extends BaseControlDefinition<TData, TContext, 'ui-computed-info'> {
  style?: CSSProperties;
}

export type ControlDefinition<
  TData extends SettingsData = any,
  TContext = any,
> =
  | TextControlDefinition<TData, TContext>
  | TextareaControlDefinition<TData, TContext>
  | BooleanControlDefinition<TData, TContext>
  | SliderControlDefinition<TData, TContext>
  | SelectControlDefinition<TData, TContext>
  | ButtonControlDefinition<TData, TContext>
  | UiComputedInfoControlDefinition<TData, TContext>;

export interface SettingsGroup<
  TData extends SettingsData = any,
  TContext = any,
> {
  id: string;
  title: string;
  color?: string;
  description?: string;
  defaultCollapsed?: boolean;
  hidden?: SettingsPredicate<TData, TContext>;
  visible?: SettingsPredicate<TData, TContext>;
  controls: ControlDefinition<TData, TContext>[];
  isShowReset?: boolean;
}

export interface SettingsConfig<
  TData extends SettingsData = any,
  TContext = any,
> {
  groups: SettingsGroup<TData, TContext>[];
  readonlyControls?: string[];
}

export interface ControlRendererProps<
  TData extends SettingsData = any,
  TContext = any,
> {
  control: ControlDefinition<TData, TContext>;
  value: any;
  disabled: boolean;
  defaultTip?: string;
  error?: string;
  onUpdate: (value: any) => void;
  onRawUpdate: (updates: Partial<TData>) => void;
  component: TData;
  context: TContext;
}
