from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

from .schemas import AnalysisContext, RawMessage

logger = logging.getLogger(__name__)

ROOT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"
BACKEND_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

load_dotenv(ROOT_ENV_FILE)
load_dotenv(BACKEND_ENV_FILE, override=False)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "auto").strip().lower()
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "").strip()


def _resolve_provider() -> str | None:
    if LLM_PROVIDER == "openai":
        return "openai" if OPENAI_API_KEY else None
    if LLM_PROVIDER == "ollama":
        return "ollama" if OLLAMA_MODEL else None
    if OPENAI_API_KEY:
        return "openai"
    if OLLAMA_MODEL:
        return "ollama"
    return None


def llm_enabled() -> bool:
    return _resolve_provider() is not None


def _safe_text(value: str | None, *, max_length: int | None = None) -> str:
    if not value:
        return ""

    cleaned = value.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    cleaned = cleaned.replace("\x00", " ").strip()

    if max_length is not None:
        cleaned = cleaned[:max_length]

    return cleaned


def _analysis_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["items"],
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "messageId",
                        "displaySender",
                        "briefSubject",
                        "aiSummary",
                        "aiReason",
                        "boardHint",
                        "boardReason",
                        "priorityReasonTags",
                        "customFeatureHits",
                        "deadline",
                        "topics",
                        "actions",
                        "distraction",
                    ],
                    "properties": {
                        "messageId": {"type": "string"},
                        "displaySender": {"type": "string"},
                        "briefSubject": {"type": "string"},
                        "aiSummary": {"type": "string"},
                        "aiReason": {"type": "string"},
                        "boardHint": {
                            "type": ["string", "null"],
                            "enum": ["priority_content", "within_48h", "todo", "ignore", None],
                        },
                        "boardReason": {"type": "string"},
                        "priorityReasonTags": {
                            "type": "array",
                            "maxItems": 4,
                            "items": {"type": "string"},
                        },
                        "customFeatureHits": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "deadline": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "hasExplicitDeadline",
                                "deadlineText",
                                "deadlineWithin48h",
                                "readWithin48h",
                                "handleWithin48h",
                                "hasMeetingOrInterviewTime",
                            ],
                            "properties": {
                                "hasExplicitDeadline": {"type": "boolean"},
                                "deadlineText": {"type": ["string", "null"]},
                                "deadlineWithin48h": {"type": "boolean"},
                                "readWithin48h": {"type": "boolean"},
                                "handleWithin48h": {"type": "boolean"},
                                "hasMeetingOrInterviewTime": {"type": "boolean"},
                            },
                        },
                        "topics": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "academic",
                                "work",
                                "recruiting",
                                "admin",
                                "finance",
                                "course",
                                "assignment",
                                "interview",
                                "meeting",
                                "customHits",
                            ],
                            "properties": {
                                "academic": {"type": "boolean"},
                                "work": {"type": "boolean"},
                                "recruiting": {"type": "boolean"},
                                "admin": {"type": "boolean"},
                                "finance": {"type": "boolean"},
                                "course": {"type": "boolean"},
                                "assignment": {"type": "boolean"},
                                "interview": {"type": "boolean"},
                                "meeting": {"type": "boolean"},
                                "customHits": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                },
                            },
                        },
                        "actions": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "needsReply",
                                "needsSubmission",
                                "needsDownload",
                                "needsFollowUp",
                                "notificationOnly",
                                "hasActionItem",
                            ],
                            "properties": {
                                "needsReply": {"type": "boolean"},
                                "needsSubmission": {"type": "boolean"},
                                "needsDownload": {"type": "boolean"},
                                "needsFollowUp": {"type": "boolean"},
                                "notificationOnly": {"type": "boolean"},
                                "hasActionItem": {"type": "boolean"},
                            },
                        },
                        "distraction": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": [
                                "isAd",
                                "isSubscription",
                                "isBulk",
                                "isMarketing",
                                "lowValueNotification",
                            ],
                            "properties": {
                                "isAd": {"type": "boolean"},
                                "isSubscription": {"type": "boolean"},
                                "isBulk": {"type": "boolean"},
                                "isMarketing": {"type": "boolean"},
                                "lowValueNotification": {"type": "boolean"},
                            },
                        },
                    },
                }
            }
        },
    }


