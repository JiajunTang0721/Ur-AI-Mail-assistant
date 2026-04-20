# 当前状态说明

这份文档只描述仓库里已经能在代码中看到的真实能力，不把“目标方案”当成“已经完成”。

## 1. 当前仓库的真实组成

| 层级 | 目录 | 当前状态 |
| --- | --- | --- |
| 原型层 | `src/` | 可以独立运行 React 演示页，用来验证界面布局、卡片和交互节奏 |
| 扩展层 | `extension/` | 已接入 Chrome Extension MV3、Gmail OAuth、Gmail 数据抓取、面板渲染和本地状态 |
| 分析层 | `backend/` | 已提供 FastAPI 接口、LLM 特征抽取、规则兜底、优先级打分和反馈记录 |

## 2. 当前已经实现的能力

- Gmail 只读授权：`gmail.readonly`
- 读取最近邮件列表、单封邮件详情和线程信息
- 规范化邮件字段并发送到后端
- 合并本地状态：
  - `selectedSenders`
  - `selectedFocuses`
  - `importantSenderNames`
  - `notImportantSenderNames`
  - `mutedSenderNames`
  - `analysisHistory`
  - `feedbackHistory`
  - `processedMessageIds`
  - `hiddenMessageIds`
- LLM 结构化特征抽取
- 规则引擎兜底
- 独立输出 `board_type` 与 `priority_level`
- 重新分析整批邮件
- 刷新单封邮件摘要
- 记录 `更重要 / 少显示` 反馈
- 按 Gmail 账号维度保存扩展侧状态

## 3. 当前实际接口

后端 `backend/app/main.py` 当前提供：

- `GET /health`
- `POST /api/v1/analyze/messages`
- `POST /api/v1/reanalyze`
- `POST /api/v1/resummary`
- `POST /api/v1/feedback`
- `GET /api/v1/feedback/{account_id}`
- `GET /api/v1/preferences`
- `POST /api/v1/preferences`

## 4. 当前方法和策略

- LLM 层：
  - `backend/app/llm.py` 使用严格 JSON Schema 限定输出
  - 同时生成结构化特征和展示字段，避免重复调用
- 规则层：
  - `backend/app/rules.py` 会从主题、正文、寄件人、时间、附件、历史反馈中提取规则信号
  - 当 LLM 不可用时，规则层会独立完成说明文本和标签生成
- 优先级模型：
  - 使用轻量加权打分加 `sigmoid` 形成 `priority_score`
  - 引入寄件人反馈偏置、关注方向偏置和阈值微调
- 板块判断：
  - `priority_content`
  - `within_48h`
  - `todo`
  - `ignore`
  - 与优先级独立计算

## 5. 当前需要诚实说明的地方

- `src/` 原型仍保留旧 tab 名称：
  - `today_focus`
  - `due_soon`
  - `todo`
  - `ignorable`
- `extension/content.ts` 已经做了旧命名到新板块命名的兼容映射。
- `docs/architecture-v1.md` 和 `docs/api-contract-v1.md` 更接近迁移目标说明，不代表每一个字段和接口都已经完全按目标态实现。

## 6. 当前适合 GitHub 展示的重点

如果是面向 GitHub 主页展示，建议强调这些“真实已实现”的部分：

- Gmail 侧边助手是可运行的，不只是静态页面
- 后端是可跑通的，不只是伪接口
- 项目已经有 LLM + 规则 + 本地反馈三层方法
- 仓库中已经包含配置文档、方法文档和演示素材
