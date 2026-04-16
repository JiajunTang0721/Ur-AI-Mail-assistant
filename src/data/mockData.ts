import type {
  ExpandedPanelData,
  HistoryEntry,
  ItemStatus,
  MailInsightDetail,
  MailListItem,
  MailRecord,
  PanelFilters,
  SenderOption,
  TabKey,
} from '../types'

type StatusMap = Record<string, ItemStatus>

const panelMeta = {
  assistantName: '邮件重点助手',
  lastSyncedText: '今天 08:12 已同步',
  lastSyncedAt: '2026-04-14T08:12:00-04:00',
}

const fallbackFrequentSenders = ['Amazon Recruiter', 'Columbia Career Center']

const mailRecords: Record<string, MailRecord> = {
  'q3-review': {
    messageId: 'q3-review',
    threadId: 'thread-project-03',
    senderName: '项目团队',
    senderEmail: 'pm@projectlab.io',
    subject: 'Q3 关键里程碑评审材料今晚补齐',
    shortSummary: '今晚 18:00 前需要补交评审材料，否则明早的 review 无法排期。',
    actionRequired: true,
    actionLabel: '提交材料',
    deadlineText: '今天 18:00',
    deadlineTs: '2026-04-14T18:00:00-04:00',
    priority: 'high',
    reasonTags: ['内部项目', '今晚截止', '需要提交'],
    itemStatus: 'pending',
    category: '项目协作',
    focusAreas: ['工作'],
    focusText: '如果今晚没有补齐材料，明早的里程碑评审就会延后。',
    suggestedAction: '先补产品进展和风险页，再把文档链接回到线程里。',
    deadlineDisplay: '请在今天 18:00 前完成补交。',
    reasonBullets: ['直接影响内部评审排期', '截止时间就在今天', '邮件明确要求补交材料'],
    receivedAt: '今天 08:42',
    previewLines: ['系统检测到项目材料缺失，请尽快补齐 review deck。'],
    bodyParagraphs: [
      '大家好，明早 9 点的里程碑评审还缺最新产品进展和风险说明。',
      '请负责同学在今天 18:00 前补齐文档链接，并同步是否存在延期风险。',
    ],
  },
  'amazon-interview': {
    messageId: 'amazon-interview',
    threadId: 'thread-amazon-01',
    senderName: 'Amazon Recruiter',
    senderEmail: 'recruiting@amazon.com',
    subject: '请确认 4/16 面试时间',
    shortSummary: '亚马逊招聘方希望你在 48 小时内确认面试时间。',
    actionRequired: true,
    actionLabel: '回复确认',
    deadlineText: '48 小时内',
    deadlineTs: '2026-04-16T10:30:00-04:00',
    priority: 'high',
    reasonTags: ['招聘方', '需要回复', '48 小时内'],
    itemStatus: 'pending',
    category: '求职 / 面试',
    focusAreas: ['招聘', '工作'],
    focusText: '这是一封面试时间确认邮件，对方正在等待你的明确回复。',
    suggestedAction: '回复可参加的时间，并顺手确认时区信息。',
    deadlineDisplay: '建议在 4/16 上午前完成确认。',
    reasonBullets: ['来自招聘方', '正文要求确认面试时间', '超过 48 小时可能影响流程'],
    receivedAt: '今天 10:30',
    previewLines: ['We would like to confirm your interview slot for Thursday.'],
    bodyParagraphs: [
      'Hi Jiajun, we would like to confirm your interview slot for Thursday.',
      '请在两个可选时间段中回复一个你可以参加的时间，我们将据此锁定面试官安排。',
    ],
  },
  'career-fair': {
    messageId: 'career-fair',
    threadId: 'thread-career-02',
    senderName: 'Columbia Career Center',
    senderEmail: 'careercenter@columbia.edu',
    subject: '4/16 科技企业招聘活动报名提醒',
    shortSummary: '学校官方招聘活动将于明晚截止报名，适合当前求职阶段参与。',
    actionRequired: true,
    actionLabel: '报名',
    deadlineText: '4/16 23:59',
    deadlineTs: '2026-04-16T23:59:00-04:00',
    priority: 'high',
    reasonTags: ['学校官方', '报名截止', '求职相关'],
    itemStatus: 'pending',
    category: '校园招聘',
    focusAreas: ['招聘', '学业'],
    focusText: '这场活动和你当前的求职方向高度相关，错过会少一个集中接触招聘方的机会。',
    suggestedAction: '确认时间不冲突后直接报名，并准备最新简历。',
    deadlineDisplay: '报名截止时间为 4/16 23:59。',
    reasonBullets: ['来源可信且与求职主题强相关', '存在明确截止时间', '属于高回报的线下资源'],
    receivedAt: '今天 09:15',
    previewLines: ['Join our spring recruiting fair featuring product, data, and strategy roles.'],
    bodyParagraphs: [
      '职业发展中心将于本周四晚举办科技企业招聘活动，参与企业包含产品、数据和战略岗位。',
      '建议提前上传简历并勾选感兴趣的公司名单，便于现场快速交流。',
    ],
  },
  'finance-report': {
    messageId: 'finance-report',
    threadId: 'thread-finance-04',
    senderName: '财务分析组',
    senderEmail: 'finance@company.com',
    subject: '财务报表待审阅',
    shortSummary: '周五评审前建议先快速浏览最新财务报表，了解预算变化。',
    actionRequired: false,
    priority: 'medium',
    reasonTags: ['项目进度', '需知悉'],
    itemStatus: 'pending',
    category: '财务 / 项目',
    focusAreas: ['工作'],
    focusText: '这封邮件不一定要立刻处理，但会影响你周五评审时的判断依据。',
    suggestedAction: '预留 10 分钟浏览重点页，确认预算和偏差项。',
    deadlineDisplay: '建议在周五评审前完成阅读。',
    reasonBullets: ['与近期评审直接相关', '包含预算变化信息', '无需立即回复但需要提前知悉'],
    receivedAt: '昨天',
    previewLines: ['FY26 Q3 budget snapshot and deviation explanation attached.'],
    bodyParagraphs: [
      '附件是本季度最新预算快照和偏差说明，请在周五评审前先过一遍。',
      '如果你负责的模块有新增需求，请在评审时提前说明。',
    ],
  },
  'visa-check': {
    messageId: 'visa-check',
    threadId: 'thread-visa-05',
    senderName: 'International Office',
    senderEmail: 'iso@university.edu',
    subject: 'SEVIS 信息核验提醒',
    shortSummary: '学校要求你在本周内确认 SEVIS 信息是否准确，避免后续材料出错。',
    actionRequired: true,
    actionLabel: '确认信息',
    deadlineText: '本周内',
    deadlineTs: '2026-04-17T17:00:00-04:00',
    priority: 'high',
    reasonTags: ['学校官方', '签证相关', '本周截止'],
    itemStatus: 'pending',
    category: '学校事务',
    focusAreas: ['学业'],
    focusText: '这封邮件涉及签证信息，优先级高但处理成本不大，适合尽早清掉。',
    suggestedAction: '登录学校系统核对个人信息，确认无误后提交。',
    deadlineDisplay: '请在本周五 17:00 前完成核验。',
    reasonBullets: ['学校官方发送', '与证件信息相关风险较高', '本周内有明确截止时间'],
    receivedAt: '昨天',
    previewLines: ['Please review your SEVIS profile before the Friday deadline.'],
    bodyParagraphs: [
      '请在本周五 17:00 前登录学生系统核验你的 SEVIS 资料。',
      '如果信息不一致，请尽快提交更正申请，以免影响后续文件出具。',
    ],
  },
  'expense-approval': {
    messageId: 'expense-approval',
    threadId: 'thread-expense-06',
    senderName: '财务部',
    senderEmail: 'expense@company.com',
    subject: '差旅报销单待你审批',
    shortSummary: '团队成员的差旅报销已提交，需要你本周完成审批。',
    actionRequired: true,
    actionLabel: '审批',
    deadlineText: '本周五',
    deadlineTs: '2026-04-17T18:00:00-04:00',
    priority: 'medium',
    reasonTags: ['财务流程', '需要审批'],
    itemStatus: 'pending',
    category: '审批流程',
    focusAreas: ['工作'],
    focusText: '这是标准审批动作，不紧急，但不适合拖到周末。',
    suggestedAction: '检查金额与附件后完成审批，避免影响报销到账。',
    deadlineDisplay: '建议在本周五下班前完成审批。',
    reasonBullets: ['存在明确待办动作', '会影响他人报销进度', '属于可快速处理的行政事项'],
    receivedAt: '昨天',
    previewLines: ['Travel reimbursement request #A1042 is waiting for your approval.'],
    bodyParagraphs: [
      '项目经理提交了一笔差旅报销申请，请你在本周五前完成审批。',
      '如有问题，请在审批页直接留言说明。',
    ],
  },
  'team-offsite': {
    messageId: 'team-offsite',
    threadId: 'thread-offsite-07',
    senderName: '行政支持',
    senderEmail: 'ops@company.com',
    subject: '团队团建地点投票本周截止',
    shortSummary: '本周五前需要完成团建地点投票，耗时很短但别遗漏。',
    actionRequired: true,
    actionLabel: '投票',
    deadlineText: '本周五',
    deadlineTs: '2026-04-17T20:00:00-04:00',
    priority: 'medium',
    reasonTags: ['内部活动', '低成本待办'],
    itemStatus: 'pending',
    category: '内部行政',
    focusAreas: ['工作'],
    focusText: '这封邮件不算高风险，但属于容易被遗忘的小待办。',
    suggestedAction: '打开表单投票，顺手确认是否携带家属。',
    deadlineDisplay: '请在本周五晚前完成投票。',
    reasonBullets: ['需要执行动作', '操作成本很低', '容易在高优事项里被遗漏'],
    receivedAt: '昨天',
    previewLines: ['Please vote for the offsite location by Friday evening.'],
    bodyParagraphs: [
      '请大家在本周五晚前完成团建地点投票，我们会据此预订场地。',
      '表单预计 1 分钟内即可完成。',
    ],
  },
  'workspace-booking': {
    messageId: 'workspace-booking',
    threadId: 'thread-workspace-08',
    senderName: '办公室管理',
    senderEmail: 'workspace@company.com',
    subject: '季度工位需求登记',
    shortSummary: '下周一前需要填写下一季度工位偏好和到岗频次。',
    actionRequired: true,
    actionLabel: '填表',
    deadlineText: '下周一',
    deadlineTs: '2026-04-20T18:00:00-04:00',
    priority: 'medium',
    reasonTags: ['行政流程', '需要填表'],
    itemStatus: 'pending',
    category: '办公室运营',
    focusAreas: ['工作'],
    focusText: '这项表单不急，但现在顺手填掉可以避免下周一被动处理。',
    suggestedAction: '确认每周到岗频次和偏好的工位区域后直接提交。',
    deadlineDisplay: '请在下周一 18:00 前提交登记。',
    reasonBullets: ['属于明确待办事项', '时间还比较充裕', '适合在空档时快速完成'],
    receivedAt: '昨天',
    previewLines: ['Submit your Q3 workspace preference form before next Monday.'],
    bodyParagraphs: [
      '为了安排下季度办公区域和权限，请在下周一前完成工位偏好登记。',
      '如果你计划长期远程，也请在表单中说明。',
    ],
  },
  'linkedin-product': {
    messageId: 'linkedin-product',
    threadId: 'thread-linkedin-09',
    senderName: 'LinkedIn Jobs',
    senderEmail: 'jobs-noreply@linkedin.com',
    subject: '为你推荐的产品岗位更新',
    shortSummary: '一封标准化职位推荐订阅邮件，没有明确 action 或截止时间。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['职位推荐', '批量推送'],
    itemStatus: 'pending',
    aggregationKey: 'linkedin-digest',
    aggregationLabel: '岗位订阅推送',
    category: '职位订阅',
    focusAreas: ['招聘'],
    focusText: '可以保留作参考，但不值得进入今天的处理列表。',
    reasonBullets: ['标准订阅模板', '无明确时限', '适合集中查看'],
    receivedAt: '昨天',
    previewLines: ['Here are new product manager roles based on your recent searches.'],
    bodyParagraphs: [
      '这里有一批与你最近搜索相关的产品岗位推荐，可按需稍后查看。',
      '这类邮件更适合集中浏览，而不是单独进入今日处理流。',
    ],
  },
  'linkedin-data': {
    messageId: 'linkedin-data',
    threadId: 'thread-linkedin-10',
    senderName: 'LinkedIn Jobs',
    senderEmail: 'jobs-noreply@linkedin.com',
    subject: '为你推荐的数据岗位更新',
    shortSummary: '一封标准化职位推荐订阅邮件，没有明确 action 或截止时间。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['职位推荐', '批量推送'],
    itemStatus: 'pending',
    aggregationKey: 'linkedin-digest',
    aggregationLabel: '岗位订阅推送',
    category: '职位订阅',
    focusAreas: ['招聘'],
    focusText: '可以保留作参考，但不值得进入今天的处理列表。',
    reasonBullets: ['标准订阅模板', '无明确时限', '适合集中查看'],
    receivedAt: '昨天',
    previewLines: ['New data analyst and data scientist jobs are waiting for you.'],
    bodyParagraphs: [
      '系统根据你的浏览记录推荐了一批数据岗位。',
      '如果当前不是集中投递时段，可以晚些统一查看。',
    ],
  },
  'linkedin-growth': {
    messageId: 'linkedin-growth',
    threadId: 'thread-linkedin-11',
    senderName: 'LinkedIn Jobs',
    senderEmail: 'jobs-noreply@linkedin.com',
    subject: '为你推荐的增长岗位更新',
    shortSummary: '一封标准化职位推荐订阅邮件，没有明确 action 或截止时间。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['职位推荐', '批量推送'],
    itemStatus: 'pending',
    aggregationKey: 'linkedin-digest',
    aggregationLabel: '岗位订阅推送',
    category: '职位订阅',
    focusAreas: ['招聘'],
    focusText: '可以保留作参考，但不值得进入今天的处理列表。',
    reasonBullets: ['标准订阅模板', '无明确时限', '适合集中查看'],
    receivedAt: '2 天前',
    previewLines: ['Growth, strategy, and operations roles you may be interested in.'],
    bodyParagraphs: [
      'LinkedIn 为你整理了增长和战略方向的新岗位推荐。',
      '这类内容更适合集中阅读，不必拆成多条独立处理。',
    ],
  },
  'linkedin-remote': {
    messageId: 'linkedin-remote',
    threadId: 'thread-linkedin-12',
    senderName: 'LinkedIn Jobs',
    senderEmail: 'jobs-noreply@linkedin.com',
    subject: '为你推荐的远程岗位更新',
    shortSummary: '一封标准化职位推荐订阅邮件，没有明确 action 或截止时间。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['职位推荐', '批量推送'],
    itemStatus: 'pending',
    aggregationKey: 'linkedin-digest',
    aggregationLabel: '岗位订阅推送',
    category: '职位订阅',
    focusAreas: ['招聘'],
    focusText: '可以保留作参考，但不值得进入今天的处理列表。',
    reasonBullets: ['标准订阅模板', '无明确时限', '适合集中查看'],
    receivedAt: '2 天前',
    previewLines: ['Remote-friendly jobs based on your recent preferences.'],
    bodyParagraphs: [
      '这里有一批远程岗位更新，可根据你之后的求职节奏再集中浏览。',
      '当前没有必须立刻处理的动作。',
    ],
  },
  'notion-newsletter': {
    messageId: 'notion-newsletter',
    threadId: 'thread-notion-13',
    senderName: 'Notion',
    senderEmail: 'team@updates.notion.so',
    subject: 'Notion 本月功能更新',
    shortSummary: '产品更新类 newsletter 可以保留，但不需要今天处理。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['产品更新', 'newsletter'],
    itemStatus: 'pending',
    category: '资讯',
    focusAreas: ['工作'],
    focusText: '适合统一放到低优先级阅读池，避免打断主线任务。',
    reasonBullets: ['信息型内容', '没有动作要求', '阅读收益可以后置'],
    receivedAt: '2 天前',
    previewLines: ['Explore new AI meeting notes and enterprise search updates.'],
    bodyParagraphs: [
      '本月 Notion 上线了 AI meeting notes 和企业搜索增强等能力。',
      '如果当前没有产品调研任务，可以稍后统一阅读。',
    ],
  },
  'aws-webinar': {
    messageId: 'aws-webinar',
    threadId: 'thread-aws-14',
    senderName: 'AWS Events',
    senderEmail: 'events@amazonaws.com',
    subject: '下周线上分享会报名',
    shortSummary: '泛技术社区活动，没有强约束，也和当前项目没有直接关系。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['活动邀请', '泛社区'],
    itemStatus: 'pending',
    category: '活动邀请',
    focusAreas: ['工作'],
    focusText: '保留即可，不建议占用今天的注意力预算。',
    reasonBullets: ['泛兴趣活动', '没有明确截止约束', '对当前任务帮助有限'],
    receivedAt: '2 天前',
    previewLines: ['Join us for a webinar on building resilient cloud pipelines.'],
    bodyParagraphs: [
      '欢迎报名参加下周的线上分享会，我们会介绍云上数据管道的稳定性建设。',
      '这类活动没有立即行动价值，可按空闲时间决定是否参加。',
    ],
  },
  'campus-weekly': {
    messageId: 'campus-weekly',
    threadId: 'thread-campus-15',
    senderName: 'Student Affairs',
    senderEmail: 'weekly@student.university.edu',
    subject: '校园本周活动速览',
    shortSummary: '校园周报更适合集中阅读，不适合进入今日重点流。',
    actionRequired: false,
    priority: 'low',
    reasonTags: ['周报', '资讯聚合'],
    itemStatus: 'pending',
    category: '校园资讯',
    focusAreas: ['学业'],
    focusText: '这是低优先级资讯聚合，保留追溯即可，不需要现在处理。',
    reasonBullets: ['周报聚合内容', '无明确截止时间', '可在空闲时浏览'],
    receivedAt: '2 天前',
    previewLines: ['This week on campus: talks, clubs, wellness events, and more.'],
    bodyParagraphs: [
      '本周校园活动包含讲座、社团和健康活动等内容，可按兴趣选择参加。',
      '如果当前正处在项目或求职冲刺阶段，可以稍后统一查看。',
    ],
  },
}

