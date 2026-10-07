---
title: Film 与渲染
description: 装配并列的画面与声音贡献，再渲染所选节目区间。
---

Film 是普通作者组件。它把显式选择的 VisualTrack、AudioTrack 与一个 Canvas、一个 Timeline
组合成 Composition。渲染器再把 Composition 变成视频。

```svml
<import as="space" from="@qflow/spatial@1"/>
<import as="film" from="@qflow/film@1"/>
<import as="html" from="@qflow/html-video@1"/>
```

## 装配 Film

```svml
<space:Canvas id="vertical" width="1080" height="1920"/>

<film:Film id="main" canvas={vertical.canvas} timeline={speech.timeline}
  appearance={recipes.film.vertical}>
  <film:Track source={picture.visual}/>
  <film:Track source={mix.audio}/>
  <film:Track source={cards.visual}/>
  <film:Track source={captions.visual}/>
  <film:Track source={meaning.visual}/>
</film:Film>
```

| 属性 | 必填 | 含义 |
|---|---|---|
| `id` | 是 | 公开 Composition 身份 |
| `canvas` | 是 | 画面坐标系 |
| `timeline` | 是 | 有限的绝对节目范围 |
| `appearance` | 是 | Film Recipe，包括清屏颜色 |

每个 `<film:Track>` 接受一个 VisualTrack 或 AudioTrack。Film 不会发现某个输出的“兄弟端口”。
如果同一份规范化媒体要同时贡献画面和声音，就分别从它声明一个 Visual Clip 和一个
Audio Clip，并在这里显式选择两边产出的 Track。

常见输出包括：

| 来源 | 类型 | 角色 |
|---|---|---|
| `{picture.visual}` | VisualTrack | Visual Track 放置的画面出现关系 |
| `{mix.audio}` | AudioTrack | Audio Track 中的语音、音乐与效果 |
| `{cards.visual}` | VisualTrack | 独立图片或视频 Clip |
| `{captions.visual}` | VisualTrack | Caption 家族 |
| `{scene.visual}` | VisualTrack | 项目组件 |

公开输出是 `{main.composition}`。

## 画面顺序属于 Present

Film 子项负责选择贡献，并不通过书写顺序定义画面堆叠。每个视觉组件发布带绝对 `z` 的
定时 Present，通常由 Recipe 中的 `stack-order` 声明。数值小的先绘制；相同数值依次采用
稳定的 Track 身份、Track 内 Present `order` 和 Present 身份。相对绘制关系确有意义时，作者
应声明不同数值。

```svs
film.vertical { background: #09090B; }
media.speaker { stack-order: 10; fit: cover; }
media.card { stack-order: 40; fit: contain; }
caption.base { stack-order: 70; }
/* Fine Text 在 Flow、Point 或 Path occurrence 上直接写 z="90"。 */
```

不同 Track 的 Present 可以交错。若多张画面、图形与文字共享布局或运动，一个 Present
也可以拥有内部元素树或浏览器程序。共享行为的内容放在一起；仍可独立使用的贡献保持并列。

## 渲染完整视频

```svml
<html:Video id="final"
  composition={main.composition} timeline={speech.timeline}/>
```

渲染器编译视觉贡献、捕获所需帧、渲染 AudioTrack，并复用封装为交付文件。
`{final.video}` 是普通 Resource-backed `Blob`，通常也是 Run Target。

```svml
<?svml using="@qflow/markup/run@1"?>
<svrun version="1">
  <author source="./main.svml"/>
  <target output="final.video"/>
</svrun>
```

## 渲染帧区间

```svml
<html:Video id="detail" composition={main.composition} timeline={speech.timeline}
  start-frame="240" end-frame-exclusive="360"/>
```

边界使用原 Timeline 的半开区间。30 fps 时，这个例子渲染第 8–12 秒。即使输出片段从零
开始，动画和媒体采样仍保留原节目位置。区间渲染只限制最终捕获与编码；上游工作仍由 Run
选择的图决定，因此应显式复用已接受的媒体与对齐输出。

## 完全由组件绘制的影片

Timeline 不要求语音或媒体：

```svml
<import as="time" from="@qflow/timeline-author@1"/>

<time:Clock id="animation-clock" frame-rate="30"/>
<time:Timeline id="animation" clock={animation-clock} end="8s"/>

<chat:Scene id="conversation" timeline={animation.timeline} within={canvas.bounds}
  during="timeline">
  <chat:Message id="question" at="0.5s" sender="Maya" text="Ready?"/>
  <chat:Message id="answer" at="2s" sender="Leo" text="Let's go."/>
</chat:Scene>

<film:Film id="main" canvas={canvas.canvas} timeline={animation.timeline}
  appearance={recipes.film.main}>
  <film:Track source={conversation.visual}/>
</film:Film>
<html:Video id="final" composition={main.composition} timeline={animation.timeline}/>
```

组件用普通绝对时间拥有自己的阅读节奏。没有选择 AudioTrack 时，结果是静音的。在语音作品
中，同一组件也可以使用投影到 Timeline 上的语义 Moment 或 Selection。

## 执行前检查

```bash
qflow check main.svml
qflow plan build.svrun
```

`check` 在不调用外部服务的情况下验证导入、类型和图边。`plan` 编译选定 Run 并显示将要
请求的 Operations。付费执行前应检查该计划。

[时间与装配](./timing.md)解释规范化、Timeline 构造、媒体放置与语义投影；
[Tracks](./tracks.md)解释 Visual 和 Audio 的作者形式。
