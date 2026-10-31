<p align="center">
  <img src="docs/composer-trigger.png" alt="触发器显示 OpenCode Zen/DeepSeek V4.1 Flash · Default" width="360">
</p>

<p align="center">
  <a href="https://github.com/ken95573/dsh-model-show/blob/main/README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-model-show"><img alt="npm 版本" src="https://img.shields.io/npm/v/dsh-model-show?style=flat-square&color=4b6fff"></a>
  <a href="https://www.npmjs.com/package/dsh-model-show"><img alt="npm 下载量" src="https://img.shields.io/npm/dm/dsh-model-show?style=flat-square&color=eab308"></a>
  <a href="https://github.com/ken95573/dsh-model-show/stargazers"><img alt="GitHub 星标" src="https://img.shields.io/github/stars/ken95573/dsh-model-show?style=flat-square&color=6c5ce7"></a>
  <a href="https://github.com/ken95573/dsh-model-show/blob/main/LICENSE"><img alt="许可" src="https://img.shields.io/npm/l/dsh-model-show?style=flat-square"></a>
</p>

# dsh-model-show

DSH Web 的对话框模型选择器显示为 **供应商/模型**，而不是一个光秃秃的模型名——选中的模型一眼看出属于哪个供应商，而选择器的其它部分一概不动。

| | 输入框右下角的触发器 |
|---|---|
| 之前 | `Example Chat · High` |
| 之后 | `Example Provider/Example Chat · High` |

*上图：供应商 `OpenCode Zen`、模型 `DeepSeek V4.1 Flash`，末尾的 `Default` 是 DSH 原本就会带的思考档位后缀。*

- **只改触发器上的文字。** 供应商前缀取自你自己的模型配置（`displayName`），插件里没有硬编码的厂商名单。
- **下拉菜单与搜索保持原生。** 每一行仍是纯模型名、仍按供应商分组；输入供应商名依旧匹配不到模型。
- **内置的版本徽标不会丢**（`DeepSeek-V4.1-Flash` → `1017`），并且跟着当前 DSH 版本走。
- **别的插件往同一标签上加的装饰也会显示**，每块各自有错误边界与有界盒子（v1.0.4）。
- **无配置、无网络、无遥测。** 只读 DSH 本来就已经拿到的模型目录。

## 环境要求

- DSH `>= 0.2.1-rc.2 < 0.2.2`，`web` 客户端平台。
- 内置模型选择插件（`@deepseek-ai/dsh-client-ui-model-selection`）**必须保持启用**：本插件复用它提供的 `modelDirectories` 服务，只接管输入框那个座位。内置版本标签插件（`…deepseek-model-label-1017`）也要启用——徽标由它画出来。
- 供应商名字取自你自己模型配置里的 `displayName`（例如 `Example Provider`）。

## 安装

**插件市场** — 搜索包名 `dsh-model-show`，安装后启用。

**桌面端自带 CLI**（保留的 `desktop` profile 只能由应用自带 CLI 管理）：

```console
"%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add dsh-model-show
```

从 GitHub 或本地目录安装，把包名换成 `github:<用户名>/dsh-model-show` 或 `"C:\path\to\dsh-model-show"`。**更新**请写显式版本（`add dsh-model-show@1.0.5`，仓库的 `latest` 可能落后于 rc 版本）；**卸载**用 `plugin --profile desktop remove dsh-model-show`。

**让 agent 装** — `plugin_manager`，`action: install_bundle`，`target` 传包目录。

## 生效与停用

| 操作 | 行为 |
|---|---|
| 从插件 UI 或市场安装、启用、停用 | DSH 当场重排插件树；本机具备 HMR（桌面端自带）时**无需重启**即生效 |
| 命令行 `dsh plugin … add`，或手改 profile | 属磁盘级改动，重启一次确认 |
| 停用插件 | 槽位条目被释放，**内置座位自动接管**：触发器回到纯模型名，无任何残留 |

如果 DSH 在 UI 操作后提示「请重启」，只会是四种已文档化的原因之一（包目录变了、触及宿主模块、涉及不受管理的插件、无法比对磁盘文件）——本插件都不涉及。

## 它做了什么

- **触发器** —— `Example Chat` → `Example Provider/Example Chat`（模型带思考档位时再跟 `· High`）。
- **徽标** —— 内置装饰器按模型名**字面匹配**，所以插件把未经改动的目录原名留在旁边、用它去重放装饰器。前缀只出现一次，徽标始终跟随 DSH 发布的内容，从不硬编码。
- **菜单、搜索、无障碍** —— 菜单行保持纯模型名，搜索只匹配纯模型名，`aria-label` 与悬停提示和可见文字一致。

