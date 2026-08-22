# AI QA Toolkit

**AI-powered Tools for Smarter and Faster Software Testing**
*Bộ công cụ AI hỗ trợ kiểm thử phần mềm thông minh và nhanh hơn.*

24 công cụ QA/QC trong một web app: 20 công cụ chạy hoàn toàn trong trình duyệt và
4 công cụ có AI hỗ trợ (test case, bug report, phân tích log, test report).
Node.js server đi kèm vừa serve site vừa làm proxy giữ API key ở phía server.

- **Không có dependency runtime** — `npm install` không cần thiết, `npm start` là chạy.
- Không có build step: HTML + CSS + JavaScript thuần.
- Mỗi công cụ có URL riêng (`#/t/json-formatter`) nên bookmark được.
- Giao diện EN/VI, Light/Dark, responsive desktop → mobile, `Ctrl+K` để tìm.
- Màu chủ đạo `#C8102E` theo logo công ty.
- `npm test` chạy 300+ assertion không cần framework.

---

## 1. Yêu cầu

| | |
|---|---|
| Node.js | **>= 18.17** (khuyến nghị 22 LTS) |
| VS Code | bất kỳ bản mới |
| npm packages | **không có** |

Kiểm tra Node đã có chưa:

```bash
node -v
```

Nếu báo lỗi *not recognized*, cài bằng winget (Windows 10/11):

```bash
winget install OpenJS.NodeJS.LTS
```

Đóng và mở lại terminal sau khi cài để PATH được nạp.

---

## 2. Chạy

```bash
npm start
```

Mở http://localhost:8123/

Chế độ tự khởi động lại khi lưu file:

```bash
npm run dev
```

Chạy bộ kiểm thử:

```bash
npm test
```

Đổi port:

```bash
set PORT=8080 && npm start
```

### Mở trực tiếp không cần server

`index.html` mở thẳng bằng trình duyệt vẫn chạy được **20 công cụ offline**.
Riêng các công cụ AI, SHA-384/512 và xác minh chữ ký JWT HS256 cần trang chạy qua
`http://` (trình duyệt chặn `file://` với Web Crypto và request cross-origin).

`serve.bat` / `serve.ps1` vẫn còn trong repo như phương án dự phòng khi máy chưa có Node
(chúng dùng PowerShell `HttpListener`, không làm proxy AI).

---

## 3. Làm việc trong VS Code

Mở thư mục này bằng VS Code. Cấu hình đã có sẵn trong `.vscode/`.

**Phím tắt**

| Phím | Việc |
|---|---|
| `F5` | Start toolkit server (có debugger, tự mở browser) |
| `Ctrl+Shift+B` | Task *Serve toolkit* |
| `Ctrl+Shift+P` → Tasks: Run Test Task | Chạy `npm test` |

**Cấu hình Run and Debug** (`.vscode/launch.json`)

- *Start toolkit server* — chạy `server/server.js`, breakpoint được ở code server.
- *Start toolkit server (watch)* — như trên nhưng `node --watch`.
- *Run self test* — debug từng assertion trong `scripts/selftest.js`.
- *Debug frontend in Chrome* / *in Edge* — breakpoint được trong `js/tools/*.js`.
- *Server + Chrome* (compound) — chạy cả hai, debug full-stack cùng lúc.

**Extension gợi ý** (`.vscode/extensions.json`) — VS Code sẽ hỏi khi mở thư mục.
Không có extension nào là bắt buộc.

`jsconfig.json` bật IntelliSense cho cả code browser (`lib: DOM`) và code server.

---

## 4. Chọn nhà cung cấp AI

Trình duyệt **luôn** nói một thứ tiếng: Claude Messages API. Server dịch sang dialect
của nhà cung cấp, nên đổi provider chỉ là đổi `.env` — cả 4 công cụ AI không cần sửa gì.

| Preset | Chi phí | Lấy key tại | Trạng thái endpoint |
|---|---|---|---|
| `ollama` | Miễn phí, chạy trên máy | không cần | phụ thuộc máy đang chạy Ollama |
| `groq` | Miễn phí (free tier) | console.groq.com/keys | ✅ reachable, chờ key |
| `gemini` | Miễn phí (free tier) | aistudio.google.com/apikey | ✅ reachable, chờ key |
| `cerebras` | Miễn phí (free tier) | cloud.cerebras.ai | ✅ reachable, chờ key |
| `mistral` | Miễn phí (free tier) | console.mistral.ai/api-keys | ✅ reachable, chờ key |
| `nvidia` | Miễn phí (free tier) | build.nvidia.com | ✅ reachable, chờ key |
| `openrouter` | Miễn phí (model `:free`) | openrouter.ai/keys | ✅ reachable, chờ key |
| `anthropic` | Trả phí | console.anthropic.com | ✅ reachable, chờ key |
| ~~`github`~~ | — | — | ❌ **khai tử 30/07/2026**, server từ chối chạy |

