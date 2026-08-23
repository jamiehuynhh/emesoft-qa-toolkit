# Kịch bản demo — EmeSoft QA Toolkit

**Khán giả: khách hàng / bên ngoài.** Mục tiêu không phải khoe 24 tool, mà chứng minh hai
điều: đội QA của EmeSoft làm việc có công cụ và có kỷ luật kỹ thuật, và **dữ liệu của khách
không rời khỏi máy họ**.

Soạn theo module. Lõi 5 phút đứng độc lập được; thêm khối để lên 10 hoặc 20 phút.

| Thời lượng | Chạy các khối |
|---|---|
| 5 phút | 0 → 1 → 2 → 6 |
| 10 phút | 0 → 1 → 2 → 3 → 4 → 6 |
| 20 phút | tất cả, cộng Q&A |

URL: **https://emesoft-qa-toolkit.pages.dev**

---

## Khối 0 — Chuẩn bị trước khi vào phòng (làm trước, không tính giờ)

- [ ] Mở sẵn tab **https://emesoft-qa-toolkit.pages.dev**, để ở trang landing.
- [ ] Chọn ngôn ngữ theo khách: nút **EN/VI** ở góc phải trên. Khách quốc tế → EN.
- [ ] Chọn theme sáng nếu trình chiếu qua máy chiếu (phòng sáng), tối nếu họp online.
- [ ] Zoom trình duyệt **125–150%** — chữ mặc định 14px quá nhỏ khi chiếu.
- [ ] Đóng mọi tab khác. Tắt thông báo Slack/Teams/mail.
- [ ] Chuẩn bị sẵn file `.har` mẫu nếu định chạy Khối 5.
- [ ] Mở sẵn file này ở màn hình thứ hai hoặc in ra.

> **Quy tắc tuyệt đối: không dán dữ liệu thật của bất kỳ khách hàng nào lên màn hình đang
> chia sẻ.** Mọi dữ liệu trong kịch bản này là dữ liệu giả. Nút **Load example** trong từng
> tool cũng chỉ sinh dữ liệu giả.

**Một điều nên quyết trước:** trang chủ hiện ghi eyebrow *"EmeSoft · Internal QA tooling"*.
Với khách bên ngoài, chữ "Internal" có thể gây hiểu nhầm đây là đồ dùng nội bộ không dành cho
họ. Nếu muốn đổi, sửa ở [js/core.js](../js/core.js) chỗ `renderLanding` rồi deploy lại — hoặc
cứ để nguyên và giải thích bằng lời ở Khối 1.

---

## Khối 1 — Mở đầu (60 giây)

**Không chiếu slide dài. Mở thẳng trang chủ.**

> "Đây là bộ công cụ đội QA của EmeSoft dùng hằng ngày. Em cho anh/chị xem vì hai lý do.
> Thứ nhất, nó cho thấy quy trình kiểm thử của bên em trông như thế nào. Thứ hai — và đây là
> phần quan trọng với dữ liệu của anh/chị — **20 trên 24 công cụ chạy hoàn toàn trong trình
> duyệt. Không có upload. Không có tài khoản. Không có server nào nhận dữ liệu.**"

Cuộn xuống phần 5 nhóm trên trang chủ, đọc lướt:

| Nhóm | Số tool |
|---|---|
| Text | 6 |
| Data | 7 |
| API & Security | 4 |
| Test Data | 3 |
| AI Assistant | 4 |

> "Em sẽ không đi hết 24 cái. Em chọn ba cái nói lên nhiều nhất."

---

## Khối 2 — Dữ liệu không rời máy (2 phút) · **khối quan trọng nhất, đừng cắt**

Chọn **Data → VN Data Validator**.

Dán vào ô input (dữ liệu giả, an toàn để chiếu):

```
0100109106
0101245678
0312345678
091234567
0100109107
```

Bấm **Validate**.

**Điểm cần chỉ ra:**
- Dòng sai được đánh dấu **kèm lý do**, không chỉ báo đỏ.
- `0100109107` sai **check digit** — sai một chữ số cuối, mắt thường không thấy.
- `091234567` thiếu số.

> "Mã số thuế Việt Nam có chữ số kiểm tra. Tool bắt được cái sai một ký tự mà mắt người
> không thấy. Khi bên em nhận file import của anh/chị, đây là bước đầu tiên."

**Rồi làm động tác quyết định — mở DevTools tab Network (F12), bấm Validate lần nữa:**

> "Anh/chị nhìn tab Network. **Không có request nào đi ra.** Dữ liệu anh/chị dán vào nằm
> nguyên trong máy anh/chị. Kể cả font chữ bên em cũng tự host, không gọi Google. Nếu rút
> mạng ngay bây giờ, tool vẫn chạy."

