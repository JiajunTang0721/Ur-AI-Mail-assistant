# 可忽略板块判定规则

本规则用于约束 `board_type = ignore` 的判定，并作为前后端一致执行的核对标准。

## 1. 总原则

1. 每封邮件必须只落在一个板块中，`ignore` 是其中之一。
2. `ignore` 是板块语义，不等于优先级链路本身，但两者应保持语义一致。
3. `ignore` 邮件仍需输出独立的 `priority_score / priority_level`。
4. 正常情况下，`ignore` 板块应主要对应 `low` 或 `ignore` 优先级；若出现 `board_type = ignore` 但 `priority_level = high`，应视为待复核冲突样本。

## 2. 基础判定思路

邮件更适合进入 `ignore` 板块，通常同时满足以下条件：

- 不命中重点寄件人
- 不命中用户关注标签或自定义关注内容
- 命中营销、订阅、批量群发、低价值通知等干扰信号
- 没有明确动作要求
- 没有明确近期待办或截止时间
- 不属于事务确认类邮件

## 3. 直接判定为可忽略的常见场景

以下场景默认优先进入 `ignore`：

- 旅行、电商、品牌类促销邮件
- 各类营销 campaign、品牌广告推送
- newsletter、digest、推荐合集、内容精选
- 与用户当前工作、学业、申请、账单无直接关系的群发推广
- 招聘平台的职位推荐、职位订阅、岗位合集

## 4. 旅行平台的强规则

以下来源命中后，需要重点识别：

- `trip.com`
- `booking`
- `agoda`
- `expedia`
- `hotels.com`
- `travelocity`
- `skyscanner`
- `kayak`
- `priceline`
- `traveloka`
- `airasia`
- `hopper`
- `ctrip`

当来源命中上述平台，且正文或主题出现以下营销信号时，应直接进入 `ignore`：

- `promotion`
- `promo`
- `sale`
- `deal`
- `discount`
- `offer`
- `flash sale`
- `limited time`
- `hotel deal`
- `travel deal`
- `coupon`
- `save up to`
- `member deal`
- `member price`
- `price alert`
- `price drop`
- `exclusive`
- `special offer`
- `travel inspiration`
- `destination guide`
- `weekend getaway`
- `book now`
- `unsubscribe`
- `newsletter`
- `digest`

## 5. 不应误判为可忽略的排除场景

以下属于交易型、事务型或必须保留在非忽略板块中的内容：

- 订单确认
- 预订确认
- 付款成功
- 发票或收据
- 行程单
- 票务信息
- 登机 / check-in 提醒
- 带有明确截止时间的正式通知
- 带有明确动作要求的事务邮件

重点排除特征包括：

- `confirmation`
- `confirmed`
- `receipt`
- `invoice`
- `ticket`
- `booking id`
- `reservation`
- `itinerary`
- `check-in`
- `boarding`
- `payment received`

## 6. 普通营销邮件规则

对于非旅行平台来源的普通营销类邮件，满足以下条件时应判定为 `ignore`：

- 命中营销 / 订阅 / digest / newsletter 特征
- 没有明确动作要求
- 没有明确截止时间
- 不属于事务确认类邮件

即便邮件文本表面上命中了某个用户关注词，如果内容本质仍是推广、宣传或批量订阅，也应优先进入 `ignore`，而不是因为关键词碰撞就进入其他板块。

## 7. 招聘平台推荐邮件的特殊规则

以下邮件默认视为 `ignore`：

- LinkedIn / 领英 职位推荐
- Job Alert / Jobs for you / Recommended jobs
- 岗位推荐、职位订阅、猜你喜欢、相似岗位合集
- 招聘平台批量岗位推送、周报、日报、合集卡片

只有在命中以下事务型信号时，招聘平台邮件才不应进入 `ignore`：

- 面试通知
- 笔试 / 测评通知
- 已投递后的进度更新
- `application update`
- `application status`
- `offer`
- `next step`
- 明确要求补充材料、确认时间、完成某一步操作

换句话说：

- “推荐你看岗位”属于 `ignore`
- “你已投递，这里是下一步操作”不属于 `ignore`

## 8. 与其他系统结果的关系

- `ignore` 板块不代表前端直接丢弃邮件，只是放入“当前可忽略”区域
- `ignore` 板块中的邮件仍应保留查看原邮件能力
- 板块导航计数必须基于最终 `board_type` 统计，不能把 `ignore` 邮件重复计入其他板块

## 9. 落地执行要求

- 同步分析结果返回后，可保留前端本地兜底忽略规则，防止明显促销邮件混入其他板块
- 若待处理或 48h 列表中存在命中强忽略规则的邮件，应在下一次同步或重排后移出
- 若用户显式将某类来源连续点击“少显示”，可把该反馈作为 `ignore` 板块的辅助信号，但不应直接替代事务型排除规则
