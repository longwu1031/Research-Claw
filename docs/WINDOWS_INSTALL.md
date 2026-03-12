# Research-Claw Windows 安装指南

Research-Claw (科研龙虾) 目前暂不提供 Windows 一键安装脚本。
请按照以下步骤手动安装。全程约需 10-15 分钟。

> 推荐方案: 如果你使用 Windows 11, 建议通过 **WSL2 (Ubuntu)** 安装,
> 然后直接使用 Linux 一键安装脚本。参见本文末尾 [WSL2 安装](#wsl2-安装推荐) 章节。

---

## 前置条件

| 软件 | 最低版本 | 下载地址 |
|------|----------|----------|
| Node.js | 22.12+ | https://nodejs.org/ (选 LTS) |
| pnpm | 9.0+ | 安装 Node.js 后运行 `npm install -g pnpm` |
| Git | 任意 | https://git-scm.com/download/win |
| Visual Studio Build Tools | 2019+ | 见下方说明 |

### 安装 Visual Studio Build Tools

Research-Claw 依赖的 `better-sqlite3` 模块需要 C++ 编译环境。

**方法 A — 自动安装 (推荐)**

打开 **管理员 PowerShell**, 运行:

```powershell
npm install -g windows-build-tools
```

**方法 B — 手动安装**

1. 下载 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 安装时勾选 **"Desktop development with C++"** 工作负载
3. 确保包含 **MSVC v143** 和 **Windows SDK**

---

## 安装步骤

### 第 1 步: 验证环境

打开 **PowerShell** 或 **命令提示符**, 运行:

```powershell
node -v    # 应显示 v22.x.x 或更高
pnpm -v    # 应显示 9.x.x 或更高
git -v     # 应显示 git version x.x.x
```

### 第 2 步: 克隆仓库

```powershell
cd ~
git clone https://github.com/wentorai/research-claw.git
cd research-claw
```

### 第 3 步: 安装依赖

```powershell
pnpm install
```

> 此过程会编译 `better-sqlite3` 等原生模块, 如果报错请检查 Build Tools 是否正确安装。

### 第 4 步: 创建配置文件

```powershell
copy config\openclaw.example.json config\openclaw.json
```

### 第 5 步: 构建 Dashboard 和插件

```powershell
pnpm build
```

### 第 6 步: 安装 Research-Plugins

```powershell
npx openclaw plugins install @wentorai/research-plugins
```

### 第 7 步: 配置 API Key

```powershell
pnpm setup
```

按照提示选择 API 服务商 (Anthropic Claude / OpenAI) 并输入 API Key。

如需配置代理 (国内用户), 按提示输入代理地址, 如 `http://127.0.0.1:7890`。

### 第 8 步: 启动

```powershell
pnpm start
```

启动后在浏览器中打开: **http://127.0.0.1:28789**

---

## 日常使用

```powershell
# 启动 Research-Claw
cd ~/research-claw
pnpm start

# 开发模式 (前端热更新)
pnpm dev

# 健康检查
pnpm health

# 备份数据库
pnpm backup

# 更新到最新版
git pull && pnpm install && pnpm build
```

---

## 常见问题

### `better-sqlite3` 编译失败

```
Error: Could not find any Visual Studio installation to use
```

**解决:** 安装 Visual Studio Build Tools, 或运行:

```powershell
npm config set msvs_version 2022
pnpm install
```

### `node-gyp` 找不到 Python

```
Error: Can't find Python executable
```

**解决:**

```powershell
# 安装 Python 3
winget install Python.Python.3.12

# 告知 node-gyp Python 位置
npm config set python python3
```

### PowerShell 执行策略错误

```
File cannot be loaded because running scripts is disabled
```

**解决:** 以管理员身份运行:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 端口被占用

```
Error: listen EADDRINUSE :::28789
```

**解决:**

```powershell
# 查找占用端口的进程
netstat -ano | findstr :28789

# 终止该进程 (PID 替换为实际值)
taskkill /PID <PID> /F

# 或使用 --force 强制启动
pnpm start -- --force
```

---

## WSL2 安装 (推荐)

如果你使用 Windows 10/11, 强烈推荐通过 WSL2 安装, 体验与 Linux 完全一致:

### 1. 启用 WSL2

```powershell
# 管理员 PowerShell
wsl --install -d Ubuntu
```

重启后设置用户名和密码。

### 2. 一键安装

在 WSL2 Ubuntu 终端中运行:

```bash
curl -fsSL https://raw.githubusercontent.com/wentorai/research-claw/main/scripts/install.sh | bash
```

### 3. 访问 Dashboard

在 Windows 浏览器中打开: **http://127.0.0.1:28789**

WSL2 的端口会自动转发到 Windows 宿主机。

---

## 卸载

```powershell
# 删除安装目录
Remove-Item -Recurse -Force ~/research-claw

# 可选: 删除本地数据
Remove-Item -Recurse -Force ~/.research-claw
```
