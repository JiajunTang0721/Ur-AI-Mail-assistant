# 閭欢鏅鸿兘鍒嗙被涓庝紭鍏堢骇杈呭姪绯荤粺

杩欐槸涓€涓潰鍚?Gmail 鐨?Chrome Extension锛圡V3锛? FastAPI 椤圭洰銆備粨搴撻噷宸茬粡鏈夊彲杩愯鐨勫墠绔師鍨嬨€丟mail 鎵╁睍娉ㄥ叆閾捐矾銆佸悗绔垎鏋愰鏋跺拰涓€鎵圭幇鎴愮殑鏈湴鐘舵€侊紱鏈疆鏂囨。閲嶆瀯鐨勭洰鏍囷紝鏄妸鏁翠釜绯荤粺缁熶竴鍒版柊鐨勫弻缁村害鏋舵瀯涓婏細

- 鏉垮潡褰掑睘锛氶偖浠跺簲璇ュ睍绀哄湪鍝釜鏉垮潡
- 浼樺厛绾э細閭欢鏈韩鐨勯噸瑕佺▼搴?
涓よ€呭繀椤昏В鑰︼紝涓嶈兘鍐嶆妸鈥滃湪鍝釜鏉垮潡灞曠ず鈥濆拰鈥滈偖浠舵湁澶氶噸瑕佲€濇贩鎴愪竴濂楀垎绫汇€?
## 褰撳墠鍓嶇鍥哄畾缁撴瀯

鐜版湁鍓嶇缁х画淇濈暀 4 涓睍绀烘澘鍧楋細

- 浼樺厛鍐呭
- 48h
- 寰呭鐞?- 鍙拷鐣?
绯荤粺蹇呴』涓烘瘡灏侀偖浠剁嫭绔嬭緭鍑猴細

- `board_type`锛歚priority_content | within_48h | todo | ignore`
- `priority_score`锛歚0 ~ 1`
- `priority_level`锛歚high | medium | low | ignore`

鍏朵腑锛?
- `board_type` 璐熻矗鍐冲畾閭欢鍑虹幇鍦ㄧ幇鏈夊墠绔殑鍝釜鏉垮潡
- `priority_level` 鍙礋璐ｉ鑹叉爣璁般€佸悓鏉垮潡鍐呮帓搴忚緟鍔╁拰鍙嶉瀛︿範

## 椤圭洰缁撴瀯

- `src/`锛歊eact 鍓嶇鍘熷瀷涓庣粍浠堕獙璇佸眰
- `extension/`锛欳hrome Extension MV3銆丟mail OAuth銆侀偖浠舵姄鍙栥€佹湰鍦扮姸鎬佷笌鍙嶉
- `backend/`锛欶astAPI 鍒嗘瀽鏈嶅姟銆佽鍒欏眰銆丩LM 鐗瑰緛鎶藉彇銆佹ā鍨嬪叆鍙?- `docs/`锛氭灦鏋勮鏄庛€佹帴鍙ｅ绾︺€佽鍒欐枃妗ｃ€侀厤缃笌鎺掓煡鎵嬪唽
- `dist-extension/`锛氭墿灞曟瀯寤轰骇鐗╋紙Chrome 鍔犺浇鐩綍锛?
## 鏂扮増鐩爣鍒嗘瀽閾捐矾

1. 浠?Gmail 鑾峰彇鍘熷閭欢鏁版嵁
2. 鍚堝苟褰撳墠椤圭洰涓凡缁忓瓨鍦ㄧ殑璁剧疆銆佽鍒欍€佸亸濂姐€佺嚎绋嬩笂涓嬫枃鍜屽弽棣堝巻鍙?3. 璋冪敤 `.env` 涓厤缃殑 OpenAI API Key 鍋氱粨鏋勫寲鐗瑰緛鎶藉彇
4. 鐙珛杈撳嚭 `board_type`
5. 鐙珛杈撳嚭 `priority_score / priority_level`
6. 灏嗙粨鏋滃啓鍏ユ暟鎹簱鎴栨湰鍦版寔涔呭眰
7. 浜ょ粰鐜版湁鍓嶇鍥涙澘鍧楀睍绀?8. 璁板綍鈥滄洿閲嶈 / 灏戞樉绀衡€濆弽棣?9. 鍦ㄢ€滈噸鏂板垎鏋愨€濇椂閲嶈窇鐗瑰緛銆侀噸璁紭鍏堢骇妯″瀷銆佸埛鏂板睍绀轰笌璁℃暟

## 褰撳墠椤圭洰閲屽凡缁忓彲澶嶇敤鐨勪笂涓嬫枃

闄や簡 Gmail 鍘熷瀛楁锛岄」鐩噷宸茬粡鏈変竴鎵瑰彲鐩存帴杩涘叆鍒嗘瀽閾捐矾鐨勬暟鎹細

- 鐢ㄦ埛鍋忓ソ璁剧疆
- 閲嶇偣瀵勪欢浜哄拰灏戞樉绀哄瘎浠朵汉閰嶇疆
- 宸查€夊叧娉ㄦ爣绛惧拰鑷畾涔夊叧娉ㄩ」
- 鍒嗘瀽鍘嗗彶銆佸弽棣堝巻鍙层€佸凡澶勭悊鐘舵€?- 宸叉湁 thread 鑱氬悎涓庨噸鎺掗€昏緫
- 鍓嶇鏉垮潡閰嶇疆銆佹帓搴忛€昏緫銆侀殣钘忕姸鎬?- `chrome.storage.local` 涓殑璐﹀彿绾х姸鎬?
杩欎簺涓婁笅鏂囬兘搴斾紭鍏堝鐢紝鑰屼笉鏄彧渚濊禆 Gmail 鏂版姄鍥炴潵鐨勫熀纭€瀛楁銆?
## 蹇€熷惎鍔?
1. 瀹夎渚濊禆

```powershell
cd C:\Users\a1800\Codex\Mail-assistant
npm install
```

2. 閰嶇疆鐜鍙橀噺

```powershell
Copy-Item .env.example .env
```

鎸夋枃妗ｅ～鍐?Gmail OAuth 涓?OpenAI 閰嶇疆锛?[docs/gmail-oauth-openai-setup.md](./docs/gmail-oauth-openai-setup.md)

3. 鍚姩鍚庣

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8010
```

