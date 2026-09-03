# @weibaohui/dsh-file-share

dsh 插件 · 目录共享 —— 把**任意一个可配置的目录**变成可在线管理的共享区。

- 🌐 **浏览器共享服务器**：手机 / 其他电脑用浏览器打开 `http://<host>:<port>` 就能浏览、上传、下载、新建文件夹、改名、删除（独立 node:http 服务，token 门禁 + 路径边界 + 只读模式 + 限流，零外部依赖）。
- 💬 **在 dsh 对话框里用**：聊天输入框「+」区会多一个 **📁 目录** 按钮，弹出共享目录管理器，选中文件点「插入 @」→ 把 `@绝对路径` 注入草稿，让 agent 直接处理该文件。
- 🤖 **模型可调工具**：`file_share_status` / `file_share_list` / `file_share_reload`。
- ⚙️ **设置即改即生效**：共享根、端口、口令、只读等在设置里改完，2 秒内自动重建共享服务器，无需重启宿主。

## 安装

```bash
# 发布到 npm 后（weibh 等 npm-only profile）：
dsh plugin --profile weibh add @weibaohui/dsh-file-share -w

# 开发态（link: 允许的 profile，如 web）：
cd dsh-file-share
dsh plugin --profile web add . -w
```

装完重启 dsh web 实例生效。之后在 **设置 → dsh-file-share** 里填 `root`（绝对路径）即启用；留空 = 停用。

## 快速开始

1. 设置 `dsh-file-share.root` = 要共享的目录（如 `/Users/me/share`），默认端口 3988、仅本机（`host: 127.0.0.1`）。
2. 想让局域网设备访问：把 `host` 改为 `0.0.0.0`，并设一个 `token`（不设则每次启动自动生成随机口令）。
3. 本机浏览器开 `http://127.0.0.1:3988` 输入口令；局域网设备开 `http://<本机局域网IP>:3988`。
4. 在 dsh 聊天框点 **📁 目录** 也可直接管理同一目录，或把文件「插入 @」进对话给 agent 处理。
5. 忘了口令？让 agent 调 `file_share_status`，或看同源 `/dsh-file-share/api/status`。

## 设置项（命名空间 `dsh-file-share`，schemastery）

| 字段 | 默认 | 说明 |
|---|---|---|
| `root` | `''` | 共享根目录绝对路径；**留空 = 停用共享服务器** |
| `port` | `3988` | 共享服务器监听端口 |
| `host` | `127.0.0.1` | `127.0.0.1`=仅本机；`0.0.0.0`=局域网可见 |
| `token` | `''` | 访问口令；留空=每次（重建）启动自动生成随机口令 |
| `readOnly` | `false` | 只读：禁上传/新建/改名/删除 |
| `hideSensitive` | `true` | 隐藏/禁访 `.env`、`.git`、`node_modules`、`*.pem/*.key`、`credentials*.yaml`、`.ssh/.aws/.netrc` 等 |
| `maxBytes` | `0` | 单文件上传上限字节；`0`=不限 |
| `limitPerMin` | `240` | 每 IP 每分钟请求上限（仅共享服务器端口）；`0`=不限 |

## 安全模型

- **路径边界**：所有磁盘操作都过「词法边界 + 真实路径（符号链接解析后）边界」双重校验，`../`、绝对路径、越出共享根的软链一律 400。
- **token 门禁**：共享服务器端口所有 `/api/*` 请求需 `?token=` 或 `X-Token` 头（timing-safe 比较）；首页 HTML 自带口令输入界面。
- **敏感文件**：`hideSensitive` 开启时，列表隐藏、且直读/下载/删除/上传同名敏感路径也会被拒。
- **只读模式**：上传/新建/改名/删除返回 403。
- 宿主同源路由 `/dsh-file-share/api`（给 dsh Web UI 用）走 dsh 自身网络面，不重复套 token；共享根未配置时返回 200 的 `{enabled:false}` 状态。
- 默认 `host: 127.0.0.1` —— 不做任何修改时服务只在本机，不会暴露到局域网；要共享才主动改 `0.0.0.0`。

## HTTP API（共享服务器端口 + 宿主同源 `/dsh-file-share/api` 同一套）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 内置管理页（HTML） |
| GET | `/api/status` | 状态：enabled/root/url/token/readOnly… |
| GET | `/api/list?path=<相对共享根>` | 列目录（dirs 在前，中文排序） |
| GET | `/api/download?path=<rel>` | 下载（attachment） |
| POST | `/api/upload?path=<dirRel>&name=<file>` | 上传（body 即文件内容；临时文件 + 原子改名） |
| POST | `/api/mkdir?path=<newRel>` | 新建文件夹 |
| POST | `/api/rename?from=<rel>&to=<rel>` | 改名/移动（同盘） |
| DELETE | `/api/delete?path=<rel>` | 删除（目录递归） |

共享服务器端口需带 token；同源 `/dsh-file-share/api` 无需 token。

## 模型工具

- `file_share_status`：查共享状态，输出带 token 的完整浏览器地址，可直接发给对方。
- `file_share_list`：列共享根下子目录内容（不越界）。
- `file_share_reload`：按最新设置立即重建共享服务器。

## 开发 / 测试

```bash
npm run check        # node --check 各源文件
npm run build:client # 由 client/index.js 生成 client/bundle.js
npm test             # 核心单测 + HTTP 服务集成测试（真实端口、真实上传下载）
```

结构：
- `src/share-core.js`：与宿主无关的共享核心（路径安全、路由、内置 HTML 页），可脱离 dsh 单独起服务；
- `src/index.js`：宿主侧（settings / 工具 / 同源路由 / 独立服务器生命周期）；
- `client/index.js`：dsh Web 客户端（composer「📁 目录」入口）。

## 局限（v0.1.0）

- 单用户口令体系，无多账号/配额；公网使用请放 HTTPS 反向代理后并自行限权。
- 上传不支持续传；同名文件拒绝覆盖（409）。
- 共享服务器地址中的局域网 IP 需要你自己把 `host` 换成实际可达地址（`0.0.0.0` 监听时浏览器用 `http://<本机IP>:<port>`）。

## License

MIT
