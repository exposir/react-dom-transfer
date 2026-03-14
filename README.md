# react-dom-transfer

[中文文档](./README.zh-CN.md)

**React can't move DOM without destroying it. This library can.**

When React moves an element to a new container, it unmounts and remounts — destroying all DOM state in the process. iframe reloads. Video restarts. Canvas clears. Scroll position resets. Focus is lost.

`react-dom-transfer` moves the actual DOM node between containers while React isn't looking.

```
  ┌─────────────┐                          ┌─────────────────────┐
  │ Container A  │       transfer()         │  Container B        │
  │ ┌─────────┐ │  ───────────────────────► │ ┌─────────────────┐ │
  │ │ element │ │   smooth CSS transition   │ │    element      │ │
  │ └─────────┘ │                           │ │  (same instance)│ │
  └─────────────┘                           │ └─────────────────┘ │
                        restore()           └─────────────────────┘
                  ◄───────────────────────
```

No unmount. No remount. No state loss. Optional FLIP animation.

## What survives the transfer

| DOM state | `appendChild` | this library |
|:--|:--:|:--:|
| `<video>` playback position | ❌ restarts | ✅ keeps playing |
| `<iframe>` loaded page | ❌ reloads | ✅ stays loaded |
| `<canvas>` / WebGL context | ❌ cleared | ✅ preserved |
| Scroll position | ❌ reset | ✅ preserved |
| Input focus & selection | ❌ lost | ✅ preserved |
| CSS animations / transitions | ❌ reset | ✅ continues |
| Event listeners | ❌ may break | ✅ intact |
| React component state | ✅ (if same key) | ✅ always |

## How it's different

| | this library | react-reparenting | react-reverse-portal |
|:--|:--:|:--:|:--:|
| Modifies Fiber tree | ❌ | ✅ | ❌ |
| Context preserved | ✅ | ❌ breaks | ✅ |
| Effects re-run | ❌ | ✅ all re-run | ❌ |
| FLIP animation | ✅ built-in | ❌ | ❌ |
| Still maintained | ✅ | ❌ since 2021 | ❌ since 2021 |
| Approach | swap `stateNode` only | rebuild Fiber tree | Portal target switch |

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
        <iframe src="https://example.com" />
      </div>

      <div ref={targetRef} />

      <button onClick={isTransferred ? restore : transfer}>
        {isTransferred ? 'Collapse' : 'Expand'}
      </button>
    </>
  );
}
```

The `<iframe>` flies to the target container with a 0.3s animation. The page inside it never reloads.

## Imperative API

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

**1. FLIP animation** — Record position → detach → `position: fixed` at origin → CSS transition to destination → settle into target container.

**2. Fiber stateNode swap** — Copy `__reactFiber$` and `__reactProps$` to the moved element. Update `fiber.stateNode` and `fiber.alternate.stateNode`. React's Fiber tree structure (`child` / `sibling` / `return`) stays completely untouched.

```
React sees:       Component → Fiber → stateNode → [same pointer]
Reality:          The DOM node is now in a different container entirely
```

This is a fundamentally different approach from `react-reparenting`, which modifies the Fiber tree structure itself — changing `child`, `sibling`, `return` pointers, which causes Context to change and all Effects to re-run.

## API

### `useDomTransfer(options?)`

```typescript
const { sourceRef, targetRef, transfer, restore, isTransferred } =
  useDomTransfer({
    transition: 'all 0.3s ease', // CSS transition (optional, instant if omitted)
    zIndex: 9999,                // z-index during animation (default: 9999)
    timeout: 3000,               // fallback timeout in ms (default: 3000)
    onTransferEnd: () => {},     // fires after transfer settles
    onRestoreEnd: () => {},      // fires after restore settles
  });
```

### `transferDom(element, target, options?) → state`

### `restoreDom(state, options?)`

## Real-world use cases

- **Video / live streaming** — player moves between feed and detail view without rebuffering
- **Embedded content** — iframe survives layout changes without reloading
- **Maps** — Google Maps / Mapbox moves from sidebar to fullscreen without re-rendering tiles
- **Rich text editors** — Monaco / CodeMirror moves between panels keeping undo history
- **3D / WebGL** — Three.js canvas keeps scene state across layout transitions
- **Dashboard widgets** — drag to reorder without losing chart scroll position

## Caveats

- Relies on React's internal `__reactFiber$` property (not public API). Runtime detection and warnings included.
- React 16.8+ (Hooks). Tested on React 18.
- A placeholder `<div>` occupies the source container during transfer.

## License

MIT