def _resummary_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["messageId", "displaySender", "briefSubject", "aiSummary", "aiReason"],
        "properties": {
            "messageId": {"type": "string"},
            "displaySender": {"type": "string"},
            "briefSubject": {"type": "string"},
            "aiSummary": {"type": "string"},
            "aiReason": {"type": "string"},
        },
    }


def _system_prompt() -> str:
    return """
你是邮件智能分类与优先级辅助系统中的“结构化特征提取器”。

你的职责不是直接给出最终优先级和最终板块，而是把每封邮件稳定地转换为一组可计算、可复用的结构化特征。

关键要求：
1. 所有输出必须严格符合 JSON Schema。
2. 字段含义要稳定，不能同一字段在不同邮件里用不同标准。
3. 不要输出自由发挥的长段解释。
4. `displaySender` 是前端展示用的“来源主体中文名”，只描述是谁 / 什么组织 / 什么团队 / 什么 App 发来的，不要带邮箱地址，不要直接拼接 `senderEmail`。
5. `briefSubject` 是前端展示标题，必须在完整理解邮件后，用中文高度概括成最简短的短语或短句；不要直接照抄原始 subject，也不要只截取正文前半句。
6. `aiSummary` 是前端展示概述，必须在完整理解邮件内容后，用中文写成一句易懂的总结性话语，直观说明“这封邮件到底在说什么”，必要时带上时间和动作要求；不要输出正文摘抄，不要只截断原文。
7. `aiReason` 只解释邮件为什么值得关注，供解释层使用；不要把它写成前端主概述，也不要重复 `aiSummary`。
8. `boardHint` 只是“候选提示”，不是最终板块。
9. 前端展示字段和结构化特征必须在同一次分析中一起产出，不要把展示字段写成泛泛的“学业相关 / 命中偏好”这类空泛标签。
10. 即使原邮件是英文，`displaySender`、`briefSubject`、`aiSummary`、`aiReason`、`boardReason`、`priorityReasonTags` 也必须全部输出为中文。
11. 必须尽量利用输入中的用户偏好、重点寄件人、历史反馈和自定义关注内容，帮助识别 `customFeatureHits` 与 `topics.customHits`。

字段判定指导：
- `deadline.hasExplicitDeadline`: 正文或主题是否出现明确时间要求、截止点、会议/面试时间。
- `deadline.deadlineWithin48h`: 是否明确落在 48 小时内。
- `deadline.readWithin48h`: 是否 48 小时内需要查阅。
- `deadline.handleWithin48h`: 是否 48 小时内需要处理。
- `actions.hasActionItem`: 是否存在明确动作项。
- `actions.notificationOnly`: 是否主要是知会/通知。
- `distraction.*`: 是否属于营销、订阅、批量群发或低价值通知。
- `customFeatureHits`: 与用户自定义关注内容直接相关的命中项。
- `priorityReasonTags`: 1 到 4 个短标签，便于卡片展示。

板块提示语义：
- `priority_content`: 值得优先看
- `within_48h`: 48 小时内需要查阅或处理
- `todo`: 有后续动作
- `ignore`: 当前阶段低价值

再次强调：不要把优先级和板块绑定成一套分类；你只负责结构化提取和候选提示。
""".strip()


