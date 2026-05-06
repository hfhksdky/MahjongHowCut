# Mahjong Tile Efficiency PoC

## What this PoC includes

- Multi-question practice (**Q1–Q10**；Q7–Q10 來自 cv39816653，`data/questions.json`）
- Two question types:
  - Tile discard (`tile`)
  - Special action choice (`choice`, e.g. 槓 / 不槓)
- Immediate correctness + original solution text (Traditional Chinese converted)
- Reference links in each question
- Local progress tracking (overall + per question)
- **Per-question notes** (`本題研讀筆記`)
- Practice page：**回報／校正**表單可將修正寫入 `localStorage` 覆寫題庫欄位；**複習標記**★；作答後在選項／牌組按鈕正下方即時標示對錯（並保留下方完整書中解答）
- Summary table shows **whether you ever answered correctly**, **last wrong time**, and **study flag**

## Run (required for UAT)

This app loads `fetch("./data/questions.json")`. Many browsers block that when you open `index.html` via `file://`, so **use a local HTTP server**.

### Windows (PowerShell)

```powershell
cd "mahjong-tile-efficiency-poc"
python -m http.server 8765
```

Then open（**請固定同一組主機名＋埠**，否則 `localStorage` 進度視為不同網站而「消失」）：

- **進度總覽（首頁）**：`http://127.0.0.1:8765/index.html`
- **單題練習**：`http://127.0.0.1:8765/play.html`

### UAT：測試不同題庫檔（總覽與練習請用同一組參數）

- **正式題庫**：`index.html` 或 `play.html`（預設載入 `data/questions.json`）
- **抽取產檔**：`index.html?bank=questions.generated.json` ／ `play.html?bank=questions.generated.json`

Practice page also accepts `?q=q3`（與總覽「練習」連結一致）。題庫白名單：`questions.json`, `questions.generated.json`。

### 匯入「其他題目」（照順序做）

在 **`mahjong-tile-efficiency-poc`** 資料夾開 PowerShell：`cd "<你的專案路徑>\mahjong-tile-efficiency-poc"`

**步驟 1 — 從網址拿到 cv 數字**（貼 opus 或 read 連結都行）：

`python tools\parse_bilibili_cv_url.py "貼這裡"`

終端會印一個數字（例如 `39816653`），記下來當 `<CV>`。

**步驟 2 — 下載題圖**（`<CV>` 換成數字；資料夾名建議對應）：

`python tools\fetch_cv_question_images.py --cv <CV> --out-dir assets\extracted_cv<CV> --save-html tools\_snippet_<CV>.html`

完成後可到 `assets\extracted_cv<CV>` 裡確認有 `q7.png`、`q8.png` 這類檔。（若這裡失敗，再打開 `tools\_snippet_<CV>.html` 看是否是文章內文；必要時可查 README 表格用 `--from-html` 離線再試。）

**步驟 3 — 寫進網頁題庫**（擇一）：

- **併入主檔**：用編輯器打開 `data\questions.json`，複製任一題那一段 `{ ... }` 改名改內容，把 `questionImage` 改成 `assets/extracted_cv<CV>/q?.png`，`answer`、`answerLine` 等對照專欄文字；**存檔**後重新整理練習頁。
- **新題庫檔**：複製為 `data\別名.json`，在 `script.js` 與 `dashboard.js` 的 **`QUESTION_BANK_FILES`** 裡加上檔名，瀏覽器網址加 `?bank=別名.json`。

**步驟 4 — 手牌／選項若與書不同**：開練習頁，用「回報／校正」依截圖改（會存本機）。

**步驟 5 — 每多一篇網站的文**：重複 **1→2**，再把新題的 JSON 區塊加進來即可；沒有其他捷徑，除非自己寫自動辨識手牌程式。

備註：瀏覽器請固定用同一條網址（例如只使用 `127.0.0.1:8765`，不要換成 `localhost`），否則進度會像在另一個網站。

## Question data source

- The app reads `data/questions.json`
- Q1：題庫內已拆解 `handTiles` + `drawTile`（互動出牌）
- Q2–Q6：`questionImage` 為 **`assets/extracted_cv39815512/q{N}.png`**
- Q7–Q10：**`assets/extracted_cv39816653/q{N}.png`**（專欄 `cv39816653` 正文為 **Quill JSON**；`fetch_cv_question_images.py` 會解析 `ops` 里的 `native-image.url` 並下載）
- **`viewinfo`** 無法取代正文：**題圖來自 **`GET /x/article/view` 裡 `data.content` HTML**。
- **`choice` 題（Q5/Q6、Q7–Q10）**：請用最新 `questions.json`。

### 從連結自動拉題配圖（WBi + HTML 切段）

先有 **`tools/bilibili_wbi.py`**（對 `article/view` 加 `w_rid`/`wts`），再配合：

| 作法 | 命令 |
|------|------|
| 全自動：**HTML** 欄位依 `<p>Qk：</p>` 切段；**Quill JSON** 欄位則依 `Q1`…`native-image` | `python tools/fetch_cv_question_images.py --cv 39815512 --out-dir assets/extracted_cv39815512` 或 `--cv 39816653 --out-dir assets/extracted_cv39816653` |
| 從 **read/cv** 或 **opus** 網址取 **cv 數字**（opus 會抓 HTML 內嵌的 `cv…`） | `python tools/parse_bilibili_cv_url.py "https://www.bilibili.com/read/cvXXXX"` 或 `…/opus/1001698046913806392` |
| 離線：`data.content` 存成 `.html` 後再解析 | `python tools/fetch_cv_question_images.py --from-html tools/_last_article_content.html --out-dir assets/extracted_cv39815512` |
| **不再打正文 API**：只對 CDN 下載 | `python tools/download_question_images_from_json.py --manifest data/cv39815512_hand_image_urls.json --out-dir assets/extracted_cv39815512` |

分段內會略過共用**分隔線圖**檔 **`02db465212d3c374a43c60fa2625cc1caeaab796.png`**。長截圖手動裁切仍可用 `tools/crop_question_panel.py`。

**Q7+（另一篇專欄）**：流程與上表相同：`parse_bilibili_cv_url.py` 取 **cv id** → `--cv` 換成新數字跑出題圖 → 將 `questionImage`、`handTiles`／`choices`／`answer` 寫入新的 `data/questions_*.json`。網頁端白名單目前只有 `questions.json` 與 `questions.generated.json`；要使用第三份題庫需把檔名加進 **`script.js` 與 `dashboard.js`** 裡的 `QUESTION_BANK_FILES`。我這邊無法在你未貼連結／未跑腳本時自動完成第二篇正文解析，但若結構仍是 `Qk：` 切段，現有機器仍可複用。

### 尚須注意的難點

| 難點 | 說明 |
|------|------|
| **封面 ≠ 題圖** | `x/article/viewinfo` 的 `image_urls` 多為横幅／譯註，誤用作題面會失真。 |
| **正文 SPA** | `/read/cv…` 回傳的 HTML 很短，題面圖通常不在 SSR 原始碼裡。 |
| **正文 API** | `x/article/view` 類介面常有 **請求過於頻繁 (-509)** 或需 Cookie / **WBi 簽名** 等門檻。 |
| **版式改版** | 若非 `<p>Qk：</p>` 結構或其他分隔裝飾檔需改切段規則 / manifest。 |
| **出牌辨識** | 即使有圖像，要變 `handTiles`/`drawTile` 還要 **版面偵測 + template match / OCR**，工程量大於「抓到 URL」。 |


## Extraction workflow (first version)

1. Put article plain text into a file (example: `data/raw_cv39815512.txt`)
2. Run:

`python tools/extract_bilibili_questions.py --text-file data/raw_cv39815512.txt --source-url "https://www.bilibili.com/read/cv39815512/?from=search&spm_id_from=333.337.0.0&opus_fallback=1" --output data/questions.generated.json`

3. Review generated JSON and fill hand tiles / draw tiles / special choices as needed.

## Planned next step

- Direct image extraction from Bilibili question images into `handTiles` + `drawTile`
- Auto classify `tile` vs `choice` questions with confidence score
