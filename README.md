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
