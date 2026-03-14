/**
 * react-dom-transfer / core
 *
 * Core logic: swap DOM nodes between containers while keeping React Fiber
 * tree structure untouched. Only the Fiber `stateNode` reference is updated
 * so that React continues to operate on the correct DOM node.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const process: { env: { NODE_ENV?: string } } | undefined;

// ---------------------------------------------------------------------------
// Fiber helpers
// ---------------------------------------------------------------------------

interface FiberNode {
  stateNode: HTMLElement | null;
  alternate: FiberNode | null;
}

/**
 * Get the React internal Fiber key on a DOM element.
 * React attaches properties like `__reactFiber$xxxx` to DOM nodes.
 */
function getReactFiberKey(element: HTMLElement): string | null {
  for (const key of Object.keys(element)) {
    if (key.startsWith('__reactFiber$')) {
      return key;
    }
  }
  return null;
}

/**
 * Get all React internal keys (__reactFiber$, __reactProps$, etc.)
 */
function getReactInternalKeys(element: HTMLElement): string[] {
  return Object.keys(element).filter((key) => key.startsWith('__react'));
}

/**
 * Swap the Fiber stateNode from `oldEl` to `newEl`.
 *
 * This is the core trick: we tell React that the Fiber's real DOM node
 * is now `newEl`, without changing the Fiber tree structure (child/sibling/return).
 * This means React won't re-run effects, won't change Context, and won't
 * trigger reconciliation — it just updates its DOM pointer.
 */
function swapFiberStateNode(oldEl: HTMLElement, newEl: HTMLElement): boolean {
  const fiberKey = getReactFiberKey(oldEl);
  if (!fiberKey) {
    if (isDev) {
      console.warn(
        '[react-dom-transfer] No React Fiber found on element. ' +
          'Is this element rendered by React?'
      );
    }
    return false;
  }

  // Copy all React internal properties to the new element
  const reactKeys = getReactInternalKeys(oldEl);
  for (const key of reactKeys) {
    (newEl as any)[key] = (oldEl as any)[key];
  }

  // Update Fiber.stateNode → point to newEl
  const fiber = (oldEl as any)[fiberKey] as FiberNode;
  if (fiber && fiber.stateNode) {
    fiber.stateNode = newEl;
    // Also update the alternate tree (React's double-buffering)
    if (fiber.alternate) {
      fiber.alternate.stateNode = newEl;
    }
  }

  return true;
}

const isDev =
  typeof process !== 'undefined' &&
  typeof process.env !== 'undefined' &&
  process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface TransferState {
  /** The original parent of the element */
  originalParent: HTMLElement | null;
  /** Placeholder element left behind */
  placeholder: HTMLElement | null;
  /** The element being transferred */
  element: HTMLElement | null;
  /** Original inline styles (to restore later) */
  originalStyles: Partial<CSSStyleDeclaration> | null;
  /** Is currently transferred */
  transferred: boolean;
}

