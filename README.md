<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/69601229-b8d5-41e2-97d9-9fb5b360f41a

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## 手机端访问与测试

- 部署到 Vercel 后，用手机浏览器打开项目地址即可访问和提交。
- 本地开发时在手机测试：保证手机和电脑在同一 WiFi，运行 `npm run dev` 后用浏览器访问 `http://<你的电脑局域网IP>:3000`（终端会显示可访问的地址）。
- 提交流程已针对触屏优化：大按钮、防误触、安全区适配；提交中会显示“正在提交” overlay，成功后短暂显示“提交成功”再跳转结果页。

## Deploy to Vercel

1. **推送代码到 GitHub**，并确保仓库可被 Vercel 访问。

2. **在 Vercel 创建项目**
   - 打开 [vercel.com](https://vercel.com) 并登录
   - 点击 **Add New** → **Project**，导入你的 GitHub 仓库
   - Vercel 会自动识别为 Vite 项目（Build Command: `npm run build`，Output Directory: `dist`）

3. **配置环境变量**（在 Vercel 项目 **Settings → Environment Variables** 中）：
   - `GEMINI_API_KEY`：你的 Gemini API Key（用于服务端/构建时）
   - `VITE_ADMIN_PASSWORD`：管理员密码（可选，会打入前端构建）

4. **部署**
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
- 数据来自 Firestore 集合 `test_results`，实时更新（有新增提交会自动刷新）。
- 桌面端为表格，手机端为卡片列表；可「返回首页」或「退出登录」。
