---
title: Studio 中的时间编辑
description: 修改产生绝对 Instant 或 Window 的声明。
---

组件消费绝对 Instant 与 Window。Studio 沿图找到这个值的生产者，修改那一处声明；它不会
要求每个视觉、音频、字幕或文字组件都理解值来自哪个领域。

## 绝对时间声明

| 作者写法 | 移动时改变什么 | 裁剪时改变什么 |
| --- | --- | --- |
| `from="2s" for="8f"` | 改 `from`，时长仍为八帧 | 左侧：同时改 `from` 与 `for`；右侧：改 `for` |
| `until="3s" for="8f"` | 改 `until`，时长仍为八帧 | 左侧：改 `for`；右侧：同时改 `until` 与 `for` |
| `from="1s" until="3s"` | 两个端点移动相同帧数 | 被选择的端点 |
| 使用 `from`/`until`/`for` 声明的具名 Window | 修改该具名声明 | 修改所选端点关系 |
| 组件 `during={named-window}` | 修改具名值的生产者 | 修改具名值的生产者 |

Instant 引用遵循同样规则：组件的 `at={claim}` 跟随产生 `claim` 的声明。时钟字面量写在
Timeline 子声明或独立具名声明上，不写在组件表面。

## 领域产生的时间值

语义时间先投影，再交给组件：

```svml
<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={speech.alignment} domain={speech-media.domain} window={film.speech}/>
</semantic:Projection>
<semantic:Window id="proof" projection={story-time} during={story.selection.proof}/>
<semantic:Instant id="reveal" projection={story-time} at={story.moment.reveal}/>

<visual:Clip during={proof} .../>
<deck:Card at={reveal} .../>
```

Narrative 投影声明保留 Companion 写回 Selection 或 Moment 所需的来源关系。修改这一声明后，
所有消费者通过普通重新编译一起更新；消费者自身只收到完成的绝对时间值。未来的节拍投影
可以提供完全不同的编辑规则，同时发布相同的 Temporal 类型。

如果生产者没有声明逆操作，解析出的值仍然可以正常使用，但 Studio 不会猜测写回目标。
这使共享语义、局部时钟值和组件行为彼此分离。

每次拖动都作为一个完整约束求解：裁剪左侧时保持原结束点，裁剪右侧时保持原开始点，整体移动时保持原长度。Studio 沿已执行的 Temporal 图找到准确作者端点，并把所有必要的 Source 修改一起提交。

`<time:Timeline>` 内构造的具名值遵守同一规则。Timeline Author 保留每个字面偏移或时长所属的子声明，因此 Studio 可以修改准确的 `Instant.at`、`Window.from`、`Window.until` 或 `Window.for`。裸引用继续向上游追溯；若修改 `earliest(...)` 或 `latest(...)` 必须替作者选择某一个分支，它就保持只读。

未修改的表达保留原单位：帧率变化后 `2s` 仍是两秒，`60f` 仍是六十帧。修改后的时钟值
按当前 Timeline 写在整数帧边界上。

[Studio](../quickstart/preview.md) 介绍编辑界面，[Companion 指南](./studio-companion-architecture.md)
介绍包自己拥有的 Item 与控件。
