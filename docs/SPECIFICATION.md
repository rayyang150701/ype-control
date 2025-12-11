
# 專案規格說明書：Project Zenith

## 1. 系統總覽

**專案名稱**：Project Zenith - 燁輝智慧製造執行方案進度管制表

**目標**：建立一個現代化、高效率的網頁應用程式，用於追蹤、管理和匯報「燁輝智慧製造執行方案」下所有子專案的進度。此系統旨在取代傳統的、手動的報表製作流程，提供一個即時、互動且具備智慧輔助功能的中央化管理平台。

**核心價值**：
- **效率提升**：透過「複製上週計畫」、AI 智慧填寫等功能，大幅縮短週報填寫時間。
- **資訊透明化**：儀表板提供所有專案狀態的即時快照，讓管理者一目了然。
- **管理精細化**：支援主專案、子專案的獨立管理，並提供暫緩、恢復、刪除等完整的生命週期操作。
- **報表自動化**：一鍵匯出符合現有格式要求的 Excel 報表，消除手動彙整的繁瑣工作。

---

## 2. 核心功能詳解

### 2.1 儀表板 (Dashboard)

- **核心功能**：以卡片網格 (Grid View) 和表格視圖 (Table View) 兩種模式，展示所有子專案的最新狀態。
- **卡片視圖 (Grid View)**：
    - 每個子專案以一張獨立卡片呈現。
    - 卡片內容包含：主專案案號/名稱、子專案名稱、TPM 窗口、預計完成日、最新週報摘要、下週計畫、遭遇問題、完成度進度條。
    - **狀態標示**：
        - **逾期未報**：若超過一週未更新週報，卡片以紅色邊框高亮。
        - **延遲**：若未完成且已超過預計完成日，會在日期旁標示延遲天數。
        - **暫緩中**：若專案或子專案被設為暫緩，卡片以黃色邊框及標籤高亮，並停止逾期計算。
- **表格視圖 (Table View)**：
    - 以主專案為單位，合併展示其下所有子專案的詳細資訊。
    - 支援主專案案號的降序排列。
    - 對於內容過長的欄位（如專案目的），提供展開/收合功能。
    - **暫緩狀態視覺化**：
        - 若主專案只有一個子專案且被暫緩，則整列變色。
        - 若主專案有多個子專案，只有被暫緩的子專案獨有欄位會變色。
- **互動操作**：
    - **點擊卡片/子專案名稱**：開啟該子專案的歷史週報時間軸。
    - **新增週報**：卡片下方提供快速按鈕，可直接為該子專案新增週報。

### 2.2 週報管理 (Progress Log)

- **新增週報**：
    - **智慧帶入**：開啟新增表單時，自動將「上週的下週計畫」填入「本週執行摘要」。
    - **AI 智慧填寫**：提供「AI 智慧填寫」按鈕，能根據使用者輸入的本週摘要和下週計畫，結合上週紀錄，自動建議「遭遇問題及風險」和「總體完成度」。
    - 提報區間會根據當前日期自動產生。
- **編輯週報**：在歷史時間軸中，可對任何一筆歷史週報進行修改。
- **歷史時間軸**：
    - 以全螢幕彈窗展示，垂直時間線清晰呈現從最新到最舊的所有週報紀錄。
    - 提供「匯出歷史紀錄」功能。

### 2.3 專案生命週期管理

- **新增專案**：
    - 透過彈窗表單，一次性建立一個主專案及其下的多個子專案。
    - 需填寫主專案的基本資訊（案號、名稱、目的等）和每個子專案的資訊（名稱、負責人、預計完成日等）。
    - 負責人可從現有使用者列表中選擇。
- **編輯專案**：
    - 可修改主專案的所有資訊。
    - 可新增、刪除或修改其下的子專案。
    - 支援修改已暫緩專案的資訊。
- **刪除專案**：
    - 管理員專屬功能。
    - 需在確認彈窗中輸入專案的「案號」，以防止誤刪。
    - 刪除為永久性操作，會一併刪除其下所有子專案和週報紀錄。
- **專案暫緩 (On-Hold)**：
    - 透過獨立對話框進行批量操作。
    - 可選擇一個主專案，並勾選其下一個或多個子專案來設定暫緩。
    - 若勾選主專案下的所有子專案，則整個主專案會被標記為暫緩。
    - 需填寫暫緩原因、開始日期等資訊。