const todayFocusIds = {
  mustHandleItems: ['q3-review', 'amazon-interview', 'career-fair'],
  worthAttentionItems: ['visa-check', 'finance-report'],
}

const todoSectionBlueprint = [
  {
    sectionKey: 'reply',
    sectionTitle: '需要回复',
    itemIds: ['amazon-interview'],
  },
  {
    sectionKey: 'register',
    sectionTitle: '需要报名 / 投票',
    itemIds: ['career-fair', 'team-offsite'],
  },
  {
    sectionKey: 'submit',
    sectionTitle: '需要提交 / 填表',
    itemIds: ['q3-review', 'workspace-booking'],
  },
  {
    sectionKey: 'confirm',
    sectionTitle: '需要确认 / 审批',
    itemIds: ['visa-check', 'expense-approval'],
  },
]

const dueSoonIds = {
  todayItems: ['q3-review'],
  next48hItems: ['amazon-interview', 'career-fair'],
  thisWeekItems: ['visa-check', 'expense-approval', 'team-offsite'],
}

const ignorableIds = [
  'linkedin-product',
  'linkedin-data',
  'linkedin-growth',
  'linkedin-remote',
  'notion-newsletter',
  'aws-webinar',
  'campus-weekly',
]

const inboxOrder = [
  'q3-review',
  'amazon-interview',
  'career-fair',
  'finance-report',
  'visa-check',
  'expense-approval',
  'team-offsite',
  'workspace-booking',
  'linkedin-product',
  'linkedin-data',
  'linkedin-growth',
  'linkedin-remote',
  'notion-newsletter',
  'aws-webinar',
  'campus-weekly',
]