*(Nếu tự tin: rút wifi thật, bấm Validate lần nữa, cắm lại. Rất thuyết phục — nhưng tập
trước, và đừng làm nếu đang họp online.)*

---

## Khối 3 — Bắt lỗi trước khi viết dòng test đầu tiên (2 phút)

Chọn **Text → Acceptance Criteria Linter**.

Dán vào:

```
Hệ thống phải xử lý nhanh và thân thiện với người dùng.
Khi người dùng nhập sai mật khẩu, hiển thị thông báo phù hợp.
Màn hình danh sách phải load trong 2 giây với 10.000 bản ghi.
```

**Điểm cần chỉ ra:**
- "nhanh", "thân thiện", "phù hợp" — **không kiểm thử được**, tool biến chúng thành câu hỏi
  gửi ngược lại người viết yêu cầu.
- Câu thứ ba **đạt**, vì có số đo cụ thể.
- Không dùng AI. Chạy tức thì.

> "Đây là chỗ tiết kiệm tiền thật sự. Một AC mơ hồ lọt vào sprint sẽ thành bug tranh cãi ở
> cuối sprint. Bên em chặn nó ở đầu, trước khi viết test case."

---

## Khối 4 — Sinh dữ liệu kiểm thử Việt Nam (2 phút)

Chọn **Test Data → Test Data Generator (VN)**.

- Số dòng: **20**
- Tick: họ tên, email, SĐT, địa chỉ, MST
- Bấm **Generate**, rồi **Download CSV**

**Điểm cần chỉ ra:**
- Họ tên, địa chỉ, đầu số điện thoại **đúng kiểu Việt Nam** — không phải "John Smith,
  123 Main St".
- MST sinh ra **hợp lệ theo check digit**, nên import vào hệ thống thật sẽ qua được validation.
- Xuất được CSV / JSON / SQL.
- CSV có BOM nên **Excel mở tiếng Việt không lỗi font** — chi tiết nhỏ nhưng ai từng dính đều hiểu.

> "Không cần dùng dữ liệu thật của khách để test. Đây là lý do bên em không bao giờ phải xin
> bản sao database production."

---

## Khối 5 — Đọc lỗi mạng từ file HAR (3 phút) · *chỉ chạy nếu có ≥ 15 phút*

Chuẩn bị trước: mở một trang web bất kỳ → F12 → Network → chuột phải → **Save all as HAR**.

Chọn **API & Security → HAR / Network Analyzer**, kéo file vào.

**Điểm cần chỉ ra:**
- Request nào **lỗi**, request nào **chậm nhất**.
- Cảnh báo **rò rỉ**: token, key xuất hiện trong URL hoặc header.
- Sinh sẵn lệnh **cURL** để dev tái hiện lại đúng request đó.

> "Khi bên em báo một lỗi API, dev của anh/chị nhận được kèm luôn lệnh cURL tái hiện. Không
> phải đoán."

---

## Khối 6 — Phần AI và sự trung thực (90 giây)

Chọn **AI Assistant → AI Test Case Designer**.

Bạn sẽ thấy dòng: *"No AI provider configured"*. **Đừng né — đó là điểm mạnh.**

Dán một yêu cầu mẫu:

```
Chức năng đăng nhập: người dùng nhập email và mật khẩu.
Sai quá 5 lần thì khóa tài khoản 15 phút.
Mật khẩu tối thiểu 8 ký tự, phải có chữ hoa và số.
```

Bấm **Copy prompt**.

> "Bốn tool AI này không ép anh/chị mua API key nào. Nó soạn sẵn prompt đầy đủ ngữ cảnh, bấm
> Copy rồi dán vào ChatGPT hay Claude mà đội anh/chị đã dùng. Phần giá trị nằm ở chỗ **biết
> phải hỏi gì** — cái đó tool làm.
>
> Và trước khi bất kỳ prompt nào rời khỏi trang, tool **che email, số điện thoại, số thẻ và
> token** — anh/chị thấy nút *Mask sensitive data* ngay đây."

Chỉ vào nút **Mask sensitive data**, bật nó lên, cho xem prompt đã che.

> "Nếu bên anh/chị có key riêng, cắm vào là chạy thẳng trong trang. Không bắt buộc."

---

## Khối 7 — Vì sao tin được (90 giây) · *chỉ chạy với khách kỹ thuật*

Chuyển sang slide, hoặc nói miệng:

- **421 kiểm thử tự động** chạy trước mỗi lần deploy. Fail thì không deploy.
- **Không có thư viện bên thứ ba nào.** Không npm dependency ⇒ không có chuỗi cung ứng để bị
  tấn công.
