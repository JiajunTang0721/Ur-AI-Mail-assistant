# 首次联调自查顺序

这份清单适用于当前项目的本机测试场景：

- 本地 Gmail 页面
- 本地 Chrome 扩展
- 本地 FastAPI 后端
- OpenAI API

## 1. 先确认 `.env`

至少要有这些值：

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=你的_google_oauth_client_id.apps.googleusercontent.com
VITE_LMA_API_BASE_URL=http://127.0.0.1:8010

OPENAI_API_KEY=你的_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=45
LLM_PROVIDER=openai
```

## 2. 先确认 Google Cloud 配置

需要同时满足：

- 已启用 `Gmail API`
- 已配置 `Google Auth Platform`
- `目标对象` 是 `External`
- 当前处于 `Testing`
- `Test users` 里已经加入你自己的 Gmail
- `数据访问` 里已经加上 `gmail.readonly`
- `客户端` 里创建了 `Chrome Extension` OAuth client
- `Item ID` 与你当前扩展 ID 一致

## 3. 先确认后端

启动命令：

```powershell
cd <repo-root>
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

健康检查：

打开 [http://127.0.0.1:8010/health](http://127.0.0.1:8010/health)

预期结果：

```json
{"status":"ok"}
```

## 4. 重新构建扩展

```powershell
cd <repo-root>
npm run build:extension
```

## 5. 重新加载扩展

在 `chrome://extensions`：

- 找到 `Lark Mail Assistant`
- 点击“重新加载”

## 6. 刷新 Gmail 页面

这一条非常重要。

只要你刚刚做过这些动作中的任意一个：

- 修改了扩展代码
- 重新 build
- 重新加载扩展

都必须重新刷新 Gmail 页面。

否则 Gmail 页面里还挂着旧 content script，很容易出现：

- `Extension context invalidated`
- 按钮没反应
- 面板排版错乱

## 7. 再打开右侧助手

推荐顺序：

1. 刷新 Gmail 页面
2. 点击浏览器右上角扩展图标
3. 打开右侧助手
4. 点击 `连接 Gmail`

## 8. 看顶部状态文案

### 情况 A

看到：

- `已用 LLM 分析 X 封邮件`

说明 Gmail OAuth、FastAPI、OpenAI 全部接通。

### 情况 B

看到：

- `当前由规则引擎分析 X 封邮件`

说明：

- Gmail 读取成功
- 后端接口成功
- 但 OpenAI 没有跑起来

优先检查：

- `OPENAI_API_KEY`
- `LLM_PROVIDER=openai`
- 后端控制台是否报错

### 情况 C

看到：

- `先连接 Gmail`

说明 Gmail OAuth 还没完成，或者授权已经失效。

优先检查：

- Google Cloud `Test users`
- `Chrome Extension` OAuth client 的 `Item ID`
- 当前 Gmail 账号是不是你加入测试名单的那个账号

## 9. 如果看到 `Extension context invalidated`

先不要继续点按钮，按这个顺序处理：

1. 回到 `chrome://extensions`
2. 确认扩展已经重新加载完成
3. 回到 Gmail 页面
4. 直接整页刷新
5. 刷新后再打开助手

如果刷新后仍然出现：

- 基本说明当前页面还在执行旧脚本，或者扩展刚被重载过但页面没完全重建

这时最稳妥的做法是：

1. 关闭当前 Gmail 标签页
2. 新开一个 Gmail 标签页
3. 再点击扩展图标打开助手
