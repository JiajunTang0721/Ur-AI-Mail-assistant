from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

BoardType = Literal["priority_content", "within_48h", "todo", "ignore"]
PriorityLevel = Literal["high", "medium", "low", "ignore"]
AnalysisEngine = Literal["llm", "rules"]
AnalysisMode = Literal["incremental", "full_reanalyze", "resummary", "rerank"]
FeedbackAction = Literal["more_important", "show_less"]


class RawMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_id: str = Field(
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    thread_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("threadId", "thread_id"),
        serialization_alias="threadId",
    )
    sender_name: str = Field(
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    sender_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderEmail", "sender_email"),
        serialization_alias="senderEmail",
    )
    subject: str
    summary: str = ""
    body_excerpt: str = Field(
        default="",
        validation_alias=AliasChoices("bodyExcerpt", "body_excerpt"),
        serialization_alias="bodyExcerpt",
    )
    time_text: str | None = Field(
        default=None,
        validation_alias=AliasChoices("timeText", "time_text"),
        serialization_alias="timeText",
    )
    timestamp: str | None = None
    is_unread: bool = Field(
        default=False,
        validation_alias=AliasChoices("isUnread", "is_unread", "unread"),
        serialization_alias="isUnread",
    )
    has_attachment: bool = Field(
        default=False,
        validation_alias=AliasChoices("hasAttachment", "has_attachment"),
        serialization_alias="hasAttachment",
    )
    label_ids: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("labelIds", "label_ids"),
        serialization_alias="labelIds",
    )
    thread_message_count: int = Field(
        default=1,
        validation_alias=AliasChoices("threadMessageCount", "thread_message_count"),
        serialization_alias="threadMessageCount",
    )


class SenderHistoryEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sender_name: str = Field(
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    count: int = 0


class FeedbackHistoryEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    thread_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("threadId", "thread_id"),
        serialization_alias="threadId",
    )
    sender_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    sender_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderEmail", "sender_email"),
        serialization_alias="senderEmail",
    )
    subject: str | None = None
    feedback_action: FeedbackAction = Field(
        validation_alias=AliasChoices("feedbackAction", "feedback_action"),
        serialization_alias="feedbackAction",
    )
    board_type: BoardType | None = Field(
        default=None,
        validation_alias=AliasChoices("boardType", "board_type"),
        serialization_alias="boardType",
    )
    priority_level: PriorityLevel | None = Field(
        default=None,
        validation_alias=AliasChoices("priorityLevel", "priority_level"),
        serialization_alias="priorityLevel",
    )
    priority_score: float | None = Field(
        default=None,
        validation_alias=AliasChoices("priorityScore", "priority_score"),
        serialization_alias="priorityScore",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusAreas", "focus_areas"),
        serialization_alias="focusAreas",
    )
    created_at: str | None = Field(
        default=None,
        validation_alias=AliasChoices("createdAt", "created_at"),
        serialization_alias="createdAt",
    )


class AnalysisHistoryEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_id: str = Field(
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    thread_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("threadId", "thread_id"),
        serialization_alias="threadId",
    )
    sender_name: str = Field(
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    sender_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderEmail", "sender_email"),
        serialization_alias="senderEmail",
    )
    display_sender: str = Field(
        default="",
        validation_alias=AliasChoices("displaySender", "display_sender"),
        serialization_alias="displaySender",
    )
    subject: str
    brief_subject: str = Field(
        default="",
        validation_alias=AliasChoices("briefSubject", "brief_subject"),
        serialization_alias="briefSubject",
    )
    summary: str = ""
    ai_summary: str = Field(
        default="",
        validation_alias=AliasChoices("aiSummary", "ai_summary"),
        serialization_alias="aiSummary",
    )
    ai_reason: str = Field(
        default="",
        validation_alias=AliasChoices("aiReason", "ai_reason"),
        serialization_alias="aiReason",
    )
    deadline_label: str | None = Field(
        default=None,
        validation_alias=AliasChoices("deadlineLabel", "deadline_label"),
        serialization_alias="deadlineLabel",
    )
    action_label: str | None = Field(
        default=None,
        validation_alias=AliasChoices("actionLabel", "action_label"),
        serialization_alias="actionLabel",
    )
    board_type: BoardType = Field(
        default="priority_content",
        validation_alias=AliasChoices("boardType", "board_type", "tab"),
        serialization_alias="boardType",
    )
    priority_level: PriorityLevel = Field(
        default="medium",
        validation_alias=AliasChoices("priorityLevel", "priority_level", "priority"),
        serialization_alias="priorityLevel",
    )
    priority_score: float = Field(
        default=0.5,
        validation_alias=AliasChoices("priorityScore", "priority_score", "sortScore"),
        serialization_alias="priorityScore",
    )
    sort_score: float = Field(
        default=0.5,
        validation_alias=AliasChoices("sortScore", "sort_score"),
        serialization_alias="sortScore",
    )
    board_reason: str | None = Field(
        default=None,
        validation_alias=AliasChoices("boardReason", "board_reason"),
        serialization_alias="boardReason",
    )
    priority_reason_tags: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("priorityReasonTags", "priority_reason_tags", "reasonTags"),
        serialization_alias="priorityReasonTags",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusAreas", "focus_areas"),
        serialization_alias="focusAreas",
    )
    custom_feature_hits: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customFeatureHits", "custom_feature_hits"),
        serialization_alias="customFeatureHits",
    )
    needs_action: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsAction", "needs_action", "isTodo"),
        serialization_alias="needsAction",
    )
    read_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("readWithin48h", "read_within_48h"),
        serialization_alias="readWithin48h",
    )
    handle_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("handleWithin48h", "handle_within_48h", "isDueSoon"),
        serialization_alias="handleWithin48h",
    )
    opened_count: int = Field(
        default=0,
        validation_alias=AliasChoices("openedCount", "opened_count"),
        serialization_alias="openedCount",
    )
    processed: bool = False
    feedback_action: FeedbackAction | None = Field(
        default=None,
        validation_alias=AliasChoices("feedbackAction", "feedback_action", "feedback"),
        serialization_alias="feedbackAction",
    )
    last_analyzed_at: str | None = Field(
        default=None,
        validation_alias=AliasChoices("lastAnalyzedAt", "last_analyzed_at"),
        serialization_alias="lastAnalyzedAt",
    )


class AnalysisContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    account_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("accountKey", "account_key"),
        serialization_alias="accountKey",
    )
    analysis_mode: AnalysisMode = Field(
        default="incremental",
        validation_alias=AliasChoices("analysisMode", "analysis_mode"),
        serialization_alias="analysisMode",
    )
    selected_senders: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("selectedSenders", "selected_senders"),
        serialization_alias="selectedSenders",
    )
    selected_focuses: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("selectedFocuses", "selected_focuses"),
        serialization_alias="selectedFocuses",
    )
    custom_sender_value: str | None = Field(
        default=None,
        validation_alias=AliasChoices("customSenderValue", "custom_sender_value"),
        serialization_alias="customSenderValue",
    )
    custom_focus_value: str | None = Field(
        default=None,
        validation_alias=AliasChoices("customFocusValue", "custom_focus_value"),
        serialization_alias="customFocusValue",
    )
    important_sender_names: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("importantSenderNames", "important_sender_names"),
        serialization_alias="importantSenderNames",
    )
    not_important_sender_names: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("notImportantSenderNames", "not_important_sender_names"),
        serialization_alias="notImportantSenderNames",
    )
    muted_sender_names: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("mutedSenderNames", "muted_sender_names"),
        serialization_alias="mutedSenderNames",
    )
    sender_history: list[SenderHistoryEntry] = Field(
        default_factory=list,
        validation_alias=AliasChoices("senderHistory", "sender_history"),
        serialization_alias="senderHistory",
    )
    recent_history: list[AnalysisHistoryEntry] = Field(
        default_factory=list,
        validation_alias=AliasChoices("recentHistory", "recent_history"),
        serialization_alias="recentHistory",
    )
    feedback_history: list[FeedbackHistoryEntry] = Field(
        default_factory=list,
        validation_alias=AliasChoices("feedbackHistory", "feedback_history"),
        serialization_alias="feedbackHistory",
    )
    processed_message_ids: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("processedMessageIds", "processed_message_ids"),
        serialization_alias="processedMessageIds",
    )
    hidden_message_ids: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("hiddenMessageIds", "hidden_message_ids"),
        serialization_alias="hiddenMessageIds",
    )


class DeadlineFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    has_explicit_deadline: bool = Field(
        validation_alias=AliasChoices("hasExplicitDeadline", "has_explicit_deadline"),
        serialization_alias="hasExplicitDeadline",
    )
    deadline_text: str | None = Field(
        default=None,
        validation_alias=AliasChoices("deadlineText", "deadline_text"),
        serialization_alias="deadlineText",
    )
    deadline_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("deadlineWithin48h", "deadline_within_48h"),
        serialization_alias="deadlineWithin48h",
    )
    read_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("readWithin48h", "read_within_48h"),
        serialization_alias="readWithin48h",
    )
    handle_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("handleWithin48h", "handle_within_48h"),
        serialization_alias="handleWithin48h",
    )
    has_meeting_or_interview_time: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "hasMeetingOrInterviewTime",
            "has_meeting_or_interview_time",
        ),
        serialization_alias="hasMeetingOrInterviewTime",
    )


class TopicFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    academic: bool = False
    work: bool = False
    recruiting: bool = False
    admin: bool = False
    finance: bool = False
    course: bool = False
    assignment: bool = False
    interview: bool = False
    meeting: bool = False
    custom_hits: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customHits", "custom_hits"),
        serialization_alias="customHits",
    )


class ActionFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    needs_reply: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsReply", "needs_reply"),
        serialization_alias="needsReply",
    )
    needs_submission: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsSubmission", "needs_submission"),
        serialization_alias="needsSubmission",
    )
    needs_download: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsDownload", "needs_download"),
        serialization_alias="needsDownload",
    )
    needs_follow_up: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsFollowUp", "needs_follow_up"),
        serialization_alias="needsFollowUp",
    )
    notification_only: bool = Field(
        default=False,
        validation_alias=AliasChoices("notificationOnly", "notification_only"),
        serialization_alias="notificationOnly",
    )
    has_action_item: bool = Field(
        default=False,
        validation_alias=AliasChoices("hasActionItem", "has_action_item"),
        serialization_alias="hasActionItem",
    )


class DistractionFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    is_ad: bool = Field(
        default=False,
        validation_alias=AliasChoices("isAd", "is_ad"),
        serialization_alias="isAd",
    )
    is_subscription: bool = Field(
        default=False,
        validation_alias=AliasChoices("isSubscription", "is_subscription"),
        serialization_alias="isSubscription",
    )
    is_bulk: bool = Field(
        default=False,
        validation_alias=AliasChoices("isBulk", "is_bulk"),
        serialization_alias="isBulk",
    )
    is_marketing: bool = Field(
        default=False,
        validation_alias=AliasChoices("isMarketing", "is_marketing"),
        serialization_alias="isMarketing",
    )
    low_value_notification: bool = Field(
        default=False,
        validation_alias=AliasChoices("lowValueNotification", "low_value_notification"),
        serialization_alias="lowValueNotification",
    )


class PreferenceFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_vip_sender: bool = Field(
        default=False,
        validation_alias=AliasChoices("fromVipSender", "from_vip_sender"),
        serialization_alias="fromVipSender",
    )
    from_deprioritized_sender: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "fromDeprioritizedSender",
            "from_deprioritized_sender",
        ),
        serialization_alias="fromDeprioritizedSender",
    )
    matches_user_focus: bool = Field(
        default=False,
        validation_alias=AliasChoices("matchesUserFocus", "matches_user_focus"),
        serialization_alias="matchesUserFocus",
    )
    matches_focus_order: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("matchesFocusOrder", "matches_focus_order"),
        serialization_alias="matchesFocusOrder",
    )
    custom_focus_hits: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customFocusHits", "custom_focus_hits"),
        serialization_alias="customFocusHits",
    )
    historical_positive_feedback: int = Field(
        default=0,
        validation_alias=AliasChoices(
            "historicalPositiveFeedback",
            "historical_positive_feedback",
        ),
        serialization_alias="historicalPositiveFeedback",
    )
    historical_negative_feedback: int = Field(
        default=0,
        validation_alias=AliasChoices(
            "historicalNegativeFeedback",
            "historical_negative_feedback",
        ),
        serialization_alias="historicalNegativeFeedback",
    )
    historical_open_count: int = Field(
        default=0,
        validation_alias=AliasChoices("historicalOpenCount", "historical_open_count"),
        serialization_alias="historicalOpenCount",
    )
    historical_processed_count: int = Field(
        default=0,
        validation_alias=AliasChoices(
            "historicalProcessedCount",
            "historical_processed_count",
        ),
        serialization_alias="historicalProcessedCount",
    )


class LLMFeatures(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schema_version: str = Field(
        default="v1",
        validation_alias=AliasChoices("schemaVersion", "schema_version"),
        serialization_alias="schemaVersion",
    )
    deadline: DeadlineFeatures
    topics: TopicFeatures
    actions: ActionFeatures
    distraction: DistractionFeatures
    preference: PreferenceFeatures
    custom_features: dict[str, float] = Field(
        default_factory=dict,
        validation_alias=AliasChoices("customFeatures", "custom_features"),
        serialization_alias="customFeatures",
    )


class FeedbackState(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    more_important_count: int = Field(
        default=0,
        validation_alias=AliasChoices("moreImportantCount", "more_important_count"),
        serialization_alias="moreImportantCount",
    )
    show_less_count: int = Field(
        default=0,
        validation_alias=AliasChoices("showLessCount", "show_less_count"),
        serialization_alias="showLessCount",
    )
    last_action: FeedbackAction | None = Field(
        default=None,
        validation_alias=AliasChoices("lastAction", "last_action"),
        serialization_alias="lastAction",
    )


class DisplayExplanation(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    board_reason: str = Field(
        validation_alias=AliasChoices("boardReason", "board_reason"),
        serialization_alias="boardReason",
    )
    priority_reason_tags: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("priorityReasonTags", "priority_reason_tags"),
        serialization_alias="priorityReasonTags",
    )


class AnalyzedMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_id: str = Field(
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    thread_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("threadId", "thread_id"),
        serialization_alias="threadId",
    )
    sender_name: str = Field(
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    sender_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderEmail", "sender_email"),
        serialization_alias="senderEmail",
    )
    display_sender: str = Field(
        default="",
        validation_alias=AliasChoices("displaySender", "display_sender"),
        serialization_alias="displaySender",
    )
    subject: str
    summary: str
    body_excerpt: str = Field(
        default="",
        validation_alias=AliasChoices("bodyExcerpt", "body_excerpt"),
        serialization_alias="bodyExcerpt",
    )
    time_text: str | None = Field(
        default=None,
        validation_alias=AliasChoices("timeText", "time_text"),
        serialization_alias="timeText",
    )
    timestamp: str | None = None
    is_unread: bool = Field(
        default=False,
        validation_alias=AliasChoices("isUnread", "is_unread"),
        serialization_alias="isUnread",
    )
    has_attachment: bool = Field(
        default=False,
        validation_alias=AliasChoices("hasAttachment", "has_attachment"),
        serialization_alias="hasAttachment",
    )
    label_ids: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("labelIds", "label_ids"),
        serialization_alias="labelIds",
    )
    thread_message_count: int = Field(
        default=1,
        validation_alias=AliasChoices("threadMessageCount", "thread_message_count"),
        serialization_alias="threadMessageCount",
    )
    brief_subject: str = Field(
        validation_alias=AliasChoices("briefSubject", "brief_subject"),
        serialization_alias="briefSubject",
    )
    ai_summary: str = Field(
        validation_alias=AliasChoices("aiSummary", "ai_summary"),
        serialization_alias="aiSummary",
    )
    ai_reason: str = Field(
        validation_alias=AliasChoices("aiReason", "ai_reason"),
        serialization_alias="aiReason",
    )
    action_label: str | None = Field(
        default=None,
        validation_alias=AliasChoices("actionLabel", "action_label"),
        serialization_alias="actionLabel",
    )
    deadline_label: str | None = Field(
        default=None,
        validation_alias=AliasChoices("deadlineLabel", "deadline_label"),
        serialization_alias="deadlineLabel",
    )
    board_type: BoardType = Field(
        validation_alias=AliasChoices("boardType", "board_type"),
        serialization_alias="boardType",
    )
    priority_score: float = Field(
        validation_alias=AliasChoices("priorityScore", "priority_score"),
        serialization_alias="priorityScore",
    )
    priority_level: PriorityLevel = Field(
        validation_alias=AliasChoices("priorityLevel", "priority_level"),
        serialization_alias="priorityLevel",
    )
    sort_score: float = Field(
        validation_alias=AliasChoices("sortScore", "sort_score"),
        serialization_alias="sortScore",
    )
    needs_action: bool = Field(
        default=False,
        validation_alias=AliasChoices("needsAction", "needs_action"),
        serialization_alias="needsAction",
    )
    read_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("readWithin48h", "read_within_48h"),
        serialization_alias="readWithin48h",
    )
    handle_within_48h: bool = Field(
        default=False,
        validation_alias=AliasChoices("handleWithin48h", "handle_within_48h"),
        serialization_alias="handleWithin48h",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusAreas", "focus_areas"),
        serialization_alias="focusAreas",
    )
    custom_feature_hits: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customFeatureHits", "custom_feature_hits"),
        serialization_alias="customFeatureHits",
    )
    llm_features: LLMFeatures = Field(
        validation_alias=AliasChoices("llmFeatures", "llm_features"),
        serialization_alias="llmFeatures",
    )
    display_explanation: DisplayExplanation = Field(
        validation_alias=AliasChoices("displayExplanation", "display_explanation"),
        serialization_alias="displayExplanation",
    )
    feedback_state: FeedbackState = Field(
        validation_alias=AliasChoices("feedbackState", "feedback_state"),
        serialization_alias="feedbackState",
    )