function createState(): TransferState {
  return {
    originalParent: null,
    placeholder: null,
    element: null,
    originalStyles: null,
    transferred: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TransferDomOptions {
  transition?: string;
  zIndex?: number;
  timeout?: number;
  onEnd?: () => void;
}

/**
 * Transfer a DOM element from its current container to a target container,
 * with an optional FLIP-style transition animation.
 *
 * The React Fiber tree is NOT modified — only the stateNode pointer is updated.
 * This means:
 * - No effects re-run
 * - No Context changes
 * - No reconciliation triggered
 *
 * @param element  The DOM element to transfer (e.g., a video player root)
 * @param target   The target container to move the element into
 * @param options  Animation and behavior options
 * @returns        State object used by `restoreDom` to reverse the operation
 */
export function transferDom(
  element: HTMLElement,
  target: HTMLElement,
  options: TransferDomOptions = {}
): TransferState {
  const {
    transition,
    zIndex = 9999,
    timeout = 3000,
    onEnd,
  } = options;

  const state = createState();
  state.element = element;
  state.originalParent = element.parentElement;

  // --- Step 1: Record the FIRST position (for FLIP animation) ---
  const firstRect = element.getBoundingClientRect();

  // --- Step 2: Create a placeholder so the source layout doesn't collapse ---
  const placeholder = document.createElement('div');
  placeholder.style.width = `${firstRect.width}px`;
  placeholder.style.height = `${firstRect.height}px`;
  placeholder.style.visibility = 'hidden';
  state.placeholder = placeholder;

  // Replace element with placeholder in the original parent
  element.parentElement?.replaceChild(placeholder, element);

  // --- Step 3: Float the element on top of the page at its original position ---
  state.originalStyles = {
    position: element.style.position,
    left: element.style.left,
    top: element.style.top,
    width: element.style.width,
    height: element.style.height,
    zIndex: element.style.zIndex,
    transition: element.style.transition,
    margin: element.style.margin,
  };

  Object.assign(element.style, {
    position: 'fixed',
    left: `${firstRect.left}px`,
    top: `${firstRect.top}px`,
    width: `${firstRect.width}px`,
    height: `${firstRect.height}px`,
    zIndex: String(zIndex),
    margin: '0',
  });

  document.body.appendChild(element);

  if (transition) {
    // --- Step 4: Calculate the LAST position (target container) ---
    const lastRect = target.getBoundingClientRect();

    // Force a reflow so the browser registers the "first" position
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    element.offsetHeight;

    // --- Step 5: Animate to the LAST position ---
    element.style.transition = transition;
    Object.assign(element.style, {
      left: `${lastRect.left}px`,
      top: `${lastRect.top}px`,
      width: `${lastRect.width}px`,
      height: `${lastRect.height}px`,
    });

    // --- Step 6: After animation, nest into target container ---
    const settle = () => {
      clearTimeout(fallbackTimer);
      element.removeEventListener('transitionend', settle);

      // Reset styles
      element.style.position = '';
      element.style.left = '';
      element.style.top = '';
      element.style.width = '';
      element.style.height = '';
      element.style.zIndex = '';
      element.style.transition = '';
      element.style.margin = '';

      // Move into target container
      target.appendChild(element);

      // Swap Fiber stateNode
      swapFiberStateNode(placeholder, element);

      state.transferred = true;
      onEnd?.();
    };

    element.addEventListener('transitionend', settle, { once: true });

    // Fallback in case transitionend doesn't fire
    const fallbackTimer = setTimeout(settle, timeout);
  } else {
    // No animation — instant move
    element.style.position = '';
    element.style.left = '';
    element.style.top = '';
    element.style.width = '';
    element.style.height = '';
    element.style.zIndex = '';
    element.style.margin = '';

    target.appendChild(element);
    swapFiberStateNode(placeholder, element);

    state.transferred = true;
    onEnd?.();
  }

  return state;
}

/**
 * Restore a previously transferred DOM element back to its original container.
 *
 * @param state    The state returned by `transferDom`
 * @param options  Animation options for the restore
 */
export function restoreDom(
  state: TransferState,
  options: TransferDomOptions = {}
): void {
  const { element, originalParent, placeholder } = state;

  if (!element || !originalParent || !placeholder || !state.transferred) {
    if (isDev) {
      console.warn('[react-dom-transfer] Cannot restore: invalid state.');
    }
    return;
  }

  const {
    transition,
    zIndex = 9999,
    timeout = 3000,
    onEnd,
  } = options;

  const firstRect = element.getBoundingClientRect();
  const lastRect = placeholder.getBoundingClientRect();

  // Remove from target, float on body
  element.parentElement?.removeChild(element);
  Object.assign(element.style, {
    position: 'fixed',
    left: `${firstRect.left}px`,
    top: `${firstRect.top}px`,
    width: `${firstRect.width}px`,
    height: `${firstRect.height}px`,
    zIndex: String(zIndex),
    margin: '0',
  });
  document.body.appendChild(element);

  const settle = () => {
    if (transition) {
      clearTimeout(fallbackTimer);
      element.removeEventListener('transitionend', settle);
    }

    // Reset styles to original
    const orig = state.originalStyles;
    if (orig) {
      element.style.position = orig.position || '';
      element.style.left = orig.left || '';
      element.style.top = orig.top || '';
      element.style.width = orig.width || '';
      element.style.height = orig.height || '';
      element.style.zIndex = orig.zIndex || '';
      element.style.transition = orig.transition || '';
      element.style.margin = orig.margin || '';
    }

    // Put back into original parent, replacing placeholder
    placeholder.replaceWith(element);
    swapFiberStateNode(placeholder, element);

    state.transferred = false;
    state.placeholder = null;
    state.originalStyles = null;
    onEnd?.();
  };

  let fallbackTimer: ReturnType<typeof setTimeout>;

  if (transition) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    element.offsetHeight;
    element.style.transition = transition;
    Object.assign(element.style, {
      left: `${lastRect.left}px`,
      top: `${lastRect.top}px`,
      width: `${lastRect.width}px`,
      height: `${lastRect.height}px`,
    });
    element.addEventListener('transitionend', settle, { once: true });
    fallbackTimer = setTimeout(settle, timeout);
  } else {
    settle();
  }
}
