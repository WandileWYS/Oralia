import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { busy?: boolean; icon: ReactNode }

export function NeuralButton({ busy = false, icon, children, className, disabled, ...props }: Props) {
  return <button {...props} type={props.type || 'button'} disabled={disabled || busy} aria-busy={busy} className={cn('primary-button neural-button rounded-full transition-all duration-300', busy && 'is-busy', className)}>
    <span className="neural-sheen" aria-hidden="true" />
    <span className="neural-content">{busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : icon}<span>{children}</span></span>
  </button>;
}
