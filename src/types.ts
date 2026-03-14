export interface TransferOptions {
  /**
   * CSS transition for the move animation.
   * e.g. 'all 0.3s ease'
   * If not provided, the move is instant.
   */
  transition?: string;

  /**
   * z-index for the floating element during transition.
   * Default: 9999
   */
  zIndex?: number;

  /**
   * Callback when transfer animation completes.
   */
  onTransferEnd?: () => void;

  /**
   * Callback when restore animation completes.
   */
  onRestoreEnd?: () => void;

  /**
   * Timeout (ms) for fallback if transition events don't fire.
   * Default: 3000
   */
  timeout?: number;
}

export interface TransferResult {
  /**
   * Ref to attach to the source container (where the DOM initially lives).
   */
  sourceRef: React.RefObject<HTMLElement | null>;

  /**
   * Ref to attach to the target container (where the DOM should move to).
   */
  targetRef: React.RefObject<HTMLElement | null>;

  /**
   * Move the DOM from source to target with optional animation.
   */
  transfer: () => void;

  /**
   * Move the DOM back from target to source.
   */
  restore: () => void;

  /**
   * Whether the DOM is currently in the target container.
   */
  isTransferred: boolean;
}
