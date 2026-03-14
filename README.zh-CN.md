# react-dom-transfer

在 React 中跨容器移动 DOM 元素，无需卸载组件。

视频播放、iframe 状态、CSS 动画等所有 DOM 状态在迁移过程中完整保留，并支持可选的 FLIP 过渡动画。

## 问题背景

在 React 中，当你需要将一个重状态元素（如视频播放器）从容器 A 移动到容器 B：

- **React 默认行为**：卸载 → 重建 → 状态丢失，视频重新加载
- **react-reparenting**：修改整个 Fiber 树 → Context 变化，Effects 重新执行
- **react-reverse-portal**：基于 Portal → 不支持过渡动画

## 解决方案

`react-dom-transfer` 采用最小化方案：**只修改 Fiber 的 `stateNode` 指针，不动 Fiber 树结构**。

- ✅ 无卸载/重建 — DOM 节点始终存活
- ✅ 无 Context 变化 — Fiber 树结构不变
- ✅ 无 Effects 重跑 — React 感知不到任何变化
- ✅ 内建 FLIP 动画 — 容器间平滑过渡
- ✅ 约 200 行代码 — 最小化，可审计

## 安装

```bash
npm install react-dom-transfer
```

## 使用

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
      {/* 源容器：如 Feed 卡片 */}
      <div ref={sourceRef}>
        <video src="live-stream.flv" autoPlay />
      </div>

      {/* 目标容器：如详情页 */}
      <div ref={targetRef} />

      <button onClick={isTransferred ? restore : transfer}>
        {isTransferred ? '返回' : '进入直播间'}
      </button>
    </>
  );
}
```

### 命令式 API

```typescript
import { transferDom, restoreDom } from 'react-dom-transfer';

// 将元素从当前容器移动到目标容器
const state = transferDom(element, targetContainer, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('迁移完成'),
});

// 之后：移回去
restoreDom(state, {
  transition: 'all 0.3s ease',
  onEnd: () => console.log('已恢复'),
});
```

## 工作原理

### 1. FLIP 动画

使用 [FLIP 技术](https://aerotwist.com/blog/flip-your-animations/)（First, Last, Invert, Play）：

1. 记录元素当前位置（`getBoundingClientRect`）
2. 从源容器脱离，`position: fixed` 定位在原始坐标
3. CSS transition 过渡到目标位置
4. `transitionend` 后嵌入目标容器

### 2. Fiber stateNode 替换

React 内部通过 `__reactFiber$xxx` 属性将 DOM 节点与 Fiber 树关联。当我们移动 DOM 节点时，只更新 Fiber 的 `stateNode`（及其 `alternate`）指向新位置：

```
React Fiber 树：  不变（child/sibling/return 指针保持原样）
Fiber.stateNode：  更新为指向新的 DOM 位置
结果：             React 认为什么都没发生，DOM 已经在新位置了
```

这与 `react-reparenting` 有本质区别——后者修改整个 Fiber 树结构（`child`、`sibling`、`return`、`index` 指针全部改变），会导致 Context 变化和 Effects 重跑。

## API 参考

### `useDomTransfer(options?)`

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `transition` | `string` | — | CSS transition 字符串（如 `'all 0.3s ease'`） |
| `zIndex` | `number` | `9999` | 动画期间的 z-index |
| `timeout` | `number` | `3000` | `transitionend` 未触发时的兜底超时（ms） |
| `onTransferEnd` | `() => void` | — | 迁移完成后回调 |
| `onRestoreEnd` | `() => void` | — | 恢复完成后回调 |

返回值：

| 属性 | 类型 | 说明 |
|------|------|------|
| `sourceRef` | `RefObject` | 绑定到源容器 |
| `targetRef` | `RefObject` | 绑定到目标容器 |
| `transfer` | `() => void` | 将 DOM 从源容器移到目标容器 |
| `restore` | `() => void` | 将 DOM 移回源容器 |
| `isTransferred` | `boolean` | 当前状态 |

### `transferDom(element, target, options?)`

命令式地将 DOM 元素迁移到目标容器。返回状态对象，供 `restoreDom` 使用。

### `restoreDom(state, options?)`

将此前迁移的元素恢复到原始容器。

## 适用场景

- **视频播放器** — Feed 卡片与详情页之间无缝切换，不中断播放
- **直播间** — 无缝切换直播间
- **地图组件** — 侧边栏预览与全屏视图之间切换
- **媒体编辑器** — 预览面板在不同布局间移动

## 方案对比

| | react-dom-transfer | react-reparenting | react-reverse-portal |
|---|---|---|---|
| 方案思路 | 只替换 stateNode | 重建 Fiber 树 | Portal 目标切换 |
| 修改 Fiber 树 | ❌ 不修改 | ✅ 修改 | ❌ 不修改 |
| Context 保持 | ✅ 保持 | ❌ 会变化 | ✅ 保持 |
| Effects 重跑 | ❌ 不重跑 | ✅ 会重跑 | ❌ 不重跑 |
| 过渡动画 | ✅ 内建 | ❌ 无 | ❌ 无 |
| 维护状态 | ✅ 活跃 | ❌ 2021 停更 | ❌ 2021 停更 |

## 注意事项

- 依赖 React 内部的 `__reactFiber$` 属性，该属性不属于 React 公开 API，可能在大版本间变动。库内包含检测和警告机制。
- 设计用于 React 16.8+（Hooks），已在 React 18 上测试。
- 迁移期间源容器会放置一个占位 `<div>` 以防止布局塌陷。

## 灵感来源

本方案提取自大规模生产环境中的真实代码，用于处理服务数千万用户的 Feed 流应用中视频播放器的无缝过渡。

## 许可证

MIT
