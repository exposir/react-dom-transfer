import { useCallback, useRef, useState } from 'react';
import { transferDom, restoreDom } from './core';
import type { TransferOptions, TransferResult } from './types';

/**
 * React Hook for transferring a DOM element between two containers
 * without unmounting or re-rendering.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { sourceRef, targetRef, transfer, restore, isTransferred } = useDomTransfer({
 *     transition: 'all 0.3s ease',
 *   });
 *
 *   return (
 *     <>
 *       {/* Feed card *\/}
 *       <div ref={sourceRef}>
 *         <VideoPlayer />
 *       </div>
 *
 *       {/* Detail page *\/}
 *       <div ref={targetRef} />
 *
 *       <button onClick={isTransferred ? restore : transfer}>
 *         {isTransferred ? 'Back' : 'Enter'}
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */
export function useDomTransfer(options: TransferOptions = {}): TransferResult {
  const {
    transition,
    zIndex = 9999,
    timeout = 3000,
    onTransferEnd,
    onRestoreEnd,
  } = options;

  const sourceRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<ReturnType<typeof transferDom> | null>(null);
  const [isTransferred, setIsTransferred] = useState(false);

  const transfer = useCallback(() => {
    const source = sourceRef.current;
    const target = targetRef.current;

    if (!source || !target) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          '[useDomTransfer] sourceRef or targetRef is not attached to a DOM element.'
        );
      }
      return;
    }

    // Find the actual element to transfer (first child of source container)
    const element = source.firstElementChild as HTMLElement;
    if (!element) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useDomTransfer] Source container is empty.');
      }
      return;
    }

    stateRef.current = transferDom(element, target, {
      transition,
      zIndex,
      timeout,
      onEnd: () => {
        setIsTransferred(true);
        onTransferEnd?.();
      },
    });
  }, [transition, zIndex, timeout, onTransferEnd]);

  const restore = useCallback(() => {
    if (!stateRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[useDomTransfer] Nothing to restore.');
      }
      return;
    }

    restoreDom(stateRef.current, {
      transition,
      zIndex,
      timeout,
      onEnd: () => {
        setIsTransferred(false);
        stateRef.current = null;
        onRestoreEnd?.();
      },
    });
  }, [transition, zIndex, timeout, onRestoreEnd]);

  return {
    sourceRef,
    targetRef,
    transfer,
    restore,
    isTransferred,
  };
}
