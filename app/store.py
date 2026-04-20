from __future__ import annotations

import json
from pathlib import Path

from .schemas import FeedbackHistoryEntry, FeedbackRequest, Preferences

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PREFERENCES_FILE = DATA_DIR / "preferences.json"
FEEDBACK_FILE = DATA_DIR / "feedback.json"


def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, default: object) -> object:
    if not path.exists():
        return default

    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write_json(path: Path, payload: object) -> None:
    _ensure_data_dir()
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)


def load_preferences() -> Preferences:
    payload = _read_json(PREFERENCES_FILE, {})
    return Preferences.model_validate(payload)


def save_preferences(preferences: Preferences) -> Preferences:
    _write_json(
        PREFERENCES_FILE,
        preferences.model_dump(mode="json", by_alias=True),
    )
    return preferences


def load_feedback_records(account_id: str | None) -> list[FeedbackHistoryEntry]:
    if not account_id:
        return []

    payload = _read_json(FEEDBACK_FILE, {"accounts": {}})
    accounts = payload.get("accounts", {}) if isinstance(payload, dict) else {}
    records = accounts.get(account_id, []) if isinstance(accounts, dict) else []
    return [FeedbackHistoryEntry.model_validate(record) for record in records]


def append_feedback_record(request: FeedbackRequest) -> list[FeedbackHistoryEntry]:
    payload = _read_json(FEEDBACK_FILE, {"accounts": {}})
    if not isinstance(payload, dict):
        payload = {"accounts": {}}

    accounts = payload.setdefault("accounts", {})
    if not isinstance(accounts, dict):
        accounts = {}
        payload["accounts"] = accounts

    account_records = accounts.setdefault(request.account_id, [])
    if not isinstance(account_records, list):
        account_records = []
        accounts[request.account_id] = account_records

    next_record = FeedbackHistoryEntry(
        messageId=request.message_id,
        threadId=request.thread_id,
        senderName=request.sender_name,
        senderEmail=request.sender_email,
        subject=request.subject,
        feedbackAction=request.feedback_action,
        boardType=request.board_type,
        priorityLevel=request.priority_level,
        priorityScore=request.priority_score,
        focusAreas=request.focus_areas,
        createdAt=request.created_at,
    )

    dedupe_key = (
        next_record.message_id,
        next_record.feedback_action,
        next_record.created_at,
    )
    existing_keys = {
        (
            record.get("messageId"),
            record.get("feedbackAction"),
            record.get("createdAt"),
        )
        for record in account_records
        if isinstance(record, dict)
    }
    if dedupe_key not in existing_keys:
        account_records.append(next_record.model_dump(mode="json", by_alias=True))

    # Keep the account history bounded so the local JSON store remains responsive.
    accounts[request.account_id] = account_records[-600:]
    _write_json(FEEDBACK_FILE, payload)
    return load_feedback_records(request.account_id)

