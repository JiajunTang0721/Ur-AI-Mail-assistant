from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import html
import logging
import math
import re

from .llm import analyze_messages_with_llm, llm_enabled, resummarize_message_with_llm
from .schemas import (
    ActionFeatures,
    AnalysisContext,
    AnalysisHistoryEntry,
    AnalyzeMessagesRequest,
    AnalyzeMessagesResponse,
    AnalyzedMessage,
    BoardType,
    DeadlineFeatures,
    DistractionFeatures,
    DisplayExplanation,
    FeedbackHistoryEntry,
    FeedbackState,
    LLMFeatures,
    OverviewCounts,
    PreferenceFeatures,
    Preferences,
    PriorityLevel,
    RawMessage,
    ResummarizeMessageRequest,
    ResummarizeMessageResponse,
    ResummarizedMessage,
    TopicFeatures,
)
from .store import load_feedback_records, load_preferences

logger = logging.getLogger(__name__)

TOPIC_KEYWORDS = {
    "academic": ("academic", "school", "student", "university", "campus", "学业", "学校", "学院", "导师"),
    "work": ("work", "project", "client", "proposal", "report", "工作", "项目", "审批", "合同"),
    "recruiting": ("recruit", "career", "job", "intern", "offer", "招聘", "求职", "内推", "岗位"),
    "admin": ("policy", "office", "administration", "compliance", "行政", "通知", "手续"),
    "finance": ("invoice", "payment", "bill", "refund", "finance", "发票", "付款", "缴费", "报销"),
    "course": ("course", "class", "seminar", "lecture", "syllabus", "课程", "选课", "讲座", "课堂"),
    "assignment": ("assignment", "homework", "essay", "submit", "作业", "论文", "提交材料"),
    "interview": ("interview", "screening", "onsite", "phone screen", "面试", "笔试", "测评"),
    "meeting": ("meeting", "calendar", "invite", "zoom", "teams", "agenda", "会议", "日程", "邀请"),
}

ACTION_KEYWORDS = {
    "reply": ("reply", "respond", "confirm", "确认", "回复", "答复"),
    "submission": ("submit", "upload", "form", "material", "提交", "补件", "填写表格"),
    "download": ("download", "attachment", "pdf", "report", "下载", "附件"),
    "follow_up": ("follow up", "next step", "action required", "complete", "后续处理", "下一步", "需要处理"),
}

MARKETING_KEYWORDS = (
    "promotion",
    "promo",
    "sale",
    "deal",
    "discount",
    "offer",
    "flash sale",
    "newsletter",
    "digest",
    "unsubscribe",
    "marketing",
    "campaign",
    "coupon",
    "member deal",
    "price alert",
    "职位推荐",
    "岗位推荐",
    "job alert",
    "jobs for you",
    "recommended jobs",
)

SUBSCRIPTION_KEYWORDS = (
    "newsletter",
    "digest",
    "weekly",
    "subscription",
    "unsubscribe",
    "recommended",
)

BULK_KEYWORDS = (
    "dear all",
    "announcement",
    "mass mail",
    "batch",
    "群发",
    "通知全体",
)

LOW_VALUE_KEYWORDS = (
    "event reminder",
    "webinar",
    "brand update",
    "what's new",
    "latest news",
    "travel inspiration",
    "destination guide",
    "营销",
    "资讯",
    "活动预告",
)

IGNORE_DOMAINS = (
    "trip.com",
    "booking",
    "agoda",
    "expedia",
    "hotels.com",
    "travelocity",
    "skyscanner",
    "kayak",
    "priceline",
    "traveloka",
    "airasia",
    "hopper",
    "ctrip",
    "linkedin.com",
)

TRANSACTION_PROTECT_KEYWORDS = (
    "confirmation",
    "confirmed",
    "receipt",
    "invoice",
    "ticket",
    "reservation",
    "itinerary",
    "check-in",
    "boarding",
    "payment received",
    "application update",
    "application status",
    "offer",
    "next step",
    "笔试",
    "面试",
    "已投递",
)

TIME_48H_KEYWORDS = (
    "today",
    "tonight",
    "tomorrow",
    "48h",
    "48 hours",
    "within 48 hours",
    "今天",
    "今晚",
    "明天",
    "48小时",
)

EXPLICIT_DEADLINE_KEYWORDS = (
    "deadline",
    "due",
    "before",
    "by ",
    "no later than",
    "截止",
    "到期",
    "请于",
    "之前",
)

MEETING_OR_INTERVIEW_KEYWORDS = (
    "meeting",
    "calendar",
    "interview",
    "schedule",
    "zoom",
    "teams",
    "会议",
    "面试",
    "时间确认",
    "日程",
)

ACTION_LABELS = {
    "reply": "需要回复",
    "submission": "需要提交",
    "download": "需要查看附件",
    "follow_up": "需要后续处理",
}


@dataclass
class EffectiveContext:
    account_key: str | None
    analysis_mode: str
    sender_terms: list[str]
    focus_order: list[str]
    deprioritized_sender_terms: list[str]
    important_sender_terms: list[str]
    sender_history: dict[str, int]
    recent_history: list[AnalysisHistoryEntry]
    feedback_history: list[FeedbackHistoryEntry]
    processed_message_ids: set[str]
    hidden_message_ids: set[str]
    preferences: Preferences


@dataclass
class PriorityModel:
    bias: float
    weights: dict[str, float]
    focus_weights: dict[str, float]
    sender_feedback_bias: dict[str, float]
    focus_feedback_bias: dict[str, float]
    high_threshold: float
    medium_threshold: float
    ignore_threshold: float


def _normalize(value: str | None) -> str:
    return (value or "").strip().lower()


def _safe_text(value: str | None, *, max_length: int | None = None) -> str:
    if not value:
        return ""

    cleaned = value.encode("utf-8", errors="ignore").decode("utf-8", errors="ignore")
    cleaned = cleaned.replace("\x00", " ").strip()

    if max_length is not None:
        cleaned = cleaned[:max_length]

    return cleaned


def _truncate(value: str, max_length: int) -> str:
    return value if len(value) <= max_length else f"{value[: max_length - 1].strip()}…"


BRIEF_SUBJECT_REPEAT_SUFFIXES = (
    "提交要求",
    "需要确认",
    "附件说明",
    "近期提醒",
    "最新通知",
    "通知",
    "提醒",
    "更新",
    "安排",
)


def _normalize_brief_subject(value: str | None) -> str:
    normalized = _safe_text(value)
    if not normalized:
        return ""

    normalized = re.sub(r"\s+", " ", normalized).strip("，。；;,. ")
    for suffix in BRIEF_SUBJECT_REPEAT_SUFFIXES:
        normalized = re.sub(
            rf"(?P<head>.*?){re.escape(suffix)}{re.escape(suffix)}$",
            rf"\g<head>{suffix}",
            normalized,
        )

    normalized = re.sub(r"(要求|通知|提醒|更新|安排|说明)\1+$", r"\1", normalized)
    exact_repeat = re.fullmatch(r"(.{2,16}?)\1+", normalized)
    if exact_repeat:
        normalized = exact_repeat.group(1)

    return normalized.strip()


def _append_brief_subject_suffix(base: str, suffix: str) -> str:
    normalized_base = _normalize_brief_subject(base)
    normalized_suffix = _normalize_brief_subject(suffix)
    if not normalized_base:
        return normalized_suffix
    if normalized_suffix and normalized_base.endswith(normalized_suffix):
        return normalized_base
    return _normalize_brief_subject(f"{normalized_base}{normalized_suffix}")


def _clean_subject_line(subject: str) -> str:
    without_prefix = re.sub(r"^(re|fw|fwd)\s*:\s*", "", subject, flags=re.I)
    without_bracket = re.sub(r"^\[[^\]]+\]\s*", "", without_prefix)
    return re.sub(r"\s+", " ", without_bracket).strip()


def _topic_display_label(features: LLMFeatures) -> str:
    if features.topics.interview:
        return "面试"
    if features.topics.meeting:
        return "会议"
    if features.topics.assignment:
        return "作业"
    if features.topics.course:
        return "课程"
    if features.topics.finance:
        return "财务"
    if features.topics.recruiting:
        return "招聘"
    if features.topics.work:
        return "工作"
    if features.topics.academic:
        return "学业"
    if features.topics.admin:
        return "行政"
    return ""