- **Content-Security-Policy** khóa trang chỉ được tải tài nguyên của chính nó.
- **Font tự host** — không một request nào ra ngoài, kể cả tới Google.
- Mã nguồn nội bộ EmeSoft, tự host được trên hạ tầng của khách nếu cần.

> "Bên em kiểm chứng bằng cách phá thử: mỗi cơ chế bảo vệ đều có test cố tình làm hỏng thứ nó
> canh, để chắc chắn nó thật sự bắt được — chứ không phải nhìn thì đúng."

---

## Khối 8 — Chốt (30 giây)

> "Toolkit chạy trên mọi thiết bị có trình duyệt, không cài đặt, có tiếng Việt và tiếng Anh.
> Nếu anh/chị muốn đội mình dùng thử, em gửi link. Nếu chính sách bên anh/chị yêu cầu chạy
> trong mạng nội bộ, bên em bàn giao được cả bản chạy offline — một file HTML duy nhất, copy
> vào USB là chạy."

*(Nếu có bản một-file: mở `dist-single/qa-toolkit.html` bằng cách nhấp đúp, cho họ thấy nó
chạy không cần mạng. Rất ấn tượng, mất 15 giây.)*

---

## Phương án dự phòng

| Tình huống | Xử lý |
|---|---|
| **Mất mạng** | Mở file `qa-toolkit.html` một-file đã tải sẵn về máy. Chạy y hệt. Chuẩn bị file này **trước** mọi buổi demo. |
| **Trang load chậm** | Đã mở sẵn từ Khối 0, không load lại giữa chừng. |
| **Khách hỏi tool không có trong kịch bản** | Mở thẳng, gõ tên vào ô search (Ctrl+K). Tool nào cũng có nút **Load example** để có dữ liệu ngay. |
| **Tool AI báo lỗi** | Đúng như thiết kế — chuyển sang luồng Copy prompt ở Khối 6. |
| **Máy chiếu hiển thị sai màu** | Đổi sang theme sáng bằng nút ☾ ở góc phải trên. |

---

## Câu hỏi hay gặp — trả lời trung thực

**"Dữ liệu chúng tôi dán vào có bị lưu lại không?"**
> Không. 20 tool xử lý hoàn toàn trong trình duyệt, không có request nào đi ra — anh/chị kiểm
> chứng được ngay bằng tab Network. Riêng 4 tool AI, khi anh/chị *chủ động bấm chạy* thì prompt
> mới được gửi tới nhà cung cấp AI mà anh/chị chọn, và dữ liệu nhạy cảm đã được che trước.

**"Có lưu gì trong máy tôi không?"**
> Chỉ hai thứ trong localStorage: ngôn ngữ và theme sáng/tối. Nếu anh/chị nhập API key thì key
> đó cũng nằm trong trình duyệt anh/chị, không gửi đi đâu.

**"Giá bao nhiêu?"**
> Đây là công cụ nội bộ của đội em, không bán. Em chia sẻ để anh/chị thấy cách bên em làm việc.

**"Có tự host trong mạng nội bộ chúng tôi được không?"**
> Được. Toàn bộ là file tĩnh, không có backend bắt buộc. Copy vào bất kỳ web server nào là
> chạy — hoặc dùng bản một-file, không cần server luôn.

**"Sao không dùng Postman / JSON formatter online có sẵn?"**
> Dùng được chứ. Khác biệt là các trang online đó **gửi dữ liệu anh/chị lên server của họ**.
> Với dữ liệu khách hàng thì bên em không chấp nhận rủi ro đó.

**"Có hỗ trợ ngôn ngữ khác ngoài Việt/Anh không?"**
> Hiện tại hai thứ tiếng. Cấu trúc i18n có sẵn nên thêm ngôn ngữ là việc nhỏ, nhưng em không
> hứa mốc thời gian ở đây.

**"Tool AI dùng model nào?"**
> Tùy anh/chị chọn. Nó nói được với Claude, và với mọi dịch vụ theo chuẩn OpenAI. Mặc định
> không cắm sẵn nhà cung cấp nào.

---

## Những điều **không** nên nói

- Đừng hứa tính năng chưa có, hay mốc thời gian nào cho tính năng mới.
- Đừng nói đây là sản phẩm thương mại của EmeSoft nếu nó không phải.
- Đừng gọi các chuỗi injection trong tool Boundary Values là "công cụ tấn công" — đó là **dữ
  liệu đầu vào để kiểm thử chính ứng dụng của khách**, và chỉ dùng khi có ủy quyền.
- Đừng đưa ra con số hiệu năng nào chưa đo được. "Tiết kiệm 30% thời gian" là con số bịa nếu
  chưa ai đo.
