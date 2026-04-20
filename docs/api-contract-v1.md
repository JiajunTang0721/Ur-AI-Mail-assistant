# V1 API 契约草案

本文件定义的是当前仓库在重构后的目标后端契约。若现有代码里仍存在旧字段，如 `today_focus`、`due_soon`、`priority` 直接绑定板块等，均应以本契约为准逐步迁移。

## 1. 鉴权范围建议

首版仍建议只申请：

- `gmail.readonly`

暂不申请：

- `gmail.modify`
- `mail.google.com`
- 邮件发送相关 scope

## 2. 统一数据原则

后端输入不能只吃 Gmail 原始字段，还必须接收当前项目已有上下文，例如：

- 用户偏好设置
- 重点寄件人配置
- 关注标签与顺序
- 自定义关注内容
- 线程上下文
- 历史分析记录
- 历史反馈记录
- 当前前端板块配置与排序规则

## 3. 核心枚举

### 3.1 板块枚举

```ts
type BoardType = "priority_content" | "within_48h" | "todo" | "ignore"
```

### 3.2 优先级枚举

```ts
type PriorityLevel = "high" | "medium" | "low" | "ignore"
```

### 3.3 反馈枚举

```ts
type FeedbackAction = "more_important" | "show_less"
```

## 4. Gmail 规范化输入

每封邮件至少应包含：

```json
{
  "message_id": "msg_001",
  "thread_id": "thread_001",
  "sender_name": "Amazon Recruiter",
  "sender_email": "recruiting@amazon.com",
  "subject": "Please confirm your interview slot",
  "summary": "The recruiter asks the candidate to confirm a slot.",
  "body_excerpt": "Please reply with your preferred time by tomorrow.",
  "time_text": "10:12 AM",
  "timestamp": "2026-04-15T10:12:00-04:00",
  "is_unread": true,
  "has_attachment": false,
  "label_ids": ["INBOX", "CATEGORY_UPDATES"],
  "thread_message_count": 3
}
```

## 5. `POST /api/v1/analyze/messages`

用途：
对一批规范化邮件做结构化特征抽取、板块归属判断和优先级打分。

请求体示例：

```json
{
  "mode": "incremental",
  "account_id": "user@gmail.com",
  "messages": [
    {
      "message_id": "msg_001",
      "thread_id": "thread_001",
      "sender_name": "Amazon Recruiter",
      "sender_email": "recruiting@amazon.com",
      "subject": "Please confirm your interview slot",
      "summary": "The recruiter asks the candidate to confirm a slot.",
      "body_excerpt": "Please reply with your preferred time by tomorrow.",
      "time_text": "10:12 AM",
      "timestamp": "2026-04-15T10:12:00-04:00",
      "is_unread": true,
      "has_attachment": false,
      "label_ids": ["INBOX"],
      "thread_message_count": 3
    }
  ],
  "project_context": {
    "preferences": {
      "vip_senders": ["recruiting@amazon.com"],
      "focus_topics": ["学业", "招聘"],
      "focus_order": ["学业", "招聘"],
      "custom_focus_items": ["CPT", "RA 申请"]
    },
    "board_config": {
      "enabled_boards": [
        "priority_content",
        "within_48h",
        "todo",
        "ignore"
      ]
    },
    "thread_context": [],
    "analysis_history": [],
    "feedback_history": [],
    "front_end_state": {
      "processed_message_ids": [],
      "hidden_message_ids": []
    }
  }
}
```

响应示例：

```json
{
  "meta": {
    "schema_version": "v1",
    "analyzed_at": "2026-04-15T10:15:00-04:00",
    "mode": "incremental"
  },
  "counts": {
    "priority_content": 2,
    "within_48h": 5,
    "todo": 6,
    "ignore": 9
  },
  "messages": [
    {
      "message_id": "msg_001",
      "thread_id": "thread_001",
      "board_type": "within_48h",
      "priority_score": 0.88,
      "priority_level": "high",
      "sort_score": 0.91,
      "llm_features": {
        "schema_version": "v1",
        "deadline": {
          "has_explicit_deadline": true,
          "deadline_within_48h": true,
          "deadline_text": "reply by tomorrow"
        },
        "topics": {
          "academic": false,
          "work": false,
          "recruiting": true,
          "meeting": false,
          "custom_hits": []
        },
        "actions": {
          "needs_reply": true,
          "needs_submission": false,
          "needs_follow_up": true,
          "notification_only": false
        },
        "distraction": {
          "is_ad": false,
          "is_subscription": false,
          "is_bulk": false,
          "low_value_notification": false
        },
        "preference": {
          "from_vip_sender": true,
          "matches_user_focus": true,
          "matches_focus_order": ["招聘"],
          "matches_history_pattern": true
        },
        "custom_features": {}
      },
      "display_explanation": {
        "board_reason": "48 小时内存在明确回复要求",
        "priority_reason_tags": ["招聘方", "需要回复", "DDL 临近"]
      },
      "feedback_state": {
        "more_important_count": 0,
        "show_less_count": 0
      }
    }
  ]
}
```