Cột trạng thái lấy từ `npm run probe` — xem bên dưới. Chọn provider bằng cách mở `.env`,
bỏ comment đúng một khối trong [.env.example](.env.example), rồi `npm start`. Banner in ra
provider, model và endpoint đang dùng.

### Kiểm tra provider nào dùng được (không cần key)

```bash
npm run probe
```

Gửi một request nhỏ tới từng endpoint và phân biệt ba loại lỗi mà từ trong toolkit trông
giống nhau:

| Kết quả | Nghĩa là |
|---|---|
| `NEEDS KEY` | Endpoint đúng và tới được — chỉ cần dán key vào `.env` là chạy |
| `BAD URL` | Preset sai đường dẫn, có key cũng không chạy |
| `BLOCKED` | Mạng này không ra được (proxy/firewall công ty, DNS) — có key cũng không chạy |
| `RETIRED` | Service đã đóng (410 Gone) |

**Chạy lại lệnh này trên máy sẽ deploy** — mạng ở đó quyết định, và kết quả thường khác
máy dev. Có key thật thì đặt vào biến tương ứng để probe gọi thật một token:
`set GROQ_KEY=gsk_... && npm run probe`

**Riêng tư vs chất lượng:** toolkit này xử lý AC, log và API response nội bộ. Nếu dữ liệu
là của khách hàng thật thì `ollama` là lựa chọn duy nhất không gửi gì ra ngoài. Các free
tier khác thường có điều khoản cho phép dùng dữ liệu để cải thiện sản phẩm — đọc kỹ trước
khi dán log thật.

### Ollama (miễn phí, chạy offline)

Tải tại https://ollama.com/download, rồi:

```bash
ollama pull llama3.2:3b
```

Nếu ổ C hết chỗ, chuyển thư mục model sang ổ khác rồi mở lại terminal:

```bash
setx OLLAMA_MODELS "D:\ollama-models"
```

Trong `.env`: `AI_PRESET=ollama` và `AI_MODEL=llama3.2:3b`.

### Test không cần provider nào

Có mock provider sẵn để kiểm tra toàn bộ luồng AI mà không cần key, không tốn tiền:

```bash
npm run mock
```

Rồi ở terminal khác:

```bash
set AI_PROVIDER=openai && set AI_API_URL=http://127.0.0.1:8199/v1/chat/completions && set AI_MODEL=mock-1 && npm start
```

Nội dung trả về là **text cố định, không phải model thật** — chỉ dùng để verify plumbing
(stream, render markdown, nút Stop, đếm token), không dùng để đánh giá chất lượng.

## 5. Cấu hình trong giao diện

Bấm **AI Settings** ở góc dưới sidebar. Có 3 chế độ:

### Server *(khuyến nghị — mặc định khi phát hiện được server)*

Request đi tới `POST /api/ai`. Node server đọc `ANTHROPIC_API_KEY` từ môi trường của nó
và forward lên `api.anthropic.com`, **stream SSE trả về nguyên vẹn**. Trình duyệt không
bao giờ thấy key.

```bash
copy .env.example .env
```

Mở `.env`, điền `ANTHROPIC_API_KEY=sk-ant-...` rồi chạy lại `npm start`.
Server in ra `AI proxy   ready` khi key đã nạp được.

Lần đầu mở toolkit từ server đã có key, chế độ Server được **chọn tự động** — không cần
nhập gì trong trình duyệt.

### Direct

Dán API key thẳng vào trình duyệt; toolkit gọi `api.anthropic.com` với header
`anthropic-dangerous-direct-browser-access: true`.
⚠️ Key nằm trong `localStorage` — ai dùng được máy đó đều đọc được. Chỉ dùng máy cá nhân.

### Custom

Nhập endpoint của bạn (gateway sẵn có, hoặc mock server để test UI).
Toolkit gửi **đúng body JSON như `/v1/messages`**.

### Tham số

