# 架构说明

## 前端层

### `src/App.tsx`

负责主界面状态编排：

- 初始化桌面运行时
- 加载配置、历史消息、版本号、分组列表
- 管理搜索、分组筛选、收藏筛选
- 打开设置弹窗
- 展示自定义通知卡片

### `src/components/`

- `SettingsModal.tsx`: 设置页，负责连接参数、通知行为、皮肤、Bark、存储目录
- `MessageCard.tsx`: 单条消息卡片
- `CustomToast.tsx`: 窗口内自定义提示卡片

### `src/lib/`

- `types.ts`: 配置和消息类型定义
- `theme.ts`: 黑白皮肤切换和本地缓存
- `gotify-client.ts`: WebSocket 建连、重连、消息去重
- `desktop.ts`: 统一封装 Tauri API 调用，包括托盘、通知、自启、Rust 命令桥接

## Rust 层

### `src-tauri/src/models.rs`

负责 Rust 与前端之间的序列化结构。

### `src-tauri/src/storage.rs`

负责本地数据能力：

- 读取 / 保存配置
- 读取 / 保存消息历史
- 收藏状态切换
- 存储目录切换
- 打开当前存储目录
- 应用退出

### `src-tauri/src/lib.rs`

负责：

- 注册 Tauri 插件
- 注册前端 `invoke` 可调用命令
- 初始化 `AppState`

## 消息流

1. 前端启动后调用 `desktopRuntime.init()`。
2. `desktop.ts` 从 Rust 读取配置与本地历史。
3. 若已有服务端配置，则启动 `BrowserGotifyClient`。
4. Gotify WebSocket 收到消息后：
   - 先补充分组名
   - 再通过 Rust 命令写入本地历史
   - 按配置决定是否 Bark 转发
   - 判断该分组是否被屏蔽弹窗
   - 若未屏蔽，则展示窗口内提示卡或系统通知
5. React 主界面同步追加新消息并刷新筛选结果。

## 主题机制

- 主题模式只保留 `white` 与 `black`
- 主题值缓存到 `localStorage`
- 页面启动时先从 `index.html` 预注入主题，避免闪烁
- React 中切换配置后再统一应用到 `document.documentElement`

## 发布机制

- Git tag 触发 `.github/workflows/release.yml`
- 工作流进入 `tauri-app/` 目录执行 `npm install`
- 同步 tag 版本到前端 `package.json` 与 Rust `Cargo.toml`
- 使用 `npm run tauri:build` 产出 NSIS 安装包
- 安装包从 `tauri-app/src-tauri/target/release/bundle/nsis/*.exe` 上传到 Release
