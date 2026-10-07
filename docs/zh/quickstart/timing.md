---
title: 时间与装配
description: 先构造绝对节目时间，再显式放置媒体并按需投影语义时间。
---

Qflow 只有一条节目时间轴：`Timeline`。它只是 `{ id, frameRate, frameCount }`，不包含素材、
单词、Track 或中央事件注册表。

对于语音作品，四类独立事实围绕这条绝对时间轴组合：

1. 把已接受素材规范化为 `SynchronizedMedia` 与有限的局部时间域；
2. 在该局部时间域上对齐 Script Segment，得到 `NarrativeAlignment`；
3. 用具名 Instant、Window 与 Extent 构造一个包含必需 `end` 的 Timeline DAG；
4. 把每个 Alignment 通过等长 Window 投影，并让普通媒体独立进入 Visual 与 Audio Source。

这种分离很重要：移动一段内容不改变媒体和局部词时序；改变画面构图不改变声音；纯动效
只需要 Timeline，不需要媒体或 Script。

```svml
<import as="mediaop" from="@qflow/media-operations@1"/>
<import as="whisperx" from="@qflow/whisperx@1"/>
<import as="semantic" from="@qflow/narrative-temporal@1"/>
<import as="time" from="@qflow/timeline-author@1"/>
<import as="media" from="@qflow/media@1"/>
<import as="visual" from="@qflow/visual-track@1"/>
<import as="audio" from="@qflow/audio-track@1"/>
```

## 规范化局部媒体

Clock 固定最终 Timeline 与所有局部时间域共享的帧率：

```svml
<time:Clock id="clock" frame-rate="30"/>
<mediaop:Normalize id="opening-media" source={opening-video.video}
  video="primary-moving" audio="default" span-authority="video" clock={clock}/>
<mediaop:Normalize id="answer-media" source={answer-video.video}
  video="primary-moving" audio="default" span-authority="video" clock={clock}/>
```

规范化只建立媒体事实，不包含 Script 含义或节目中的位置。

## 在局部时间域上对齐语义

```svml
<whisperx:Alignment id="opening-alignment" narrative={story}
  segment={story.segment.opening} media={opening-media.media}
  domain={opening-media.domain} language="en"/>
<whisperx:Alignment id="answer-alignment" narrative={story}
  segment={story.segment.answer} media={answer-media.media}
  domain={answer-media.domain} language="en"/>
```

每个输出只是 `NarrativeAlignment`：在局部时间域上测得的 Segment 与单词边界。它不包含
媒体，也不选择 Timeline 位置。没有 Token 的 Segment 省略 `language`，边界直接采用局部
时间域边界，并且不发起声学请求。

## 构造绝对 Timeline

Timeline 声明是无环构造图。`end` 必填；每个具名 Instant 或 Window 都自然发布为普通图值：

```svml
<time:Timeline id="speech" clock={clock} end="answer.end">
  <time:Window id="opening" from="start" for={opening-media.extent}/>
  <time:Window id="answer" from="opening.end" for={answer-media.extent}/>
</time:Timeline>
```

每个 `for={...extent}` 使用已经解析、但尚未定位的时长。因此，未知长度的生成语音可以在
普通图求值中撑开 Timeline。`from="opening.end+2s"` 表示空隙，
`from="opening.end-12f"` 表示重叠，`latest(a.end,b.end)` 可以合并并行分支。纯动效可直接
声明 `<time:Timeline id="animation" clock={clock} end="8s"/>`。Timeline 不保留媒体或局部
时间域身份。

## 独立投影语义

把每个 Alignment、完整局部时间域和等长绝对 Window 配对，投影语义证据：

```svml
<semantic:Projection id="story-time" narrative={story} timeline={speech.timeline}>
  <semantic:Map alignment={opening-alignment.alignment}
    domain={opening-media.domain} window={speech.opening}/>
  <semantic:Map alignment={answer-alignment.alignment}
    domain={answer-media.domain} window={speech.answer}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
</semantic:Projection>
```

显式请求的 `story-time.proof` 与 `story-time.claim` 是普通的绝对 Window 与 Instant。
语义时间只是一种可选投影来源；
直接秒数、帧数以及 Timeline 的具名绝对值同样是一等公民。

## 呈现画面与声音

```svml
<visual:Track id="picture" timeline={speech.timeline}>
  <visual:Clip id="opening" media={opening-media.media} during={speech.opening}
    frame={speech-frame} z="10" fit="cover"/>
  <visual:Clip id="answer" media={answer-media.media} during={speech.answer}
    frame={speech-frame} z="10" fit="cover"/>
</visual:Track>

<audio:Track id="mix" timeline={speech.timeline}>
  <audio:Clip id="opening" source={opening-media.media} during={speech.opening}/>
  <audio:Clip id="answer" source={answer-media.media} during={speech.answer}/>
</audio:Track>
```

不再存在独立的 Performance、Sound 或通用 Presentation 协议。Visual 与 Audio Clip 是
平等的媒体出现关系。同一份规范化媒体可以同时供两边使用，但选择画面绝不会自动让声音
进入成片。

```text
SynchronizedMedia + Window ──────────────────────────────→ Visual / Audio occurrence

NarrativeAlignment + LocalDomain + Window ──────────────→ 绝对 Instant / Window

Instant / Window / TemporalExtent DAG ───────────────────→ Timeline
```

组件最终只消费 Timeline 与绝对 Instant/Window。领域投影在上游发布这些值；通用组件的
Surface 不接受 Script 对象，也不携带投影器。