| Mục | Mặc định | Ghi chú |
|---|---|---|
| Model | `claude-opus-5` | thêm `claude-sonnet-5`, `claude-haiku-4-5` |
| Effort | `high` | `low`…`max`, chỉ áp dụng cho model 4.6+ |
| Max output tokens | 16000 | |
| Answer language | Theo giao diện | có thể ép EN hoặc VI |

Nút **Test connection** gọi một request rất nhỏ để xác nhận đường đi hoạt động.

---

## 6. API của server

| Endpoint | Mô tả |
|---|---|
| `GET /api/health` | `{ ok, service, aiConfigured, defaultModel, node }` — frontend dùng để tự phát hiện server |
| `POST /api/ai` | Nhận body của `/v1/messages`, thêm credentials phía server, stream response về |
| `GET /*` | File tĩnh |

`POST /api/ai` trả về:

- `503 not_configured` khi server chưa có `ANTHROPIC_API_KEY` (UI hiện đúng hướng dẫn sửa).
- `400` khi body không phải JSON hoặc thiếu `messages`.
- `413` khi body vượt `MAX_BODY_BYTES` (mặc định 2 MB).
- `502` khi không gọi được upstream, kèm message gốc.

Bảo mật đã áp dụng ở server:

- Bind `127.0.0.1` theo mặc định — proxy giữ key nên không tự phơi ra LAN.
  Đặt `HOST=0.0.0.0` khi muốn chia sẻ, và **hãy đặt auth của bạn phía trước**.
- Không serve `.env`, `.git`, `node_modules`, `server/` qua http.
- Chống path traversal: mọi đường dẫn phải nằm trong project root.
- Client ngắt kết nối giữa stream thì request upstream bị abort (không đốt token vô ích).
- Timeout mặc định 10 phút cho request AI dài.

---

## 7. Danh sách công cụ

### Văn bản (Text) — 6

| Công cụ | Chức năng |
|---|---|
| Text Compare | So sánh 2 đoạn văn bản theo dòng (LCS diff), tô sáng từ khác nhau, bỏ qua hoa/thường, chỉ hiện phần khác |
| Character & Word Counter | Đếm ký tự / từ / dòng / byte UTF-8, kiểm tra giới hạn độ dài trường |
| Case Converter | UPPER, lower, Title, camelCase, PascalCase, snake_case, CONSTANT_CASE, kebab-case, dot.case, slug (bỏ dấu tiếng Việt) |
| Line Tools | Lọc dòng trùng, sắp xếp, đảo, cắt khoảng trắng, đánh số, thêm tiền tố/hậu tố |
| Regex Tester | Thử regex, xem group, replace preview, chế độ "mỗi dòng là 1 giá trị" (PASS/FAIL), 9 mẫu sẵn (email, SĐT VN, MST, CCCD, UUID…) |
| **Acceptance Criteria Linter** | Bắt diễn đạt không kiểm thử được trong AC (từ mơ hồ, thiếu ngưỡng số, "v.v.", TBD, có giới hạn mà không nói khi vượt, thiếu luồng lỗi, câu bị động che chủ thể) và **biến thành danh sách câu hỏi gửi BA**. Không cần AI, chạy tức thì, EN + VI |

### Dữ liệu (Data) — 7

| Công cụ | Chức năng |
|---|---|
| JSON Formatter & Validator | Format / validate / minify, **báo lỗi kèm dòng + cột + con trỏ ^**, sắp xếp key, escape/unescape, thống kê độ sâu |
| CSV ⇄ JSON | Chuyển 2 chiều, tự nhận dấu phân cách, xem trước dạng bảng. **Giữ nguyên số 0 đầu** (SĐT, MST không bị biến thành số) |
| SQL Formatter | Định dạng / thu gọn SQL, tokenizer riêng nên không phá chuỗi và comment |
| Timestamp Converter | Unix s/ms ⇄ ngày giờ theo giờ máy / UTC / Việt Nam (UTC+7), thời gian tương đối, đồng hồ hiện tại |
| Base64 | Mã hóa / giải mã UTF-8, biến thể URL-safe, mã hóa file thành data URI |
| URL Encoder / Decoder | encodeURI / encodeURIComponent, tách URL thành từng phần và bảng tham số query |
| **VN Data Validator** | Dán một cột từ Excel — MST, CCCD/CMND, SĐT, email, số tài khoản, số thẻ — chỉ ra dòng nào sai **và sai vì sao** ("check digit là 7, đúng phải 6"), phát hiện giá trị trùng, gộp nhóm nguyên nhân, xuất CSV. Verify chéo với generator: 30/30 MST sinh ra đều validate đúng |

