# react-dom-transfer

[中文文档](./README.zh-CN.md)

Move DOM elements between containers without unmounting React components.

Preserves video playback, iframe state, CSS animations, and all DOM state during transfer — with optional FLIP transition animations.

## The Problem

In React, when you need to move a heavy stateful element (like a video player) from Container A to Container B:

- **React's default**: unmount → remount → state lost, video restarts
- **react-reparenting**: modifies entire Fiber tree → Context changes, Effects re-run
- **react-reverse-portal**: Portal-based → no transition animation support

## The Solution

`react-dom-transfer` takes a minimal approach: **swap only the Fiber `stateNode` pointer, don't touch the Fiber tree structure**.

- ✅ No unmount/remount — DOM node stays alive
- ✅ No Context changes — Fiber tree structure unchanged
- ✅ No Effects re-run — React doesn't know anything happened
- ✅ Built-in FLIP animations — smooth transitions between containers
- ✅ ~200 lines — minimal, auditable code

## Install

```bash
npm install react-dom-transfer
```

## Usage

### Hook API

```tsx
import { useDomTransfer } from 'react-dom-transfer';

function App() {
  const { sourceRef, targetRef, transfer, restore, isTransferred } =
    useDomTransfer({
      transition: 'all 0.3s ease',
    });

  return (
    <>
      {/* Source: e.g. a feed card */}
      <div ref={sourceRef}>
        <video src="live-stream.flv" autoPlay />
      </div>

      {/* Target: e.g. a detail page */}
      <div ref={targetRef} />

      <button onClick={isTransferred ? restore : transfer}>
        {isTransferred ? 'Back' : 'Enter'}
      </button>
    </>
  );
}
```

### Imperative API

```typescript
import { transferDom, restoreDom } from 'react-dom-transfer';

// Move element from current parent to target container
const state = transferDom(element, targetContainer, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('Transfer complete'),
});

// Later: move it back
restoreDom(state, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('Restored'),
});
```

## How It Works

### 1. FLIP Animation

Uses the [FLIP technique](https://aerotwist.com/blog/flip-your-animations/) (First, Last, Invert, Play):

1. Record element's current position (`getBoundingClientRect`)
2. Detach from source, apply `position: fixed` at original coordinates
3. CSS transition to target position
4. On `transitionend`, nest into target container

### 2. Fiber stateNode Swap

React internally attaches `__reactFiber$xxx` properties to DOM nodes. When we move a DOM node, we update the Fiber's `stateNode` (and its `alternate`) to point to the new location:

```
React Fiber Tree:  unchanged (child/sibling/return pointers stay the same)
Fiber.stateNode:   updated to point to new DOM position
Result:            React thinks nothing happened, DOM is in new location
```

This is fundamentally different from `react-reparenting`, which modifies the entire Fiber tree structure (changing `child`, `sibling`, `return`, and `index` pointers), causing Context to change and Effects to re-run.

## API Reference

### `useDomTransfer(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transition` | `string` | — | CSS transition string (e.g. `'all 0.3s ease'`) |
| `zIndex` | `number` | `9999` | z-index during animation |
| `timeout` | `number` | `3000` | Fallback timeout (ms) if `transitionend` doesn't fire |
| `onTransferEnd` | `() => void` | — | Called after transfer completes |
| `onRestoreEnd` | `() => void` | — | Called after restore completes |

Returns:

| Property | Type | Description |
|----------|------|-------------|
| `sourceRef` | `RefObject` | Attach to source container |
| `targetRef` | `RefObject` | Attach to target container |
| `transfer` | `() => void` | Move DOM from source to target |
| `restore` | `() => void` | Move DOM back to source |
| `isTransferred` | `boolean` | Current state |

### `transferDom(element, target, options?)`

Imperatively transfer a DOM element to a target container. Returns a state object for `restoreDom`.

### `restoreDom(state, options?)`

Restore a previously transferred element back to its original container.

## Use Cases

- **Video players** — move between feed cards and detail pages without interrupting playback
- **Live streaming** — seamless room transitions
- **Map widgets** — move between sidebar preview and full-screen view
- **Media editors** — move preview panels between layouts

## Comparison

| | react-dom-transfer | react-reparenting | react-reverse-portal |
|---|---|---|---|
| Approach | Swap stateNode only | Rebuild Fiber tree | Portal target switch |
| Fiber tree modified | ❌ No | ✅ Yes | ❌ No |
| Context preserved | ✅ Yes | ❌ Changes | ✅ Yes |
| Effects re-run | ❌ No | ✅ Yes | ❌ No |
| Transition animation | ✅ Built-in | ❌ No | ❌ No |
| Maintained | ✅ Active | ❌ 2021 | ❌ 2021 |

## Caveats

- Relies on React's internal `__reactFiber$` properties. These are not part of React's public API and may change between major versions. The library includes detection and warnings.
- Designed for React 16.8+ (Hooks). Tested on React 18.
- The source container gets a placeholder `<div>` during transfer to prevent layout collapse.

## Inspired By

This approach is extracted from real-world production code at scale, handling seamless video player transitions in feed-based applications serving millions of users.

## License

MIT
