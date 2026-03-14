# react-dom-transfer

[English](./README.md)

**React 移动 DOM 必须销毁重建。这个库不用。**

React 把元素移到新容器时，会先卸载再重建——过程中所有 DOM 状态全部丢失。iframe 重载、视频重播、Canvas 清空、滚动位置归零、焦点消失。

`react-dom-transfer` 趁 React 不注意，把真实 DOM 节点搬到另一个容器里。

```
  ┌─────────────┐                          ┌─────────────────────┐
  │  容器 A      │       transfer()         │  容器 B              │
  │ ┌─────────┐ │  ───────────────────────► │ ┌─────────────────┐ │
  │ │  元素    │ │    CSS 过渡 + FLIP 动画   │ │     元素          │ │
  │ └─────────┘ │                           │ │  （同一个实例）    │ │
  └─────────────┘                           │ └─────────────────┘ │
                        restore()           └─────────────────────┘
                  ◄───────────────────────
```

不卸载。不重建。状态不丢。可选 FLIP 过渡动画。

## 搬运过程中保留了什么

| DOM 状态 | 原生 `appendChild` | 本库 |
|:--|:--:|:--:|
| `<video>` 播放进度 | ❌ 从头开始 | ✅ 继续播放 |
| `<iframe>` 已加载页面 | ❌ 重新加载 | ✅ 保持不动 |
| `<canvas>` / WebGL 上下文 | ❌ 被清空 | ✅ 保留 |
| 滚动位置 | ❌ 归零 | ✅ 保留 |
| 输入框焦点和选区 | ❌ 丢失 | ✅ 保留 |
| CSS 动画 / transition | ❌ 重置 | ✅ 继续 |
| 事件监听器 | ❌ 可能失效 | ✅ 正常 |
| React 组件 state | ✅（相同 key） | ✅ 始终保留 |

## 和现有方案的区别

| | 本库 | react-reparenting | react-reverse-portal |
|:--|:--:|:--:|:--:|
| 改 Fiber 树 | ❌ | ✅ | ❌ |
| Context 保持 | ✅ | ❌ 会断 | ✅ |
| Effects 重跑 | ❌ | ✅ 全部重跑 | ❌ |
| 过渡动画 | ✅ 内建 | ❌ | ❌ |
| 是否维护 | ✅ | ❌ 2021 停更 | ❌ 2021 停更 |
| 核心思路 | 只换 `stateNode` | 重建 Fiber 链表 | Portal 目标切换 |

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
        <iframe src="https://example.com" />
      </div>

      <div ref={targetRef} />

      <button onClick={isTransferred ? restore : transfer}>
        {isTransferred ? '收起' : '展开'}
      </button>
    </>
  );
}
```

`<iframe>` 会用 0.3 秒动画飞到目标容器。里面加载的页面不会重载。

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

调用 `transfer()` 做了两件事：

**1. FLIP 动画** — 记录位置 → 脱离容器 → `position: fixed` 定在原坐标 → CSS transition 飞到目标 → 落入目标容器。

**2. Fiber stateNode 替换** — 把 `__reactFiber$` 和 `__reactProps$` 复制到搬运后的元素上，更新 `fiber.stateNode` 和 `fiber.alternate.stateNode`。Fiber 树结构（`child` / `sibling` / `return`）完全不动。

```
React 看到的：    组件 → Fiber → stateNode → [同一个指针]
实际情况：        DOM 节点已经在另一个容器里了
```

这和 `react-reparenting` 的思路完全不同——后者修改 Fiber 树的链表结构（`child`、`sibling`、`return`），导致 Context 变化、Effects 全部重跑。

## API

### `useDomTransfer(options?)`

```typescript
const { sourceRef, targetRef, transfer, restore, isTransferred } =
  useDomTransfer({
    transition: 'all 0.3s ease', // CSS 过渡（可选，不传则瞬间完成）
    zIndex: 9999,                // 动画期间 z-index（默认 9999）
    timeout: 3000,               // 兜底超时 ms（默认 3000）
    onTransferEnd: () => {},     // 迁移完成后触发
    onRestoreEnd: () => {},      // 恢复完成后触发
  });
```

### `transferDom(element, target, options?) → state`

### `restoreDom(state, options?)`

## 实际应用场景

- **视频 / 直播** — 播放器在 Feed 和详情页之间无缝切换，不重新缓冲
- **嵌入内容** — iframe 在布局变化中存活，不重载
- **地图** — Google Maps / Mapbox 从侧边栏展开到全屏，不重新渲染瓦片
- **富文本编辑器** — Monaco / CodeMirror 在面板间移动，保留撤销历史
- **3D / WebGL** — Three.js canvas 跨布局切换时保留场景状态
- **仪表盘组件** — 拖拽重排不丢失图表滚动位置

## 注意

- 依赖 React 内部的 `__reactFiber$` 属性（非公开 API），内置运行时检测和警告。
- 需要 React 16.8+（Hooks），已在 React 18 测试通过。
- 迁移期间源容器会插入占位 `<div>`。

## 许可证

MIT