### API & Bảo mật — 4

| Công cụ | Chức năng |
|---|---|
| JWT Decoder | Đọc header/payload, tóm tắt claim, cảnh báo `alg: none`, tính hạn `exp`, **xác minh chữ ký HS256** bằng secret |
| Hash Generator | MD5, SHA-1, SHA-256 (pure JS, chạy được cả offline) + SHA-384/512 (Web Crypto), ô đối chiếu hash |
| API Response Analyzer | Gửi request thật (GET/POST/PUT/PATCH/DELETE) hoặc dán response; đánh giá status, thời gian, header bảo mật thiếu, body JSON, trường null/rỗng. **Import/export cURL** — dán lệnh dev gửi là tự điền, hoặc xuất request thành cURL để gắn vào bug report |
| **HAR / Network Analyzer** | Kéo file `.har` từ DevTools vào: bảng toàn bộ request kèm thanh thời gian, và tự phát hiện 5xx/4xx, request >1s và >3s, TTFB cao (lỗi ở backend chứ không phải mạng), **mẫu N+1** (cùng một call lặp ≥5 lần), payload >500KB, **credential nằm trong query string**, mixed content, cookie thiếu Secure/HttpOnly, thiếu security header. Xuất CSV |

### Tạo dữ liệu (Test Data) — 3

| Công cụ | Chức năng |
|---|---|
| Test Data Generator (VN) | 23 trường: họ tên, giới tính, ngày sinh, email, SĐT VN, địa chỉ, **MST 10 số đúng check digit**, CCCD 12 số, công ty, số tài khoản… Xuất bảng / CSV / JSON / SQL INSERT. Có **seed** để tái lập đúng bộ dữ liệu |
| UUID / ID Generator | UUID v4 (nhiều định dạng), ULID sắp theo thời gian, nil UUID, ID số, tối đa 5000 giá trị |
| Random String & Boundary Values | Chuỗi ngẫu nhiên, mật khẩu mạnh, OTP, API token + **25 giá trị biên** sẵn dùng cho test âm (chuỗi rỗng, emoji, full-width, ngày 30/02, SQL/XSS/path-traversal probe…) |

### Trợ lý AI — 4

| Công cụ | Đầu vào | Đầu ra |
|---|---|---|
| AI Test Case Designer | Feature + AC + độ sâu | Bảng test case (ID, Title, Type, Priority, Precondition, Steps, Data, Expected) + Coverage notes + câu hỏi còn mở. **Xuất CSV** |
| AI Bug Report Writer | Ghi chú thô + môi trường + log | Bug report chuẩn / ticket Jira / bản ngắn, kèm phán đoán nguyên nhân và mục "thiếu thông tin cần xác nhận" |
| AI Log & Error Analyzer | Stack trace / log / API lỗi | What failed → bảng bằng chứng → 3 nguyên nhân có xếp hạng độ tin cậy → thuộc layer nào → việc QA làm tiếp |
| AI Test Report Builder | Phạm vi + số liệu + defect | Executive summary, bảng kết quả, defect theo severity, rủi ro, đánh giá chất lượng, khuyến nghị GO / NO-GO |

Các công cụ AI **tự kiểm tra tính nhất quán của số liệu** (pass+fail+blocked+chưa chạy ≠ tổng
thì báo lệch chứ không tự sửa) và được yêu cầu **không bịa** số liệu, bug id hay module
không có trong input.

---

## 8. Bảo mật & dữ liệu

- 17 công cụ offline: dữ liệu bạn nhập **không rời khỏi trang**. Không analytics, không request ngoài.
- 4 công cụ AI: nội dung bạn bấm chạy được gửi tới Claude API. Hãy xóa dữ liệu khách hàng thật, token, mật khẩu trước khi gửi — mỗi trang AI đều có nhắc.
- Dùng chế độ **Server** khi deploy dùng chung để API key không nằm ở trình duyệt.
- `.env` đã nằm trong `.gitignore` và bị server từ chối serve qua http.
- Test Data Generator sinh **dữ liệu giả**, có gắn nhãn cảnh báo rõ. Họ tên / MST / CCCD ngẫu nhiên, không phải dữ liệu cá nhân thật.
- Các chuỗi SQL injection / XSS trong Boundary Values là **probe để kiểm tra chính ứng dụng của bạn khi được cho phép** — chỉ nhằm xác minh input có được escape hay không.

