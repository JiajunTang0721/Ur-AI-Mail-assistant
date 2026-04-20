# 前端组件树 V1

本组件树服务于现有 Gmail 右侧面板，不重做页面结构，只统一板块与优先级语义。若代码里还存在 `TodayFocusView`、`DueSoonView` 等旧命名，可在重构中分别迁移为 `PriorityContentView`、`Within48hView`。

## 1. 插件入口层

### ExtensionEntry

负责整个插件前端的入口初始化。

### GmailInjector

负责识别 Gmail 页面，并将右侧 AI 面板挂载到页面中。

### PanelMountPoint

负责提供面板的挂载容器。

## 2. 面板外壳层

这些组件在“展开态（列表浏览）”中始终存在，不因板块切换而消失。

### AssistantPanel

整个右侧 AI 面板的最外层容器。

### PanelHeader

显示 AI 助手名称、设置按钮、关闭按钮等头部信息。

### SyncStatus

显示最近同步时间，例如“今天 08:12 已同步”。

### OverviewCards

显示顶部四个概览数字卡片：

- 优先内容
- 48h
- 待处理
- 可忽略

支持点击卡片后切换板块。

### TabBar

显示四个固定模块 Tab：

- 优先内容
- 48h
- 待处理
- 可忽略

支持当前板块高亮与板块切换。

## 3. 内容切换层

根据 `activeBoard` 渲染下半部分内容区。

### PanelContentSwitch

根据 `activeBoard` 决定当前显示哪个内容模块。

### PriorityContentView

用于渲染“优先内容”板块。

包含：

- `ImmediateAttentionSection`
- `WorthReviewingSection`
- `MailCardList`
- `MailCard`

### Within48hView

用于渲染“48h”板块。

包含：

- `ReadWithin48hSection`
- `HandleWithin48hSection`
- `MailCardList`
- `MailCard`

### TodoView

用于渲染“待处理”板块。

包含：

- `TodoSectionList`
- `TodoSection`
- `MailCardList`
- `MailCard`

### IgnoreView

用于渲染“可忽略”板块。

包含：

- `IgnoreReasonSection`
- `MailCardList`
- `MailCard`

## 4. 邮件详情联动态

当用户点击“查看原邮件”后，右侧切换到单封邮件解读视图。

### MailInsightView

邮件详情联动态的主容器。

### InsightHeader

显示发件人、主题、板块归属、优先级等基础信息。

### InsightSummary

显示一句话重点总结。

### InsightAction

显示建议动作。

### InsightDeadline

显示截止时间。

### InsightReasons

显示判断原因列表。

### InsightFeedback

显示“更重要 / 少显示”等反馈操作入口。

## 5. 通用组件

这些组件会被多个板块复用。

### MailCard

单封邮件卡片组件。

负责显示：

- 发件人
- 邮件标题
- 一句话重点总结
- 板块说明
- 优先级标记
- 建议动作
- 截止时间
- 原因标签
- 查看原邮件按钮

### MailCardList

邮件卡片列表容器。

### SectionBlock

某个内容分组的外层组件，例如：

- 需要立刻注意
- 48 小时内处理
- 回复类待处理

### PriorityBadge

优先级标记组件，仅表达 `high / medium / low / ignore`。

### ReasonTag

原因标签组件，例如：

- 招聘方
- 有 deadline
- 命中用户偏好

### ActionChip

动作标签组件，例如：

- 回复
- 报名
- 提交

### FeedbackControls

卡片级或详情级反馈入口，提供：

- 更重要
- 少显示

### EmptyState

当前板块没有数据时展示的空状态组件。

### LoadingState

当前板块数据加载中时展示的加载状态组件。

### ErrorState

当前板块加载失败时展示的错误状态组件。