## 为什么不会拖垮输入框

`conversation.input.model` 是 `single` 槽位：只渲染一个条目，本插件注册在 `priority: -1`，因此遮蔽内置座位。DSH 只给**声明了 children** 的条目注入 `renderSlot`，而子槽位只能被声明一次（被内置座位占用），所以这个子槽位由插件自己组合：

- 每个注册都以组件方式**挂载**（`createElement`），别的插件的 hook 组件保有自己的 hook 槽；
- 每块都套**错误边界**——第三方装饰器渲染期抛错只会让那一块变空白（以前正是这种错误让菜单卡死、日志里什么都没有）；
- 每块都在**有界盒子**里（`min-width: 0`、`max-width: 100%`、`overflow: hidden`、省略号），自带背景或宽度上限的整块 pill 也撑不破触发器；
- **标签主体固定为 DSH 自己的装饰器**（locale 前缀 `deepseek-model-label`），其余注册追加在旁边，而不是被丢弃。

副作用：这些附加装饰也会出现在下拉菜单的每一行——平台对每一行同样渲染那个槽位。

## 常见问题

**菜单里不显示供应商，是 bug 吗？** 不是。只改写触发器，菜单行保持纯模型名，分组与搜索才可预期。

**徽标不见了？** 启用内置的 `…deepseek-model-label-1017` 插件——徽标是重放它的装饰器，不是本插件打印的字符串。

**市场卡片显示「宿主要求未知」？** 市场目录会自行从 registry 推导 `npm` 字段；推导完成后卡片显示版本与 `engines.dsh`，安装也改走 registry。

**装了没反应？** 确认内置模型选择插件处于启用状态，并确认 profile 的 `dsh.profile.bundles` 里还列着 `dsh-model-show`（宿主升级时损坏的声明可能被丢掉）——补回该行并重启。

## 隐私

不发网络请求、无遥测。只读 DSH 已经暴露的接口（当前会话的模型目录、语言词典、槽位注册表），运行时不写你的模型目录、凭据或设置。发布包共 12 个文件：代码、语言包、图标、截图、patch、许可与说明、两份 README。

## 开发

```console
npm test              # manifest、vendoring 改动、标签组合行为、发布白名单
npm run vendor        # 重新提取内置 bundle 并重新打改动
npm run vendor:check  # 已发布的 bundle 与重新提取结果不一致时以非零码退出
```

`npm run vendor` 读取已安装应用里的 `…\resources\app\dsh\node_modules\@deepseek-ai\dsh-client-ui-model-selection\lib\client.js`（新版安装包已解包，因此同时支持 `--from <client.js>` 与 `--asar <app.asar>`）。上游挪动锚点时脚本会直接报错退出，不会产出坏包。`lib/client.js` 按字节比较且行尾统一为 LF，CRLF 检出会让 `npm test` 与 `vendor:check` 双双失败。

| 路径 | 作用 |
|---|---|
| `lib/client.js` | vendored 浏览器 bundle（11 处有据可查的改动） |
| `lib/index.js`、`cordis.patch.yml` | 宿主半段（空 `apply`）与挂载它的那一行 |
| `scripts/vendor-from-asar.mjs` | 提取、改动、校验 |
| `tests/*.test.mjs` | bundle 断言、标签组合、发布白名单 |

## 已知限制

- `lib/client.js` 是内置 bundle 的 vendored 副本，仍依赖浏览器模块表里的 `dsh-client-ui-primitives`、`cordis`、`dsh-client-store`（已在 `dsh.client.external` 声明）。未来若 DSH 重构内置选择器，这份副本可能失效；`engines.dsh`、vendoring 脚本与测试套件是三道保险。
- 控件沿用内置实现，包括 `min(360px, 45cqw)` 的触发器宽度：过长的「供应商/模型」会被省略号截断，不会换行。
- vendored bundle 刻意保留内置插件的完整服务列表——座位通过消费方上下文解析模型目录，裁掉列表会让启动后第一次渲染抛错、座位被静默除名。
- 没有可配置项：格式固定为「供应商/模型」。
- 同一标签上的第三方装饰也会在菜单每一行渲染，长列表里可能显得嘈杂。

## 许可

MIT。`lib/client.js` 派生自 `@deepseek-ai/dsh-client-ui-model-selection`（MIT，Copyright (c) DeepSeek），详见 [NOTICE.md](https://github.com/ken95573/dsh-model-show/blob/main/NOTICE.md)。