---

## 9. Cấu trúc thư mục

```
package.json             scripts: start / dev / test (không có dependency)
server/server.js         static server + proxy /api/ai + /api/health
server/providers.js      adapter Claude dialect <-> OpenAI dialect
server/security.js       headers, auth, rate limit, audit log
scripts/selftest.js      npm test — nạp chính code browser rồi assert
scripts/mock-provider.js npm run mock — provider giả để test luồng AI
scripts/probe-providers.js npm run probe — endpoint nào tới được
.env.example             mẫu cấu hình, copy thành .env
.vscode/                 launch, tasks, settings, extensions
jsconfig.json            IntelliSense cho code browser + server

index.html               khung trang + thứ tự nạp script
assets/css/app.css       design tokens, light/dark, responsive
js/core.js               registry, router hash, i18n, markdown, helper DOM
js/i18n.js               chuỗi giao diện EN/VI
js/boot.js               khởi động: theme, ngôn ngữ, search, probe server
js/ai.js                 client Messages API (3 chế độ, streaming) + modal cấu hình
js/lib/hash.js           MD5 / SHA-1 / SHA-256 pure JS, base64, base64url
js/lib/diff.js           LCS line diff + inline word diff
js/lib/csv.js            parse / stringify CSV theo RFC 4180
js/lib/sqlfmt.js         tokenizer + formatter SQL
js/lib/faker.js          sinh dữ liệu VN (có seed), check digit MST
js/lib/vnvalid.js        validator MST / CCCD / SĐT / email / số thẻ
js/lib/scrub.js          che dữ liệu nhạy cảm trước khi gửi AI
js/lib/har.js            parse + phân tích HAR, và import/export cURL
js/lib/aclint.js         linter cho Acceptance Criteria
js/tools/*.js            24 công cụ, mỗi file một công cụ
logs/audit.jsonl         audit log (git-ignored, không serve qua http)
serve.bat / serve.ps1    server dự phòng khi máy chưa có Node
docs/DE-TAI.md           nội dung đề tài (bài toán, giải pháp, giá trị, đối tượng)
```

---

## 10. Thêm một công cụ mới

Tạo `js/tools/my-tool.js`:

```js
QAT.register({
  id: 'my-tool',                 // cũng là URL: #/t/my-tool
  group: 'data',                 // text | data | security | generator | ai
  icon: '★',
  name: { en: 'My Tool', vi: 'Công cụ của tôi' },
  desc: { en: 'What it does.', vi: 'Công cụ này làm gì.' },
  tags: ['keyword', 'for search'],
  ai: false,                     // true nếu gọi AI

  build: function (root) {
    var L = QAT.L;               // L('English', 'Tiếng Việt')
    root.innerHTML = QAT.panel({
      title: L('Input', 'Dữ liệu vào'),
      body: '<textarea id="mtIn"></textarea>' +
            '<button class="btn" id="mtRun">' + L('Run', 'Chạy') + '</button>'
    });
    root.querySelector('#mtRun').addEventListener('click', function () {
      QAT.toast(L('Done', 'Xong'), 'ok');
    });
  }
});
```

Thêm `<script src="js/tools/my-tool.js"></script>` vào `index.html`.
Công cụ tự xuất hiện ở sidebar, dashboard và ô tìm kiếm.

`npm test` sẽ tự kiểm tra công cụ mới: tên file phải trùng `id`, phải có tên + mô tả EN/VI,
phải có `tags` và `build`, `group` phải hợp lệ.

Helper dùng được: `QAT.panel()`, `QAT.status(el)`, `QAT.copy()`, `QAT.download()`,
`QAT.toast()`, `QAT.md()`, `QAT.jsonHighlight()`, `QAT.esc()`, `QAT.bytes()`,
`QAT.csv`, `QAT.diff`, `QAT.hash`, `QAT.sql`, `QAT.faker`, `QAT.ai.wire()`.

---

## 11. Deploy

### Static host — cách được cấu hình sẵn

20/24 công cụ không cần server gì cả, nên static host là đủ và an toàn nhất:
không có server để bị tấn công, không có API key để rò rỉ. Bundle chỉ **448 KB / 41 file**.