const withStatus = (record: MailRecord, statusMap: StatusMap): MailRecord => ({
  ...record,
  itemStatus: statusMap[record.messageId] ?? record.itemStatus,
})

const includesText = (value: string | undefined, query: string) =>
  (value ?? '').toLowerCase().includes(query.trim().toLowerCase())

const matchesSenderTerm = (record: MailRecord, term: string) => {
  const normalizedTerm = term.trim().toLowerCase()

  if (!normalizedTerm) {
    return false
  }

  return (
    record.senderName.toLowerCase() === normalizedTerm ||
    record.senderEmail?.toLowerCase() === normalizedTerm ||
    record.senderName.toLowerCase().includes(normalizedTerm) ||
    record.senderEmail?.toLowerCase().includes(normalizedTerm)
  )
}

const matchesFilters = (record: MailRecord, filters?: PanelFilters) => {
  if (!filters) {
    return true
  }

  const hasSenderFilter =
    filters.senderNames.length > 0 || Boolean(filters.customSenderQuery?.trim())
  const hasFocusFilter =
    filters.focusTopics.length > 0 || Boolean(filters.customFocusQuery?.trim())

  const senderMatched =
    !hasSenderFilter ||
    filters.senderNames.some((term) => matchesSenderTerm(record, term)) ||
    includesText(record.senderName, filters.customSenderQuery ?? '') ||
    includesText(record.senderEmail, filters.customSenderQuery ?? '')

  const focusMatched =
    !hasFocusFilter ||
    filters.focusTopics.some((topic) => record.focusAreas.includes(topic)) ||
    includesText(record.category, filters.customFocusQuery ?? '') ||
    includesText(record.subject, filters.customFocusQuery ?? '') ||
    includesText(record.shortSummary, filters.customFocusQuery ?? '') ||
    record.focusAreas.some((topic) => includesText(topic, filters.customFocusQuery ?? ''))

  return senderMatched && focusMatched
}