def _ensure_sentence(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        return ""
    if stripped[-1] in "。！？!?":
        return stripped
    return f"{stripped}。"


def _first_content_sentence(*candidates: str) -> str:
    for candidate in candidates:
        cleaned = _safe_text(candidate, max_length=320)
        if not cleaned:
            continue

        normalized = re.sub(r"\s+", " ", cleaned).strip(" \t\r\n-—•*")
        if not normalized:
            continue

        parts = [
            part.strip(" ，,。.；;:：")
            for part in re.split(r"[。！？!?；;\n]+", normalized)
            if part.strip(" ，,。.；;:：")
        ]
        for part in parts:
            if len(part) >= 6:
                return part

        return normalized

    return ""


def _contains_cjk(value: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff]", value))


def _looks_like_raw_excerpt(value: str) -> bool:
    normalized = _normalize(value)
    if not normalized:
        return False

    excerpt_markers = (
        "view in your browser",
        "read in browser",
        "dear ",
        "unsubscribe",
        "click here",
        "no-reply",
        "noreply",
    )
    if any(marker in normalized for marker in excerpt_markers):
        return True

    return not _contains_cjk(value) and len(normalized.split()) >= 8


KNOWN_SENDER_PHRASES = {
    "university life": "学生生活",
    "columbia news": "哥伦比亚大学新闻",
    "columbia engineering": "哥伦比亚大学工程学院",
    "columbia university": "哥伦比亚大学",
    "gradescope": "作业平台",
    "linkedin": "领英",
    "amazon": "亚马逊",
    "gmail": "谷歌邮箱",
    "google calendar": "谷歌日历",
    "zoom": "视频会议",
    "do not reply": "系统通知",
    "noreply": "系统通知",
    "no-reply": "系统通知",
}

KNOWN_DOMAIN_LABELS = {
    "columbia.edu": "哥伦比亚大学",
    "amazon.com": "亚马逊",
    "linkedin.com": "领英",
    "gradescope.com": "作业平台",
    "gmail.com": "谷歌邮箱",
    "google.com": "谷歌",
    "zoom.us": "视频会议",
}

KNOWN_TOKEN_LABELS = {
    "columbia": "哥伦比亚大学",
    "university": "大学",
    "college": "学院",
    "life": "生活",
    "news": "新闻",
    "student": "学生",
    "students": "学生",
    "engineering": "工程",
    "school": "学校",
    "office": "办公室",
    "team": "团队",
    "career": "就业",
    "recruiting": "招聘",
    "finance": "财务",
    "financial": "财务",
    "billing": "账单",
    "event": "活动",
    "events": "活动",
    "digest": "摘要",
    "course": "课程",
    "assignment": "作业",
    "meeting": "会议",
    "interview": "面试",
    "service": "服务",
    "support": "支持",
    "portal": "平台",
    "app": "应用",
    "jobs": "招聘",
    "job": "招聘",
}

KNOWN_PLATFORM_ROOTS = {
    "workday": "Workday",
    "greenhouse": "Greenhouse",
    "handshake": "Handshake",
    "lever": "Lever",
    "icims": "iCIMS",
    "docusign": "DocuSign",
    "slack": "Slack",
    "notion": "Notion",
    "canvas": "Canvas",
    "piazza": "Piazza",
    "coursera": "Coursera",
    "substack": "Substack",
    "mailchimp": "Mailchimp",
    "eventbrite": "Eventbrite",
    "ed": "Ed",
}


def _clean_sender_fallback_label(value: str) -> str:
    cleaned = _safe_text(value, max_length=80)
    if not cleaned:
        return ""

    cleaned = re.sub(r"\S+@\S+", " ", cleaned)
    cleaned = re.sub(r"(?i)\b(do not reply|no-?reply|noreply|via)\b", " ", cleaned)
    cleaned = re.sub(r"[<_>\"'|]+", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ·|-,")
    return cleaned


def _humanize_sender_from_domain(domain: str, local_part: str) -> str:
    cleaned_domain = _normalize(domain)
    domain_tokens = [token for token in re.split(r"[^a-z0-9]+", cleaned_domain) if token]

    for token in domain_tokens:
        if token in KNOWN_PLATFORM_ROOTS:
            return KNOWN_PLATFORM_ROOTS[token]

    root_tokens = [token for token in domain_tokens if token not in {"com", "edu", "org", "net", "mail", "email", "app", "www"}]
    if root_tokens:
        root = root_tokens[0]
        if len(root) >= 2:
            return root.title()

    local_tokens = [token for token in re.split(r"[^a-z0-9]+", _normalize(local_part)) if token]
    if local_tokens:
        return " ".join(token.title() for token in local_tokens[:3])

    return ""

GENERIC_DISPLAY_CUES = {"资讯更新", "校园信息", "学生生活资讯", "研究生信息"}

DISPLAY_BOILERPLATE_PATTERNS = (
    r"view in your browser",
    r"read (?:this )?(?:email|message) in your browser",
    r"open this email in your browser",
    r"having trouble viewing.*?(?=$|[.!?])",
    r"dear (?:students|student|all|team|colleagues|applicants|friends)[,:]?",
    r"hello[,:]?",
    r"hi[,:]?",
    r"unsubscribe(?: here)?",
    r"click here",
    r"do not reply",
    r"no-?reply",
)

DISPLAY_CUE_PATTERNS = (
    (("commencement", "graduation", "毕业季", "毕业典礼"), "毕业季安排"),
    (("study break", "spring break", "学习间歇", "休息活动"), "学习间歇活动"),
    (("orientation", "迎新"), "迎新安排"),
    (("career fair", "career event", "招聘会"), "招聘活动"),
    (("application update", "application status", "申请进展"), "申请进展"),
    (("job alert", "job opportunity", "internship", "岗位", "实习"), "岗位机会"),
    (("interview", "phone screen", "onsite", "面试"), "面试安排"),
    (("meeting", "calendar invite", "agenda", "zoom", "teams", "会议"), "会议安排"),
    (("course registration", "registration", "add/drop", "enroll", "选课", "报名"), "报名或选课安排"),
    (("syllabus", "lecture", "seminar", "course", "class", "课程"), "课程安排"),
    (("assignment", "homework", "submit", "作业", "提交"), "作业与提交要求"),
    (("invoice", "billing", "payment", "refund", "tuition", "账单", "缴费", "退款"), "账单与付款信息"),
    (("scholarship", "stipend", "funding", "奖学金", "资助"), "奖助与资助信息"),
    (("housing", "move-in", "move out", "residence", "住宿"), "住宿安排"),
    (("visa", "i-20", "opt", "cpt", "签证"), "签证与身份事务"),
    (("health", "wellness", "counseling", "健康"), "健康与支持服务"),
    (("student life", "university life", "学生生活"), "学生生活资讯"),
    (("graduate students", "graduate student", "研究生"), "研究生信息"),
    (("spring", "春季"), "春季安排"),
    (("campus event", "events", "event", "活动"), "校园活动"),
    (("newsletter", "digest", "news", "资讯"), "资讯更新"),
    (("campus", "校园"), "校园信息"),
)

DISPLAY_FALLBACK_TOPIC_CUES = {
    "interview": "面试安排",
    "meeting": "会议安排",
    "assignment": "作业与提交要求",
    "course": "课程安排",
    "finance": "账单与付款信息",
    "recruiting": "岗位机会",
    "work": "工作事项",
    "academic": "学业事务",
    "admin": "行政通知",
}


def _build_display_sender(message: RawMessage, provided: str) -> str:
    if provided and _contains_cjk(provided) and "@" not in provided:
        return provided.strip()

    sender_name = re.sub(r"\S+@\S+", "", message.sender_name or "").strip(" ·|-")
    sender_email = (message.sender_email or "").strip().lower()
    domain = sender_email.split("@", 1)[1] if "@" in sender_email else ""
    local_part = sender_email.split("@", 1)[0] if "@" in sender_email else ""
    source_text = " ".join(part for part in [sender_name, sender_email, domain] if part).strip()
    normalized = _normalize(source_text)

    for phrase, label in KNOWN_SENDER_PHRASES.items():
        if phrase in normalized:
            if "columbia" in normalized and "哥伦比亚大学" not in label and label not in {"系统通知"}:
                return f"哥伦比亚大学{label}"
            return label

    if domain in KNOWN_DOMAIN_LABELS:
        domain_label = KNOWN_DOMAIN_LABELS[domain]
    else:
        domain_label = ""
        for known_domain, label in KNOWN_DOMAIN_LABELS.items():
            if known_domain and known_domain in domain:
                domain_label = label
                break

    translated_tokens = [
        KNOWN_TOKEN_LABELS[token]
        for token in re.findall(r"[a-z]+", normalized)
        if token in KNOWN_TOKEN_LABELS
    ]
    translated = "".join(token for token in translated_tokens if token)

    if domain_label and translated and translated not in domain_label:
        return f"{domain_label}{translated}"
    if domain_label:
        return domain_label
    if translated:
        return translated

    cleaned_sender_name = _clean_sender_fallback_label(sender_name)
    if _contains_cjk(cleaned_sender_name):
        return cleaned_sender_name

    if cleaned_sender_name and "@" not in cleaned_sender_name:
        if " via " in cleaned_sender_name.lower():
            via_parts = [part.strip() for part in re.split(r"(?i)\bvia\b", cleaned_sender_name) if part.strip()]
            if via_parts:
                cleaned_sender_name = via_parts[-1]
        return _truncate(cleaned_sender_name, 28)

    fallback_from_domain = _humanize_sender_from_domain(domain, local_part)
    if fallback_from_domain:
        return _truncate(fallback_from_domain, 24)

    return "系统来信"


def _is_generic_brief_subject(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return True

    generic_labels = {
        "学业相关",
        "招聘相关",
        "工作相关",
        "财务相关",
        "课程相关",
        "行政相关",
        "新邮件",
        "邮件提醒",
    }
    return (
        normalized in generic_labels
        or normalized.endswith("相关")
        or "@" in normalized
        or _looks_like_raw_excerpt(normalized)
        or not _contains_cjk(normalized)
    )


def _is_placeholder_summary(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return True

    placeholder_markers = (
        "命中了你的关注方向",
        "命中你的关注方向",
        "来自重点寄件人",
        "值得优先查看",
        "值得快速查看",
    )
    return (
        any(marker in normalized for marker in placeholder_markers)
        or "@" in normalized
        or _looks_like_raw_excerpt(normalized)
        or not _contains_cjk(normalized)
    )


def _is_generic_brief_subject(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return True

    generic_labels = {
        "学业相关",
        "招聘相关",
        "工作相关",
        "财务相关",
        "课程相关",
        "行政相关",
        "新邮件",
        "邮件提醒",
        "招聘通知",
        "课程通知",
        "工作通知",
        "财务通知",
        "校园通知",
        "资讯更新",
    }
    return (
        normalized in generic_labels
        or bool(re.match(r"^(学业|招聘|工作|财务|课程|行政|面试|会议|邮件|系统|校园)(相关|通知|提醒|更新)$", normalized))
        or "@" in normalized
        or _looks_like_raw_excerpt(normalized)
        or not _contains_cjk(normalized)
    )


def _is_placeholder_summary(value: str) -> bool:
    normalized = value.strip()
    if not normalized:
        return True

    placeholder_markers = (
        "命中了你的关注方向",
        "命中你的关注方向",
        "来自重点寄件人",
        "值得优先查看",
        "值得快速查看",
        "建议快速了解重点内容",
        "当前以阅读了解为主",
        "主要围绕",
        "主要说明",
        "主要通知",
    )
    return (
        any(marker in normalized for marker in placeholder_markers)
        or "@" in normalized
        or _looks_like_raw_excerpt(normalized)
        or not _contains_cjk(normalized)
    )


def _clean_display_text(*candidates: str) -> str:
    combined = " ".join(_safe_text(candidate, max_length=1600) for candidate in candidates if candidate)
    if not combined:
        return ""

    cleaned = html.unescape(combined)
    cleaned = re.sub(r"https?://\S+", " ", cleaned, flags=re.I)
    cleaned = re.sub(r"\S+@\S+", " ", cleaned)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)

    for pattern in DISPLAY_BOILERPLATE_PATTERNS:
        cleaned = re.sub(pattern, " ", cleaned, flags=re.I)

    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip(" -—–:;,.，。")


def _pick_cjk_display_sentence(*candidates: str) -> str:
    for candidate in candidates:
        cleaned = _clean_display_text(candidate)
        if not cleaned:
            continue

        parts = [
            part.strip(" ，。；;：:")
            for part in re.split(r"[。！？!?；;\n]+", cleaned)
            if part.strip(" ，。；;：:")
        ]
        for part in parts:
            if _contains_cjk(part) and len(part) >= 6 and not _looks_like_raw_excerpt(part):
                return _truncate(part, 36)

    return ""


def _localize_deadline_text(value: str | None) -> str:
    if not value:
        return ""

    localized = _safe_text(value, max_length=48)
    localized = re.sub(
        r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b",
        lambda match: (
            f"{'上午' if match.group(3).lower() == 'am' else '下午'}"
            f"{match.group(1)}点"
            f"{match.group(2) and f'{match.group(2)}分' or ''}"
        ),
        localized,
        flags=re.I,
    )
    replacements = {
        "today": "今天",
        "tonight": "今晚",
        "tomorrow": "明天",
        "next week": "下周",
        "monday": "周一",
        "tuesday": "周二",
        "wednesday": "周三",
        "thursday": "周四",
        "friday": "周五",
        "saturday": "周六",
        "sunday": "周日",
        "am": "上午",
        "pm": "下午",
    }
    month_replacements = {
        "january": "1月",
        "february": "2月",
        "march": "3月",
        "april": "4月",
        "may": "5月",
        "june": "6月",
        "july": "7月",
        "august": "8月",
        "september": "9月",
        "october": "10月",
        "november": "11月",
        "december": "12月",
    }

    for source, target in {**month_replacements, **replacements}.items():
        localized = re.sub(rf"\b{re.escape(source)}\b", target, localized, flags=re.I)

    localized = re.sub(r"\bno later than\b", "最晚", localized, flags=re.I)
    localized = re.sub(r"\b(before|by|due)\b", "", localized, flags=re.I)
    localized = re.sub(r"(今天|今晚|明天|下周)\s+(上午|下午)", r"\1\2", localized)
    localized = re.sub(r"\s+", " ", localized)
    return localized.strip(" ，。")


def _extract_display_cues(message: RawMessage, features: LLMFeatures) -> list[str]:
    normalized_text = _normalize(
        _clean_display_text(
            _clean_subject_line(message.subject),
            message.summary,
            message.body_excerpt,
        )
    )

    cues: list[str] = []
    for keywords, label in DISPLAY_CUE_PATTERNS:
        if any(keyword in normalized_text for keyword in keywords):
            cues.append(label)

    if not cues:
        for field_name, label in DISPLAY_FALLBACK_TOPIC_CUES.items():
            if getattr(features.topics, field_name):
                cues.append(label)

    if features.distraction.is_marketing and "推广更新" not in cues:
        cues.append("推广更新")

    return _merge_unique(cues)[:3]


def _extract_audience_label(message: RawMessage) -> str:
    normalized_text = _normalize(
        _clean_display_text(
            message.subject,
            message.summary,
            message.body_excerpt,
        )
    )

    if "graduate students" in normalized_text or "graduate student" in normalized_text or "研究生" in normalized_text:
        return "研究生"
    if "applicant" in normalized_text or "candidate" in normalized_text or "申请者" in normalized_text:
        return "申请者"
    if "faculty" in normalized_text or "staff" in normalized_text or "教职员工" in normalized_text:
        return "教职员工"
    if "students" in normalized_text or "student" in normalized_text or "学生" in normalized_text:
        return "学生"
    return ""


def _select_primary_display_cues(cues: list[str]) -> tuple[str, str]:
    if not cues:
        return "", ""

    primary = next((cue for cue in cues if cue not in GENERIC_DISPLAY_CUES), cues[0])
    secondary = next((cue for cue in cues if cue != primary), "")
    return primary, secondary


def _action_summary_clause(features: LLMFeatures, primary_cue: str) -> str:
    if features.topics.interview and features.actions.needs_reply:
        return "需要尽快确认具体时间"
    if features.topics.meeting and features.actions.needs_reply:
        return "需要确认会议时间或参会安排"
    if features.actions.needs_submission and primary_cue == "作业与提交要求":
        return "需要按要求提交作业或材料"
    if features.actions.needs_submission:
        return "需要提交材料或填写信息"
    if features.actions.needs_reply:
        return "需要回复或确认"
    if features.actions.needs_download:
        return "建议先查看附件内容"
    if features.actions.needs_follow_up:
        return "后续还有待处理事项"
    if features.actions.notification_only:
        return "当前以阅读了解为主"
    return ""


def _build_rule_based_subject(message: RawMessage, features: LLMFeatures) -> str:
    cjk_candidate = _pick_cjk_display_sentence(
        _clean_subject_line(message.subject),
        message.summary,
        message.body_excerpt,
    )
    if cjk_candidate and not _is_generic_brief_subject(cjk_candidate) and len(cjk_candidate) <= 18:
        return cjk_candidate

    cues = _extract_display_cues(message, features)
    primary_cue, secondary_cue = _select_primary_display_cues(cues)
    sender_label = _build_display_sender(message, "")

    if features.topics.interview and features.actions.needs_reply:
        return "确认面试安排"
    if features.topics.meeting and features.deadline.has_meeting_or_interview_time:
        return "查看会议安排"
    if features.actions.needs_submission and primary_cue:
        return _truncate(_append_brief_subject_suffix(primary_cue, "提交要求"), 18)
    if features.actions.needs_reply and primary_cue:
        return _truncate(_append_brief_subject_suffix(primary_cue, "需要确认"), 18)
    if features.actions.needs_download and primary_cue:
        return _truncate(_append_brief_subject_suffix(primary_cue, "附件说明"), 18)
    if primary_cue == "学习间歇活动":
        return "学习间歇活动推荐"
    if primary_cue == "毕业季安排":
        return "毕业季动态更新"
    if primary_cue == "春季安排" and secondary_cue == "校园活动":
        return "春季校园活动更新"
    if primary_cue and secondary_cue and secondary_cue in GENERIC_DISPLAY_CUES:
        return _truncate(_append_brief_subject_suffix(primary_cue, "更新"), 18)
    if primary_cue:
        return _truncate(_normalize_brief_subject(primary_cue), 18)
    if sender_label and sender_label != "邮件来源":
        return _truncate(_append_brief_subject_suffix(sender_label, "最新通知"), 18)
    return "邮件提醒"


def _build_rule_based_summary(
    message: RawMessage,
    features: LLMFeatures,
    board_type: BoardType,
) -> str:
    cjk_candidate = _pick_cjk_display_sentence(
        message.summary,
        message.body_excerpt,
        _clean_subject_line(message.subject),
    )
    if cjk_candidate and not _is_placeholder_summary(cjk_candidate):
        summary = cjk_candidate
    else:
        sender_label = _build_display_sender(message, "")
        cues = _extract_display_cues(message, features)
        primary_cue, secondary_cue = _select_primary_display_cues(cues)
        audience_label = _extract_audience_label(message)

        if board_type == "ignore" and features.distraction.is_marketing:
            summary = f"这封邮件主要在推送{primary_cue or '订阅内容'}，当前没有明显需要处理的事项"
        elif primary_cue == "学习间歇活动":
            target = f"适合{audience_label}参加的" if audience_label else ""
            extra = "，也补充了近期校园活动信息" if secondary_cue and secondary_cue != "学习间歇活动" else ""
            summary = f"这封邮件在介绍{target}学习间歇活动和放松安排{extra}"
        elif primary_cue == "毕业季安排":
            target = f"{audience_label}需要关注的" if audience_label else ""
            extra = "，并带来近期校园资讯" if secondary_cue else ""
            summary = f"这封邮件在更新{target}毕业季相关动态{extra}"
        elif primary_cue == "春季安排" and secondary_cue == "校园活动":
            summary = "这封邮件在更新春季校园活动和近期安排"
        elif primary_cue and secondary_cue and secondary_cue not in GENERIC_DISPLAY_CUES:
            summary = f"这封邮件在说明{primary_cue}，也提到了{secondary_cue}"
        elif primary_cue:
            summary = f"这封邮件在说明{primary_cue}"
        elif sender_label and sender_label != "邮件来源":
            summary = f"这封邮件来自{sender_label}的最新通知"
        else:
            summary = "这封邮件带来了一条新的提醒"

    extras: list[str] = []
    localized_deadline = _localize_deadline_text(features.deadline.deadline_text)
    primary_cue, _ = _select_primary_display_cues(_extract_display_cues(message, features))
    action_clause = _action_summary_clause(features, primary_cue)

    if localized_deadline:
        if features.deadline.handle_within_48h or features.actions.has_action_item:
            extras.append(f"需要在{localized_deadline}前处理")
        else:
            extras.append(f"建议在{localized_deadline}前查看")
    elif features.deadline.handle_within_48h:
        extras.append("最好在48小时内处理")
    elif features.deadline.read_within_48h:
        extras.append("建议在48小时内查看")

    if action_clause and action_clause not in extras:
        extras.append(action_clause)

    if message.has_attachment and not features.actions.needs_download:
        extras.append("邮件里附带了相关附件")

    summary = summary.strip("，。 ")
    if extras:
        summary = f"{summary}，{'，'.join(_merge_unique(extras)[:2])}"

    return _truncate(_ensure_sentence(summary), 120)


def _contains_any(text: str, keywords: tuple[str, ...] | list[str]) -> bool:
    haystack = _normalize(text)
    return any(_normalize(keyword) in haystack for keyword in keywords)


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        candidate = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None

    return candidate if candidate.tzinfo else candidate.replace(tzinfo=UTC)


def _sanitize_message(message: RawMessage) -> RawMessage:
    return RawMessage(
        messageId=_safe_text(message.message_id, max_length=160),
        threadId=_safe_text(message.thread_id, max_length=160) or None,
        senderName=_safe_text(message.sender_name, max_length=160) or "未知发件人",
        senderEmail=_safe_text(message.sender_email, max_length=200) or None,
        subject=_safe_text(message.subject, max_length=400) or "(无标题邮件)",
        summary=_safe_text(message.summary, max_length=1600),
        bodyExcerpt=_safe_text(message.body_excerpt, max_length=5000),
        timeText=_safe_text(message.time_text, max_length=80) or None,
        timestamp=_safe_text(message.timestamp, max_length=80) or None,
        isUnread=bool(message.is_unread),
        hasAttachment=bool(message.has_attachment),
        labelIds=[_safe_text(label, max_length=80) for label in message.label_ids if _safe_text(label, max_length=80)],
        threadMessageCount=max(1, int(message.thread_message_count or 1)),
    )


def _merge_unique(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    for group in groups:
        for item in group:
            safe_item = _safe_text(item, max_length=80)
            if safe_item and safe_item not in merged:
                merged.append(safe_item)
    return merged


def _dedupe_feedback(records: list[FeedbackHistoryEntry]) -> list[FeedbackHistoryEntry]:
    unique: dict[tuple[str | None, str | None, str | None], FeedbackHistoryEntry] = {}
    for record in records:
        key = (record.message_id, record.feedback_action, record.created_at)
        unique[key] = record
    return list(unique.values())


def _build_effective_context(context: AnalysisContext, preferences: Preferences) -> EffectiveContext:
    sender_terms = _merge_unique(
        context.selected_senders,
        [context.custom_sender_value or ""],
        preferences.vip_senders,
        context.important_sender_names,
    )
    focus_order = _merge_unique(
        context.selected_focuses,
        [context.custom_focus_value or ""],
        preferences.focus_order,
        preferences.focus_topics,
        preferences.custom_focus_items,
    )
    deprioritized_sender_terms = _merge_unique(
        context.not_important_sender_names,
        context.muted_sender_names,
        preferences.not_important_senders,
        preferences.muted_senders,
    )
    important_sender_terms = _merge_unique(context.important_sender_names, preferences.vip_senders)
    sender_history = {
        _normalize(entry.sender_name): int(entry.count)
        for entry in context.sender_history
        if _normalize(entry.sender_name)
    }
    feedback_history = _dedupe_feedback(
        load_feedback_records(context.account_key) + context.feedback_history
    )

    return EffectiveContext(
        account_key=context.account_key,
        analysis_mode=context.analysis_mode,
        sender_terms=sender_terms,
        focus_order=focus_order,
        deprioritized_sender_terms=deprioritized_sender_terms,
        important_sender_terms=important_sender_terms,
        sender_history=sender_history,
        recent_history=context.recent_history,
        feedback_history=feedback_history,
        processed_message_ids=set(context.processed_message_ids + preferences.processed_message_ids),
        hidden_message_ids=set(context.hidden_message_ids),
        preferences=preferences,
    )


def _history_by_message_id(context: EffectiveContext) -> dict[str, AnalysisHistoryEntry]:
    return {entry.message_id: entry for entry in context.recent_history}


def _history_by_sender(context: EffectiveContext) -> dict[str, list[AnalysisHistoryEntry]]:
    grouped: dict[str, list[AnalysisHistoryEntry]] = {}
    for entry in context.recent_history:
        grouped.setdefault(_normalize(entry.sender_name), []).append(entry)
    return grouped


def _feedback_state_for_message(
    message_id: str,
    feedback_history: list[FeedbackHistoryEntry],
) -> FeedbackState:
    relevant = [entry for entry in feedback_history if entry.message_id == message_id]
    more_count = sum(1 for entry in relevant if entry.feedback_action == "more_important")
    less_count = sum(1 for entry in relevant if entry.feedback_action == "show_less")
    last_action = relevant[-1].feedback_action if relevant else None
    return FeedbackState(
        moreImportantCount=more_count,
        showLessCount=less_count,
        lastAction=last_action,
    )


def _extract_deadline_features(text: str, timestamp: str | None) -> DeadlineFeatures:
    parsed_timestamp = _parse_timestamp(timestamp)
    now = datetime.now(UTC)
    hours_from_message = None
    if parsed_timestamp is not None:
        hours_from_message = max((now - parsed_timestamp).total_seconds() / 3600.0, 0)

    explicit_match = re.search(
        r"((?:今天|今晚|明天|后天|本周[一二三四五六日天]?|next week|today|tonight|tomorrow|by [^,.]{2,30}|before [^,.]{2,30}|due [^,.]{2,30}|[01]?\d/[0-3]?\d(?:\s+\d{1,2}:\d{2})?))",
        text,
        flags=re.IGNORECASE,
    )
    deadline_text = _safe_text(explicit_match.group(1), max_length=48) if explicit_match else None
    has_explicit_deadline = bool(deadline_text) or _contains_any(text, EXPLICIT_DEADLINE_KEYWORDS)
    deadline_within_48h = _contains_any(text, TIME_48H_KEYWORDS)

    if not deadline_within_48h and deadline_text and hours_from_message is not None:
        deadline_within_48h = hours_from_message <= 48 and _contains_any(deadline_text, TIME_48H_KEYWORDS)

    has_meeting_or_interview_time = _contains_any(text, MEETING_OR_INTERVIEW_KEYWORDS)
    handle_within_48h = deadline_within_48h and _contains_any(
        text,
        ACTION_KEYWORDS["reply"] + ACTION_KEYWORDS["submission"] + ACTION_KEYWORDS["follow_up"],
    )
    read_within_48h = deadline_within_48h and not handle_within_48h

    if has_meeting_or_interview_time and deadline_within_48h:
        read_within_48h = True

    return DeadlineFeatures(
        hasExplicitDeadline=has_explicit_deadline,
        deadlineText=deadline_text,
        deadlineWithin48h=deadline_within_48h,
        readWithin48h=read_within_48h,
        handleWithin48h=handle_within_48h,
        hasMeetingOrInterviewTime=has_meeting_or_interview_time,
    )


def _extract_topic_features(text: str, focus_order: list[str]) -> TopicFeatures:
    normalized = _normalize(text)
    topic_hits = {
        name: any(keyword in normalized for keyword in keywords)
        for name, keywords in TOPIC_KEYWORDS.items()
    }

    custom_hits = []
    default_focuses = {value for values in TOPIC_KEYWORDS.values() for value in values}
    for focus in focus_order:
        normalized_focus = _normalize(focus)
        if normalized_focus and normalized_focus not in default_focuses and normalized_focus in normalized:
            custom_hits.append(focus)

    return TopicFeatures(
        academic=topic_hits["academic"],
        work=topic_hits["work"],
        recruiting=topic_hits["recruiting"],
        admin=topic_hits["admin"],
        finance=topic_hits["finance"],
        course=topic_hits["course"],
        assignment=topic_hits["assignment"],
        interview=topic_hits["interview"],
        meeting=topic_hits["meeting"],
        customHits=custom_hits,
    )


def _extract_action_features(text: str) -> ActionFeatures:
    normalized = _normalize(text)
    needs_reply = any(keyword in normalized for keyword in ACTION_KEYWORDS["reply"])
    needs_submission = any(keyword in normalized for keyword in ACTION_KEYWORDS["submission"])
    needs_download = any(keyword in normalized for keyword in ACTION_KEYWORDS["download"])
    needs_follow_up = any(keyword in normalized for keyword in ACTION_KEYWORDS["follow_up"])
    has_action_item = any((needs_reply, needs_submission, needs_download, needs_follow_up))
    notification_only = not has_action_item and any(
        keyword in normalized
        for keyword in ("for your information", "fyi", "notification", "通知", "供知晓", "仅提醒")
    )

    return ActionFeatures(
        needsReply=needs_reply,
        needsSubmission=needs_submission,
        needsDownload=needs_download,
        needsFollowUp=needs_follow_up,
        notificationOnly=notification_only,
        hasActionItem=has_action_item,
    )


def _extract_distraction_features(text: str, message: RawMessage) -> DistractionFeatures:
    combined = _normalize(f"{message.sender_email or ''} {text}")
    domain_hit = any(domain in combined for domain in IGNORE_DOMAINS)
    is_marketing = _contains_any(combined, MARKETING_KEYWORDS) or domain_hit
    is_subscription = _contains_any(combined, SUBSCRIPTION_KEYWORDS)
    is_bulk = _contains_any(combined, BULK_KEYWORDS)
    low_value_notification = _contains_any(combined, LOW_VALUE_KEYWORDS)
    is_ad = is_marketing or "广告" in combined or "sponsored" in combined

    if _contains_any(combined, TRANSACTION_PROTECT_KEYWORDS):
        is_marketing = False
        is_subscription = False
        is_ad = False
        low_value_notification = False

    return DistractionFeatures(
        isAd=is_ad,
        isSubscription=is_subscription,
        isBulk=is_bulk,
        isMarketing=is_marketing,
        lowValueNotification=low_value_notification,
    )


def _feedback_counts_by_sender(
    feedback_history: list[FeedbackHistoryEntry],
) -> dict[str, tuple[int, int]]:
    counts: dict[str, list[int]] = {}
    for entry in feedback_history:
        sender_key = _normalize(entry.sender_name)
        if not sender_key:
            continue
        more_count, less_count = counts.setdefault(sender_key, [0, 0])
        if entry.feedback_action == "more_important":
            more_count += 1
        else:
            less_count += 1
        counts[sender_key] = [more_count, less_count]
    return {key: (value[0], value[1]) for key, value in counts.items()}


def _feedback_bias_by_focus(
    feedback_history: list[FeedbackHistoryEntry],
) -> dict[str, float]:
    bias: dict[str, float] = {}
    for entry in feedback_history:
        delta = 0.08 if entry.feedback_action == "more_important" else -0.08
        for focus in entry.focus_areas:
            focus_key = _normalize(focus)
            if focus_key:
                bias[focus_key] = bias.get(focus_key, 0.0) + delta
    return bias


def _train_priority_model(context: EffectiveContext) -> PriorityModel:
    feedback_counts = _feedback_counts_by_sender(context.feedback_history)
    sender_feedback_bias: dict[str, float] = {}
    for sender_key, (more_count, less_count) in feedback_counts.items():
        sender_feedback_bias[sender_key] = max(min((more_count - less_count) * 0.06, 0.32), -0.32)

    focus_feedback_bias = _feedback_bias_by_focus(context.feedback_history)
    focus_weights: dict[str, float] = {}
    for index, focus in enumerate(context.focus_order):
        focus_weights[_normalize(focus)] = max(0.55 - (index * 0.08), 0.24)

    global_more = sum(1 for entry in context.feedback_history if entry.feedback_action == "more_important")
    global_less = sum(1 for entry in context.feedback_history if entry.feedback_action == "show_less")
    positive_shift = min(global_more, 12) * 0.004
    negative_shift = min(global_less, 12) * 0.004

    return PriorityModel(
        bias=-0.42,
        weights={
            "is_unread": 0.28,
            "has_attachment": 0.04,
            "thread_depth": 0.08,
            "has_explicit_deadline": 0.62,
            "deadline_within_48h": 0.72,
            "read_within_48h": 0.28,
            "handle_within_48h": 0.58,
            "meeting_or_interview": 0.42,
            "needs_reply": 0.56,
            "needs_submission": 0.62,
            "needs_download": 0.18,
            "needs_follow_up": 0.38,
            "notification_only": -0.26,
            "vip_sender": 0.52,
            "deprioritized_sender": -0.46,
            "positive_feedback": 0.26,
            "negative_feedback": -0.32,
            "open_history": 0.16,
            "processed_history": 0.08,
            "marketing": -1.12,
            "subscription": -0.84,
            "bulk": -0.58,
            "low_value": -0.96,
            "processed_message": -0.82,
            "hidden_message": -0.92,
        },
        focus_weights=focus_weights,
        sender_feedback_bias=sender_feedback_bias,
        focus_feedback_bias=focus_feedback_bias,
        high_threshold=max(min(0.72 - positive_shift + negative_shift, 0.82), 0.66),
        medium_threshold=max(min(0.48 - (positive_shift / 2) + (negative_shift / 2), 0.58), 0.4),
        ignore_threshold=max(min(0.18 + (negative_shift / 2) - (positive_shift / 2), 0.24), 0.14),
    )


def _compute_preference_features(
    message: RawMessage,
    text: str,
    topic_features: TopicFeatures,
    context: EffectiveContext,
) -> PreferenceFeatures:
    sender_text = _normalize(f"{message.sender_name} {message.sender_email or ''}")
    text_normalized = _normalize(text)

    sender_terms_hit = [term for term in context.sender_terms if _normalize(term) and _normalize(term) in sender_text]
    deprioritized_hit = [
        term
        for term in context.deprioritized_sender_terms
        if _normalize(term) and _normalize(term) in sender_text
    ]

    topic_labels = {
        "academic": "学业",
        "work": "工作",
        "recruiting": "招聘",
        "admin": "行政",
        "finance": "财务",
        "course": "课程",
        "assignment": "作业",
        "interview": "面试",
        "meeting": "会议",
    }

    detected_topic_labels = [
        label
        for field_name, label in topic_labels.items()
        if getattr(topic_features, field_name)
    ]

    matches_focus_order = []
    for focus in context.focus_order:
        normalized_focus = _normalize(focus)
        if not normalized_focus:
            continue
        if normalized_focus in text_normalized or focus in detected_topic_labels or focus in topic_features.custom_hits:
            matches_focus_order.append(focus)

    sender_feedback_counts = _feedback_counts_by_sender(context.feedback_history)
    more_count, less_count = sender_feedback_counts.get(_normalize(message.sender_name), (0, 0))

    sender_recent_history = _history_by_sender(context).get(_normalize(message.sender_name), [])
    historical_open_count = context.sender_history.get(_normalize(message.sender_name), 0) + sum(
        entry.opened_count for entry in sender_recent_history
    )
    historical_processed_count = sum(1 for entry in sender_recent_history if entry.processed)

    return PreferenceFeatures(
        fromVipSender=bool(sender_terms_hit),
        fromDeprioritizedSender=bool(deprioritized_hit),
        matchesUserFocus=bool(matches_focus_order),
        matchesFocusOrder=matches_focus_order,
        customFocusHits=topic_features.custom_hits,
        historicalPositiveFeedback=more_count,
        historicalNegativeFeedback=less_count,
        historicalOpenCount=historical_open_count,
        historicalProcessedCount=historical_processed_count,
    )


def _merge_feature_dicts(
    heuristic: DeadlineFeatures | TopicFeatures | ActionFeatures | DistractionFeatures,
    llm_data: dict[str, object] | None,
) -> dict[str, object]:
    merged = heuristic.model_dump(mode="json", by_alias=True)
    if not llm_data:
        return merged

    for key, value in llm_data.items():
        if value is None:
            continue
        merged[key] = value
    return merged


def _compose_llm_features(
    message: RawMessage,
    context: EffectiveContext,
    llm_payload: dict[str, object] | None,
) -> tuple[LLMFeatures, list[str], str, str, str, str, str | None]:
    combined_text = " ".join(
        filter(
            None,
            [
                message.sender_name,
                message.sender_email,
                message.subject,
                message.summary,
                message.body_excerpt,
            ],
        )
    )

    heuristic_deadline = _extract_deadline_features(combined_text, message.timestamp)
    heuristic_topics = _extract_topic_features(combined_text, context.focus_order)
    heuristic_actions = _extract_action_features(combined_text)
    heuristic_distraction = _extract_distraction_features(combined_text, message)

    deadline = DeadlineFeatures.model_validate(
        _merge_feature_dicts(
            heuristic_deadline,
            (llm_payload or {}).get("deadline") if isinstance(llm_payload, dict) else None,
        )
    )
    topics = TopicFeatures.model_validate(
        _merge_feature_dicts(
            heuristic_topics,
            (llm_payload or {}).get("topics") if isinstance(llm_payload, dict) else None,
        )
    )
    actions = ActionFeatures.model_validate(
        _merge_feature_dicts(
            heuristic_actions,
            (llm_payload or {}).get("actions") if isinstance(llm_payload, dict) else None,
        )
    )
    distraction = DistractionFeatures.model_validate(
        _merge_feature_dicts(
            heuristic_distraction,
            (llm_payload or {}).get("distraction") if isinstance(llm_payload, dict) else None,
        )
    )
    preference = _compute_preference_features(message, combined_text, topics, context)

    custom_feature_hits = _merge_unique(
        topics.custom_hits,
        (llm_payload or {}).get("customFeatureHits", []) if isinstance(llm_payload, dict) else [],
    )
    topics.custom_hits = custom_feature_hits

    custom_features = {f"custom::{hit}": 1.0 for hit in custom_feature_hits}
    features = LLMFeatures(
        deadline=deadline,
        topics=topics,
        actions=actions,
        distraction=distraction,
        preference=preference,
        customFeatures=custom_features,
    )

    brief_subject = _safe_text(
        (llm_payload or {}).get("briefSubject") if isinstance(llm_payload, dict) else None,
        max_length=80,
    )
    ai_summary = _safe_text(
        (llm_payload or {}).get("aiSummary") if isinstance(llm_payload, dict) else None,
        max_length=400,
    )
    ai_reason = _safe_text(
        (llm_payload or {}).get("aiReason") if isinstance(llm_payload, dict) else None,
        max_length=280,
    )
    board_reason_hint = _safe_text(
        (llm_payload or {}).get("boardReason") if isinstance(llm_payload, dict) else None,
        max_length=160,
    )
    board_hint = (llm_payload or {}).get("boardHint") if isinstance(llm_payload, dict) else None
    priority_tags = _merge_unique(
        (llm_payload or {}).get("priorityReasonTags", []) if isinstance(llm_payload, dict) else [],
        custom_feature_hits,
    )[:4]
    display_sender = _safe_text(
        (llm_payload or {}).get("displaySender") if isinstance(llm_payload, dict) else None,
        max_length=80,
    )

    return (
        features,
        priority_tags,
        display_sender,
        brief_subject,
        ai_summary,
        ai_reason,
        board_reason_hint or (board_hint if isinstance(board_hint, str) else None),
    )


def _sigmoid(value: float) -> float:
    if value >= 0:
        denominator = 1.0 + math.exp(-value)
        return 1.0 / denominator
    exp_value = math.exp(value)
    return exp_value / (1.0 + exp_value)


def _score_priority(
    message: RawMessage,
    features: LLMFeatures,
    model: PriorityModel,
    context: EffectiveContext,
) -> tuple[float, PriorityLevel, list[str]]:
    sender_key = _normalize(message.sender_name)
    feature_values = {
        "is_unread": 1.0 if message.is_unread else 0.0,
        "has_attachment": 1.0 if message.has_attachment else 0.0,
        "thread_depth": min(message.thread_message_count, 6) / 6.0,
        "has_explicit_deadline": 1.0 if features.deadline.has_explicit_deadline else 0.0,
        "deadline_within_48h": 1.0 if features.deadline.deadline_within_48h else 0.0,
        "read_within_48h": 1.0 if features.deadline.read_within_48h else 0.0,
        "handle_within_48h": 1.0 if features.deadline.handle_within_48h else 0.0,
        "meeting_or_interview": 1.0
        if features.deadline.has_meeting_or_interview_time or features.topics.interview or features.topics.meeting
        else 0.0,
        "needs_reply": 1.0 if features.actions.needs_reply else 0.0,
        "needs_submission": 1.0 if features.actions.needs_submission else 0.0,
        "needs_download": 1.0 if features.actions.needs_download else 0.0,
        "needs_follow_up": 1.0 if features.actions.needs_follow_up else 0.0,
        "notification_only": 1.0 if features.actions.notification_only else 0.0,
        "vip_sender": 1.0 if features.preference.from_vip_sender else 0.0,
        "deprioritized_sender": 1.0 if features.preference.from_deprioritized_sender else 0.0,
        "positive_feedback": min(features.preference.historical_positive_feedback, 4) / 4.0,
        "negative_feedback": min(features.preference.historical_negative_feedback, 4) / 4.0,
        "open_history": min(features.preference.historical_open_count, 10) / 10.0,
        "processed_history": min(features.preference.historical_processed_count, 8) / 8.0,
        "marketing": 1.0 if features.distraction.is_marketing else 0.0,
        "subscription": 1.0 if features.distraction.is_subscription else 0.0,
        "bulk": 1.0 if features.distraction.is_bulk else 0.0,
        "low_value": 1.0 if features.distraction.low_value_notification else 0.0,
        "processed_message": 1.0 if message.message_id in context.processed_message_ids else 0.0,
        "hidden_message": 1.0 if message.message_id in context.hidden_message_ids else 0.0,
    }

    score_logit = model.bias
    contribution_tags: list[tuple[float, str]] = []
    for key, value in feature_values.items():
        if not value:
            continue
        weight = model.weights.get(key, 0.0)
        score_logit += weight * value
        if weight > 0:
            contribution_tags.append((weight * value, key))

    for focus in features.preference.matches_focus_order:
        focus_key = _normalize(focus)
        weight = model.focus_weights.get(focus_key, 0.24)
        score_logit += weight
        contribution_tags.append((weight, f"focus::{focus}"))
        score_logit += model.focus_feedback_bias.get(focus_key, 0.0)

    sender_feedback_bias = model.sender_feedback_bias.get(sender_key, 0.0)
    score_logit += sender_feedback_bias
    if sender_feedback_bias > 0:
        contribution_tags.append((sender_feedback_bias, "sender_feedback"))

    for hit in features.custom_features:
        score_logit += 0.06
        contribution_tags.append((0.06, hit))

    priority_score = max(min(_sigmoid(score_logit), 0.999), 0.001)

    ignore_like = (
        features.distraction.is_marketing
        or features.distraction.is_subscription
        or features.distraction.is_bulk
        or features.distraction.low_value_notification
    ) and not (
        features.actions.has_action_item
        or features.deadline.has_explicit_deadline
        or features.preference.from_vip_sender
        or features.preference.matches_user_focus
    )

    if priority_score >= model.high_threshold:
        priority_level: PriorityLevel = "high"
    elif priority_score >= model.medium_threshold:
        priority_level = "medium"
    elif priority_score < model.ignore_threshold or ignore_like:
        priority_level = "ignore"
    else:
        priority_level = "low"

    tag_labels = {
        "has_explicit_deadline": "有明确DDL",
        "deadline_within_48h": "48h内",
        "meeting_or_interview": "会议/面试",
        "needs_reply": "需要回复",
        "needs_submission": "需要提交",
        "needs_follow_up": "需要处理",
        "vip_sender": "重点寄件人",
        "open_history": "经常查看",
        "positive_feedback": "历史偏好提升",
        "sender_feedback": "反馈强化",
    }

    top_tags = []
    for _, raw_tag in sorted(contribution_tags, key=lambda item: item[0], reverse=True):
        if raw_tag.startswith("focus::"):
            tag = raw_tag.replace("focus::", "关注:")
        elif raw_tag.startswith("custom::"):
            tag = raw_tag.replace("custom::", "自定义:")
        else:
            tag = tag_labels.get(raw_tag)
        if tag and tag not in top_tags:
            top_tags.append(tag)
        if len(top_tags) >= 4:
            break

    return round(priority_score, 4), priority_level, top_tags


def _resolve_action_label(features: LLMFeatures) -> str | None:
    if features.actions.needs_reply:
        return ACTION_LABELS["reply"]
    if features.actions.needs_submission:
        return ACTION_LABELS["submission"]
    if features.actions.needs_download:
        return ACTION_LABELS["download"]
    if features.actions.needs_follow_up:
        return ACTION_LABELS["follow_up"]
    return None


def _resolve_board_type(
    message: RawMessage,
    features: LLMFeatures,
    priority_score: float,
    priority_level: PriorityLevel,
    board_hint: str | None,
    context: EffectiveContext,
) -> tuple[BoardType, str]:
    needs_time_attention = (
        features.deadline.handle_within_48h
        or features.deadline.read_within_48h
        or features.deadline.deadline_within_48h
    )
    needs_human_action = (
        features.actions.has_action_item
        or features.actions.needs_follow_up
        or board_hint == "todo"
    )
    strong_ignore = (
        (
            features.distraction.is_marketing
            or features.distraction.is_subscription
            or features.distraction.is_bulk
            or features.distraction.low_value_notification
        )
        and not features.actions.has_action_item
        and not features.deadline.has_explicit_deadline
        and not features.preference.from_vip_sender
        and not features.preference.matches_user_focus
        and features.preference.historical_positive_feedback == 0
        and priority_score < 0.55
    )
    if strong_ignore or (
        board_hint == "ignore"
        and priority_level in {"low", "ignore"}
        and not features.actions.has_action_item
    ):
        return "ignore", "营销/订阅信号明显，且当前没有明确动作要求"

    # 非 ignore 板块只承接非灰色邮件，避免可忽略内容混入优先浏览区。
    if priority_level == "ignore":
        return "ignore", "当前优先级已落入可忽略区间，暂不进入需要优先查看的板块"

    if features.deadline.handle_within_48h:
        return "within_48h", "48 小时内需要处理"

    if features.deadline.read_within_48h or features.deadline.deadline_within_48h:
        return "within_48h", "48 小时内建议查阅"

    if needs_human_action:
        return "todo", "存在后续处理动作"

    if not needs_time_attention and not needs_human_action:
        return "priority_content", "优先级较高，且当前不属于 48 小时提醒或待处理事项"

    return "ignore", "当前阶段价值较低，可暂时放后"


def _build_brief_subject(message: RawMessage, features: LLMFeatures, provided: str) -> str:
    if provided and not _is_generic_brief_subject(provided):
        return provided

    clean_subject = _clean_subject_line(message.subject)
    if not _contains_cjk(clean_subject) or _looks_like_raw_excerpt(clean_subject):
        clean_subject = ""
    summary_candidate = _first_content_sentence(message.summary, message.body_excerpt)
    if not _contains_cjk(summary_candidate) or _looks_like_raw_excerpt(summary_candidate):
        summary_candidate = ""
    topic_label = _topic_display_label(features)
    sender_label = _build_display_sender(message, "")

    if features.topics.interview and features.actions.needs_reply:
        return "确认面试安排"
    if features.topics.meeting and features.deadline.has_meeting_or_interview_time:
        return "查看会议安排"
    if features.actions.needs_submission:
        return _truncate(f"提交{topic_label or '相关'}材料", 18)
    if features.actions.needs_reply:
        return _truncate(f"回复{topic_label or '当前'}事项", 18)
    if features.actions.needs_download:
        return _truncate(f"查看{topic_label or '相关'}附件", 18)
    if features.deadline.deadline_within_48h and topic_label:
        return _truncate(f"{topic_label}近期提醒", 18)
    if features.distraction.is_marketing:
        return "营销通知"
    if summary_candidate:
        return _truncate(summary_candidate, 18)
    if topic_label:
        return _truncate(f"{topic_label}通知", 18)
    if sender_label and sender_label != "邮件来源":
        return _truncate(f"{sender_label}通知", 18)
    return _truncate(clean_subject or "邮件提醒", 18)


def _build_ai_summary(
    message: RawMessage,
    features: LLMFeatures,
    provided: str,
    board_type: BoardType,
) -> str:
    if provided and not _is_placeholder_summary(provided):
        return provided

    summary_candidate = _first_content_sentence(
        message.summary,
        message.body_excerpt,
        _clean_subject_line(message.subject),
    )
    if not _contains_cjk(summary_candidate) or _looks_like_raw_excerpt(summary_candidate):
        summary_candidate = ""
    topic_label = _topic_display_label(features)
    sender_label = _build_display_sender(message, "")

    if features.deadline.handle_within_48h and features.deadline.deadline_text:
        core = summary_candidate or f"这封邮件主要说明{topic_label or '当前事项'}的处理要求"
        return _truncate(_ensure_sentence(f"{core}，并需在 {features.deadline.deadline_text} 前处理"), 120)
    if features.deadline.read_within_48h and features.deadline.deadline_text:
        core = summary_candidate or f"这封邮件主要说明{topic_label or '近期'}的重要信息"
        return _truncate(_ensure_sentence(f"{core}，建议在 {features.deadline.deadline_text} 前查看"), 120)
    if features.actions.needs_reply:
        core = summary_candidate or f"这封邮件希望你就{topic_label or '当前事项'}进行回复或确认"
        return _truncate(_ensure_sentence(f"{core}，需要你回复或确认"), 120)
    if features.actions.needs_submission:
        core = summary_candidate or f"这封邮件要求你提交{topic_label or '相关'}材料或填写信息"
        return _truncate(_ensure_sentence(f"{core}，需要你完成提交"), 120)
    if features.actions.needs_download:
        core = summary_candidate or "这封邮件附带了需要查看的附件或材料"
        return _truncate(_ensure_sentence(f"{core}，建议先查看附件"), 120)
    if board_type == "ignore":
        if summary_candidate:
            return _truncate(_ensure_sentence(f"{summary_candidate}，当前更像一般通知或订阅内容"), 120)
        return _ensure_sentence(f"这封邮件主要来自{sender_label}，内容更像一般通知或订阅更新，当前没有明显需要处理的事项")
    if summary_candidate:
        return _truncate(_ensure_sentence(summary_candidate), 120)
    if topic_label and features.actions.notification_only:
        return _ensure_sentence(f"这封邮件主要通知与{topic_label}有关的最新信息，当前以阅读了解为主")
    if topic_label:
        return _ensure_sentence(f"这封邮件主要围绕{topic_label}事项提供更新信息，建议快速了解重点内容")
    return _ensure_sentence(f"这封邮件主要来自{sender_label}，包含一条需要你了解的最新通知")


def _build_brief_subject(message: RawMessage, features: LLMFeatures, provided: str) -> str:
    if provided and not _is_generic_brief_subject(provided):
        return _normalize_brief_subject(provided)

    return _normalize_brief_subject(_build_rule_based_subject(message, features))


def _build_ai_summary(
    message: RawMessage,
    features: LLMFeatures,
    provided: str,
    board_type: BoardType,
) -> str:
    if provided and not _is_placeholder_summary(provided):
        return provided

    return _build_rule_based_summary(message, features, board_type)


def _build_ai_reason(
    message: RawMessage,
    features: LLMFeatures,
    provided: str,
    board_reason: str,
) -> str:
    if provided and _contains_cjk(provided):
        return provided
    if features.preference.from_vip_sender:
        return "来自重点寄件人，且当前规则判断它值得优先关注。"
    if features.deadline.deadline_within_48h:
        return "邮件中出现了 48 小时内的时间敏感信号。"
    if features.actions.has_action_item:
        return "邮件包含明确动作项，不适合只当作普通通知。"
    if board_reason:
        return board_reason
    return f"系统结合主题、动作和偏好后，对来自 {message.sender_name} 的邮件做了当前判断。"


def _sort_score(
    message: RawMessage,
    features: LLMFeatures,
    priority_score: float,
) -> float:
    score = priority_score * 100
    if features.deadline.handle_within_48h:
        score += 14
    elif features.deadline.read_within_48h:
        score += 8
    if message.is_unread:
        score += 4
    if features.preference.from_vip_sender:
        score += 6
    if features.actions.has_action_item:
        score += 4
    return round(min(score, 100.0), 2)


def _build_priority_reason_tags(
    llm_tags: list[str],
    computed_tags: list[str],
    features: LLMFeatures,
    board_type: BoardType,
) -> list[str]:
    tags = _merge_unique(llm_tags, computed_tags)

    if board_type == "ignore":
        if features.distraction.is_marketing:
            tags = _merge_unique(tags, ["营销/订阅"])
        if features.distraction.is_subscription:
            tags = _merge_unique(tags, ["订阅通知"])
        if features.distraction.low_value_notification:
            tags = _merge_unique(tags, ["低价值提醒"])

    return tags[:4]


def _analyze_single_message(
    message: RawMessage,
    context: EffectiveContext,
    model: PriorityModel,
    llm_payload: dict[str, object] | None,
    history_entry: AnalysisHistoryEntry | None,
) -> AnalyzedMessage:
    features, llm_tags, display_sender, brief_subject, ai_summary, ai_reason, board_hint_reason = _compose_llm_features(
        message,
        context,
        llm_payload,
    )

    board_hint = llm_payload.get("boardHint") if isinstance(llm_payload, dict) else None

    priority_score, priority_level, computed_tags = _score_priority(message, features, model, context)
    board_type, board_reason = _resolve_board_type(
        message,
        features,
        priority_score,
        priority_level,
        board_hint if isinstance(board_hint, str) else None,
        context,
    )

    display_sender = _build_display_sender(
        message,
        display_sender or (history_entry.display_sender if history_entry else ""),
    )
    brief_subject = _build_brief_subject(
        message,
        features,
        brief_subject or (history_entry.brief_subject if history_entry else ""),
    )
    ai_summary = _build_ai_summary(
        message,
        features,
        ai_summary or (history_entry.ai_summary if history_entry else ""),
        board_type,
    )
    ai_reason = _build_ai_reason(
        message,
        features,
        ai_reason or (history_entry.ai_reason if history_entry else ""),
        board_hint_reason or board_reason,
    )
    action_label = _resolve_action_label(features)
    deadline_label = features.deadline.deadline_text

    priority_reason_tags = _build_priority_reason_tags(
        llm_tags or (history_entry.priority_reason_tags if history_entry else []),
        computed_tags,
        features,
        board_type,
    )
    feedback_state = _feedback_state_for_message(message.message_id, context.feedback_history)

    return AnalyzedMessage(
        messageId=message.message_id,
        threadId=message.thread_id,
        senderName=message.sender_name,
        senderEmail=message.sender_email,
        displaySender=display_sender,
        subject=message.subject,
        summary=message.summary or message.body_excerpt[:200],
        bodyExcerpt=message.body_excerpt,
        timeText=message.time_text,
        timestamp=message.timestamp,
        isUnread=message.is_unread,
        hasAttachment=message.has_attachment,
        labelIds=message.label_ids,
        threadMessageCount=message.thread_message_count,
        briefSubject=brief_subject,
        aiSummary=ai_summary,
        aiReason=ai_reason,
        actionLabel=action_label,
        deadlineLabel=deadline_label,
        boardType=board_type,
        priorityScore=priority_score,
        priorityLevel=priority_level,
        sortScore=_sort_score(message, features, priority_score),
        needsAction=features.actions.has_action_item,
        readWithin48h=features.deadline.read_within_48h,
        handleWithin48h=features.deadline.handle_within_48h,
        focusAreas=_merge_unique(
            history_entry.focus_areas if history_entry else [],
            features.preference.matches_focus_order,
        ),
        customFeatureHits=features.topics.custom_hits,
        llmFeatures=features,
        displayExplanation=DisplayExplanation(
            boardReason=board_reason,
            priorityReasonTags=priority_reason_tags,
        ),
        feedbackState=feedback_state,
    )


def _sort_items(items: list[AnalyzedMessage]) -> list[AnalyzedMessage]:
    board_rank = {
        "priority_content": 0,
        "within_48h": 1,
        "todo": 2,
        "ignore": 3,
    }
    return sorted(
        items,
        key=lambda item: (
            board_rank[item.board_type],
            -item.priority_score,
            -item.sort_score,
            item.sender_name,
            item.message_id,
        ),
    )


def _build_overview(items: list[AnalyzedMessage]) -> OverviewCounts:
    return OverviewCounts(
        priorityContentCount=sum(1 for item in items if item.board_type == "priority_content"),
        within48hCount=sum(1 for item in items if item.board_type == "within_48h"),
        todoCount=sum(1 for item in items if item.board_type == "todo"),
        ignoreCount=sum(1 for item in items if item.board_type == "ignore"),
    )


def analyze_messages(payload: AnalyzeMessagesRequest) -> AnalyzeMessagesResponse:
    sanitized_messages = [_sanitize_message(message) for message in payload.messages]
    preferences = load_preferences()
    effective_context = _build_effective_context(payload.project_context, preferences)
    history_by_id = _history_by_message_id(effective_context)
    model = _train_priority_model(effective_context)

    mode = payload.mode or effective_context.analysis_mode
    should_rerun_llm = mode in {"full_reanalyze", "rerank", "resummary"}

    llm_targets = [
        message
        for message in sanitized_messages
        if should_rerun_llm or message.message_id not in history_by_id
    ]
    llm_payload_by_id: dict[str, dict[str, object]] = {}
    engine: str = "rules"

    if llm_targets and llm_enabled():
        try:
            llm_items = analyze_messages_with_llm(llm_targets, payload.project_context)
            llm_payload_by_id = {
                str(item.get("messageId")): item
                for item in llm_items
                if item.get("messageId")
            }
            engine = "llm"
        except Exception:
            logger.exception("LLM feature extraction failed. Falling back to rule extraction.")
            llm_payload_by_id = {}

    items = [
        _analyze_single_message(
            message,
            effective_context,
            model,
            llm_payload_by_id.get(message.message_id),
            None if should_rerun_llm else history_by_id.get(message.message_id),
        )
        for message in sanitized_messages
    ]

    return AnalyzeMessagesResponse(
        generatedAt=datetime.now(UTC),
        engine=engine if engine == "llm" or llm_enabled() else "rules",
        overview=_build_overview(items),
        items=_sort_items(items),
    )


def resummarize_message(payload: ResummarizeMessageRequest) -> ResummarizeMessageResponse:
    message = _sanitize_message(payload.message)
    preferences = load_preferences()
    effective_context = _build_effective_context(payload.project_context, preferences)
    history_entry = _history_by_message_id(effective_context).get(message.message_id)

    features, _, display_sender, brief_subject, ai_summary, ai_reason, board_hint_reason = _compose_llm_features(
        message,
        effective_context,
        None,
    )
    engine: str = "rules"

    if llm_enabled():
        try:
            llm_item = resummarize_message_with_llm(message, payload.project_context)
            display_sender = _safe_text(llm_item.get("displaySender"), max_length=80) or display_sender
            brief_subject = _safe_text(llm_item.get("briefSubject"), max_length=80) or brief_subject
            ai_summary = _safe_text(llm_item.get("aiSummary"), max_length=400) or ai_summary
            ai_reason = _safe_text(llm_item.get("aiReason"), max_length=220) or ai_reason
            engine = "llm"
        except Exception:
            logger.exception("Single-message resummary failed. Falling back to rules.")

    display_sender = _build_display_sender(
        message,
        display_sender or (history_entry.display_sender if history_entry else ""),
    )
    brief_subject = _build_brief_subject(
        message,
        features,
        brief_subject or (history_entry.brief_subject if history_entry else ""),
    )
    ai_summary = _build_ai_summary(
        message,
        features,
        ai_summary or (history_entry.ai_summary if history_entry else ""),
        history_entry.board_type if history_entry else "priority_content",
    )
    ai_reason = _build_ai_reason(
        message,
        features,
        ai_reason or (history_entry.ai_reason if history_entry else ""),
        history_entry.board_reason if history_entry and history_entry.board_reason else board_hint_reason or "",
    )

    return ResummarizeMessageResponse(
        generatedAt=datetime.now(UTC),
        engine=engine if engine == "llm" or llm_enabled() else "rules",
        item=ResummarizedMessage(
            messageId=message.message_id,
            displaySender=display_sender,
            briefSubject=brief_subject,
            aiSummary=ai_summary,
            aiReason=ai_reason,
        ),
    )
