# Gotify PC (Tauri 版)

基于 Tauri + React 构建的现代化 Gotify 桌面客户端。本目录是新的桌面端实现，与旧的 Electron 核心完全重构和隔离。后续开发、构建、发布等核心迭代都将围绕此架构展开。

## ✨ 核心特性 (Features)

- **实时通讯**: Gotify WebSocket 实时连接与断线重连保障。
- **本地存储**: 消息历史本地持久化，支持切换本地存储目录和收藏消息。
- **系统集成**: 托盘驻留、开机自启、关闭到托盘与系统原生整合。
- **现代化体验**: 全新设计的极简 UI，支持浅色 (Light) / 深色 (Dark) 双主题皮肤无缝切换。
- **高级通知 & 过滤**: 自定义窗口内通知卡片，支持按分组屏蔽特定弹窗提醒，支持 Bark 分组分发。
- **动态版本对齐**: 设置页提供应用版本号展示，并且会自动跟随并对齐 Git Tag 发布版本号。

## 🛠️ 核心目录结构 (Structure)

- `src/` (前端应用层)
  - `App.tsx`: 应用主界面与全局状态编排
  - `components/`: 纯界面组件库
  - `lib/types.ts`: 前端数据类型定义与默认配置
  - `lib/theme.ts`: 黑白皮肤切换控制逻辑
  - `lib/gotify-client.ts`: WebSocket 客户端逻辑实现
  - `lib/desktop.ts`: Tauri 运行时桥接，封装托盘、通知、配置以及本地操作命令调用
- `src-tauri/` (底层与系统交互层)
  - `src/models.rs`: Rust 侧数据模型与序列化封装
  - `src/storage.rs`: 核心存储逻辑，如配置读取、系统属性、历史消息与存储目录切换接口
  - `src/lib.rs`: Tauri 外部插件安装与应用自有指令(RPC)的注册中心
  - `tauri.conf.json`: Tauri 官方构建与打包行为核心配置文件
- `README.md`: 当前项目概览与说明文档
- `ARCHITECTURE.md`: 模块职责划分、分层架构和数据流转规则的详细解说

## 📋 依赖环境 (Prerequisites)

在准备本地开发之前，您需要准备基础支持环境：

- [Node.js](https://nodejs.org/zh-cn) (建议使用 LTS 版本)
- [Rust & Cargo](https://rustup.rs/) (通过 Rustup 安装)
- **Windows 用户额外说明**: 请务必前置安装 [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/)，并且在安装时勾选「使用 C++ 的桌面开发」工作负载，获取 MSVC 和 Windows SDK 支持。

## 💻 开发与构建 (Build & Dev)

### 开发环境运行

```bash
npm install
npm run tauri:dev
```

### 生产环境打包

```bash
npm run tauri:build
```

> 💡 **Windows 平台常见提示**：
> 目前的 `npm run tauri:dev` 和 `npm run tauri:build` 脚本内部分已内置调用了 `VsDevCmd` 工具链自动捕获。即使如此，当依然提示缺失 `kernel32.lib`、`link.exe` 核心报错时，最大的原因是环境依赖异常，请重新验证 MSVC 的 C++ 工作负载安装状态。

## 📦 发布规则 (Release Pipeline)

1. **自动构建部署**: GitHub Actions 脚本的运行源路径已调整为针对当前 `tauri-app` 或 Tauri 工作区进行集中全系统构建。
2. **遵守语义化标签**: 触发流水心必须严格遵守 `v1.2.3` 等 Git Tag 标签格式。
3. **版本链统一**: 流水线将依据 Tag 值逆向注入更新前置配置，从而与 `package.json` 以及 `src-tauri/Cargo.toml` 形成统一。
4. **内部展示自适应**: 客户端运行时内部的版本查询 (如关于详情中展示的 `v + app.getVersion()`) 将精确且唯一地指向这一定义发布标签，从源代码侧切断不一致性。