const asMailListItem = (record: MailRecord): MailListItem => ({
  messageId: record.messageId,
  threadId: record.threadId,
  senderName: record.senderName,
  senderEmail: record.senderEmail,
  subject: record.subject,
  shortSummary: record.shortSummary,
  actionRequired: record.actionRequired,
  actionLabel: record.actionLabel,
  deadlineText: record.deadlineText,
  deadlineTs: record.deadlineTs,
  priority: record.priority,
  reasonTags: record.reasonTags,
  itemStatus: record.itemStatus,
  aggregationKey: record.aggregationKey,
  aggregationLabel: record.aggregationLabel,
})

const mapFilteredItems = (ids: string[], statusMap: StatusMap, filters?: PanelFilters) =>
  ids
    .map((id) => withStatus(mailRecords[id], statusMap))
    .filter((record) => matchesFilters(record, filters))
    .map(asMailListItem)

const uniqueCount = (
  ids: string[],
  statusMap: StatusMap,
  filters?: PanelFilters,
  predicate: (record: MailRecord) => boolean = () => true,
) =>
  Array.from(new Set(ids)).filter((id) => {
    const record = withStatus(mailRecords[id], statusMap)
    return (
      record.itemStatus === 'pending' &&
      matchesFilters(record, filters) &&
      predicate(record)
    )
  }).length