**GitHub Pages** — workflow đã có sẵn tại [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Rồi vào **Settings → Pages → Source: GitHub Actions**. Mỗi lần push lên `main` sẽ:
chạy `npm test` trước (fail thì **không** deploy), ghép bundle, kiểm tra mọi thẻ `<script>`
và `<link>` đều resolve được, xác nhận `server/`, `scripts/`, `.env` không lọt vào bundle,
rồi publish.

**Netlify / Cloudflare Pages** — không cần build command, publish directory là gốc repo.
Hai host này đọc file [_headers](_headers) nên **giữ được toàn bộ security header** (CSP,
X-Frame-Options, HSTS…) giống như khi chạy Node server.

⚠️ **GitHub Pages không hỗ trợ custom header.** Nếu deploy lên Pages thì mất CSP,
X-Frame-Options, Referrer-Policy và HSTS. Với tool nội bộ thì thường chấp nhận được, nhưng
cần biết. Muốn giữ header thì chọn Netlify hoặc Cloudflare Pages.

**Các công cụ AI trên static host:** không có `/api/ai`, nên toolkit sẽ báo đúng lý do
("địa chỉ này serve được file nhưng không có endpoint /api/ai"). Hai cách dùng:
nút **Copy prompt** (không cần key gì) hoặc chế độ **Direct** với key free cá nhân.
Nếu dùng Direct với provider ngoài Anthropic, thêm host đó vào `connect-src` trong `_headers`.

### Có Node ở server (nếu sau này cần proxy AI)

```bash
set HOST=0.0.0.0
set AUTH_TOKEN=<chuỗi random dài>
set BEHIND_HTTPS=true
npm start
```

Server **từ chối khởi động** nếu `HOST` không phải loopback mà thiếu `AUTH_TOKEN` — đó là
có chủ đích, không phải lỗi. Đặt sau reverse proxy (IIS ARR / Nginx) có TLS.
Với PM2: `pm2 start server/server.js --name qa-toolkit`.

Sinh token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 12. Đã kiểm thử

`npm test` (`scripts/selftest.js`) nạp **chính các file browser** rồi assert:

- MD5 / SHA-1 / SHA-256 khớp test vector chuẩn, và khớp `crypto.subtle` ở các mốc padding 55/56/64/119 byte cùng chuỗi UTF-8 có dấu + emoji.
- CSV: ô có dấu phẩy trong ngoặc kép, `""` escape, tự nhận `,` `;` tab, và **số 0 đầu được giữ nguyên** (SĐT, MST) — số quá 15 chữ số cũng giữ dạng text.
- Diff: chuỗi thao tác same/del/add đúng, inline word diff đánh dấu đúng bên.
- 200 MST sinh ra đều thỏa công thức check digit; SĐT đúng đầu số VN; CCCD 12 số; năm sinh trong CCCD khớp ngày sinh; email chỉ dùng domain dành riêng cho test.
- Cùng seed → cùng bộ dữ liệu; seed khác → dữ liệu khác.
- SQL formatter không đụng tới keyword nằm trong chuỗi literal.
- Markdown renderer escape HTML (không XSS từ output của AI).
- Registry: 22 công cụ, id không trùng, tên file trùng id, đủ EN/VI, đúng group.
- Cấu hình AI: `ready()` đúng cho cả 3 chế độ.

Kiểm thử trên trình duyệt thật (thủ công, qua http://localhost:8123):

- 22/22 công cụ render không lỗi JS, console sạch.
- Không tràn ngang ở 530px và 1440px; sidebar off-canvas đúng ở mobile.
- Chuyển EN ⇄ VI và Light ⇄ Dark không mất dữ liệu đang nhập.
- Công cụ AI khi chưa cấu hình thì báo hướng dẫn, không crash.

---

## 13. Giới hạn hiện tại

- Chưa có database: không lưu lịch sử, không chia sẻ kết quả giữa người dùng.
- `/api/ai` chưa có auth — vì mặc định chỉ bind `127.0.0.1`. Nếu đặt `HOST=0.0.0.0`, hãy thêm auth phía trước trước khi mở cho người khác.
- API Response Analyzer bị CORS chặn với API không cho phép origin này (có chế độ dán response để thay thế).
- JWT chỉ xác minh HS256; RS256 cần public key nên không nằm trong phạm vi công cụ chạy ở trình duyệt.
- Text Compare giới hạn 4000 dòng mỗi bên sau khi cắt phần giống nhau (có cảnh báo khi bị cắt).
