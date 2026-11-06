import { useEffect, useRef } from 'react';

/** Native modal behavior with scroll locking and StrictMode-safe focus restoration. */
export function useModalDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  // Capture before React commits any autoFocus control inside the new dialog.
  const returnFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      alive.current = false;
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
      else document.getElementById('main')?.focus({ preventScroll: true });
    };
  }, []);
  return { dialog, alive };
}
