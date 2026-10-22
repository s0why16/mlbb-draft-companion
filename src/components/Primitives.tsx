import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', icon, iconRight, full, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn('btn', `btn--${variant}`, `btn--${size}`, full && 'btn--full', className)}
      {...props}
    >
      {icon && <span className="btn__icon">{icon}</span>}
      <span className="btn__label">{children}</span>
      {iconRight && <span className="btn__icon btn__icon--right">{iconRight}</span>}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'default' | 'danger' | 'cyan';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tone = 'default', className, children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cn('icon-btn', `icon-btn--${tone}`, className)} {...props}>
      {children}
    </button>
  );
});

export function Chip({
  children,
  tone = 'muted',
  className,
}: {
  children: ReactNode;
  tone?: 'muted' | 'cyan' | 'gold' | 'red' | 'green' | 'violet';
  className?: string;
}) {
  return <span className={cn('chip', `chip--${tone}`, className)}>{children}</span>;
}

export function Eyebrow({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={cn('eyebrow', className)} style={style}>{children}</div>;
}

export function Meter({
  value,
  tone = 'cyan',
  label,
  compact = false,
}: {
  value: number;
  tone?: 'cyan' | 'red' | 'gold' | 'green' | 'violet';
  label?: string;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('meter', compact && 'meter--compact')}>
      {label && (
        <div className="meter__head">
          <span>{label}</span>
          <span className="meter__value">{Math.round(clamped)}</span>
        </div>
      )}
      <div className="meter__track">
        <span className={cn('meter__fill', `meter__fill--${tone}`)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function Divider({ label }: { label?: string }) {
  return (
    <div className="divider">
      <span />
      {label && <em>{label}</em>}
      <span />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