def _build_user_payload(messages: list[RawMessage], context: AnalysisContext) -> str:
    compact_messages = [
        {
            "messageId": message.message_id,
            "threadId": message.thread_id,
            "senderName": message.sender_name,
            "senderEmail": message.sender_email,
            "subject": message.subject,
            "summary": message.summary,
            "bodyExcerpt": message.body_excerpt[:2400],
            "timeText": message.time_text,
            "timestamp": message.timestamp,
            "isUnread": message.is_unread,
            "hasAttachment": message.has_attachment,
            "labelIds": message.label_ids,
            "threadMessageCount": message.thread_message_count,
        }
        for message in messages
    ]

    payload = {
        "context": {
            "accountKey": context.account_key,
            "analysisMode": context.analysis_mode,
            "selectedSenders": context.selected_senders,
            "selectedFocuses": context.selected_focuses,
            "customSenderValue": context.custom_sender_value,
            "customFocusValue": context.custom_focus_value,
            "importantSenderNames": context.important_sender_names,
            "notImportantSenderNames": context.not_important_sender_names,
            "mutedSenderNames": context.muted_sender_names,
            "senderHistory": [item.model_dump(by_alias=True) for item in context.sender_history[:40]],
            "recentHistory": [item.model_dump(by_alias=True) for item in context.recent_history[:80]],
            "feedbackHistory": [item.model_dump(by_alias=True) for item in context.feedback_history[:120]],
            "processedMessageIds": context.processed_message_ids,
            "hiddenMessageIds": context.hidden_message_ids,
        },
        "messages": compact_messages,
    }

    return json.dumps(payload, ensure_ascii=False)


def _resummary_system_prompt() -> str:
    return """
你是邮件前端展示层的重新概述助手。
你的任务只有一个：重新理解一封邮件，并输出更清楚、更具体、更适合前端展示的中文概述内容。

要求：
1. 只输出符合 JSON Schema 的结构化 JSON。
2. 不要改动优先级，不要改动板块，不要输出任何打分或分类判断。
3. `displaySender` 要说明来源主体是谁、什么组织或什么 App，不要包含邮箱地址。
4. `briefSubject` 要用中文高度概括邮件核心主题，避免照抄原始 subject。
5. `aiSummary` 要用中文一句话直观说明邮件到底说了什么，并带上关键时间、动作或对象；不要只摘抄邮件前半句。
6. `aiReason` 只写一句简短补充说明，帮助用户理解新的概述重点；不要提优先级或模型。
7. 即使原邮件是英文，输出也必须是自然中文。
8. 文案必须具体、个性化、有区分度，避免“主要围绕……提供更新信息”这类模板句。
""".strip()


def _build_resummary_payload(message: RawMessage, context: AnalysisContext) -> str:
    payload = {
        "context": {
            "accountKey": context.account_key,
            "analysisMode": context.analysis_mode,
            "selectedSenders": context.selected_senders,
            "selectedFocuses": context.selected_focuses,
            "importantSenderNames": context.important_sender_names,
            "feedbackHistory": [item.model_dump(by_alias=True) for item in context.feedback_history[:60]],
        },
        "message": {
            "messageId": message.message_id,
            "threadId": message.thread_id,
            "senderName": message.sender_name,
            "senderEmail": message.sender_email,
            "subject": message.subject,
            "summary": message.summary,
            "bodyExcerpt": message.body_excerpt[:3200],
            "timeText": message.time_text,
            "timestamp": message.timestamp,
            "isUnread": message.is_unread,
            "hasAttachment": message.has_attachment,
            "labelIds": message.label_ids,
            "threadMessageCount": message.thread_message_count,
        },
    }

    return json.dumps(payload, ensure_ascii=False)


def _post_openai(messages: list[RawMessage], context: AnalysisContext) -> list[dict[str, Any]]:
    response = httpx.post(
        f"{OPENAI_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENAI_MODEL,
            "temperature": 0.1,
            "messages": [
                {"role": "system", "content": _system_prompt()},
                {"role": "user", "content": _build_user_payload(messages, context)},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "mail_feature_extraction",
                    "strict": True,
                    "schema": _analysis_schema(),
                },
            },
        },
        timeout=OPENAI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["choices"][0]["message"]["content"]
    return json.loads(content).get("items", [])


