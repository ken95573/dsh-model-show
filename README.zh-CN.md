# dsh-model-show

给 DSH Web 界面用的客户端插件：对话框右下角的模型选择器显示为 **供应商/模型**，选中哪个模型就能看出它属于哪个供应商。

| | 输入框右下角的触发器 |
|---|---|
| 之前 | `Example Chat · High` |
| 之后 | `Example Provider/Example Chat · High` |

下拉菜单保持原样：每一行仍是纯模型名（`Example Chat`），归在各自的供应商分组下，搜索也只匹配纯模型名。鼠标悬停提示与 ARIA 标签和可见文字一致，都是「供应商/模型」。

![触发器显示 OpenCode Zen/DeepSeek V4.1 Flash，Default](docs/composer-trigger.png)

真实效果：供应商 `OpenCode Zen`、模型 `DeepSeek V4.1 Flash`，末尾的 `Default` 是 DSH 原本就会带的思考档位后缀。

## 环境要求

- DSH `>= 0.2.0-rc.1 < 0.3.0-0`，`web` 客户端平台（在桌面端运行时 `0.2.0-rc.2` 上开发与验证）。
- 内置的模型选择插件（`@deepseek-ai/dsh-client-ui-model-selection`）需要保持启用：本插件复用它提供的 `modelDirectories` 服务，只接管输入框那个座位。
- 供应商名字取自你自己模型配置里的 `displayName`（例如 `Example Provider`、`Example Vendor`）。

## 安装

### 插件市场

在目标 DSH 应用的插件市场里搜索包名 `dsh-model-show`，安装后启用。

### 桌面端自带 CLI

桌面端的 `desktop` 是保留 profile，只能用它自带的 CLI 管理：

```console
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-model-show
```

从 GitHub 或本地目录安装：

```console
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add github:<用户名>/dsh-model-show
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\path\to\dsh-model-show"
```

卸载：`plugin --profile desktop remove dsh-model-show`。

### 让 DSH 里的 agent 安装

直接让 agent 安装这个目录的 bundle（`plugin_manager`，`action: install_bundle`，`target` 传包目录）。

安装后刷新页面即可看到效果；如果替换的是已经加载过的插件代码，需要重启应用。

## 验证

1. 输入框右下角的触发器显示「供应商/模型」（模型有推理档位时再带 `· 档位`）。
2. 鼠标悬停显示同样的文字。
3. 下拉菜单里仍是纯模型名，按供应商名搜索不会匹配到模型。

## 实现方式

- `lib/index.js` 是插件的宿主半段（空的 `apply`），只为了让 profile 的层能挂上这一行；浏览器半段由 `dsh.client` + `exports["./client"]` 发现。
- `cordis.patch.yml` 插入一行（`id: model-show`、`name: dsh-model-show`）。
- `lib/client.js` 是内置 `@deepseek-ai/dsh-client-ui-model-selection` 浏览器 bundle 的 vendored 副本，共 6 处改动（见 `scripts/vendor-from-asar.mjs`，每处都在生成文件里留下 `EDIT:` 注释）。带来可见变化的是两处：`choices[].model.name` 拼上供应商前缀，以及把输入框座位注册到 `priority: -1`——优先级最低者渲染，因此影子覆盖内置座位。
- 前缀只加在触发器读取的 `currentChoice?.model.name` 上，菜单用的 `groups` 没动，所以搜索行为不变。

## 开发

```console
npm test                 # 离线检查：manifest、6 处改动、标签行为
npm run vendor           # 从已安装的应用重新提取上游 bundle 并重新打这 6 处改动
npm run vendor:check     # 已发布的 bundle 与重新提取结果不一致时以非零码退出
```

`npm run vendor` 默认读取
`%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\app.asar` 里的
`dsh/node_modules/@deepseek-ai/dsh-client-ui-model-selection/lib/client.js`，也可以用
`--from <client.js>` 指定单个 bundle，或用 `--asar <app.asar>` 指定归档。

上游把锚点改掉时，vendoring 会**直接报错退出**（`anchor not found (<label>) — upstream bundle changed?`），不会默默产出坏包；这时需要对照新 bundle 复核这 6 处改动、更新脚本，再跑 `npm test`。

行尾由 `.gitattributes` 统一为 LF。`lib/client.js` 是按字节与 vendoring 结果比较的，CRLF 检出会让 `npm test` 和 `npm run vendor:check` 双双失败。

| 路径 | 作用 |
|---|---|
| `package.json` | bundle 与客户端 manifest（`dsh.bundle.patch`、`dsh.client`） |
| `cordis.patch.yml` | 把插件行插入 profile 的层栈 |
| `lib/index.js` | 宿主半段（空 `apply`，让这一行能挂载） |
| `lib/client.js` | vendored 的浏览器 bundle（含 6 处改动） |
| `scripts/vendor-from-asar.mjs` | vendoring：从已安装的 DSH 提取、改、校验 |
| `tests/verify-bundle.test.mjs` | 对已发布 bundle 的离线验证 |
| `icon.svg`、`locale/*.json` | 插件市场卡片信息 |
| `screenshots.json`、`docs/composer-trigger.png` | 市场详情页截图，声明在仓库里由市场直接读取 |

## 已知限制

- `lib/client.js` 是内置 bundle 的 vendored 副本，因此它还依赖浏览器模块表里的
  `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`
  （已在 `dsh.client.external` 里声明）。未来某个 DSH 版本若重构内置模型选择器，这个 bundle 可能失效；`engines.dsh`、vendoring 脚本和 `npm test` 是三道保险。
- 控件整体沿用内置实现，包括它的样式与 `min(360px, 45cqw)` 的触发器宽度；「供应商/模型」过长时会被省略号截断，不会换行或撑破布局。
- vendored bundle 刻意保留内置插件的完整服务列表（`commandUi`、`locale`、`sessions`、`slots`、`remote`、`remote.session`）。座位是通过**消费方上下文**去解析每个会话的模型目录的，一旦把列表裁成"本插件看得见用到的服务"，启动后第一次渲染就会抛 `cannot get property "remote.session" without inject`，槽位注册表随即把这个条目静默除名、改由内置座位渲染——界面上看不到任何报错。`npm run vendor` 与 `npm test` 都会拦住这处改动再次出现。
- 没有可配置项：格式固定为「供应商/模型」。

## 许可

MIT。`lib/client.js` 派生自 `@deepseek-ai/dsh-client-ui-model-selection`（MIT，Copyright (c) DeepSeek），详见 [NOTICE.md](NOTICE.md)。
