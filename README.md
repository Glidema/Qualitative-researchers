<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/69601229-b8d5-41e2-97d9-9fb5b360f41a

## Run Locally

**Prerequisites:**  Node.js

1. 安装依赖：`npm install`
2. 在项目根目录创建 `.env.local`，设置：
   - `VITE_ADMIN_PASSWORD=你的管理员密码`（可选，默认 `admin123`）
   - 若要用本地 API（提交/管理员列表），可运行 `vercel dev`（需先 `vercel link` 并配置好 KV、`ADMIN_SECRET`），否则仅前端：`npm run dev`
3. 运行：`npm run dev`（仅前端）或 `vercel dev`（前端 + 本地 API）

## 手机端访问与测试

- 部署到 Vercel 后，用手机浏览器打开项目地址即可访问和提交。
- 本地开发时在手机测试：保证手机和电脑在同一 WiFi，运行 `npm run dev` 后用浏览器访问 `http://<你的电脑局域网IP>:3000`（终端会显示可访问的地址）。
- 提交流程已针对触屏优化：大按钮、防误触、安全区适配；提交中会显示“正在提交” overlay，成功后短暂显示“提交成功”再跳转结果页。

## 部署到 Railway（推荐，提交更稳定）

Railway 自带 Redis，同机内网连接，避免 Vercel 上 500 问题。

1. **注册并安装**
   - 打开 [railway.app](https://railway.app) 登录（可用 GitHub）
   - 点击 **New Project** → **Deploy from GitHub repo**，选择本仓库

2. **添加 Redis**
   - 在项目里点 **+ New** → **Database** → **Redis**
   - 创建后 Railway 会自动注入 `REDIS_URL`（redis://...）到你的应用服务

3. **配置环境变量**
   - 选中你的 **Service**（前端+API 那个），在 **Variables** 里添加：
   - `REDIS_URL`：若未自动注入，从 Redis 服务里复制（通常加完 Redis 会自动带）
   - `ADMIN_SECRET`：管理员密码（与前端登录密码一致）
   - `VITE_ADMIN_PASSWORD`：同上，前端管理员登录用（部署时会被打进前端）

4. **构建与启动**
   - Build Command：`npm run build`（Railway 一般会自动识别）
   - Start Command：`npm start`
   - 根目录已有 `railway.json`，会先执行 build 再执行 start

5. **生成域名**
   - 在 Service → **Settings** → **Networking** 里点 **Generate Domain**，用生成的链接即可访问。

**若构建失败**（例如报 Node 版本或 better-sqlite3）：项目已要求 Node 20 并移除了未使用的 native 依赖。若仍用 Node 18，可在 Service 的 **Variables** 里添加 `NIXPACKS_NODE_VERSION=20` 后重新部署。

**本地用 Railway 跑一遍（可选）**

```bash
npm run build
REDIS_URL=redis://localhost:6379 ADMIN_SECRET=admin123 npm start
```

用浏览器打开 http://localhost:3000，提交会写入本地 Redis；管理员后台需带密码访问。

---

## Deploy to Vercel

1. **推送代码到 GitHub**，并确保仓库可被 Vercel 访问。

2. **在 Vercel 创建项目**
   - 打开 [vercel.com](https://vercel.com) 并登录
   - 点击 **Add New** → **Project**，导入你的 GitHub 仓库
   - Vercel 会自动识别为 Vite 项目（Build Command: `npm run build`，Output Directory: `dist`）

3. **添加数据存储（必选）**  
   在 Vercel 项目 **Storage** 或 **Marketplace** 中创建 **KV（Redis）** 存储（如 [Upstash Redis](https://vercel.com/marketplace) 等），并绑定到当前项目。绑定后会自动注入 `KV_REST_API_URL`、`KV_REST_API_TOKEN`，提交与管理员列表会使用该存储。

4. **配置环境变量**（在 Vercel 项目 **Settings → Environment Variables** 中）：
   - `VITE_ADMIN_PASSWORD`：管理员密码（前端登录用），建议与 `ADMIN_SECRET` 一致。
   - `ADMIN_SECRET`：与管理员密码一致，用于校验 `/api/results` 请求，**必填**。

5. **部署**
   - 点击 **Deploy**；之后每次推送到默认分支都会自动重新部署。

### 本地用 Vercel CLI 部署（可选）

```bash
npm i -g vercel
vercel
```

按提示登录并选择或创建项目，环境变量同样需在 Vercel 控制台里配置。

## 管理员后台（查看测试结果）

系统已实现管理员后台，可查看所有人的测验提交记录与得分。

**进入方式**
- 在任意页面右上角点击 **「管理员」**，弹出密码框后输入密码即可进入后台。

**密码设置**
- **本地**：在项目根目录的 `.env.local` 中设置 `VITE_ADMIN_PASSWORD=你设置的密码`。若不设置，默认密码为 `admin123`。
- **Vercel 部署**：在 Vercel 项目 **Settings → Environment Variables** 中添加 `VITE_ADMIN_PASSWORD`，值为你自定义的密码。**务必设置**，否则线上会使用默认密码 `admin123`。

**后台功能**
- 列表展示每条提交的：提交时间、姓名、学号、测验结果类型、四个维度得分（原本论 / 新实证论 / 建构论 / 批判理论）。
- 数据来自 Vercel API + KV 存储；可点击「刷新」获取最新列表。
- 桌面端为表格，手机端为卡片列表；可「返回首页」或「退出登录」。

## Vercel 一体化说明（提交与数据存储）

本项目已改为 **Vercel 一体化**：前端与数据接口均部署在 Vercel，不再依赖 Firebase。

- **提交**：用户点击「查看结果」后，前端请求同源接口 `POST /api/submit`，由 Vercel Serverless 写入 **Vercel KV（Redis）**。
- **管理员列表**：后台请求 `GET /api/results`（需带管理员密码头），从 KV 读取后展示。
- **优点**：同源请求、无需直连 Google，国内访问更稳定；配置好 KV 与 `ADMIN_SECRET` 即可使用。
- **环境变量**：`VITE_ADMIN_PASSWORD`（前端）、`ADMIN_SECRET`（API 校验，建议与前者一致）；KV 相关变量由 Vercel 在绑定 Storage 后自动注入。
