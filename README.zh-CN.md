# react-dom-transfer

[English](./README.md)

**把一个 DOM 元素从 A 容器搬到 B 容器 —— 瞒着 React。**

不卸载。不重建。状态不丢。视频继续播。

```
  ┌──────────────┐                         ┌──────────────────────┐
  │  Feed 卡片    │      transfer()         │   直播间详情页         │
  │ ┌──────────┐ │  ──────────────────────► │ ┌──────────────────┐ │
  │ │ ▶ 播放器  │ │   CSS 过渡 + FLIP 动画   │ │   ▶ 播放器        │ │
  │ └──────────┘ │                          │ │  （同一个元素）     │ │
  └──────────────┘                          │ └──────────────────┘ │
                         restore()          └──────────────────────┘
                   ◄──────────────────────
```

## 为什么需要这个？

React 卸载组件时会销毁 DOM。对大多数元素来说没问题，但对 `<video>`、`<iframe>`、`<canvas>` 这类带实时状态的元素是灾难：

- 视频从头开始
- iframe 整个重载
- WebGL 上下文丢失
- WebSocket 连接断开

现有方案要么[修改整个 Fiber 树](https://github.com/paol-imi/react-reparenting)（导致 Context 变化、Effects 重跑），要么[基于 Portal](https://github.com/httptoolkit/react-reverse-portal)（不支持动画，2021 年停更）。

**这个库换了个思路**：只改 Fiber 的 `stateNode` 指针。React 的组件树完全不动——Context 不变、Effects 不重跑、不触发 reconciliation。

## 和现有方案的区别

| | 本库 | react-reparenting | react-reverse-portal |
|:--|:--:|:--:|:--:|
| 改动 Fiber 树 | ❌ | ✅ | ❌ |
| Context 保持 | ✅ | ❌ | ✅ |
| Effects 重跑 | ❌ | ✅ | ❌ |
| 过渡动画 | ✅ | ❌ | ❌ |
| 是否维护 | ✅ | ❌ 2021 | ❌ 2021 |
| 代码量 | ~200 行 | ~400 行 | ~300 行 |

## 安装

```bash
npm install react-dom-transfer
```

## 快速上手

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
        {isTransferred ? '返回' : '进入'}
      </button>
    </>
  );
}
```

就这些。`<video>` 会用 0.3 秒动画从源容器飞到目标容器，播放全程不中断。

## 命令式 API

不在 React 组件里也能用：

```typescript
import { transferDom, restoreDom } from 'react-dom-transfer';

const state = transferDom(element, target, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('完成'),
});

// 之后
restoreDom(state);
```

## 原理

调用 `transfer()` 时做了两件事：

**1. FLIP 动画** — 记录位置 → 脱离容器 → `position: fixed` 定在原坐标 → CSS transition 飞到目标位置 → 落入目标容器。

**2. Fiber stateNode 替换** — 把 `__reactFiber$` 和 `__reactProps$` 复制到新的 DOM 引用上，更新 `fiber.stateNode`（以及双缓冲树的 `fiber.alternate.stateNode`）。React 全程无感知。

```
React 看到的：    Component → Fiber → stateNode → [同一个指针]
实际情况：        DOM 节点已经在完全不同的容器里了
```

## API

### `useDomTransfer(options?)`

```typescript
const { sourceRef, targetRef, transfer, restore, isTransferred } =
  useDomTransfer({
    transition: 'all 0.3s ease', // CSS 过渡（可选）
    zIndex: 9999,                // 动画期间的 z-index
    timeout: 3000,               // transitionend 未触发时的兜底超时（ms）
    onTransferEnd: () => {},     // 迁移完成回调
    onRestoreEnd: () => {},      // 恢复完成回调
  });
```

### `transferDom(element, target, options?) → state`

### `restoreDom(state, options?)`

## 适用场景

- 视频播放器在 Feed 卡片和详情页之间无缝切换
- 直播间切换
- 地图预览展开为全屏
- 媒体编辑器面板布局切换

## 注意

- 依赖 React 内部的 `__reactFiber$` 属性，不是公开 API，大版本升级可能变动。库内有运行时检测和警告。
- 需要 React 16.8+（Hooks），已在 React 18 测试通过。
- 迁移期间源容器会插入一个占位 `<div>` 防止布局塌陷。

## 许可证

MIT
