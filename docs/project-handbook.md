# 项目手册

## 1. 项目介绍

“邮件智能分类与优先级辅助系统”运行在 Gmail 右侧，是一个帮助用户快速理解和组织收件箱的 AI 助手。

当前项目的核心目标，不再是单纯把邮件粗暴分成几类，而是为每封邮件独立产出两层结果：

1. 板块归属
2. 优先级

现有前端固定保留 4 个板块：

- 优先内容
- 48h
- 待处理
- 可忽略

其中：

- 板块归属代表展示语义与行动语义
- 优先级代表邮件本身的重要程度

## 2. 当前仓库真实组成

项目目前由三层组成：

- 原型层：`src/`，负责验证页面结构、交互节奏和组件拆分
- 扩展层：`extension/`，负责 Chrome Extension MV3、Gmail 注入、授权、状态和反馈
- 分析层：`backend/`，负责 FastAPI 接口、规则引擎、LLM 特征抽取与优先级建模入口

这意味着当前仓库已经具备“真实 Gmail + 本地后端 + LLM 分析”的联调基础，并非只有 demo UI。

## 3. 当前已经沉淀下来的能力

### 3.1 基础链路

- Chrome Extension MV3 骨架已完成
- Gmail 页面注入与右侧助手挂载已完成
- Gmail OAuth 授权与 `gmail.readonly` 已接入
- Gmail API 最近邮件读取已接入
- FastAPI 后端最小链路已可运行

### 3.2 分析链路

- OpenAI / Ollama / 规则引擎兜底能力已存在
- 增量分析与历史结果复用已存在
- 单封邮件重新概述与整体重新分析入口已存在
- 偏好、历史和反馈已能进入部分排序逻辑

### 3.3 用户状态

扩展层已经沉淀了大量可复用状态，包括但不限于：

- `selectedSenders`
- `selectedFocuses`
- `customSenderValue`
- `customFocusValue`
- `importantSenderNames`
- `notImportantSenderNames`
- `mutedSenderNames`
- `analysisHistory`
- `feedbackHistory`
- `processedMessageIds`
- `hiddenMessageIds`

这些状态是新版分析链路的重要输入，不应继续只停留在 UI 层。

## 4. 当前统一后的系统方法

整个系统的目标流程为：

```text
Gmail 原始数据
-> 项目已有设置与上下文
-> LLM 结构化特征抽取
-> 板块判断
-> 本地优先级模型
-> 持久化
-> 现有前端四板块展示
-> 用户反馈
-> 重新分析与重训
```

### 4.1 Gmail 输入层

至少规范化以下字段：

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

### 4.2 项目上下文层

必须一并合并当前项目已有内容：

- 用户偏好设置
- 重点寄件人
- 标签顺序
- 自定义关注内容
- thread 上下文
- 历史反馈
- 已有排序和过滤逻辑
- 前端板块配置

### 4.3 LLM 特征层

LLM 输出应是固定 schema 的特征 JSON，而不是解释性自由文本。特征至少覆盖：

- 时间与 DDL
- 主题
- 操作需求
- 干扰信号
- 用户偏好命中

并允许 `custom_features` 扩展。

### 4.4 板块与优先级双输出

系统最终必须分别输出：

- `board_type`
  - `priority_content`
  - `within_48h`
  - `todo`
  - `ignore`
- `priority_score`
- `priority_level`
  - `high`
  - `medium`
  - `low`
  - `ignore`

这是本仓库此后所有文档和重构的主基线。

## 5. 目录结构

```text
Ur-AI-Mail-assistant/
├─ src/
│  ├─ App.tsx
│  ├─ App.css
│  ├─ types.ts
│  ├─ data/mockData.ts
│  └─ components/
├─ extension/
│  ├─ background.ts
│  ├─ chrome.ts
│  ├─ content.ts
│  ├─ popup.ts
│  ├─ popup.html
│  ├─ popup.css
│  └─ public/
│     ├─ manifest.json
│     └─ content.css
├─ backend/
│  ├─ README.md
│  ├─ requirements.txt
│  └─ app/
│     ├─ main.py
│     ├─ schemas.py
│     ├─ rules.py
│     ├─ llm.py
│     └─ store.py
├─ docs/
│  └─ frontend/
└─ .env.example
```

## 6. 数据落点

| 数据类型 | 落点 | 说明 |
| --- | --- | --- |
| 扩展历史缓存 | `chrome.storage.local` | 使用 key `lma-extension-panel-state`，按 Gmail 账号区分 |
| 偏好与反馈本地状态 | `chrome.storage.local` | 包含偏好、已处理、反馈、分析历史、缓存结果 |
| 后端偏好文件 | `backend/data/preferences.json` | 由 `backend/app/store.py` 维护 |
| 环境配置 | `.env` | 包含 Google OAuth Client ID、后端地址、OpenAI Key 等 |
| 构建产物 | `dist-extension/` | Chrome 加载的已构建扩展目录 |

## 7. 当前最重要的语义迁移

仓库里仍可能存在旧命名或旧逻辑，例如：

- `today_focus`
- `due_soon`
- “今日重点”
- “即将到期”
- 将高优先级直接等同于第一板块

从本版手册开始，一律以以下设计为准：

- `priority_content`
- `within_48h`
- `todo`
- `ignore`

并明确：

- 板块归属和优先级不是同一回事
- 颜色只保留优先级颜色
- 反馈按钮以“更重要 / 少显示”为准

## 8. 反馈与重训

当前前端反馈入口保留：

- 更重要
- 少显示

反馈默认先影响优先级模型，再在重新分析时作为辅助信号影响板块逻辑。推荐流程为：

1. 记录反馈到持久层
2. 用户点击“重新分析”
3. 重新读取 Gmail 与当前设置
4. 重跑特征抽取
5. 更新训练样本
6. 重训优先级模型
7. 必要时重算板块归属

## 9. 本地联调顺序

1. 配置 `.env`
2. 启动 FastAPI
3. 访问 `/health`
4. 构建扩展
5. `chrome://extensions` 重新加载
6. Gmail 页面强制刷新
7. 打开助手并完成授权
8. 触发一次“重新分析”检查链路

## 10. 项目文档入口

- 架构说明：[`architecture-v1.md`](./architecture-v1.md)
- API 契约：[`api-contract-v1.md`](./api-contract-v1.md)
- 优先级规则：[`priority-scoring-rules.md`](./priority-scoring-rules.md)
- 可忽略板块规则：[`ignorable-classification-rules.md`](./ignorable-classification-rules.md)
- Gmail OAuth 与 OpenAI 配置：[`gmail-oauth-openai-setup.md`](./gmail-oauth-openai-setup.md)
- 问题与修复记录：[`project-issue-log.md`](./project-issue-log.md)

## 11. 后续建议方向

- 把 `chrome.storage.local` 中的账号态逐步提升为服务端账号态
- 继续增强 thread 级理解与跨邮件上下文
- 把用户偏好顺序和自定义内容稳定纳入模型训练
- 用统一 shared schema 打通扩展、后端和前端原型
- 在代码层彻底清理旧命名，完成新板块契约迁移
