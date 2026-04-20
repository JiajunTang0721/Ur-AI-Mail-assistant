# Gmail OAuth、多人测试与 OpenAI 配置指南

这份文档分成两个场景：

1. 你先在自己电脑上把项目跑通
2. 你把项目发给其他测试者，让他们也能在自己的电脑上试用

## 1. 你需要准备什么

### 1.1 本地文件

- 项目根目录 `.env`
- `backend/requirements.txt`
- 构建输出目录 `dist-extension/`

### 1.2 外部配置

- 一个 Google Cloud 项目
- 已启用的 `Gmail API`
- 一个 `Chrome Extension` 类型的 OAuth Client
- 一个 OpenAI API Key
- 如果要多人共用同一个扩展 ID，还需要一个固定扩展公钥

## 2. Google Cloud 基础配置

## 2.1 创建或选择 Google Cloud 项目

1. 打开 Google Cloud Console
2. 新建一个项目，或选择现有项目

## 2.2 启用 Gmail API

1. 进入 `APIs & Services`
2. 打开 `Library`
3. 搜索 `Gmail API`
4. 点击启用

## 2.3 配置 Google Auth Platform

新版 Google Cloud 界面里，原先的 OAuth consent screen 被拆成了这些栏目：

- `品牌塑造`
- `目标对象`
- `数据访问`
- `客户端`

### 2.3.1 品牌塑造

填写：

- 应用名称
- 支持邮箱
- 开发者联系邮箱

### 2.3.2 目标对象

本地联调或多人内测阶段建议：

- 选择 `External`
- 保持在 `Testing`

### 2.3.3 数据访问

添加 scope：

- `https://www.googleapis.com/auth/gmail.readonly`

### 2.3.4 客户端

创建 OAuth Client：

- `Application type` 选择 `Chrome Extension`
- `Item ID` 填扩展 ID

创建完成后会拿到一个 `client_id`，后面要写进 `.env`。

## 3. 如何把对方 Gmail 加进 Test users

在 2026 年 4 月这版 Google Cloud 界面里，入口通常在：

- `Google Auth Platform`
- `目标对象`
- `Test users`

操作步骤：

1. 打开你的 Google Cloud 项目
2. 进入 `Google Auth Platform`
3. 点击左侧 `目标对象`
4. 确认当前应用状态还是 `Testing`
5. 在 `Test users` 区域点击 `Add users`
6. 输入对方的 Gmail 地址
7. 点击 `Save`

说明：

- 只有被加入 `Test users` 的账号，才能在 `Testing` 阶段完成 Gmail 授权
- 如果对方不在名单里，扩展能加载，但 Gmail 授权会失败

## 4. 如何固定扩展 ID

这是多人测试最重要的一步。

原因是：Google Cloud 里的 `Chrome Extension` OAuth Client 绑定的是 `Item ID`。如果每个测试者本地加载后拿到的扩展 ID 都不同，你就没法在 Google Cloud 里只配置一次。

Chrome 官方支持在 `manifest.json` 里使用 `key` 字段来保持扩展 ID 稳定。官方文档见：[manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)

## 4.1 获取固定公钥

推荐流程：

1. 把当前扩展目录打包成 zip
2. 打开 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. 点击 `Add new item`
4. 上传 zip，但先不用发布
5. 进入该扩展的 `Package` 页面
6. 点击 `View public key`
7. 复制 `-----BEGIN PUBLIC KEY-----` 和 `-----END PUBLIC KEY-----` 中间的内容
8. 去掉所有换行，整理成一整行

得到的这一整行内容，就是固定扩展 ID 所需的公钥。

### 4.1.1 如果你卡在 Chrome Web Store 后台第二步

最常见的原因不是 zip 错了，而是你还没有完成 Chrome Web Store 开发者账号注册。

按 Chrome 官方文档，第一次进入 Developer Dashboard 时，需要先：

1. 同意开发者协议
2. 支付一次性开发者注册费用

做完之后，`Add new item` 才会稳定可用。官方说明见：

