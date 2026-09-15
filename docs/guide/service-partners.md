---
title: Model and deployment services
description: Hosted model APIs, your own deployments, and independent service partners.
---

Choose the service that supplies the material your video needs. This choice is separate from
[where you run your Agent](./agents.md).

QflowHub is Qflow's recommended integrated hosted service for supported generation and WhisperX
work. Its Provider is maintained with Qflow. Local execution remains available through the local
Providers, and users can connect their own services through project Providers.

The services introduced below are independent partners. They have their own accounts, terms,
prices, model availability and APIs. A partnership is an introduction, not a shared QflowHub account
or an automatically installed integration. Choose a service for the work and connect its supported
capabilities through the ordinary [Model and Provider](./providers.md) extension path.

## Model and tool API partners

### Monid

[Monid](https://monid.ai) is a Qflow service partner.
[Its documentation](https://docs.monid.ai/) describes discovering tools, inspecting their inputs and
prices, and calling them through its interfaces. For a video production, identify the concrete
image, video, audio or other tool that meets the material requirement. Its
[HTTP API documentation](https://docs.monid.ai/api/overview.html) supplies the connection details.
An installed compatible Provider can be reused; otherwise the Agent can implement the required
request and result mapping in a project package. Availability of a tool does not itself install
a Qflow Provider for it.

## Your own model deployment

A deployment platform supplies somewhere to run a model. The resulting inference service connects
through the same Model–Provider–Endpoint relationship as a hosted model API. Reuse a Provider when
its full protocol matches, or implement that service's API in a project package. The chosen cloud
account owns compute and deployment costs; QflowHub credits do not pay for that deployment.

[Using your own deployment](./providers.md#use-your-own-model-deployment) explains what changes when
you own the serving environment. A deployment can be used without a partnership or an officially
bundled Provider.
