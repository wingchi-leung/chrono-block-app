# ChronoBlock Desktop

基于 Tauri 2.0 的跨平台时间块管理桌面应用，使用本地 SQLite 数据库。

## 技术栈

| 类别 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite |
| **样式** | Tailwind CSS |
| **状态管理** | Zustand |
| **数据库** | SQLite (本地) |
| **桌面框架** | Tauri 2.0 (Rust) |

## 环境要求

### 必需
- Node.js 18+
- Rust (最新稳定版)
- npm/pnpm/yarn

### Windows 额外要求
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ 工作负载)
- [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (Windows 10/11 已预装)

### macOS 额外要求
- Xcode Command Line Tools: `xcode-select --install`

## 快速开始

### 1. 安装 Rust

**Windows:**
```bash
# 下载安装器
winget install Rustlang.Rustup

# 或访问 https://rustup.rs/ 下载
```

**macOS:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 2. 安装依赖

```bash
cd timeblock-tauri
npm install
```

### 3. 开发模式

```bash
npm run tauri dev
```

### 4. 构建发布版

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`:
- **Windows**: `.msi` / `.exe`
- **macOS**: `.dmg` / `.app`

## 项目结构

```
timeblock-tauri/
├── src/                    # React 前端代码
│   ├── components/         # UI 组件
│   │   ├── ui/            # 基础 UI 组件 (shadcn/ui)
│   │   ├── calendar/      # 日历组件
│   │   └── daily/         # 日视图组件
│   ├── lib/               # 工具函数 & 数据库 API
│   ├── store/             # Zustand 状态管理
│   ├── types/             # TypeScript 类型定义
│   ├── App.tsx            # 主应用组件
│   └── main.tsx           # 入口文件
├── src-tauri/              # Tauri/Rust 后端
│   ├── src/
│   │   ├── db/            # 数据库模块
│   │   │   ├── models.rs  # 数据模型
│   │   │   ├── commands.rs # Tauri 命令
│   │   │   └── migrations.rs # 数据库迁移
│   │   ├── lib.rs         # 主库文件
│   │   └── main.rs        # 入口
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
├── public/                 # 静态资源
├── index.html             # HTML 入口
├── vite.config.ts         # Vite 配置
├── tailwind.config.js     # Tailwind 配置
└── package.json           # 项目依赖
```

## 数据库结构

### tasks 表
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    color TEXT,
    estimated_duration INTEGER,
    created_at TEXT,
    updated_at TEXT
);
```

### time_blocks 表
```sql
CREATE TABLE time_blocks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    all_day INTEGER DEFAULT 0,
    color TEXT,
    editable INTEGER DEFAULT 1,
    completion_status TEXT,
    is_pomodoro INTEGER DEFAULT 0,
    task_id TEXT REFERENCES tasks(id),
    created_at TEXT,
    updated_at TEXT
);
```

## 功能特性

- [x] 日视图时间块管理
- [x] 月视图日历
- [x] 任务列表
- [x] 主题切换 (浅色/深色/跟随系统)
- [x] 本地 SQLite 数据库
- [x] 桌面通知
- [ ] 周视图
- [ ] 番茄时钟
- [ ] 系统托盘

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建前端 |
| `npm run tauri dev` | 启动 Tauri 开发模式 |
| `npm run tauri build` | 构建发布版本 |

## macOS 测试包

如果你想给 Mac 熟人测试，但手上没有 Mac，可以直接用仓库里的 GitHub Actions：

1. 推送代码到 GitHub
2. 打开仓库的 `Actions`
3. 运行 `Build Tauri macOS`
4. 构建完成后，在 workflow 的 `Artifacts` 里下载 `ChronoBlock-macos-bundles`

下载到的产物通常会包含：
- `.dmg`
- `.app` 或 `.app.tar.gz`

如果是未签名、未公证的测试版，首次启动时可能需要在：
`系统设置 > 隐私与安全性`
里点击“仍要打开”。

### Mac 用户如何打开 `.dmg`

1. 双击下载好的 `.dmg`
2. 在弹出的窗口里，把 `ChronoBlock.app` 拖到 `Applications`
3. 打开 `Applications` 文件夹
4. 找到 `ChronoBlock`，右键后选择“打开”
5. 如果系统提示安全限制，前往：
`系统设置 > 隐私与安全性`
点击“仍要打开”，然后再次启动

## Windows 测试包

如果你想给 Windows 用户分发安装器，可以直接用仓库里的 GitHub Actions：

1. 推送代码到 GitHub
2. 打开仓库的 `Actions`
3. 运行 `Build Tauri Windows`
4. 构建完成后，在 workflow 的 `Artifacts` 里下载 `ChronoBlock-windows-bundles`

下载到的产物通常会包含：
- `ChronoBlock_x.x.x_x64-setup.exe` 或类似命名的安装器
- `timeblock-tauri.exe` 程序本体

推荐发给普通用户的是 `setup.exe` 安装器。

## 数据存储

数据库文件存储位置：
- **Windows**: `%APPDATA%/com.chronoblock.desktop/chronoblock.db`
- **macOS**: `~/Library/Application Support/com.chronoblock.desktop/chronoblock.db`

## License

MIT
