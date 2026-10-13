import React, { forwardRef } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { Menu as BaseMenu } from '@base-ui/react/menu';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { useRecapPortal } from './provider';
import { cn } from '../lib/utils';
import { Button, IconButton, Kbd } from './foundations';
import { Icon, type IconName } from './icons';

export const DialogRoot = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'dialog' | 'peek' | 'sheet'; backdrop?: boolean;
}
export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(function DialogContent({ children, className, variant = 'dialog', backdrop = true, ...props }, ref) {
  const portal = useRecapPortal();
  return <BaseDialog.Portal container={portal}>
    {backdrop && <BaseDialog.Backdrop className="rc-backdrop" />}
    <BaseDialog.Popup ref={ref} className={cn('rc-dialog', `rc-dialog--${variant}`, className)} {...props}>{children}</BaseDialog.Popup>
  </BaseDialog.Portal>;
});
export interface DialogProps {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string;
  children: React.ReactNode; footer?: React.ReactNode; trigger?: React.ReactElement;
  variant?: 'dialog' | 'peek' | 'sheet'; className?: string; modal?: boolean;
}
export function Dialog({ open, onOpenChange, title, description, children, footer, trigger, variant = 'dialog', className, modal = true }: DialogProps) {
  return <DialogRoot open={open} onOpenChange={onOpenChange} modal={modal}>
    {trigger && <DialogTrigger render={trigger} />}
    <DialogContent variant={variant} className={className} backdrop={modal}>
      <header className="rc-dialog-header"><div><DialogTitle className="rc-dialog-title">{title}</DialogTitle><DialogDescription className="rc-dialog-description">{description}</DialogDescription></div>
        <DialogClose render={<IconButton icon="close" label="关闭" />} />
      </header>
      <div className="rc-dialog-body">{children}</div>{footer && <footer className="rc-dialog-footer">{footer}</footer>}
    </DialogContent>
  </DialogRoot>;
}
export function Sheet(props: Omit<DialogProps, 'variant'>) { return <Dialog {...props} variant="sheet" />; }
export interface ConfirmDialogProps { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel?: string; onConfirm: () => void; }
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = '确认删除', onConfirm }: ConfirmDialogProps) {
  const portal = useRecapPortal();
  return <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}><BaseAlertDialog.Portal container={portal}>
    <BaseAlertDialog.Backdrop className="rc-backdrop" /><BaseAlertDialog.Popup className="rc-dialog">
      <div className="rc-dialog-header"><div><BaseAlertDialog.Title className="rc-dialog-title">{title}</BaseAlertDialog.Title>
        <BaseAlertDialog.Description className="rc-dialog-description">{description}</BaseAlertDialog.Description></div></div>
      <footer className="rc-dialog-footer"><BaseAlertDialog.Close render={<Button />}>取消</BaseAlertDialog.Close>
        <Button variant="danger" onClick={() => { onConfirm(); onOpenChange(false); }}>{confirmLabel}</Button></footer>
    </BaseAlertDialog.Popup>
  </BaseAlertDialog.Portal></BaseAlertDialog.Root>;
}
export interface MenuAction { id: string; label: string; icon?: IconName; shortcut?: string; disabled?: boolean; danger?: boolean; separatorBefore?: boolean; onSelect: () => void; }
export interface DropdownMenuProps { trigger: React.ReactElement; items: MenuAction[]; label?: string; }
export function DropdownMenu({ trigger, items, label = '操作菜单' }: DropdownMenuProps) {
  const portal = useRecapPortal();
  return <BaseMenu.Root><BaseMenu.Trigger render={trigger} /><BaseMenu.Portal container={portal}>
    <BaseMenu.Positioner sideOffset={6} align="end" className="rc-positioner">
      <BaseMenu.Popup className="rc-menu-popup" aria-label={label}>
        {items.map(item => <React.Fragment key={item.id}>{item.separatorBefore && <BaseMenu.Separator className="rc-separator" />}
          <BaseMenu.Item className="rc-menu-item" disabled={item.disabled} data-danger={item.danger || undefined} onClick={item.onSelect}>
            {item.icon && <Icon name={item.icon} />}<span>{item.label}</span>{item.shortcut && <span className="rc-menu-trailing"><Kbd>{item.shortcut}</Kbd></span>}
          </BaseMenu.Item>
        </React.Fragment>)}
      </BaseMenu.Popup>
    </BaseMenu.Positioner>
  </BaseMenu.Portal></BaseMenu.Root>;
}
export interface PopoverProps { trigger: React.ReactElement; children: React.ReactNode; label: string; open?: boolean; onOpenChange?: (open: boolean) => void; }
export function Popover({ trigger, children, label, open, onOpenChange }: PopoverProps) {
  const portal = useRecapPortal();
  return <BasePopover.Root open={open} onOpenChange={onOpenChange}><BasePopover.Trigger render={trigger} />
    <BasePopover.Portal container={portal}><BasePopover.Positioner sideOffset={8} className="rc-positioner">
      <BasePopover.Popup className="rc-popover" aria-label={label}>{children}</BasePopover.Popup>
    </BasePopover.Positioner></BasePopover.Portal>
  </BasePopover.Root>;
}
export function TooltipProvider({ children }: { children: React.ReactNode }) { return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>; }
export function Tooltip({ children, content }: { children: React.ReactElement; content: React.ReactNode }) {
  const portal = useRecapPortal();
  return <BaseTooltip.Root><BaseTooltip.Trigger render={children} /><BaseTooltip.Portal container={portal}>
    <BaseTooltip.Positioner sideOffset={8} className="rc-positioner"><BaseTooltip.Popup className="rc-tooltip">{content}</BaseTooltip.Popup></BaseTooltip.Positioner>
  </BaseTooltip.Portal></BaseTooltip.Root>;
}