约束：

- 每封邮件必须同时返回 `board_type` 和 `priority_score / priority_level`
- `board_type` 不能由 `priority_level` 直接推导
- `counts` 必须来源于当前这次最新分类结果

## 6. `POST /api/v1/feedback`

用途：
记录用户对单封邮件优先级判断的反馈，默认首先作用于优先级模型。

请求体示例：

```json
{
  "account_id": "user@gmail.com",
  "message_id": "msg_001",
  "thread_id": "thread_001",
  "feedback_action": "more_important",
  "source": "detail_panel",
  "board_type": "within_48h",
  "priority_level": "medium"
}
```

说明：

- `more_important`：上调目标优先级
- `show_less`：下调目标优先级

响应示例：

```json
{
  "ok": true,
  "recorded_at": "2026-04-15T10:16:00-04:00"
}
```

## 7. `POST /api/v1/reanalyze`

用途：
用户点击“重新分析”时触发全链路重跑。

请求体示例：

```json
{
  "account_id": "user@gmail.com",
  "mode": "full_reanalyze",
  "refresh_gmail": true
}
```

后端应完成：

1. 拉取 Gmail 最新数据
2. 读取当前项目已有设置
3. 重跑 LLM 特征抽取
4. 读取反馈记录
5. 更新训练样本
6. 优化 `β`
7. 优化优先级阈值
8. 重算 `board_type`
9. 返回最新结果与计数

## 8. `GET /api/v1/preferences`

用途：
读取用户偏好与权重约束。

响应示例：

```json
{
  "vip_senders": ["recruiting@amazon.com"],
  "focus_topics": ["学业", "招聘"],
  "focus_order": ["学业", "招聘"],
  "custom_focus_items": ["CPT", "RA 申请"],
  "board_preferences": {
    "default_board": "priority_content"
  }
}
```

## 9. `POST /api/v1/preferences`

用途：
更新用户偏好。偏好更新后，下一次分析必须进入特征抽取与模型链路，而不是只改前端 UI。

请求体示例：

```json
{
  "vip_senders": ["recruiting@amazon.com"],
  "focus_topics": ["学业", "招聘"],
  "focus_order": ["学业", "招聘"],
  "custom_focus_items": ["CPT", "RA 申请"]
}
```

## 10. `GET /api/v1/mail/:messageId/insight`

用途：
返回单封邮件在详情视图中需要展示的解释性字段。

响应示例：

```json
{
  "message_id": "msg_001",
  "thread_id": "thread_001",
  "sender_name": "Amazon Recruiter",
  "sender_email": "recruiting@amazon.com",
  "subject": "Please confirm your interview slot",
  "board_type": "within_48h",
  "priority_level": "high",
  "priority_score": 0.88,
  "focus_text": "这是一封需要在 48 小时内回复的面试确认邮件。",
  "suggested_action": "回复可参加的时间，并确认时区。",
  "deadline_display": "请在明天前回复",
  "reason_bullets": [
    "发件人为招聘方",
    "正文包含明确回复动作",
    "截止时间落在 48 小时内"
  ]
}
```

## 11. 共享 schema 建议

建议前后端统一共享以下类型：

- `BoardType`
- `PriorityLevel`
- `FeedbackAction`
- `OverviewCounts`
- `MailListItem`
- `MailInsightDetail`
- `AnalyzeMessagesRequest`
- `AnalyzeMessagesResponse`
- `Preferences`

## 12. 状态更新约束

1. overview 数字必须基于当前最新 `board_type` 统计
2. `priority_score` 与 `priority_level` 必须始终同时出现
3. `timestamp` 与 deadline 字段统一使用 ISO 8601
4. `reason_bullets` 最多保留 1 到 3 条
5. 如果存在 `custom_focus_items`，LLM 输出 schema 必须同步支持对应扩展特征
