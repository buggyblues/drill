import React, { useId, useRef, useState } from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { Select as BaseSelect } from '@base-ui/react/select';
import { useRecapPortal } from './provider';
import { cn, clamp } from '../lib/utils';
import { validateFiles, formatBytes } from '../lib/domain';
import { Icon, type IconName } from './icons';
import { Button } from './foundations';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; hint?: string; error?: string; leading?: IconName; hideLabel?: boolean;
}
export function TextField({ label, hint, error, leading, hideLabel, id, className, ...props }: TextFieldProps) {
  const generated = useId(), inputId = id ?? generated;
  const descriptionId = `${inputId}-description`;
  return <div className={cn('rc-field', className)}>
    <label htmlFor={inputId} className={hideLabel ? 'rc-sr-only' : 'rc-field-label'}>{label}{props.required && <span aria-hidden="true"> *</span>}</label>
    <div className="rc-input-wrap">{leading && <Icon name={leading} />}
      <input {...props} id={inputId} className="rc-input" aria-invalid={!!error || props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], (error || hint) ? descriptionId : null].filter(Boolean).join(' ') || undefined} />
    </div>
    {(error || hint) && <p id={descriptionId} className={error ? 'rc-field-error' : 'rc-field-hint'} role={error ? 'alert' : undefined}>{error || hint}</p>}
  </div>;
}
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label: string; hint?: string; error?: string; hideLabel?: boolean; }
export function Textarea({ label, hint, error, hideLabel, id, className, ...props }: TextareaProps) {
  const generated = useId(), inputId = id ?? generated;
  return <div className={cn('rc-field', className)}><label htmlFor={inputId} className={hideLabel ? 'rc-sr-only' : 'rc-field-label'}>{label}</label>
    <textarea {...props} id={inputId} className="rc-input rc-textarea" aria-invalid={!!error || props['aria-invalid']} aria-describedby={[props['aria-describedby'], error || hint ? `${inputId}-hint` : null].filter(Boolean).join(' ') || undefined} />
    {(hint || error) && <p id={`${inputId}-hint`} className={error ? 'rc-field-error' : 'rc-field-hint'}>{error || hint}</p>}
  </div>;
}
export interface CheckboxProps { label: string; checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void; disabled?: boolean; name?: string; }
export function Checkbox({ label, ...props }: CheckboxProps) {
  const id = useId();
  return <label className="rc-check-label" htmlFor={id}><BaseCheckbox.Root {...props} id={id} className="rc-checkbox">
    <BaseCheckbox.Indicator><Icon name="check" size={13} /></BaseCheckbox.Indicator>
  </BaseCheckbox.Root><span>{label}</span></label>;
}
export interface SwitchProps extends CheckboxProps { description?: string; }
export function Switch({ label, description, ...props }: SwitchProps) {
  const id = useId();
  return <div className="rc-switch-field"><div><label htmlFor={id}>{label}</label>{description && <p id={`${id}-description`} className="rc-field-hint">{description}</p>}</div>
    <BaseSwitch.Root {...props} id={id} aria-describedby={description ? `${id}-description` : undefined} className="rc-switch">
      <BaseSwitch.Thumb className="rc-switch-thumb" />
    </BaseSwitch.Root>
  </div>;
}
export interface SelectOption { value: string; label: string; disabled?: boolean; }
export interface SelectProps {
  label: string; value: string; onValueChange: (value: string) => void; options: SelectOption[];
  disabled?: boolean; name?: string; hint?: string; hideLabel?: boolean; placeholder?: string;
}
export function Select({ label, value, onValueChange, options, disabled, name, hint, hideLabel, placeholder = '请选择' }: SelectProps) {
  const id = useId(), portal = useRecapPortal();
  return <div className="rc-field"><label id={`${id}-label`} className={hideLabel ? 'rc-sr-only' : 'rc-field-label'}>{label}</label>
    <BaseSelect.Root items={options} value={value} onValueChange={next => { if (next !== null) onValueChange(String(next)); }} disabled={disabled} name={name}>
      <BaseSelect.Trigger className="rc-select-trigger" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined}>
        <BaseSelect.Value placeholder={placeholder} /><BaseSelect.Icon><Icon name="down" size={14} /></BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={portal}><BaseSelect.Positioner sideOffset={6} alignItemWithTrigger={false} className="rc-positioner">
        <BaseSelect.Popup className="rc-menu-popup"><BaseSelect.List>
          {options.map(option => <BaseSelect.Item key={option.value} value={option.value} disabled={option.disabled} className="rc-menu-item">
            <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
            <BaseSelect.ItemIndicator className="rc-menu-trailing"><Icon name="check" /></BaseSelect.ItemIndicator>
          </BaseSelect.Item>)}
        </BaseSelect.List></BaseSelect.Popup>
      </BaseSelect.Positioner></BaseSelect.Portal>
    </BaseSelect.Root>{hint && <p id={`${id}-hint`} className="rc-field-hint">{hint}</p>}
  </div>;
}
export interface ProgressProps { value: number; max?: number; label: string; showValue?: boolean; }
export function Progress({ value, max = 100, label, showValue = false }: ProgressProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue = Number.isFinite(value) ? clamp(value, 0, safeMax) : 0;
  return <div className="rc-progress-wrap">
    {showValue && <div className="rc-progress-label"><span>{label}</span><span>{Math.round(safeValue / safeMax * 100)}%</span></div>}
    <div className="rc-progress" role="progressbar" aria-label={label} aria-valuenow={safeValue} aria-valuemin={0} aria-valuemax={safeMax}>
      <span style={{ width: `${safeValue / safeMax * 100}%` }} />
    </div>
  </div>;
}
export interface FileDropzoneProps {
  onFiles: (files: File[]) => void;
  accept?: string[];
  maxBytes?: number;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
}
export function FileDropzone({ onFiles, accept = ['.md', '.txt', '.json', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.wav', '.m4a'], maxBytes = 50 * 1024 * 1024, multiple = true, disabled = false, label = '拖放文件到这里' }: FileDropzoneProps) {
  const input = useRef<HTMLInputElement>(null), depth = useRef(0);
  const [dragging, setDragging] = useState(false), [errors, setErrors] = useState<string[]>([]);
  function receive(list: FileList | File[]) {
    if (disabled) return;
    const files = Array.from(list).slice(0, multiple ? undefined : 1);
    const result = validateFiles(files, maxBytes, accept); setErrors(result.errors);
    if (result.accepted.length) onFiles(result.accepted as File[]);
    if (input.current) input.current.value = '';
  }
  return <div className="rc-dropzone-wrap"><div className="rc-dropzone" data-dragging={dragging || undefined} data-disabled={disabled || undefined}
    onDragEnter={event => { event.preventDefault(); if (!disabled) { depth.current++; setDragging(true); } }}
    onDragOver={event => { event.preventDefault(); }}
    onDragLeave={event => { event.preventDefault(); depth.current--; if (depth.current <= 0) setDragging(false); }}
    onDrop={event => { event.preventDefault(); depth.current = 0; setDragging(false); receive(event.dataTransfer.files); }}>
    <Icon name="import" size={26} /><strong>{label}</strong><p>选择文件 · 单个不超过 {formatBytes(maxBytes)}</p>
    <Button onClick={() => input.current?.click()} disabled={disabled}>选择文件</Button>
    <input ref={input} type="file" hidden accept={accept.join(',')} multiple={multiple} disabled={disabled} onChange={event => { if (event.target.files) receive(event.target.files); }} aria-label="选择本地文件" />
    <small>{accept.join(' / ')}</small>
  </div>{errors.length > 0 && <div className="rc-field-error" role="alert">{errors.map(error => <p key={error}>{error}</p>)}</div>}</div>;
}
