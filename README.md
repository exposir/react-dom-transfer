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

### Video / live streaming

User scrolls a feed of live streams. Each card has a small player preview already playing. User clicks a card → the player *flies* into a fullscreen detail page with a 0.3s animation. The stream never buffers again, the danmaku (live comments) overlay stays, volume stays, all plugin state stays. User clicks back → the player flies back into the feed card. The whole time, the `<video>` element is the same DOM node.

Without this library: the player is destroyed and recreated. The stream re-requests from the CDN, the user sees a loading spinner, and the first 1-2 seconds of content are lost. At scale (millions of users), this re-request also multiplies CDN costs.

### Embedded content (iframe)

A SaaS product embeds a third-party form (Typeform, Google Forms, Stripe Checkout) via iframe. The form is initially shown in a sidebar. User clicks "expand" → the iframe moves to a centered modal at full width. User fills in half the form, clicks "collapse" → it goes back to the sidebar. The form state (everything the user typed) is still there.

Without this library: the iframe reloads on every layout change. The user loses all input. For payment flows (Stripe), this means restarting checkout from scratch.

### Maps

A real estate listing page shows a small map preview in the sidebar. User clicks the map → it expands to fullscreen with satellite tiles already loaded. User explores, zooms in, drops a pin. Clicks "minimize" → the map goes back to the sidebar with all tiles, zoom level, and pins intact.

Without this library: Google Maps / Mapbox re-initializes. All tiles re-download (expensive on mobile data). Zoom level resets. Custom layers and pins are gone. The Maps JS SDK re-executes initialization, adding 200-500ms of jank.

### Rich text editors

A docs app (like Notion) has a split-panel layout. User drags a Monaco/CodeMirror editor block from the left panel to the right panel. The cursor position, undo/redo history, syntax highlighting state, and any unsaved changes all survive the move.

Without this library: the editor remounts. Undo history is wiped. If the user was mid-edit with unsaved changes, the content might flash or reset. Monaco's language service re-initializes (200ms+ on large files).

### 3D / WebGL

A product configurator shows a Three.js 3D model viewer in a card. User clicks "fullscreen" → the canvas expands with the current camera angle, loaded textures, and lighting. User rotates the model, then clicks "exit fullscreen" → canvas shrinks back, camera angle preserved.

Without this library: the WebGL context is destroyed. All textures re-upload to GPU. Model re-parses. The scene rebuilds from scratch — often a 1-3 second loading time.

### Dashboard widgets

An analytics dashboard has draggable chart cards. User drags a chart from row 1 to row 3 to reorder. The chart's current scroll position (if it's a large data table), tooltip state, and any zoom applied to the time axis all survive the drag.

Without this library: every drag-drop destroys and recreates the chart. Data re-fetches from the API. Large datasets cause visible re-render jank. Users see a flash of empty → loading → rendered on every reorder.

## Caveats

- Relies on React's internal `__reactFiber$` property (not public API). Runtime detection and warnings included.
- React 16.8+ (Hooks). Tested on React 18.
- A placeholder `<div>` occupies the source container during transfer.

## License

MIT
