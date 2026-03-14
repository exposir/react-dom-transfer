# react-dom-transfer

[中文文档](./README.zh-CN.md)

**Move a DOM element from one React container to another — without React knowing.**

No unmount. No remount. No state loss. The video keeps playing.

```
  ┌──────────────┐                         ┌──────────────────────┐
  │  Feed Card    │      transfer()         │   Detail Page        │
  │ ┌──────────┐ │  ──────────────────────► │ ┌──────────────────┐ │
  │ │ ▶ video  │ │  CSS transition + FLIP   │ │   ▶ video        │ │
  │ └──────────┘ │                          │ │   (same element) │ │
  └──────────────┘                          │ └──────────────────┘ │
                         restore()          └──────────────────────┘
                   ◄──────────────────────
```

## Why?

React destroys DOM when components unmount. For most elements, that's fine. For `<video>`, `<iframe>`, `<canvas>`, and anything with live state — it's a disaster:

- Video restarts from zero
- iframe reloads entirely
- WebGL context is lost
- WebSocket connections drop

Existing solutions either [modify the entire Fiber tree](https://github.com/paol-imi/react-reparenting) (breaking Context and re-running Effects) or [require Portal wrappers](https://github.com/httptoolkit/react-reverse-portal) (no animation support, unmaintained since 2021).

**This library takes a different approach**: swap only the Fiber `stateNode` pointer. React's component tree stays untouched — no Context changes, no Effects re-run, no reconciliation triggered.

## How it's different

| | this library | react-reparenting | react-reverse-portal |
|:--|:--:|:--:|:--:|
| Modifies Fiber tree | ❌ | ✅ | ❌ |
| Context preserved | ✅ | ❌ | ✅ |
| Effects re-run | ❌ | ✅ | ❌ |
| FLIP animation | ✅ | ❌ | ❌ |
| Maintained | ✅ | ❌ 2021 | ❌ 2021 |
| Code size | ~200 LOC | ~400 LOC | ~300 LOC |

## Install

```bash
npm install react-dom-transfer
```

## Quick Start

```tsx
import { useDomTransfer } from 'react-dom-transfer';

function App() {
  const { sourceRef, targetRef, transfer, restore, isTransferred } =
    useDomTransfer({ transition: 'all 0.3s ease' });

  return (
    <>
      <div ref={sourceRef}>
        <video src="stream.flv" autoPlay />
      </div>

      <div ref={targetRef} />

      <button onClick={isTransferred ? restore : transfer}>
        {isTransferred ? 'Back' : 'Go'}
      </button>
    </>
  );
}
```

That's it. The `<video>` flies from source to target with a 0.3s animation. Playback never stops.

## Imperative API

For use outside React components or in class-based code:

```typescript
import { transferDom, restoreDom } from 'react-dom-transfer';

const state = transferDom(element, target, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('done'),
});

// later
restoreDom(state);
```

## How it works

Two things happen when you call `transfer()`:

**1. FLIP animation** — Record position → detach → `position: fixed` at origin → CSS transition to destination → settle into target container.

**2. Fiber stateNode swap** — Copy `__reactFiber$` and `__reactProps$` from the old DOM reference to the new one. Update `fiber.stateNode` (and `fiber.alternate.stateNode`) to point at the moved element. React never notices.

```
What React sees:    Component → Fiber → stateNode → [same pointer]
What actually is:   The DOM node is now in a completely different container
```

## API

### `useDomTransfer(options?)`

```typescript
const { sourceRef, targetRef, transfer, restore, isTransferred } =
  useDomTransfer({
    transition: 'all 0.3s ease', // CSS transition (optional)
    zIndex: 9999,                // z-index during animation
    timeout: 3000,               // fallback if transitionend doesn't fire
    onTransferEnd: () => {},     // called after transfer
    onRestoreEnd: () => {},      // called after restore
  });
```

### `transferDom(element, target, options?) → state`

### `restoreDom(state, options?)`

## Use cases

- Video players moving between feed cards and detail pages
- Live streaming room transitions
- Map previews expanding to fullscreen
- Media editor panels changing layout

## Caveats

- Relies on React's internal `__reactFiber$` property. Not a public API — may change between major React versions. Runtime detection and warnings are included.
- React 16.8+ required (Hooks). Tested on React 18.
- A placeholder `<div>` is inserted in the source container during transfer to prevent layout collapse.

## License

MIT
