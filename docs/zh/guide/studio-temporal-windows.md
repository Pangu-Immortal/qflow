---
title: Studio 中的时间编辑
description: 修改产生绝对 Instant 或 Window 的声明。
---

组件消费绝对 Instant 与 Window。Studio 沿图找到这个值的生产者，修改那一处声明；它不会
要求每个视觉、音频、字幕或文字组件都理解值来自哪个领域。

## 绝对时间声明

| 作者写法 | 移动时改变什么 | 裁剪时改变什么 |
| --- | --- | --- |
| `from="2s" for="8f"` | 改 `from`，时长仍为八帧 | `from` 或 `for` |
| `until="3s" for="8f"` | 改 `until`，时长仍为八帧 | `for` 或 `until` |
| `from="1s" until="3s"` | 两个端点移动相同帧数 | 被选择的端点 |
| `during="timeline"` | 不提供局部写回 | 不提供局部写回 |
| `during={named-window}` | 修改具名值的生产者 | 修改具名值的生产者 |

Instant 引用遵循同样规则：`at={claim}` 跟随产生 `claim` 的声明；`at="2s"` 修改自己的时钟值。

## 领域产生的时间值

语义时间先投影，再交给组件：

```svml
<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={speech.alignment} domain={speech-media.domain} window={film.speech}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="reveal" moment={story.moment.reveal}/>
</semantic:Projection>

<visual:Clip during={story-time.proof} .../>
<deck:Card at={story-time.reveal} .../>
```

Narrative 投影声明保留 Companion 写回 Selection 或 Moment 所需的来源关系。修改这一声明后，
所有消费者通过普通重新编译一起更新；消费者自身只收到完成的绝对时间值。未来的节拍投影
可以提供完全不同的编辑规则，同时发布相同的 Temporal 类型。

如果生产者没有声明逆操作，解析出的值仍然可以正常使用，但 Studio 不会猜测写回目标。
这使共享语义、局部时钟值和组件行为彼此分离。

未修改的表达保留原单位：帧率变化后 `2s` 仍是两秒，`60f` 仍是六十帧。修改后的时钟值
按当前 Timeline 写在整数帧边界上。

[Studio](../quickstart/preview.md) 介绍编辑界面，[Companion 指南](./studio-companion-architecture.md)
介绍包自己拥有的实体与控件。
