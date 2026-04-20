# FastAPI Backend

这里是 Ur-AI-Mail-assistant 的分析后端。它负责把 Gmail 邮件和本地上下文整理成统一输入，并输出：

- `board_type`
- `priority_score`
- `priority_level`
- `displaySender`
- `briefSubject`
- `aiSummary`
- `aiReason`

## 当前实际提供的接口

- `GET /health`
- `POST /api/v1/analyze/messages`
- `POST /api/v1/reanalyze`
- `POST /api/v1/resummary`
- `POST /api/v1/feedback`
- `GET /api/v1/feedback/{account_id}`
- `GET /api/v1/preferences`
- `POST /api/v1/preferences`

## 当前后端方法

1. 接收 Gmail 规范化邮件数据。
2. 合并偏好、历史分析、反馈、重点寄件人和隐藏/已处理状态。
3. 尝试调用 LLM 输出固定 schema 的结构化特征和展示字段。
4. 若 LLM 不可用或失败，则使用规则层完成特征抽取和说明生成。
5. 用一个轻量本地优先级模型计算 `priority_score / priority_level`。
6. 独立判断 `board_type`，避免把板块和优先级硬绑定成一套标签。

## 关键源码位置

- `backend/app/main.py`: FastAPI 路由入口
- `backend/app/schemas.py`: 输入输出 schema
- `backend/app/llm.py`: OpenAI / Ollama 调用与 JSON Schema
- `backend/app/rules.py`: 规则、特征、优先级打分、板块判断
- `backend/app/store.py`: 偏好和反馈 JSON 持久化

## 环境变量

后端默认读取仓库根目录 `.env`：

```env
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=45
LLM_PROVIDER=auto
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=
```

如果要强制使用本地模型：

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
```

## 运行方式

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

## 数据文件

- `backend/data/preferences.json`: 默认偏好模板
- `backend/data/feedback.json`: 空反馈模板

这两个文件在当前仓库中已经做过脱敏处理，避免把真实账号数据直接提交到 GitHub。