export const initialStatusMap = Object.keys(mailRecords).reduce(
  (collection, messageId) => {
    collection[messageId] = 'pending'
    return collection
  },
  {} as Record<string, ItemStatus>,
)

export const buildPanelData = (
  statusMap: StatusMap,
  activeTab: TabKey,
  filters?: PanelFilters,
): ExpandedPanelData => ({
  meta: panelMeta,
  overview: {
    highPriorityCount: Object.values(mailRecords).filter((record) => {
      const current = withStatus(record, statusMap)
      return (
        current.priority === 'high' &&
        current.itemStatus === 'pending' &&
        matchesFilters(current, filters)
      )
    }).length,
    todoCount: uniqueCount(
      Object.values(mailRecords)
        .filter((record) => record.actionRequired)
        .map((record) => record.messageId),
      statusMap,
      filters,
    ),
    dueSoon48hCount: uniqueCount(
      [...dueSoonIds.todayItems, ...dueSoonIds.next48hItems],
      statusMap,
      filters,
    ),
    ignorableCount: uniqueCount(ignorableIds, statusMap, filters),
  },
  activeTab,
  todayFocus: {
    mustHandleItems: mapFilteredItems(todayFocusIds.mustHandleItems, statusMap, filters),
    worthAttentionItems: mapFilteredItems(todayFocusIds.worthAttentionItems, statusMap, filters),
  },
  todo: {
    sections: todoSectionBlueprint.map((section) => ({
      sectionKey: section.sectionKey,
      sectionTitle: section.sectionTitle,
      items: mapFilteredItems(section.itemIds, statusMap, filters),
    })),
  },
  dueSoon: {
    todayItems: mapFilteredItems(dueSoonIds.todayItems, statusMap, filters),
    next48hItems: mapFilteredItems(dueSoonIds.next48hItems, statusMap, filters),
    thisWeekItems: mapFilteredItems(dueSoonIds.thisWeekItems, statusMap, filters),
  },
  ignorable: {
    ignorableItems: mapFilteredItems(ignorableIds, statusMap, filters),
  },
})

