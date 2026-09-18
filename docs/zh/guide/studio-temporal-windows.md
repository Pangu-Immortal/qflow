---
title: Studio 中的时间编辑
description: 区分跟随语义、使用时钟，以及时间编辑实际改变的对象。
---

时间表达记录作者的选择。讲解画面可以跟随一句话，闪光可以响应答案，独立动画可以使用影片时钟。
Studio 修改的是该写法所表达的选择。

[Script](../quickstart/script.md) 用 Selection 和 Moment 为语义范围与事件命名。
Timeline 放置准备好的表演；组件通过这些身份或时钟位置获得 Instant、Window。
无声动画使用同一种 Timeline，由作者声明完整时长。

## 选择需要编辑的关系

| 作者写法 | 移动时改变什么 | 裁剪时改变什么 |
| --- | --- | --- |
| `during={story.selection.proof}` | 两个共享 Script 锚点移动相同数量的语义停靠点；时长可能变化 | 对应的 Selection 边界 |
| 事件的 `at={story.moment.reveal}` | 共享 Moment 锚点 | 该写法没有声明持续时间 |
| 事件的 `at={story.selection.proof} boundary="start"` | 仅 Selection 的起点锚点 | 该写法没有声明持续时间 |
| `at={story.moment.reveal} for="8f"` | Moment；持续时间保持八帧 | 从尾端改变持续时间；Moment 保持不变 |
| `until={story.moment.reveal} for="8f"` | Moment；持续时间保持八帧 | 从首端改变持续时间；Moment 保持不变 |
| `at="2s" for="8f"` | 作者指定的时钟位置 | 从尾端改变持续时间 |
| `instant="moment.cue + 2f" moment={story.moment.reveal}` | 局部偏移；Moment 保持不变 | 该写法没有声明持续时间 |
| `start="…" end="…"` | 两个端点表达式移动相同帧数 | 仅对应端点的表达式 |
| `during={story.segment.opening}` 或 `during="program"` | 跟随结构范围，不提供时间线拖动 | 不提供时间线裁剪 |

消费组件决定需要 Instant 还是 Window，以及支持哪些写法。事件跟随 Selection 终点时使用
`boundary="end"`，同样只修改选定边界。

## 分清共享语义与局部偏移

移动 `at={story.moment.reveal}` 会在 Script 中移动 Moment，所有使用它的组件随后一起跟随。
使用相同 Moment 的 `instant="moment.cue"` 则暴露一个初始为零的局部偏移；移动它不会改写共享事件。

需要有意提前或延后时，写 `instant="moment.cue + 2f"` 并绑定 `moment={story.moment.reveal}`。
计算表达式不写进 `{story.moment.reveal}` 这样的图值引用中。

事件与持续时间是两个独立决定。`at/for` 只在尾端提供时长裁剪，`until/for` 只在首端提供时长裁剪。
另一端不会提供一个同时移动共享事件、再补偿时长的隐藏操作。

## 保留原文与所选边界

词首、词尾和结构边界是不同的语义锚点。停顿可以属于前一句，也可以属于后一句。
拖动沿不同帧位置上的语义停靠点进行；多个锚点重合时，支持该编辑的 Inspector 可以选择精确身份。
Take 交叠或重排时，Script 顺序可以与实际时间顺序不同。

移动标记保留无关原文、空格、标点、发音和词属性。字幕 Cue 保留来自 Script 的内容及实测词时间。
在 Script 中修改文案或 Cue 边界，通过 Caption Style 与带时间范围的 Use 修改呈现。

未编辑的表达式保留原单位：`2s` 在帧率变化后仍是两秒，`60f` 则保持六十帧。
拖动改变的时钟位置或偏移以当前帧率下的整数帧写回。

## 编辑项目组件

组件的 Companion 把画面实体连接到实际作者输入和已投影的时间。时间形式决定编辑对象，
组件名称或偶然相同的帧位置不能代替该关系。Script Companion 拥有源码观察和标记移动；
增加新组件不需要让 Studio 再学习一种 Script 解释方式。

[Studio](../quickstart/preview.md) 介绍编辑界面，[Companion 指南](./studio-companion-architecture.md)
介绍如何公开实体和控件；包内的[时间编辑参考](https://github.com/qflow-ai/qflow/blob/main/packages/temporal-markup/EDITING.md)
维护精确实现接口和支持的操作。
