# @weibaohui/dsh-file-share

[![DSH plugin](https://img.shields.io/badge/dsh-plugin-green)](https://github.com/topics/dsh-plugin)
[![npm version](https://img.shields.io/npm/v/@weibaohui/dsh-file-share)](https://www.npmjs.com/package/@weibaohui/dsh-file-share)

**会话工作区文件管理插件**：在对话区顶部加一个「文件」tab，点开即可浏览、预览并管理**当前会话工作区**下的所有文件。

## 核心功能

- **按会话工作区**：文件树绑定到当前对话的工作区目录（`ctx.sessions.get(sessionId).header.cwd`），不用配置任何固定目录
- **树形浏览**：目录树懒加载、逐层展开，文件大小一眼可见
- **预览 / 查看**：点文件名或行内「预览」弹出查看面板——文本/代码直接显示、图片内联渲染；超大文件或二进制类型引导下载或交给 agent
- **上传 / 下载**：一键上传本机文件到当前目录（可多选）；任意文件可下载
- **目录管理**：新建文件夹 / 改名 / 删除（目录递归、带确认）/ 刷新 / 名称过滤搜索
- **@ 进对话框**：文件行点「@」把 `@绝对路径` 注入输入框，agent 直接处理该文件
- **路径边界安全**：所有操作锁定在会话工作区内，`../`、绝对路径、软链逃逸一律拒绝

## 安装

```bash
dsh plugin --profile web add @weibaohui/dsh-file-share -w
```

装完重启 `dsh web` 即生效。

## 使用

1. 打开 Web UI，进入任意一个会话（或新建会话）
2. 对话区顶部找到 **「文件」** tab（跟在「工艺」旁），点开即见该会话工作区目录树
3. 点击文件名可预览内容；悬停文件行可 下载 / @ / 改名 / 删除；工具栏可上传、新建文件夹、搜索过滤
4. 上传、新建等操作作用于**当前目录**——点目录名展开并切换目标目录
5. 想让 agent 处理某个文件：点「@」把 `@路径` 注入输入框，回车后 agent 直接读取

> 提示：文件管理基于会话工作区，需在本实例中打开过的活跃会话；跨实例或未打开的旧会话会提示原因。

## 联系我 :飞书群

![link](https://foruda.gitee.com/images/1774880015525784725/4fd67005_77493.png "link")
