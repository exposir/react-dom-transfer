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

### 视频 / 直播

用户在 Feed 流里划动，每个卡片上有一个正在播放的小窗播放器。用户点击卡片 → 播放器用 0.3 秒动画*飞入*全屏详情页。流不重新缓冲，弹幕还在，音量不变，所有插件状态都在。用户点返回 → 播放器飞回 Feed 卡片。全程，`<video>` 元素是同一个 DOM 节点。

没有这个库：播放器销毁重建。流从 CDN 重新请求，用户看到 loading，开头 1-2 秒内容丢失。大规模场景（千万级用户）下，这种重复请求还会显著增加 CDN 成本。

### 嵌入内容（iframe）

一个 SaaS 产品通过 iframe 嵌入了第三方表单（Typeform、Google Forms、Stripe 支付）。表单一开始在侧边栏。用户点"展开" → iframe 移到全宽弹窗。用户填了一半表单，点"收起" → 回到侧边栏，已填内容还在。

没有这个库：每次布局切换 iframe 都重载。用户填的信息全部丢失。如果是支付流程（Stripe），意味着从头开始结账。

### 地图

一个房产网站在侧边栏显示小地图预览。用户点击地图 → 展开为全屏，卫星瓦片已经加载好了。用户浏览、缩放、标记。点"缩小" → 地图回到侧边栏，瓦片、缩放级别、标记全部保留。

没有这个库：Google Maps / Mapbox 重新初始化。所有瓦片重新下载（移动网络下很贵）。缩放级别重置，自定义图层和标记全没了。Maps SDK 重跑初始化，额外 200-500ms 卡顿。

### 富文本编辑器

一个类 Notion 的文档应用有分栏布局。用户把一个 Monaco / CodeMirror 编辑器块从左栏拖到右栏。光标位置、撤销/重做历史、语法高亮状态、未保存的修改全部保留。

没有这个库：编辑器重新挂载。撤销历史清空。如果用户正在编辑，内容可能闪烁或重置。Monaco 的语言服务重新初始化（大文件 200ms+）。

### 3D / WebGL

一个产品配置器用 Three.js 在卡片里展示 3D 模型。用户点"全屏" → canvas 展开，当前相机角度、已加载纹理、光照全部保留。用户旋转模型，点"退出全屏" → canvas 缩回，相机角度不变。

没有这个库：WebGL 上下文销毁。所有纹理重新上传 GPU，模型重新解析，场景从头构建——通常要 1-3 秒加载时间。

### 仪表盘组件

一个数据分析仪表盘有可拖拽的图表卡片。用户把一个图表从第 1 行拖到第 3 行。图表的当前滚动位置（大数据表）、tooltip 状态、时间轴缩放全部保留。

没有这个库：每次拖拽都销毁重建图表。数据从 API 重新拉取。大数据集产生明显的渲染卡顿。用户每次重排都看到 空白 → loading → 渲染完成 的闪烁。

## 注意

- 依赖 React 内部的 `__reactFiber$` 属性（非公开 API），内置运行时检测和警告。
- 需要 React 16.8+（Hooks），已在 React 18 测试通过。
- 迁移期间源容器会插入占位 `<div>`。

## 许可证

MIT
