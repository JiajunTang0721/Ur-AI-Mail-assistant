from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .rules import analyze_messages, resummarize_message
from .schemas import (
    AnalyzeMessagesRequest,
    AnalyzeMessagesResponse,
    FeedbackRequest,
    FeedbackResponse,
    Preferences,
    ResummarizeMessageRequest,
    ResummarizeMessageResponse,
)
from .store import append_feedback_record, load_feedback_records, load_preferences, save_preferences

app = FastAPI(title="Mail assistant API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/analyze/messages", response_model=AnalyzeMessagesResponse)
def analyze_messages_endpoint(payload: AnalyzeMessagesRequest) -> AnalyzeMessagesResponse:
    return analyze_messages(payload)


@app.post("/api/v1/reanalyze", response_model=AnalyzeMessagesResponse)
def reanalyze_messages_endpoint(payload: AnalyzeMessagesRequest) -> AnalyzeMessagesResponse:
    payload.mode = "full_reanalyze"
    payload.project_context.analysis_mode = "full_reanalyze"
    return analyze_messages(payload)


@app.post("/api/v1/resummary", response_model=ResummarizeMessageResponse)
def resummary_message_endpoint(payload: ResummarizeMessageRequest) -> ResummarizeMessageResponse:
    return resummarize_message(payload)


@app.post("/api/v1/feedback", response_model=FeedbackResponse)
def record_feedback(payload: FeedbackRequest) -> FeedbackResponse:
    recorded_at = payload.created_at or datetime.now(UTC).isoformat()
    payload.created_at = recorded_at
    records = append_feedback_record(payload)
    more_count = sum(1 for record in records if record.message_id == payload.message_id and record.feedback_action == "more_important")
    less_count = sum(1 for record in records if record.message_id == payload.message_id and record.feedback_action == "show_less")
    return FeedbackResponse(
        ok=True,
        recordedAt=recorded_at,
        moreImportantCount=more_count,
        showLessCount=less_count,
    )


@app.get("/api/v1/feedback/{account_id}")
def get_feedback(account_id: str) -> list[dict[str, object]]:
    return [record.model_dump(mode="json", by_alias=True) for record in load_feedback_records(account_id)]


@app.get("/api/v1/preferences", response_model=Preferences)
def get_preferences() -> Preferences:
    return load_preferences()


@app.post("/api/v1/preferences", response_model=Preferences)
def post_preferences(preferences: Preferences) -> Preferences:
    return save_preferences(preferences)

