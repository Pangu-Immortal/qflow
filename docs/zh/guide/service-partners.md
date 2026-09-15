---
title: 模型与部署服务
description: 托管模型 API、自有模型部署，以及独立服务合作方。
---

根据视频需要的素材选择服务。这与[在哪个 Agent 中工作](./agents.md)是不同的选择。

QflowHub 是 Qflow 推荐的集成托管服务，提供已支持的生成与 WhisperX 能力，Provider 随 Qflow
维护。本地能力仍可通过本地 Provider 使用，用户自己的服务通过项目 Provider 接入。

下面介绍的合作方是独立服务，各有自己的账户、条款、价格、模型可用性和 API。
合作关系提供一个了解服务的入口，不共用 QflowHub 账户，也不意味着已经自动安装了适配。
根据当前作品选择服务，通过普通的 [Model 与 Provider](./providers.md) 扩展方式连接所需能力。

## 模型与工具 API 合作方

### Monid

[Monid](https://monid.ai) 是 Qflow 的服务合作方。
[它的文档](https://docs.monid.ai/)介绍了工具发现、输入与价格查询，以及调用方式。
制作视频时，根据具体素材需要找到合适的图片、视频、音频或其他工具，
[HTTP API 文档](https://docs.monid.ai/api/overview.html)提供接入依据。
已有兼容 Provider 可以复用；缺少时，Agent 可以在项目包中实现这次所需的请求与结果映射。
服务里存在某个工具，并不意味着项目已经安装了对应的 Qflow Provider。

## 自己部署模型

部署平台提供运行模型的地方，部署得到的推理服务沿用 Model–Provider–Endpoint 的关系接入。
完整协议兼容时复用 Provider，否则在项目包中实现该服务的 API。算力和部署费用属于所选云账户，
QflowHub 额度不支付这份部署。

[使用自有模型部署](./providers.md#使用自有模型部署)说明自己管理服务环境时需要处理什么。
没有合作关系、没有官方内置 Provider，也可以使用一份合适的部署。