export const getMailRecord = (
  messageId: string,
  statusMap: StatusMap,
): MailRecord | undefined => {
  const record = mailRecords[messageId]

  if (!record) {
    return undefined
  }

  return withStatus(record, statusMap)
}

export const getMailDetail = (
  messageId: string,
  statusMap: StatusMap,
): MailInsightDetail | undefined => {
  const record = getMailRecord(messageId, statusMap)

  if (!record) {
    return undefined
  }

  return {
    messageId: record.messageId,
    threadId: record.threadId,
    senderName: record.senderName,
    senderEmail: record.senderEmail,
    subject: record.subject,
    category: record.category,
    priority: record.priority,
    focusText: record.focusText,
    suggestedAction: record.suggestedAction,
    deadlineDisplay: record.deadlineDisplay,
    reasonBullets: record.reasonBullets,
  }
}

export const getInboxItems = (statusMap: StatusMap) =>
  inboxOrder.map((messageId) => asMailListItem(withStatus(mailRecords[messageId], statusMap)))

export const getFrequentSenderOptions = (
  clickCounts: Record<string, number>,
): SenderOption[] => {
  const sortedHistory = Object.entries(clickCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .map(([senderName, count]) => ({
      value: senderName,
      label: `@${senderName}`,
      count,
    }))

  const merged: SenderOption[] = [...sortedHistory]

  for (const senderName of fallbackFrequentSenders) {
    if (!merged.find((item) => item.value === senderName)) {
      merged.push({
        value: senderName,
        label: `@${senderName}`,
        count: clickCounts[senderName] ?? 0,
      })
    }
  }

  return merged.slice(0, 2)
}

export const getSenderHistoryEntries = (
  clickCounts: Record<string, number>,
): HistoryEntry[] =>
  Object.entries(clickCounts)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, 4)
    .map(([senderName, count]) => ({
      senderName,
      count,
    }))
