# @weibaohui/dsh-file-share

dsh 插件 · **会话工作区文件管理** —— 在对话区顶部加一个「文件」tab，点开就能看到**当前会话工作区**里的目录树，并就地管理。

- 🗂️ **按会话工作区**：文件操作绑定到当前对话的工作区目录（`ctx.sessions.get(sessionId).header.cwd`），不是全局固定目录。
- 📁 **树形浏览**：目录树懒加载、逐层展开；悬停任意行出现操作按钮。
- ⬆️⬇️ **上传 / 下载**：上传到当前所在目录（可多选）；文件可下载到本机。
- 👁️ **预览 / 查看**：点文件名或行内「预览」弹出查看面板——文本/代码直接显示、图片内联渲染；文本超 512KB 或暂不支持的二进制类型给「下载 / @ 给 agent」。
- 🛠️ **目录操作**：新建文件夹 / 改名 / 删除（目录递归，带确认）/ 刷新 / 名称过滤搜索。
- 💬 **@ 进对话框**：文件行点「@」把 `@绝对路径` 注入 composer，agent 直接处理该文件（宿主 file-reference 可解析工作区内文件）。
- 🔒 **边界安全**：所有路径过「词法 + 真实路径」双重校验，`../`、绝对路径、软链逃逸一律拒绝。

## 形态

| | |
|---|---|
| 入口 | 对话区顶部 tab（conversation.view，order 27，label「文件」，跟在 工艺 之后） |
| 后端 | 宿主同源路由 `/dsh-file-share/api/*`（无独立端口、无 token——只服务本机 dsh Web GUI） |
| 数据 | 每请求带 `sessionId`，宿主解析该会话工作区为根 |

## 安装

```bash
# 开发态（link 允许的 profile，如 web）
cd dsh-file-share
dsh plugin --profile web add . -w

# 发布到 npm 后（npm-only profile，如 weibh）
dsh plugin --profile weibh add @weibaohui/dsh-file-share@0.1.0 -w
```

装完重启 dsh web 实例生效。**无需任何设置**：打开/新建一个会话，切到「文件」tab 即用。

## HTTP API（同源 `/dsh-file-share/api`，全部带 `sessionId`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/status?sessionId=` | 状态：`{ok, workspace}`；会话不在本实例活跃存储/无 cwd 时 `{ok:false, error}` |
| GET | `/list?sessionId=&path=<相对工作区>` | 列目录（dirs 在前，中文排序） |
| GET | `/download?sessionId=&path=<rel>` | 下载（attachment） |
| POST | `/upload?sessionId=&path=<dirRel>&name=<file>` | 上传（body 即文件内容；临时文件 + 原子改名，同名 409） |
| POST | `/mkdir?sessionId=&path=<newRel>` | 新建文件夹 |
| POST | `/rename?sessionId=&from=<rel>&to=<rel>` | 改名/移动 |
| DELETE | `/delete?sessionId=&path=<rel>` | 删除（目录递归） |

## 已知边界（v0.1.0）

- **会话必须是本实例的活跃会话**：`ctx.sessions.get()` 只覆盖本进程正在打开的会话。文件 tab 属于当前打开的会话，天然满足；但跨实例/未在本实例打开过的旧会话查不到工作区（UI 会显示原因）。
- 搜索过滤作用于已加载的树节点（懒加载目录需先展开）。
- 预览只读不编辑：文本/代码直显、图片内联，不做语法高亮与编辑（不是本插件范围）；超大文本/未知二进制提示下载。
- 上传不支持续传、同名拒绝覆盖。

## 开发 / 测试

```bash
npm run check        # node --check 各源文件
npm run build:client # 由 client/index.js 生成 client/bundle.js
npm test             # share-core 单测 + HTTP 集成 + 会话工作区隔离测试
```

结构：
- `src/share-core.js`：路径安全与文件操作核心（词法+真实路径边界、list/download/upload/mkdir/rename/delete），可脱离 dsh 复用；
- `src/index.js`：宿主侧（sessionId→工作区解析、同源 API）；
- `client/index.js`：conversation.view「文件」tab（目录树 + 管理 + @ 插入）。

## License

MIT