def _post_ollama(messages: list[RawMessage], context: AnalysisContext) -> list[dict[str, Any]]:
    response = httpx.post(
        f"{OLLAMA_BASE_URL}/api/chat",
        json={
            "model": OLLAMA_MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": _system_prompt()},
                {"role": "user", "content": _build_user_payload(messages, context)},
            ],
            "format": _analysis_schema(),
        },
        timeout=OPENAI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    payload = response.json()
    content = payload["message"]["content"]
    return json.loads(content).get("items", [])


def analyze_messages_with_llm(
    messages: list[RawMessage],
    context: AnalysisContext,
) -> list[dict[str, Any]]:
    provider = _resolve_provider()
    if provider is None:
        raise RuntimeError("LLM provider is not configured.")

    raw_items = _post_ollama(messages, context) if provider == "ollama" else _post_openai(messages, context)
    items_by_id = {item.get("messageId"): item for item in raw_items if item.get("messageId")}

    sanitized_items: list[dict[str, Any]] = []
    for message in messages:
        raw_item = items_by_id.get(message.message_id)
        if raw_item is None:
            logger.warning("LLM result missing messageId=%s, skipping.", message.message_id)
            continue

        sanitized_items.append(
            {
                "messageId": message.message_id,
                "displaySender": _safe_text(raw_item.get("displaySender"), max_length=80),
                "briefSubject": _safe_text(raw_item.get("briefSubject"), max_length=80),
                "aiSummary": _safe_text(raw_item.get("aiSummary"), max_length=400),
                "aiReason": _safe_text(raw_item.get("aiReason"), max_length=400),
                "boardHint": raw_item.get("boardHint"),
                "boardReason": _safe_text(raw_item.get("boardReason"), max_length=200),
                "priorityReasonTags": [
                    _safe_text(tag, max_length=24)
                    for tag in raw_item.get("priorityReasonTags", [])
                    if _safe_text(tag, max_length=24)
                ][:4],
                "customFeatureHits": [
                    _safe_text(tag, max_length=40)
                    for tag in raw_item.get("customFeatureHits", [])
                    if _safe_text(tag, max_length=40)
                ],
                "deadline": raw_item.get("deadline", {}),
                "topics": raw_item.get("topics", {}),
                "actions": raw_item.get("actions", {}),
                "distraction": raw_item.get("distraction", {}),
            }
        )

    return sanitized_items


def resummarize_message_with_llm(
    message: RawMessage,
    context: AnalysisContext,
) -> dict[str, Any]:
    provider = _resolve_provider()
    if provider is None:
        raise RuntimeError("LLM provider is not configured.")

    if provider == "ollama":
        response = httpx.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "messages": [
                    {"role": "system", "content": _resummary_system_prompt()},
                    {"role": "user", "content": _build_resummary_payload(message, context)},
                ],
                "format": _resummary_schema(),
            },
            timeout=OPENAI_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        raw_item = json.loads(payload["message"]["content"])
    else:
        response = httpx.post(
            f"{OPENAI_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENAI_MODEL,
                "temperature": 0.2,
                "messages": [
                    {"role": "system", "content": _resummary_system_prompt()},
                    {"role": "user", "content": _build_resummary_payload(message, context)},
                ],
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "mail_resummary",
                        "strict": True,
                        "schema": _resummary_schema(),
                    },
                },
            },
            timeout=OPENAI_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        payload = response.json()
        raw_item = json.loads(payload["choices"][0]["message"]["content"])

    return {
        "messageId": message.message_id,
        "displaySender": _safe_text(raw_item.get("displaySender"), max_length=80),
        "briefSubject": _safe_text(raw_item.get("briefSubject"), max_length=80),
        "aiSummary": _safe_text(raw_item.get("aiSummary"), max_length=400),
        "aiReason": _safe_text(raw_item.get("aiReason"), max_length=220),
    }