class OverviewCounts(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    priority_content_count: int = Field(
        validation_alias=AliasChoices("priorityContentCount", "priority_content_count"),
        serialization_alias="priorityContentCount",
    )
    within_48h_count: int = Field(
        validation_alias=AliasChoices("within48hCount", "within_48h_count"),
        serialization_alias="within48hCount",
    )
    todo_count: int = Field(
        validation_alias=AliasChoices("todoCount", "todo_count"),
        serialization_alias="todoCount",
    )
    ignore_count: int = Field(
        validation_alias=AliasChoices("ignoreCount", "ignore_count"),
        serialization_alias="ignoreCount",
    )


class AnalyzeMessagesRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    mode: AnalysisMode | None = None
    messages: list[RawMessage]
    project_context: AnalysisContext = Field(
        default_factory=AnalysisContext,
        validation_alias=AliasChoices("projectContext", "project_context", "hints", "context"),
        serialization_alias="projectContext",
    )


class AnalyzeMessagesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    generated_at: datetime = Field(
        validation_alias=AliasChoices("generatedAt", "generated_at"),
        serialization_alias="generatedAt",
    )
    engine: AnalysisEngine
    overview: OverviewCounts
    items: list[AnalyzedMessage]


class ResummarizeMessageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: RawMessage
    project_context: AnalysisContext = Field(
        default_factory=AnalysisContext,
        validation_alias=AliasChoices("projectContext", "project_context", "context"),
        serialization_alias="projectContext",
    )


class ResummarizedMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message_id: str = Field(
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    display_sender: str = Field(
        validation_alias=AliasChoices("displaySender", "display_sender"),
        serialization_alias="displaySender",
    )
    brief_subject: str = Field(
        validation_alias=AliasChoices("briefSubject", "brief_subject"),
        serialization_alias="briefSubject",
    )
    ai_summary: str = Field(
        validation_alias=AliasChoices("aiSummary", "ai_summary"),
        serialization_alias="aiSummary",
    )
    ai_reason: str = Field(
        default="",
        validation_alias=AliasChoices("aiReason", "ai_reason"),
        serialization_alias="aiReason",
    )


class ResummarizeMessageResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    generated_at: datetime = Field(
        validation_alias=AliasChoices("generatedAt", "generated_at"),
        serialization_alias="generatedAt",
    )
    engine: AnalysisEngine
    item: ResummarizedMessage


class Preferences(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    focus_topics: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusTopics", "focus_topics"),
        serialization_alias="focusTopics",
    )
    focus_order: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusOrder", "focus_order"),
        serialization_alias="focusOrder",
    )
    vip_senders: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("vipSenders", "vip_senders"),
        serialization_alias="vipSenders",
    )
    custom_focus_items: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("customFocusItems", "custom_focus_items"),
        serialization_alias="customFocusItems",
    )
    not_important_senders: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("notImportantSenders", "not_important_senders"),
        serialization_alias="notImportantSenders",
    )
    muted_senders: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("mutedSenders", "muted_senders"),
        serialization_alias="mutedSenders",
    )
    processed_message_ids: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("processedMessageIds", "processed_message_ids"),
        serialization_alias="processedMessageIds",
    )
    default_board: BoardType = Field(
        default="priority_content",
        validation_alias=AliasChoices("defaultBoard", "default_board"),
        serialization_alias="defaultBoard",
    )


class FeedbackRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    account_id: str = Field(
        validation_alias=AliasChoices("accountId", "account_id"),
        serialization_alias="accountId",
    )
    message_id: str = Field(
        validation_alias=AliasChoices("messageId", "message_id"),
        serialization_alias="messageId",
    )
    thread_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("threadId", "thread_id"),
        serialization_alias="threadId",
    )
    sender_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderName", "sender_name"),
        serialization_alias="senderName",
    )
    sender_email: str | None = Field(
        default=None,
        validation_alias=AliasChoices("senderEmail", "sender_email"),
        serialization_alias="senderEmail",
    )
    subject: str | None = None
    feedback_action: FeedbackAction = Field(
        validation_alias=AliasChoices("feedbackAction", "feedback_action"),
        serialization_alias="feedbackAction",
    )
    board_type: BoardType | None = Field(
        default=None,
        validation_alias=AliasChoices("boardType", "board_type"),
        serialization_alias="boardType",
    )
    priority_level: PriorityLevel | None = Field(
        default=None,
        validation_alias=AliasChoices("priorityLevel", "priority_level"),
        serialization_alias="priorityLevel",
    )
    priority_score: float | None = Field(
        default=None,
        validation_alias=AliasChoices("priorityScore", "priority_score"),
        serialization_alias="priorityScore",
    )
    focus_areas: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("focusAreas", "focus_areas"),
        serialization_alias="focusAreas",
    )
    created_at: str | None = Field(
        default=None,
        validation_alias=AliasChoices("createdAt", "created_at"),
        serialization_alias="createdAt",
    )


class FeedbackResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    ok: bool = True
    recorded_at: str = Field(
        validation_alias=AliasChoices("recordedAt", "recorded_at"),
        serialization_alias="recordedAt",
    )
    more_important_count: int = Field(
        validation_alias=AliasChoices("moreImportantCount", "more_important_count"),
        serialization_alias="moreImportantCount",
    )
    show_less_count: int = Field(
        validation_alias=AliasChoices("showLessCount", "show_less_count"),
        serialization_alias="showLessCount",
    )
