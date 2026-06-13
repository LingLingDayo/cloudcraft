import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from './index';
import type { SettingsConfig } from './types';
import styles from './SettingsModal.module.scss';

// Mock translation
vi.mock('@i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const keys: Record<string, string> = {
        'common.cancel': 'Cancel',
        'common.confirm': 'Confirm',
      };
      return keys[key] || key;
    },
  }),
}));

interface TestData {
  name: string;
  description: string;
  enabled: boolean;
  volume: number;
  mode: string;
  roles: string[];
}

const CONFIG: SettingsConfig<TestData> = {
  groups: [
    {
      id: 'general',
      title: 'General Settings',
      defaultCollapsed: false,
      controls: [
        {
          key: 'name',
          label: 'Name',
          type: 'text',
          placeholder: 'Enter name',
          defaultValue: 'DefaultName',
        },
        {
          key: 'description',
          label: 'Description',
          type: 'textarea',
          placeholder: 'Enter description',
          defaultValue: 'DefaultDesc',
        },
        {
          key: 'enabled',
          label: 'Enabled',
          type: 'boolean',
          defaultValue: true,
        },
        {
          key: 'volume',
          label: 'Volume',
          type: 'slider',
          min: 0,
          max: 100,
          step: 5,
          defaultValue: 50,
        },
        {
          key: 'mode',
          label: 'Mode',
          type: 'select',
          defaultValue: 'easy',
          options: [
            { label: 'Easy', value: 'easy' },
            { label: 'Hard', value: 'hard' },
          ],
        },
        {
          key: 'roles',
          label: 'Roles',
          type: 'select',
          isMultiple: true,
          defaultValue: ['admin'],
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ],
        },
        {
          key: 'info',
          label: 'Computed Info',
          type: 'ui-computed-info',
          valueGetter: (data) => `Name is: ${data.name}`,
        },
        {
          key: 'triggerBtn',
          label: 'Trigger Button',
          type: 'button',
          buttonText: 'Action Button',
          onClick: () => {
            return { name: 'ButtonClicked' };
          },
        },
      ],
    },
  ],
};

const INITIAL_DATA: TestData = {
  name: 'John',
  description: 'A player',
  enabled: false,
  volume: 30,
  mode: 'hard',
  roles: ['user'],
};

describe('SettingsModal component', () => {
  it('should not render anything when isOpen is false', () => {
    const onUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={false}
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        onUpdate={onUpdate}
      />
    );

    expect(screen.queryByText('General Settings')).not.toBeInTheDocument();
  });

  it('should render correct input controls with values in dialog mode', () => {
    const onUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        title="Game Config"
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Game Config')).toBeInTheDocument();
    expect(screen.getByText('General Settings')).toBeInTheDocument();

    // 检查 Name 文本框初始值
    const nameInput = screen.getByPlaceholderText('Enter name') as HTMLInputElement;
    expect(nameInput.value).toBe('John');

    // 检查 Description 文本域初始值
    const descInput = screen.getByPlaceholderText('Enter description') as HTMLTextAreaElement;
    expect(descInput.value).toBe('A player');

    // 检查 Volume 滑块值
    expect(screen.getByText('30')).toBeInTheDocument();

    // 检查 Computed Info 的 valueGetter 计算结果
    expect(screen.getByText('Name is: John')).toBeInTheDocument();

    // 检查 Action Button 是否渲染
    expect(screen.getByText('Action Button')).toBeInTheDocument();
  });

  it('should trigger onUpdate immediately on control change in liveUpdate mode', () => {
    const onUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        isLiveUpdate={true}
        onUpdate={onUpdate}
      />
    );

    // 修改 Name
    const nameInput = screen.getByPlaceholderText('Enter name');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(onUpdate).toHaveBeenLastCalledWith({ name: 'Alice' });

    // 点击 Toggle 开关
    const switchEl = screen.getByText('Enabled').closest(`.${styles.controlWrapper}`)?.querySelector(`.${styles.switchContainer}`);
    if (switchEl) {
      fireEvent.click(switchEl);
      expect(onUpdate).toHaveBeenLastCalledWith({ enabled: true });
    }

    // 滑块变化
    const sliderInput = screen.getByRole('slider');
    fireEvent.change(sliderInput, { target: { value: 75 } });
    expect(onUpdate).toHaveBeenLastCalledWith({ volume: 75 });
  });

  it('should trigger onClose and not trigger onUpdate when Cancel is clicked in localEdit mode', () => {
    const onUpdate = vi.fn();
    const onClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        isLiveUpdate={false}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    );

    // 修改 Name
    const nameInput = screen.getByPlaceholderText('Enter name');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(onUpdate).not.toHaveBeenCalled();

    // 点击取消按钮，不应触发 onUpdate，触发 onClose
    fireEvent.click(screen.getByText('取消'));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('should trigger onUpdate and onConfirm when Confirm is clicked in localEdit mode', () => {
    const onUpdate = vi.fn();
    const onConfirm = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        isLiveUpdate={false}
        onUpdate={onUpdate}
        onConfirm={onConfirm}
      />
    );

    // 修改 Name
    const nameInput = screen.getByPlaceholderText('Enter name');
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    expect(onUpdate).not.toHaveBeenCalled();
    
    // 点击确认
    fireEvent.click(screen.getByText('确认'));
    expect(onUpdate).toHaveBeenCalledWith({
      name: 'Alice',
      description: 'A player',
      enabled: false,
      volume: 30,
      mode: 'hard',
      roles: ['user'],
    });
    expect(onConfirm).toHaveBeenCalled();
  });

  it('should trigger button onClick action', () => {
    const onUpdate = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        data={INITIAL_DATA}
        settingsConfig={CONFIG}
        context={null}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByText('Action Button'));
    expect(onUpdate).toHaveBeenCalledWith({ name: 'ButtonClicked' });
  });

  it('should support pages config with Sidebar tab switching and ui-custom control rendering', () => {
    const onUpdate = vi.fn();
    const pagesConfig = {
      pages: [
        {
          id: 'page1',
          title: 'Tab 1',
          groups: [
            {
              id: 'group1',
              title: 'Group 1',
              controls: [
                {
                  key: 'name',
                  label: 'Name Input',
                  type: 'text' as const,
                },
              ],
            },
          ],
        },
        {
          id: 'page2',
          title: 'Tab 2',
          groups: [
            {
              id: 'group2',
              title: 'Group 2',
              controls: [
                {
                  key: 'customField',
                  type: 'ui-custom' as const,
                  render: () => <div data-testid="my-custom-node">Custom Node</div>,
                },
              ],
            },
          ],
        },
      ],
    };

    render(
      <SettingsModal
        isOpen={true}
        data={INITIAL_DATA}
        settingsConfig={pagesConfig}
        context={null}
        onUpdate={onUpdate}
      />
    );

    // 默认展示 Tab 1 的内容
    expect(screen.getByText('Tab 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 2')).toBeInTheDocument();
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.queryByText('Group 2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('my-custom-node')).not.toBeInTheDocument();

    // 点击切换到 Tab 2
    fireEvent.click(screen.getByText('Tab 2'));
    expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
    expect(screen.getByText('Group 2')).toBeInTheDocument();
    expect(screen.getByTestId('my-custom-node')).toBeInTheDocument();
    expect(screen.getByText('Custom Node')).toBeInTheDocument();
  });
});
