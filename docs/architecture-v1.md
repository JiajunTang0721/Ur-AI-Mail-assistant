# V1 架构说明

## 1. 当前系统定位

当前仓库已经不是单纯的前端 mock，而是一个包含三层的可联调项目：

- `src/`：前端原型与交互验证层
- `extension/`：真实 Gmail Chrome Extension 层
- `backend/`：后端分析与规则层

本轮架构统一的重点不是重做前端，而是把现有前端已经固定的 4 个板块接上完整、清晰、可训练的后端分析链路。

前端固定板块如下：

- 优先内容
- 48h
- 待处理
- 可忽略

## 2. 核心原则

### 2.1 板块归属和优先级是两个维度

每封邮件都必须同时拥有两类结果：

1. `board_type`
   - `priority_content`
   - `within_48h`
   - `todo`
   - `ignore`
2. `priority_score` 与 `priority_level`
   - `priority_score ∈ [0,1]`
   - `priority_level ∈ {high, medium, low, ignore}`

两者关系如下：

- `board_type` 决定邮件展示在现有前端哪个板块
- `priority_level` 决定颜色标记、板块内排序参考和反馈训练目标
- 48h 和待处理板块都允许同时出现不同优先级邮件
- 不能把 `high = priority_content`、`medium = within_48h` 这类映射当成系统规则

### 2.2 现有前端不重做，只改后端语义和契约

本仓库已经具备 Gmail 面板结构、卡片组件、反馈入口和顶部概览。后续工作以适配现有四板块为前提，不重新定义页面布局。

## 3. 当前仓库中已经存在的可复用层

### 3.1 前端层

- `src/App.tsx`：原型演示入口
- `src/components/AssistantPanel.tsx`：右侧助手面板外壳
- `src/components/MailCard.tsx`：邮件卡片
- `src/components/MailInsightView.tsx`：详情联动视图
- `src/data/mockData.ts`：原型数据与概览联动逻辑

### 3.2 扩展层

- `extension/background.ts`：OAuth、Gmail API 调用、与后端通信
- `extension/chrome.ts`：扩展共享常量与消息定义
- `extension/` 下的内容脚本逻辑：负责 Gmail 页面注入、面板状态、缓存、反馈与本地重排

扩展层目前已经保存并复用了大量账号级状态，典型包括：

- `selectedSenders`
- `selectedFocuses`
- `customSenderValue`
- `customFocusValue`
- `importantSenderNames`
- `notImportantSenderNames`
- `mutedSenderNames`
- `processedMessageIds`
- `analysisHistory`
- `feedbackHistory`
- `hiddenMessageIds`

这些数据不应停留在 UI 层，而应进入分析链路。

### 3.3 后端层

- `backend/app/main.py`：FastAPI 入口
- `backend/app/schemas.py`：请求与响应 schema
- `backend/app/rules.py`：规则逻辑与兜底分析
- `backend/app/llm.py`：LLM 调用与结构化输出
- `backend/app/store.py`：偏好持久化

## 4. 统一后的系统流程

系统流程应固定为：

```text
Gmail 原始数据获取
-> 合并项目已有设置与上下文
-> LLM 提取结构化特征
-> 板块判断逻辑输出 board_type
-> 本地优先级模型输出 priority_score / priority_level
-> 写入数据库或本地持久层
-> 输出给现有前端展示
-> 用户点击反馈
-> 更新反馈记录
-> 用户点击“重新分析”后重训与重分配
```

## 5. 数据获取层

### 5.1 Gmail 规范化字段

至少应统一为以下字段：

- `message_id`
- `thread_id`
- `sender_name`
- `sender_email`
- `subject`
- `summary`
- `body_excerpt`
- `time_text`
- `timestamp`
- `is_unread`
- `has_attachment`
- `label_ids`
- `thread_message_count`

### 5.2 项目内上下文补充

输入数据不能只来自 Gmail，还必须并入当前项目已有内容，例如：