- **恢復專案 (Resume)**：
    - 透過獨立對話框進行批量操作。
    - 系統會自動列出所有處於暫緩狀態的主專案和子專案。
    - 使用者可勾選需要恢復的項目，進行批量恢復。

### 2.4 Excel 報表匯出

- **匯出總表**：
    - 一鍵將儀表板上所有專案的最新狀態，匯出成一份 Excel 總覽表。
    - 樣式、欄位、合併儲存格等完全比照現有的手動報表格式。
    - **暫緩樣式**：精準控制儲存格顏色，僅在被暫緩的子專案獨有欄位上套用灰色字體。
- **匯出歷史紀錄**：
    - 在子專案時間軸彈窗中，可將該子專案的所有歷史週報匯出成一份獨立的 Excel 表。

### 2.5 使用者管理

- **功能**：提供一個獨立頁面，讓管理員可以管理系統中的所有使用者。
- **操作**：支援新增、編輯和刪除使用者。
- **屬性**：可設定使用者的姓名、Email、角色（管理員、編輯者、檢視者）和狀態（啟用、停用）。

---

## 3. 技術架構 (Tech Stack)

- **前端框架**: Next.js (App Router)
- **UI 元件庫**: React, ShadCN UI
- **樣式**: Tailwind CSS
- **語言**: TypeScript
- **後端服務 & 資料庫**: Firebase (Firestore, Authentication)
- **伺服器端邏輯**: Node.js (透過 Next.js Server Actions 和 API Routes)
- **AI 功能**: Google Genkit
- **Excel 處理**: `xlsx-js-style`
- **表單管理**: `react-hook-form`
- **資料驗證**: `zod`

---

## 4. 資料庫模型 (Firestore Data Structure)

資料庫圍繞四大核心實體（Entity）構建：`Users`, `Projects`, `SubProjects`, `ProgressLogs`。

```
/users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - role: 'admin' | 'editor' | 'viewer'
  - status: 'active' | 'pending'
  - createdAt: timestamp

/projects/{projectId}
  - caseNumber: string
  - name: string
  - status: 'active' | 'on-hold' | ...
  - createdBy: string (userId)
  - projectPurpose: string
  - ... (其他主專案資訊)
  - isOnHold: boolean
  - ... (其他暫緩資訊)

  /sub_projects/{subProjectId}
    - name: string
    - owner: string (userId)
    - projectId: string
    - expectedCompletionDate: timestamp
    - ... (其他子專案資訊)
    - isOnHold: boolean
    - ... (其他暫緩資訊)

    /progress_logs/{progressLogId}
      - reportingPeriod: string
      - executionSummary: string
      - nextWeekPlan: string
      - roadblocks: string
      - completionPercentage: number
      - updatedAt: timestamp
      - createdBy: string (userId)
```

**設計原則**：
- **層級化結構**：`SubProjects` 和 `ProgressLogs` 作為 `Projects` 的子集合，結構清晰，便於查詢。
- **反正規化 (Denormalization)**：`Project`、`SubProject` 和 `ProgressLog` 中都直接儲存了建立者或擁有者的 `userId`，這使得權限規則的撰寫變得極為高效，無需在規則中進行跨集合的 `get()` 查詢。
- **狀態欄位**：透過 `status` 和 `isOnHold` 等欄位明確地對實體狀態進行建模，便於篩選和邏輯處理。

---

## 5. 風格指南 (Style Guidelines)

- **主要顏色 (Primary)**: Dark teal (`#008080`) - 營造可靠、專業的感覺。
- **背景顏色 (Background)**: Very light teal (`#F0FFFF`) - 提供乾淨、不干擾的背景。
- **強調顏色 (Accent)**: Orange (`#FFA500`) - 用於高亮關鍵互動元素和重要警示（如逾期專案）。
- **字體搭配**:
    - **標題 (Headline)**: 'Belleza' (sans-serif) - 優雅、現代。
    - **內文 (Body)**: 'Alegreya' (serif) - 易於閱讀。
    - **程式碼 (Code)**: 'Source Code Pro' (monospace) - 用於顯示技術細節。
- **圖示 (Icons)**: [Lucide React](https://lucide.dev/guide/react) - 使用清晰、一致的圖示庫來表示各種操作和狀態。
- **響應式設計**: 儀表板採用響應式網格布局，確保在不同尺寸的螢幕上都有良好的可用性。
