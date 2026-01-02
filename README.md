# 每日營養追蹤 - 部署指南

這是一個每日卡路里與營養攝取追蹤應用程式，支援 AI 食物照片分析功能。

## 功能特色

- 📊 根據身高、體重、年齡、性別計算每日建議攝取量
- 🎯 追蹤四大營養素：熱量、蛋白質、鈉、水分
- 📸 AI 拍照分析食物營養（使用 Gemini Vision API）
- ✏️ 手動新增食物記錄
- 💾 雲端儲存，跨裝置同步

## 部署到 Vercel

### 1. 推送程式碼到 GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. 在 Vercel 建立專案

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 **Add New** > **Project**
3. 匯入你的 GitHub 儲存庫
4. Framework Preset 選擇 **Vite**
5. 點擊 **Deploy**

### 3. 建立 Vercel KV 資料庫

1. 在 Vercel Dashboard 進入你的專案
2. 點擊 **Storage** 標籤
3. 選擇 **Create Database** > **KV**
4. 建立後，點擊 **Connect to Project**
5. 選擇你的專案並連結

> 連結後，Vercel 會自動注入 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 環境變數

### 4. 設定環境變數

1. 進入專案 **Settings** > **Environment Variables**
2. 新增以下變數：

| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | `AIzaSyCIg_IOK2FUKb4YEWQVDofDAcLLj7nUp6k` |

3. 點擊 **Save**

### 5. 重新部署

1. 進入 **Deployments** 標籤
2. 點擊最新的部署旁邊的 **...** 選單
3. 選擇 **Redeploy**

## 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

> ⚠️ 本地開發時 API 功能不可用，因為需要 Vercel KV 和環境變數

## 專案結構

```
Calories/
├── api/                    # Vercel Serverless Functions
│   ├── analyze-food.js     # AI 食物分析 API
│   ├── records.js          # 每日記錄 CRUD
│   └── user.js             # 使用者設定
├── src/
│   ├── components/         # UI 元件
│   ├── utils/              # 工具函式
│   ├── main.js             # 應用程式入口
│   └── style.css           # 樣式設計系統
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

## 技術棧

- **前端**: Vite + Vanilla JavaScript
- **後端**: Vercel Serverless Functions
- **資料庫**: Vercel KV (Redis)
- **AI**: Google Gemini Vision API