- [Register your developer account](https://developer.chrome.com/docs/webstore/register/)
- [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish/)

如果你只是为了固定扩展 ID 做内测，其实可以跳过这条路线，直接使用下面的“本地生成公钥”方案。

### 4.1.2 不走 Web Store，直接本地生成固定公钥

如果你现在只是想先把扩展 ID 固定下来，最快的方法是本地生成一对 RSA 密钥，并把公钥写进 `.env`。

在项目根目录运行：

```powershell
cd <repo-root>
@'
const { generateKeyPairSync } = require("node:crypto");
const { writeFileSync } = require("node:fs");

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

writeFileSync("extension-private-key.pem", privateKey, "utf8");
writeFileSync("extension-public-key.txt", publicKey.toString("base64"), "utf8");

console.log(publicKey.toString("base64"));
'@ | node -
```

运行后会得到两个文件：

- `extension-private-key.pem`
- `extension-public-key.txt`

其中：

- `extension-public-key.txt` 里的整行内容，填到 `.env` 的 `CHROME_EXTENSION_PUBLIC_KEY`
- `extension-private-key.pem` 需要自己保管，不要随便发给别人

然后：

1. 重新 `npm run build:extension`
2. 去 `chrome://extensions` 加载 `dist-extension`
3. 记录扩展 ID
4. 回 Google Cloud，把这个扩展 ID 填进 `Chrome Extension` OAuth Client 的 `Item ID`

这样就能先完成多人测试，不必被 Web Store 后台卡住。

## 4.2 在当前项目中怎么配置

这个项目现在已经支持通过环境变量把固定公钥自动写进构建后的 `manifest.json`。

在 `.env` 中增加：

```env
CHROME_EXTENSION_PUBLIC_KEY=你的单行公钥
```

然后重新构建：

```powershell
cd <repo-root>
npm run build:extension
```

构建后，`dist-extension/manifest.json` 会自动带上 `key` 字段。

## 4.3 如何确认已经固定成功

1. 去 `chrome://extensions`
2. 重新加载 `dist-extension`
3. 记录当前扩展 ID
4. 对比它和你在 Chrome Web Store Developer Dashboard 里看到的 Item ID

如果两者一致，就说明固定成功。

这时你在 Google Cloud 里只需要把这一个 `Item ID` 配给 OAuth Client，所有测试者都能共用。

## 5. `.env` 应该怎么填

先复制模板：

```powershell
cd <repo-root>
Copy-Item .env.example .env
```

多人内测推荐至少填这些：

```env
VITE_GOOGLE_OAUTH_CLIENT_ID=你的_google_oauth_client_id.apps.googleusercontent.com
VITE_LMA_API_BASE_URL=http://127.0.0.1:8010
CHROME_EXTENSION_PUBLIC_KEY=你的单行公钥

OPENAI_API_KEY=你的_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=45
LLM_PROVIDER=openai
```

## 5.1 每个字段从哪里来

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Google Cloud 的 OAuth Client 页面 | 扩展做 Gmail 授权 |
| `VITE_LMA_API_BASE_URL` | 你本机或你部署的后端地址 | 本地联调通常是 `http://127.0.0.1:8010` |
| `CHROME_EXTENSION_PUBLIC_KEY` | Chrome Web Store Developer Dashboard 的 public key | 固定扩展 ID |
| `OPENAI_API_KEY` | OpenAI 平台 | 后端调用模型 |
| `OPENAI_MODEL` | 项目内配置 | 默认推荐 `gpt-5.4-mini` |
| `OPENAI_BASE_URL` | OpenAI 官方地址 | 通常固定为 `https://api.openai.com/v1` |
| `OPENAI_TIMEOUT_SECONDS` | 项目内配置 | 默认 `45` |
| `LLM_PROVIDER` | 项目内配置 | 用 OpenAI 时填 `openai` |

## 5.2 关于安全

- `OPENAI_API_KEY` 只应该在后端使用
- 不要把它写进扩展前端逻辑里
- 如果曾经把 API Key 发到公开位置，建议立刻旋转新 key

## 6. 单人本地联调流程

### 6.1 启动后端

```powershell
cd <repo-root>
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

健康检查：

[http://127.0.0.1:8010/health](http://127.0.0.1:8010/health)

### 6.2 构建并加载扩展

```powershell
cd <repo-root>
npm install
npm run build:extension
```

然后：

1. 打开 `chrome://extensions`
2. 打开“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择 `<repo-root>/dist-extension`
5. 回到 Gmail 强制刷新

### 6.3 首次 Gmail 授权

1. 打开 Gmail
2. 点击浏览器右上角扩展图标
3. 打开右侧助手
4. 点击 `连接 Gmail`
5. 选择 Google 账号
6. 完成授权

如果顶部显示：

- `已用 LLM 分析 X 封邮件`

说明链路已经打通。

## 7. 多人内测时该怎么发给别人

建议发整个项目根目录压缩包，而不是只发 `dist-extension`。

推荐保留：

- `backend/`
- `extension/`
- `src/`
- `docs/`
- `package.json`
- `package-lock.json`
- `.env.example`

建议不要直接发：

- `.env`
- `node_modules/`
- `dist/`
- `dist-extension/`
- `.git/`
- `backend/data/preferences.json`

### 7.1 对方拿到后要做的事

1. 解压项目
2. 复制 `.env.example` 为 `.env`
3. 填自己的 OpenAI Key
4. 保持你给出的 Google OAuth Client ID 和固定扩展公钥
5. 启动本地 FastAPI
6. 构建扩展
7. 加载 `dist-extension`
8. 打开 Gmail，完成授权

### 7.2 你要为测试者做什么

1. 把他们的 Gmail 加进 `Test users`
2. 提供统一的 `VITE_GOOGLE_OAUTH_CLIENT_ID`
3. 提供统一的 `CHROME_EXTENSION_PUBLIC_KEY`
4. 确保 Google Cloud 里 `Chrome Extension` OAuth Client 的 `Item ID` 已经对应固定扩展 ID

## 8. 如果以后要给所有用户使用

本地测试和正式对外不是一回事。要给所有用户使用，还要继续做这些：

1. 固定扩展 ID
2. 把 OAuth 从 `Testing` 推到 `Production`
3. 为 `gmail.readonly` 做 Google 验证
4. 把 FastAPI 部署到公网
5. 把 `VITE_LMA_API_BASE_URL` 改成线上地址
6. 最好把用户历史、偏好、反馈迁移到服务端账号体系

## 9. 官方参考

- [Chrome Extensions OAuth](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)
- [Chrome manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key)
- [Chrome identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Google Workspace 创建凭据](https://developers.google.com/workspace/guides/create-credentials)
- [Google 配置 OAuth 同意界面](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Google 敏感权限验证](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
