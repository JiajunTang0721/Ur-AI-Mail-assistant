# 实现方法说明

这份文档解释项目制作过程中采用的具体方法，以及每一层为什么这样设计。

## 1. 总体方法

项目没有把“邮件分类”做成单一步骤，而是拆成四段：

1. Gmail 邮件获取与规范化
2. LLM 结构化特征抽取
3. 规则与本地优先级打分
4. 面板展示、反馈记录与重新分析

这样设计的原因是：

- 只靠规则会遗漏语义理解
- 只靠 LLM 会让输出不稳定、难复用
- 只靠一个单一标签无法同时表达“展示位置”和“重要程度”

## 2. Gmail 获取方法

扩展后台在 `extension/background.ts` 中完成：

- Gmail OAuth 鉴权
- 最近邮件列表拉取
- 单封邮件详情获取
- 线程消息数量补充
- 失败重试和并发控制

输出会被整理成统一结构，包括：

- `messageId`
- `threadId`
- `senderName`
- `senderEmail`
- `subject`
- `summary`
- `bodyExcerpt`
- `timeText`
- `timestamp`
- `isUnread`
- `hasAttachment`
- `labelIds`
- `threadMessageCount`

## 3. LLM 方法

`backend/app/llm.py` 的核心方法不是让模型自由解释邮件，而是：

- 用严格 JSON Schema 约束输出
- 一次性生成结构化特征
- 同时生成前端展示字段

输出内容分成两类：

1. 计算特征
   - `deadline`
   - `topics`
   - `actions`
   - `distraction`
2. 展示字段
   - `displaySender`
   - `briefSubject`
   - `aiSummary`
   - `aiReason`

这样做的好处是：

- 减少重复调用模型
- 让前端展示和后端判断来自同一份理解结果
- 让规则层与本地模型可以复用统一特征

## 4. 规则与优先级方法

`backend/app/rules.py` 会先补规则特征，再训练一个轻量本地优先级模型。

### 4.1 规则特征

规则层会从这些角度抽取信号：

- 时间与截止日期
- 面试/会议/提交/回复等动作要求
- 招聘、学业、工作、财务等主题
- 营销、订阅、群发、低价值提醒等干扰信号
- 重点寄件人、关注方向、历史反馈等偏好信号

### 4.2 优先级公式

当前实现是轻量加权模型：

```text
priority_score = sigmoid(bias + Σ(weight_i * feature_i) + sender_feedback_bias + focus_feedback_bias)
```

然后根据阈值映射为：

- `high`
- `medium`
- `low`
- `ignore`

### 4.3 反馈如何进入模型

反馈不是直接粗暴改标签，而是通过这些方式进入下一轮分析：

- 寄件人偏置
- 关注方向偏置
- 全局阈值微调

这让模型可以逐步学习“这类邮件对当前用户到底算不算重要”。

## 5. 板块判断方法

板块判断和优先级分开计算。

板块语义如下：

- `priority_content`: 值得优先查看
- `within_48h`: 48 小时内建议查阅或处理
- `todo`: 存在后续动作
- `ignore`: 当前阶段可忽略

判断顺序大致是：

1. 先识别强烈可忽略信号
2. 再识别 48 小时内时效邮件
3. 再识别需要后续动作的邮件
4. 最后把高价值但不紧急的邮件放入 `priority_content`

## 6. 扩展展示方法

`extension/content.ts` 负责：

- Gmail 页面注入
- 面板展开/收起
- 按板块显示邮件
- 同步过滤条件
- 反馈按钮
- 重新分析
- 本地缓存和账号态管理

为了兼容旧原型，它还做了旧命名与新命名之间的映射。

## 7. 为什么这个方案适合 GitHub 展示

这个项目适合 GitHub 展示，不是因为“概念好看”，而是因为仓库里已经能看到完整链路：

- 真 Gmail
- 真扩展
- 真后端
- 真方法
- 真文档

因此在 GitHub 上最值得突出的是“真实可运行链路”和“方法拆分的合理性”。