4. 鏋勫缓鎵╁睍

```powershell
npm run build:extension
```

濡傛灉 PowerShell 鎻愮ず鎵句笉鍒?`npm`锛屽彲鐢細

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build:extension
```

5. 鍦?Chrome 鍔犺浇鎵╁睍

- 鎵撳紑 `chrome://extensions`
- 寮€鍚€滃紑鍙戣€呮ā寮忊€?- 閫夋嫨鈥滃姞杞藉凡瑙ｅ帇鐨勬墿灞曠▼搴忊€?- 鎸囧悜 `dist-extension/`

6. 鎵撳紑 Gmail 楠岃瘉

- 棣栨鐐瑰嚮杩炴帴 Gmail 鎺堟潈
- 妫€鏌ュ彸渚у姪鎵嬮潰鏉挎槸鍚︽甯稿嚭鐜?4 涓澘鍧?- 瑙﹀彂涓€娆♀€滈噸鏂板垎鏋愨€濈‘璁ゅ悗绔拰 LLM 閾捐矾姝ｅ父

## 褰撳墠鏂囨。缁熶竴绾﹀畾

- 鏂囨。涓互 `priority_content` / `within_48h` / `todo` / `ignore` 浣滀负鏉垮潡鍊煎煙
- 鑻ヤ粨搴撲唬鐮侀噷浠嶅瓨鍦?`today_focus` / `due_soon` 绛夋棫鍛藉悕锛屽悗缁噸鏋勬椂闇€缁熶竴杩佺Щ鍒版柊鐨勬澘鍧楁灇涓?- 棰滆壊浣撶郴鍙繚鐣欎紭鍏堢骇棰滆壊锛屼笉鍐嶇粰鏉垮潡鍗曠嫭瀹氫箟鍥哄畾棰滆壊璇箟
- 鍙嶉鎸夐挳浠モ€滄洿閲嶈 / 灏戞樉绀衡€濅负鍑嗭紝鍏朵粬鏃у弽棣堟枃妗堜笉鍐嶄綔涓轰富濂戠害

## 鏂囨。绱㈠紩

- 椤圭洰鎵嬪唽锛歔docs/project-handbook.md](./docs/project-handbook.md)
- 鏋舵瀯璇存槑锛歔docs/architecture-v1.md](./docs/architecture-v1.md)
- API 鍚堢害锛歔docs/api-contract-v1.md](./docs/api-contract-v1.md)
- 鍓嶇椤甸潰鐘舵€侊細[frontend-contract-v1.md](./frontend-contract-v1.md)
- 鍓嶇 Props 濂戠害锛歔frontend-props-contract-v1.md](./frontend-props-contract-v1.md)
- 鍓嶇缁勪欢鏍戯細[frontend-component-tree-v1.md.md](./frontend-component-tree-v1.md.md)
- 浼樺厛绾ц鍒欙細[docs/priority-scoring-rules.md](./docs/priority-scoring-rules.md)
- 鍙拷鐣ユ澘鍧楄鍒欙細[docs/ignorable-classification-rules.md](./docs/ignorable-classification-rules.md)
- 闅愮瀹夊叏鏂规锛歔docs/privacy-security-plan.md](./docs/privacy-security-plan.md)
- 鍚庣璇存槑锛歔backend/README.md](./backend/README.md)
- 闂涓庝慨澶嶈褰曪細[docs/project-issue-log.md](./docs/project-issue-log.md)



