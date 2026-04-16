# FastAPI 鍚庣

杩欓噷鏄偖浠舵櫤鑳藉垎绫讳笌浼樺厛绾ц緟鍔╃郴缁熺殑鍒嗘瀽鍚庣銆傚畠鐨勮亴璐ｄ笉鏄畝鍗曠粰閭欢璐翠竴涓爣绛撅紝鑰屾槸瀹屾垚浠ヤ笅閾捐矾锛?
1. 鎺ユ敹 Gmail 瑙勮寖鍖栭偖浠舵暟鎹?2. 鍚堝苟褰撳墠椤圭洰涓凡缁忓瓨鍦ㄧ殑鍋忓ソ銆佽鍒欍€佸弽棣堝拰绾跨▼涓婁笅鏂?3. 璋冪敤 LLM 杈撳嚭鍥哄畾 schema 鐨勭粨鏋勫寲鐗瑰緛
4. 鐙珛鍒ゆ柇 `board_type`
5. 鐙珛璁＄畻 `priority_score / priority_level`
6. 灏嗙粨鏋滆繑鍥炵粰鐜版湁鍓嶇鍥涙澘鍧楀睍绀?
## 褰撳墠鐩爣杈撳嚭

姣忓皝閭欢閮藉繀椤诲悓鏃跺緱鍒颁袱绫荤粨鏋滐細

- `board_type`
  - `priority_content`
  - `within_48h`
  - `todo`
  - `ignore`
- `priority_score` / `priority_level`
  - `priority_score 鈭?[0,1]`
  - `priority_level 鈭?{high, medium, low, ignore}`

娉ㄦ剰锛?
- `board_type` 鍐冲畾閭欢鍑虹幇鍦ㄧ幇鏈夊墠绔摢涓澘鍧?- `priority_level` 鍐冲畾棰滆壊涓庢帓搴忓弬鑰?- 涓よ€呬笉鑳戒簰鐩告浛浠?
## 褰撳墠鎺ュ彛鐩爣

鍚庣閲嶆瀯鍚庣殑鐩爣鎺ュ彛浠?[docs/api-contract-v1.md](../docs/api-contract-v1.md) 涓哄噯锛屾牳蹇冨寘鎷細

- `GET /health`
- `POST /api/v1/analyze/messages`
- `POST /api/v1/feedback`
- `POST /api/v1/reanalyze`
- `GET /api/v1/preferences`
- `POST /api/v1/preferences`
- `GET /api/v1/mail/:messageId/insight`

## 鍒嗘瀽闃舵

`POST /api/v1/analyze/messages` 搴旀寜浠ヤ笅椤哄簭鎵ц锛?
1. 璇诲彇 Gmail 瑙勮寖鍖栧瓧娈?2. 鍚堝苟椤圭洰宸叉湁涓婁笅鏂?3. 浼樺厛璋冪敤 LLM 鍋氱粨鏋勫寲鐗瑰緛鎶藉彇
4. 鑻?LLM 涓嶅彲鐢ㄦ垨澶辫触锛屽垯鐢辫鍒欏眰鍏滃簳
5. 鏍规嵁瑙勫垯鎴栨贩鍚堥€昏緫杈撳嚭 `board_type`
6. 浣跨敤鏈湴妯″瀷杈撳嚭 `priority_score / priority_level`
7. 杩斿洖瑙ｉ噴瀛楁銆佹帓搴忓瓧娈靛拰璁℃暟

## 褰撳墠椤圭洰涓簲杩涘叆鍚庣鐨勪笂涓嬫枃

鎵╁睍灞傚凡缁忔寔鏈夌殑寰堝鐘舵€侀兘搴旇繘鍏ュ垎鏋愰摼璺紝鑰屼笉鏄彧鍋滅暀鍦ㄥ墠绔細

- `selectedSenders`
- `selectedFocuses`
- `customSenderValue`
- `customFocusValue`
- `importantSenderNames`
- `notImportantSenderNames`
- `mutedSenderNames`
- `analysisHistory`
- `feedbackHistory`
- `processedMessageIds`
- `hiddenMessageIds`

杩欎簺杈撳叆鐨勮涔夋槸鈥滃垎鏋愪笌鍋忓ソ涓婁笅鏂団€濓紝涓嶆槸纭繃婊ゆ潯浠躲€?
## LLM 鎻愪緵鏂?
褰撳墠浠撳簱宸蹭繚鐣欎袱绉?LLM 鏉ユ簮锛?
- OpenAI
- 鏈湴 Ollama

鍦ㄦ柊鐨勬枃妗ｇ害鏉熶笅锛孡LM 杈撳嚭蹇呴』鏄浐瀹?schema 鐨勭壒寰?JSON锛岃€屼笉鏄嚜鐢辨枃鏈鏄庛€?
## 鐜鍙橀噺

鍚庣榛樿璇诲彇浠撳簱鏍圭洰褰?`.env`锛?
```env
OPENAI_API_KEY=浣犵殑 OpenAI API Key
OPENAI_MODEL=gpt-5.4-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_TIMEOUT_SECONDS=45
LLM_PROVIDER=auto
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=
```

濡傛灉闇€瑕佹湰鍦版ā鍨嬶細

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
```

## 瀹夎渚濊禆

```bash
python -m pip install -r backend/requirements.txt
```

## 鍚姩

```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

## 鏈湴浼樺厛绾фā鍨嬭姹?
浼樺厛绾фā鍨嬪涔犵殑鏄敤鎴峰閭欢閲嶈绋嬪害鐨勫績鐞嗛鏈燂紝涓嶆槸鏉垮潡褰掑睘鏈韩銆傚缓璁洰鏍囧舰寮忎负锛?
```text
Z = sigmoid(尾^T X)
```

鍏朵腑锛?
- `X` 涓洪偖浠剁壒寰佸悜閲?- `尾` 涓烘ā鍨嬫潈閲?- `Z` 涓轰紭鍏堢骇鍒嗘暟

鍐嶉€氳繃闃堝€兼槧灏勫埌锛?
- `high`
- `medium`
- `low`
- `ignore`

## 鐢ㄦ埛鍋忓ソ绾︽潫

鐢ㄦ埛瀵瑰叧娉ㄩ『搴忋€佽嚜瀹氫箟鍐呭鍜岄噸鐐瑰瘎浠朵汉鐨勮缃紝蹇呴』鐩存帴杩涘叆鐗瑰緛鍜屾ā鍨嬮摼璺€?
渚嬪鐢ㄦ埛璁剧疆锛?
1. 瀛︿笟
2. 鎷涜仒

鍒欐ā鍨嬪拰鎺掑簭閫昏緫閮藉簲浣撶幇锛?
- 瀛︿笟鐩稿叧鐗瑰緛鏉冮噸 > 鎷涜仒鐩稿叧鐗瑰緛鏉冮噸
- 涓よ€呴兘楂樹簬鏅€?tag 鏉冮噸

## 杩佺Щ鎻愰啋

褰撳墠浠ｇ爜閲屽鏋滀粛瀛樺湪灏?`priority` 鍜?`tab` 缁戝畾杈撳嚭鐨勬棫瀹炵幇锛屽簲鍦ㄥ悗缁噸鏋勪腑缁熶竴鏇挎崲涓猴細

- `board_type`
- `priority_score`
- `priority_level`

浠ュ厤缁х画鎶娾€滄澘鍧楄涔夆€濆拰鈥滈噸瑕佺▼搴﹁涔夆€濇贩涓轰竴浣撱€?