- 用户偏好设置
- 重点寄件人配置
- 当前关注板块与标签顺序
- 已有分类规则与忽略规则
- 历史用户反馈记录
- thread 聚合结果
- 前端板块配置和已存在的排序逻辑
- 用户自定义关注内容

原则是：优先复用项目已有数据结构和状态，而不是重新发明一套平行输入。

## 6. LLM 特征抽取层

### 6.1 目标

LLM 的职责不是解释邮件，而是把邮件转成固定 schema 的结构化特征，便于后续计算、排序、训练和扩展。

### 6.2 输入

LLM 输入应同时包含：

- Gmail 规范化后的邮件字段
- 用户偏好与重点寄件人
- 标签配置和业务规则
- 当前线程上下文
- 历史反馈痕迹
- 用户自定义关注内容

### 6.3 输出

LLM 输出必须满足：

- 字段命名固定
- 格式固定
- 同类特征跨邮件可比较
- 特征尽量独立
- 支持扩展新特征

### 6.4 基础特征类别

基础特征至少覆盖：

- 时间与 DDL 特征
- 主题特征
- 操作需求特征
- 干扰类特征
- 用户偏好命中特征

同时允许通过 `custom_features` 扩展新维度，避免用户新增自定义关注内容后系统无法识别。

## 7. 板块判断层

### 7.1 板块判断是独立逻辑

`board_type` 应由单独逻辑决定，可以是：

- 规则逻辑
- LLM 输出标签逻辑
- 规则 + 特征的混合逻辑
- 后续独立建模

但无论采用哪种方式，都不能把板块直接写成优先级的映射。

### 7.2 板块语义

- `priority_content`：应该优先被用户看到的内容区
- `within_48h`：48 小时内需要查阅或处理
- `todo`：存在后续处理动作，但不一定卡在 48 小时内
- `ignore`：当前阶段低价值或无需处理

## 8. 本地优先级模型

优先级模型学习的是用户对邮件“心理上的重要程度判断”，而不是邮件应该在哪个板块展示。

定义如下：

```text
X = 邮件特征向量
β = 模型参数
Z = sigmoid(β^T X)
```

其中：

- `Z ∈ [0,1]`
- `Z` 越大，表示邮件越重要

再通过阈值把 `Z` 映射到：

- `high`
- `medium`
- `low`
- `ignore`

## 9. 排序、颜色和一致性

### 9.1 板块内排序

板块内部排序应综合以下信号：

1. `priority_score`
2. 时间相关特征
3. 是否未读
4. 是否命中重点寄件人
5. 当前项目已有排序规则

### 9.2 颜色策略

前端只保留优先级颜色：

- `high`：橙红色
- `medium`：蓝色
- `low`：绿色
- `ignore`：灰色

颜色不再表达板块本身。

### 9.3 数量一致性

导航栏计数必须与真实展示数量一致，这要求：

- 计数基于最新分类结果计算
- 不能读旧缓存值冒充当前结果
- 前端过滤和后端分类边界清晰

## 10. 反馈与重训

### 10.1 反馈按钮

前端反馈按钮以以下两项为准：

- 更重要
- 少显示

### 10.2 反馈含义

- `更重要`：优先提高该邮件的目标优先级
- `少显示`：优先降低该邮件的目标优先级

反馈默认先进入优先级模型，不直接改板块语义。

### 10.3 重新分析

用户点击“重新分析”后，系统应执行：

1. 读取 Gmail 最新数据
2. 读取当前项目已有设置
3. 重跑 LLM 特征抽取
4. 读取用户反馈记录
5. 更新训练样本
6. 重新训练优先级模型
7. 重新输出 `priority_score / priority_level`
8. 必要时重跑板块判断
9. 同步更新前端展示

## 11. 迁移说明

当前仓库代码里仍可能出现旧命名，例如：

- `today_focus`
- `due_soon`
- “今日重点”
- “即将到期”

从本版文档开始，统一以下面这套命名为准：

- `priority_content`
- `within_48h`
- `todo`
- `ignore`

后续代码重构时，应以新契约覆盖旧命名，而不是反过来为了兼容旧概念去扭曲新设计。
