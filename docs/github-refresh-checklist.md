# GitHub 整理说明

这份文件用于说明：为什么要新建这一版 `Ur-AI-Mail-assistant` 文件夹，以及它相对于当前 GitHub 仓库修复了什么。

## 1. 发现的问题

在对照本地项目和 GitHub 仓库后，主要问题包括：

1. 根目录 `README.md` 没有稳定区分“当前真实能力”和“目标架构”。
2. GitHub 仓库缺少本地 `docs/` 中的大部分方法与说明文件。
3. 远端 `backend/README.md` 已经出现乱码。
4. 仓库里混有不适合公开展示或不适合继续上传的文件：
   - `node_modules`
   - `dist`
   - `dist-extension`
   - `dist-extension.zip`
   - `.env`
   - `.DS_Store`
   - `extension/content.ts.broken-backup`
5. 本地 `backend/data/feedback.json` 含有真实账号反馈数据，不适合直接公开提交。
6. 前端说明文件命名不整洁，存在 `frontend-component-tree-v1.md.md` 这种重复后缀。

## 2. 这份新文件夹已经做的整理

- 重写根目录 `README.md`
- 修复 `backend/README.md`
- 新增：
  - `docs/current-status.md`
  - `docs/implementation-method.md`
  - `docs/feature-breakdown.md`
  - `docs/github-refresh-checklist.md`
- 补回并保留原本本地存在的 `docs/` 文档
- 把前端说明文件统一移动到 `docs/frontend/`
- 删除 `extension/content.ts.broken-backup`
- 新增脱敏后的：
  - `backend/data/preferences.json`
  - `backend/data/feedback.json`
  - `backend/data/README.md`
- 新增 GitHub 展示素材目录：
  - `assets/demo/`
  - `assets/preview/`
- 新增 `.gitattributes`，改善文本与二进制文件管理
- 更新 `.gitignore`，避免再次把本地缓存和敏感文件传上去

## 3. 这份新文件夹故意没有放进去的内容

- `.env`
- `node_modules/`
- `dist/`
- `dist-extension/`
- `dist-extension.zip`
- `.venv/`
- `__pycache__/`
- 原始比赛说明 `飞书AI比赛.docx`

这些文件不是公开仓库的必要组成，或者会带来冗余、泄露风险和对比噪音。

## 4. 手动上传时建议优先替换的内容

如果你要人工对照 GitHub 仓库并修改，建议优先处理：

1. 根目录 `README.md`
2. `backend/README.md`
3. `docs/` 整体
4. `backend/data/` 的脱敏模板
5. `assets/` 演示素材
6. 删除 GitHub 上不该保留的构建产物、备份文件和乱码文件

## 5. 最终目标

这份新文件夹的目标不是直接替你改线上仓库，而是给你一套：

- 结构更完整
- 内容更真实
- 文件更干净
- 更适合 GitHub 展示

的可上传版本，方便你逐项比对并手动更新。
