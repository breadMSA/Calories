# 飲食紀錄

記錄每日飲食、營養素、飲水與體重趨勢的 Web App（可加入手機主畫面使用）。

## 功能

- **帳號系統**：Email + 密碼登入，憑邀請碼註冊；每個人的資料互相獨立
- **完整營養素**：熱量、蛋白質、碳水、脂肪、膳食纖維、糖、鈉、水分
- **個人化目標**：依 Mifflin-St Jeor 公式、活動量與減重／增重速度計算，也可自訂；記錄新體重時自動更新
- **飲食日記**：早餐／午餐／晚餐／點心分組，可切換日期補記、修改份量／餐別／日期，刪除可復原，一鍵複製昨天的餐
- **多種新增方式**
  - 搜尋衛福部「食品營養成分資料庫」（2,000+ 項台灣食材，離線搜尋）
  - 拍照或文字描述，由 Gemini 拆解每樣食物並估算份量與營養素，可逐項調整後加入
  - 條碼掃描（優先比對自己建立的食物，其次查詢 Open Food Facts）
  - 自訂食物，可存入「我的食物」並加上星號
- **趨勢**：每日熱量圖、平均營養素、體重平滑趨勢線、依實際紀錄推算的真實每日消耗 (TDEE)
- **匯出**：任意期間匯出 CSV（Excel 可直接開啟）

## 技術架構

| | |
|---|---|
| 前端 | React 19 + TypeScript + Vite，TanStack Query |
| 後端 | Vercel Functions (`/api`，Web 標準 Request/Response) |
| 資料庫 | Postgres（正式環境用 Neon；本機開發自動使用內建 PGlite，免設定） |
| AI | Google Gemini（`@google/genai`），預設使用免費額度，多模型自動備援 |

## 本機開發

```bash
npm install
npm run dev        # http://localhost:3000
```

不需要任何雲端設定即可執行：資料存在 `.data/`（PGlite）。第一個註冊的帳號不需要邀請碼。
如需測試 AI 分析，建立 `.env.local` 並填入 `GEMINI_API_KEY`（參考 `.env.example`）。

```bash
npm run typecheck  # 型別檢查
npm run build      # 正式建置
```

## 部署到 Vercel

1. 在 Vercel 匯入此 GitHub 專案（Framework 選 **Vite**）。
2. **Storage → Create Database → Neon (Postgres)**，連結到專案。Vercel 會自動加入 `DATABASE_URL`。資料表會在第一次請求時自動建立。
3. **Settings → Environment Variables** 新增：

   | 名稱 | 說明 |
   |---|---|
   | `GEMINI_API_KEY` | 到 [Google AI Studio](https://aistudio.google.com/apikey) 建立 |
   | `INVITE_CODE` | 註冊用的邀請碼，只給要使用的人 |
   | `GEMINI_MODELS` | 選填，依序嘗試的模型（逗號分隔）。預設 `gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.8-flash,gemini-2.5-flash-lite`：免費額度以模型分開計算，一個用完自動換下一個 |
   | `AI_DAILY_LIMIT` | 選填，每人每日 AI 分析次數，預設 40 |

4. 重新部署。

> **API Key 請只放在環境變數，不要寫進程式碼或 README。**

## 更新食品資料庫

衛福部資料約每年更新。下載 [食品營養成分資料集](https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=20&logType=2)，解壓縮後執行：

```bash
npm run build:tfda -- path/to/20_2.csv
```

## 專案結構

```
api/            Vercel Functions（auth, profile, entries, foods, water, weights, summary, analyze, barcode）
  _lib/         資料庫、驗證、共用工具（底線開頭不會被部署成端點）
shared/         前後端共用：營養素定義、目標計算、API 型別
src/
  features/     各頁面：diary, add, trends, foods, settings, profile, auth
  components/   UI 元件
  lib/          API client、查詢 hooks、日期、格式化、圖片壓縮、資料庫搜尋
public/data/    衛福部食品營養成分資料（由 scripts/build-tfda.mjs 產生）
scripts/        資料與圖示產生腳本
```
