# 页面状态定义

本文件描述现有 Gmail 右侧助手面板的页面状态与数据契约。页面结构不重做，但业务语义统一更新为：

- 板块归属：决定邮件在哪个板块展示
- 优先级：决定邮件有多重要

## 一级状态 1：收起态

### 进入方式

用户打开 Gmail 后，助手未展开时进入该状态。

### 固定内容

右侧仅显示助手图标和提醒数字。

### 用户目标

在不打扰原有 Gmail 使用流程的前提下，提示用户当前有多少封值得进入助手面板查看的邮件。

### 可执行操作

- 点击助手图标

### 跳转结果

进入“一级状态 2：展开态（列表浏览）”。

## 一级状态 2：展开态（列表浏览）

### 进入方式

用户点击助手图标后进入该状态。

### 固定内容

该状态下，以下区域始终显示，不因模块切换而消失：

- AI 助手名称
- 最近同步时间
- 顶部四个概览数字卡片
- 四个模块 Tab

四个固定板块为：

- 优先内容
- 48h
- 待处理
- 可忽略

### 用户目标

用户在固定结构中切换不同板块，快速查看当前最该先看、48 小时内要看、需要后续处理或当前可忽略的邮件。

### 子状态

- 子状态 2-1：优先内容
- 子状态 2-2：48h
- 子状态 2-3：待处理
- 子状态 2-4：可忽略

### 可执行操作

- 点击顶部数字卡片切换到对应板块
- 点击下方 Tab 切换到对应板块
- 点击某条邮件的“查看原邮件”
- 点击“更重要”或“少显示”反馈

### 顶部概览数字与模块映射

- 优先内容数量：点击后切换到 `priority_content`
- 48h 数量：点击后切换到 `within_48h`
- 待处理数量：点击后切换到 `todo`
- 可忽略数量：点击后切换到 `ignore`

### 跳转结果

- 切换板块时仍停留在“展开态（列表浏览）”，只更新下半部分内容区
- 点击“查看原邮件”后进入“一级状态 3：邮件详情联动态”

### 异常与边界状态

- 加载状态：正在同步邮件或加载当前板块内容
- 空状态：当前板块下暂无对应邮件
- 错误状态：数据加载失败，可提示用户重试

## 子状态 2-1：优先内容

### 内容区显示

- 最值得先看的邮件
- 可按“需要立刻注意 / 值得优先查看”分组
- 每封邮件显示板块理由与优先级标记

### 用户目标

让用户在最短时间内先看到当前最值得优先打开或阅读的内容。

### 关键说明

“优先内容”是展示语义，不等于所有邮件都必须是 `high` 优先级。

## 子状态 2-2：48h

### 内容区显示

- 48 小时内需要查阅的邮件
- 48 小时内需要处理的邮件
- 每封邮件继续显示独立优先级标记

### 用户目标

快速识别时间敏感内容，避免漏掉近两天内需要阅读或处理的事项。

### 关键说明

48h 板块中允许同时存在 `high / medium / low` 不同优先级邮件。

## 子状态 2-3：待处理

### 内容区显示

- 所有需要用户执行后续动作的邮件
- 可按回复、确认、报名、提交等类型分组

### 用户目标

集中查看所有 action item。

### 关键说明

待处理板块是行动维度，不等于“中优先级板块”。

## 子状态 2-4：可忽略

### 内容区显示

- 当前阶段可暂时不处理的邮件列表
- 每条邮件附带“为什么现在可以忽略”的解释标签

### 用户目标

让用户知道系统是在帮他减负，而不是把邮件吞掉；仍然保留追溯能力。

## 一级状态 3：邮件详情联动态

### 进入方式

用户在任意列表板块点击“查看原邮件”后进入该状态。

### 页面联动

- 左侧 Gmail 打开对应原邮件
- 右侧显示该邮件的结构化解读

### 右侧内容

- 发件人
- 邮件标题
- `board_type`
- `priority_level` 与 `priority_score`
- 一句话重点总结
- 建议动作
- 截止时间
- 判断原因

### 用户目标

帮助用户快速理解单封邮件，而不需要重新阅读全文。

# 字段结构定义

## 一、固定外壳字段

用于展开态顶部固定区域，不因板块切换而消失。

### PanelMeta

- `assistantName`：AI 助手名称
- `lastSyncedText`：最近同步时间展示文本
- `lastSyncedAt`：最近同步时间原始值

### OverviewCounts

- `priorityContentCount`：优先内容数量
- `within48hCount`：48h 数量
- `todoCount`：待处理数量
- `ignoreCount`：可忽略数量

### PanelShellState

- `meta`：顶部元信息
- `overview`：顶部四个数字
- `activeBoard`：当前激活板块

### activeBoard 可选值

- `priority_content`
- `within_48h`
- `todo`
- `ignore`

## 二、公共邮件卡片字段

用于四个板块的下半部分列表。

### MailListItem

- `messageId`：邮件 id
- `threadId`：线程 id
- `senderName`：发件人
- `senderEmail`：发件人邮箱
- `subject`：邮件标题
- `summary`：摘要
- `bodyExcerpt`：正文摘录
- `timeText`：展示时间文本
- `timestamp`：标准时间
- `isUnread`：是否未读
- `hasAttachment`：是否有附件
- `labelIds`：Gmail 标签列表
- `threadMessageCount`：线程内消息数
- `boardType`：板块归属
- `priorityLevel`：优先级等级
- `priorityScore`：优先级分数
- `sortScore`：排序参考分值
- `shortSummary`：一句话重点总结
- `actionRequired`：是否需要用户执行动作
- `actionLabel`：建议动作文本
- `deadlineText`：展示用截止时间
- `deadlineTs`：标准化截止时间
- `boardReasonText`：进入该板块的说明
- `priorityReasonTags`：优先级原因标签
- `itemStatus`：事项状态，可选值为 `pending` 或 `done`

## 三、各板块内容字段

### PriorityContentContent

- `immediateAttentionItems`：优先看到的邮件列表
- `worthReviewingItems`：值得尽快查看的邮件列表

### Within48hContent

- `readWithin48hItems`：48 小时内需要查阅的邮件
- `handleWithin48hItems`：48 小时内需要处理的邮件

### TodoContent

- `sections`：待处理分组列表

### IgnoreContent

- `items`：可忽略邮件列表

## 四、展开态总数据

### ExpandedPanelData

- `meta`
- `overview`
- `activeBoard`
- `priorityContent`
- `within48h`
- `todo`
- `ignore`

## 五、邮件详情联动态字段

### MailInsightDetail

- `messageId`：邮件 id
- `threadId`：线程 id
- `senderName`：发件人
- `senderEmail`：发件人邮箱
- `subject`：邮件标题
- `boardType`：板块归属
- `priorityLevel`：优先级等级
- `priorityScore`：优先级分数
- `focusText`：一句话解读
- `suggestedAction`：建议动作
- `deadlineDisplay`：截止时间展示文本
- `reasonBullets`：判断原因列表

## 数据联动规则

- 顶部四个概览数字是整个展开态的全局统计信息
- 数量必须基于最新 `board_type` 结果实时计算
- 当前处于哪个子状态，都必须继续显示四个数字和四个 Tab
- 当前激活板块由 `activeBoard` 控制
- 下半部分内容区根据 `activeBoard` 渲染对应模块内容
- 邮件卡片颜色只表达 `priorityLevel`，不表达板块
