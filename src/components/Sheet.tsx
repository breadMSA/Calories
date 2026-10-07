// Modal sheet: slides up from the bottom on phones, centred dialog on larger screens.

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './ui';

// Only the top-most sheet reacts to Escape.
const stack: symbol[] = [];

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  headerExtra?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('sheet');
    stack.push(token);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.classList.add('scroll-locked');
    // Hide the page behind the sheet from assistive tech and keyboard focus.
    const root = document.getElementById('root');
    if (root) root.inert = true;

    // Focus the first form control, or the panel itself, without scrolling the page.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus], input:not([type=radio]):not([type=checkbox]), textarea');
    (first && window.matchMedia('(pointer: fine)').matches ? first : panel)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack[stack.length - 1] === token) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      stack.splice(stack.indexOf(token), 1);
      if (stack.length === 0) {
        document.body.classList.remove('scroll-locked');
        if (root) root.inert = false;
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={`sheet sheet-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="sheet-header">
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          {headerExtra}
          <IconButton label="關閉" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="sheet-body">{children}</div>
        {footer ? <footer className="sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
