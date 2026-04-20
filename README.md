# Ur-AI-Mail-assistant

Ur-AI-Mail-assistant 是一个面向 Gmail 的智能邮件整理项目，仓库中同时包含 Chrome Extension MV3、Gmail 页面侧边助手、FastAPI 分析服务，以及一套基于 LLM 特征抽取、规则兜底和本地反馈权重的邮件优先级方法。

代码中的产品工作名仍然保留 `Lark Mail Assistant / 邮件重点助手`，而 GitHub 展示仓库统一使用 `Ur-AI-Mail-assistant` 作为项目名。这样既保留了现有代码语义，也方便在 GitHub 上做更清晰的项目展示。

![Assistant UI Preview](./assets/preview/assistant-ui-preview.png)

## 项目当前已经实现的内容

- Chrome Extension MV3 弹窗、Gmail 页面注入与右侧助手面板
- Gmail `gmail.readonly` OAuth 授权与最近邮件/线程读取
- Gmail 原始数据规范化、线程信息补充和批量同步
- 后端结构化分析接口、健康检查、偏好读写、反馈记录、重新分析、单封邮件重概述
- OpenAI / Ollama 两种 LLM 来源，以及规则引擎兜底
- 邮件双维度输出：
  - `board_type`: `priority_content | within_48h | todo | ignore`
  - `priority_score / priority_level`
- 解释字段生成：`displaySender`、`briefSubject`、`aiSummary`、`aiReason`
- 用户反馈入口：`更重要`、`少显示`
- 本地偏好与反馈持久化：
  - 扩展侧：`chrome.storage.local`
  - 后端侧：`backend/data/preferences.json`、`backend/data/feedback.json`

## 这个项目是怎么工作的

1. Chrome 扩展在 Gmail 页面挂载右侧助手，并由 `extension/background.ts` 负责 Gmail OAuth、邮件抓取和后端请求。
2. Gmail 邮件会被整理成统一结构，再与本地偏好、历史分析结果、反馈记录和已处理状态合并。
3. `backend/app/llm.py` 使用严格 JSON Schema 让 LLM 一次性输出结构化特征和前端展示字段。
4. `backend/app/rules.py` 会把 LLM 输出和规则特征合并，计算优先级分数，并独立判断 `board_type`。
5. 前端/扩展面板按板块展示邮件，允许重新分析、刷新摘要和记录反馈。

更完整的方法说明见：

- [当前状态说明](./docs/current-status.md)
- [实现方法说明](./docs/implementation-method.md)
- [功能拆解清单](./docs/feature-breakdown.md)

## 当前仓库结构

```text
Ur-AI-Mail-assistant/
├─ assets/                     # GitHub 展示素材
├─ src/                        # React 原型层
├─ extension/                  # Chrome Extension MV3 与 Gmail 注入
├─ backend/                    # FastAPI、规则、LLM、持久化
├─ docs/                       # 架构、方法、配置、功能文档
├─ public/                     # 前端静态资源
├─ package.json                # 前端与扩展构建脚本
└─ vite.extension.config.ts    # 扩展 manifest 与打包逻辑
```

## 演示素材

- Demo 视频：[assistant-demo.mp4](./assets/demo/assistant-demo.mp4)
- UI 预览图：[`assets/preview/assistant-ui-preview.png`](./assets/preview/assistant-ui-preview.png)

## 快速启动

1. 安装前端依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

3. 启动后端

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

4. 构建扩展

```bash
npm run build:extension
```

5. 在 Chrome 中加载 `dist-extension/`

- 打开 `chrome://extensions`
- 开启开发者模式
- 选择“加载已解压的扩展程序”
- 指向构建后的 `dist-extension/`

## 真实状态说明

- `src/` 目录中的独立 React 原型仍保留了 `today_focus / due_soon / todo / ignorable` 这套旧 tab 命名。
- `extension/content.ts` 已经实现了旧命名到新板块枚举的兼容映射，并以 `priority_content / within_48h / todo / ignore` 作为主输出。
- `docs/architecture-v1.md` 与 `docs/api-contract-v1.md` 描述的是迁移基线和目标契约；如果你要看“当前代码实际做了什么”，请优先看 `docs/current-status.md` 与 `backend/app/*.py`。
- 当前只申请 Gmail 只读权限，不包含邮件修改、发送或删除能力。

## 文档入口

- 项目现状：[docs/current-status.md](./docs/current-status.md)
- 实现方法：[docs/implementation-method.md](./docs/implementation-method.md)
- 功能清单：[docs/feature-breakdown.md](./docs/feature-breakdown.md)
- GitHub 整理说明：[docs/github-refresh-checklist.md](./docs/github-refresh-checklist.md)
- 项目手册：[docs/project-handbook.md](./docs/project-handbook.md)
- 架构说明：[docs/architecture-v1.md](./docs/architecture-v1.md)
- API 契约：[docs/api-contract-v1.md](./docs/api-contract-v1.md)
- Gmail OAuth 与 OpenAI 配置：[docs/gmail-oauth-openai-setup.md](./docs/gmail-oauth-openai-setup.md)
- 首次联调自查：[docs/first-run-checklist.md](./docs/first-run-checklist.md)
- 前端契约：[docs/frontend/frontend-contract-v1.md](./docs/frontend/frontend-contract-v1.md)
- 前端 Props 契约：[docs/frontend/frontend-props-contract-v1.md](./docs/frontend/frontend-props-contract-v1.md)
- 前端组件树：[docs/frontend/frontend-component-tree-v1.md](./docs/frontend/frontend-component-tree-v1.md)
