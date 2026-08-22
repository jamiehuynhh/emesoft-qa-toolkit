# AI QA Toolkit — Nội dung đề tài

**Tên đề tài:** AI QA Toolkit
**Tagline:** AI-powered Tools for Smarter and Faster Software Testing
**Tiếng Việt:** Bộ công cụ AI hỗ trợ kiểm thử phần mềm thông minh và nhanh hơn.

> *AI* = trí tuệ nhân tạo · *QA* = đảm bảo chất lượng phần mềm · *Toolkit* = tập hợp
> nhiều công cụ trên cùng một nền tảng.

---

## 5. Bài toán cần giải quyết

**Quy trình hiện tại.** Trong một sprint, QA/QC phải: đọc AC và mô tả nghiệp vụ để viết
test case, tự nghĩ và tự nhập test data, kiểm tra API response và log khi có lỗi, viết
bug report, rồi tổng hợp test report cuối chu kỳ. Phần lớn các bước này đang làm thủ công
và mỗi bước lại dùng một công cụ khác nhau — thường là các website miễn phí bên ngoài
(format JSON, decode JWT, so sánh text, đổi timestamp, tạo dữ liệu giả…).

**Khó khăn / pain point đang tồn tại.**

1. **Phân tán công cụ.** Một tác vụ đơn giản phải mở 4–5 tab của 4–5 website khác nhau,
   mỗi trang một cách dùng, nhiều trang có quảng cáo và giới hạn dung lượng.
2. **Rủi ro dữ liệu.** Dán payload thật, token, log có thông tin khách hàng lên website
   không rõ nguồn gốc là rủi ro về bảo mật và tuân thủ.
3. **Mất thời gian cho việc lặp lại.** Viết test case cho một luồng CRUD, sinh 200 bản ghi
   test data hợp lệ định dạng Việt Nam (họ tên có dấu, SĐT đúng đầu số, MST đúng check digit),
   soạn lại bug report cho đủ ý — đều là việc lặp đi lặp lại.
4. **Không đồng nhất.** Mỗi QA viết test case và bug report theo một cấu trúc khác nhau,
   dẫn đến dev phải hỏi lại nhiều lần, và test report giữa các sprint khó so sánh.
5. **Nguy cơ bỏ sót.** Khi làm thủ công dưới áp lực thời gian, các case âm và giá trị biên
   (chuỗi rỗng, ngày 30/02, emoji, vượt maxlength, ký tự phân cách trong dữ liệu) là phần
   bị bỏ sót nhiều nhất — cũng chính là nơi lỗi thường nằm.
6. **Chi phí onboarding.** QA mới không biết bắt đầu từ đâu, viết tài liệu chưa đạt chuẩn
   nên Test Lead phải review và sửa nhiều.

**Đối tượng bị ảnh hưởng.**

| Bộ phận | Ảnh hưởng |
|---|---|
| QA/QC, Software Tester | Mất thời gian cho việc thủ công, khó đảm bảo độ phủ |
| Developer | Nhận bug report thiếu bước tái hiện, thiếu log → phải hỏi lại, kéo dài thời gian fix |
| Business Analyst | Sự mơ hồ trong AC chỉ lộ ra rất muộn, khi QA đã bắt đầu test |
| Project Manager / Test Lead | Không có báo cáo chuẩn hóa để đánh giá chất lượng bản build và ra quyết định phát hành |

**Vì sao cần giải quyết.** Thời gian QA dành cho thao tác thủ công là thời gian không dùng
để tìm lỗi. Giảm phần thao tác và chuẩn hóa tài liệu vừa rút ngắn chu kỳ kiểm thử, vừa
tăng chất lượng phát hiện lỗi, đồng thời loại bỏ rủi ro đưa dữ liệu nội bộ ra website ngoài.

---

## 6. Giải pháp ứng dụng AI

Xây dựng **AI QA Toolkit** — một web application tập trung các công cụ QA thường dùng,
trong đó AI đảm nhận các bước cần suy luận và soạn thảo.

**AI được dùng để làm gì.**

1. **Phân tích yêu cầu và thiết kế test case.** Từ AC / mô tả nghiệp vụ, AI sinh bảng test
   case gồm ID, tiêu đề, loại (Positive / Negative / Boundary / Permission / Security),
   priority, precondition, các bước, test data và kết quả mong đợi — kèm phần *Coverage notes*
   nêu rõ rule nào đã phủ và **những điểm còn mơ hồ cần hỏi lại BA**.
2. **Phân tích lỗi.** Từ stack trace, log server hoặc API response lỗi, AI chỉ ra hiện tượng,
   bảng bằng chứng (exception, file:line, status code, trace id), 3 nguyên nhân khả năng cao
   nhất **có kèm mức độ tin cậy**, layer chịu trách nhiệm, và việc QA nên làm tiếp.
3. **Soạn bug report.** Từ ghi chú thô của tester, AI sắp xếp thành bug report chuẩn / ticket
   Jira / bản ngắn cho stand-up, với các bước tái hiện đánh số và mục *"thiếu thông tin cần
   xác nhận"* thay vì tự bịa thông tin.
4. **Tổng hợp test report.** Từ số liệu thực thi và danh sách defect, AI viết executive summary,
   bảng kết quả, phân tích rủi ro và khuyến nghị GO / GO WITH CONDITIONS / NO-GO.

**AI được áp dụng ở bước nào trong quy trình.**

```
Phân tích yêu cầu → [AI] Thiết kế test case → [Toolkit] Sinh test data
        → Thực thi test → [AI] Phân tích log/API khi fail → [AI] Viết bug report
        → Retest → [AI] Tổng hợp test report → Quyết định phát hành
```

Các bước xử lý dữ liệu xác định (format JSON, diff, decode JWT, đổi timestamp, sinh test data,
hash, regex) **không dùng AI** — chúng chạy bằng thuật toán ngay trên trình duyệt, cho kết quả
chính xác tuyệt đối và tức thì. AI chỉ dùng ở nơi cần suy luận và soạn thảo. Đây là lựa chọn
có chủ đích: nó giữ chi phí thấp, tốc độ cao và tránh việc AI "sáng tạo" ở chỗ không được phép.

**Dữ liệu đầu vào dự kiến.** Acceptance criteria, mô tả nghiệp vụ / user story, quy tắc
validate trường, API request/response, log lỗi và stack trace, ghi chú của tester, số liệu
thực thi test và danh sách defect.

**Kết quả đầu ra dự kiến.** Bảng test case (xuất được CSV để import vào test management tool),
bộ test data (CSV / JSON / SQL INSERT), phân tích nguyên nhân lỗi, bug report sẵn để dán vào
Jira, test report sẵn để gửi review.

**Ràng buộc kỹ thuật đã áp dụng.**

- Toàn bộ 17 công cụ xử lý dữ liệu chạy tại trình duyệt, **không gửi dữ liệu lên server**.
- Chỉ 4 công cụ AI gửi request, và chỉ khi người dùng chủ động bấm chạy.
- Hỗ trợ 2 chế độ gọi AI: trực tiếp bằng API key cá nhân, hoặc qua **proxy backend** để
  API key không bao giờ nằm ở phía trình duyệt khi triển khai dùng chung.
- Prompt được thiết kế để AI **không bịa** số liệu, bug id hay module không có trong input,
  và phải nêu rõ những gì còn thiếu.

---

## 7. Giá trị dự kiến mang lại

**Về thời gian.**

| Công việc | Cách làm hiện tại | Với AI QA Toolkit |
|---|---|---|
| Viết test case cho 1 luồng nghiệp vụ | 60–120 phút | 10–20 phút (AI nháp + QA review) |
| Sinh 200 bản ghi test data VN hợp lệ | 60+ phút thủ công | dưới 1 phút |
| Viết 1 bug report đầy đủ | 10–20 phút | 3–5 phút |
| Tổng hợp test report cuối sprint | 2–4 giờ | 20–30 phút |
| Tra cứu / xử lý dữ liệu lẻ (JSON, JWT, timestamp…) | 4–5 tab website ngoài | 1 trang nội bộ |

**Về chất lượng.**

- **Tăng độ phủ.** AI luôn đề xuất case âm, giá trị biên và case phân quyền; toolkit có sẵn
  25 giá trị biên dùng ngay cho test âm — giảm rủi ro bỏ sót ở đúng chỗ lỗi thường xuất hiện.
- **Phát hiện mơ hồ sớm.** Phần "câu hỏi còn mở" của AI buộc AC thiếu rõ ràng phải lộ ra
  ngay ở bước thiết kế test case, thay vì khi đã test được nửa sprint.
- **Chuẩn hóa tài liệu.** Test case, bug report và test report ra theo một cấu trúc thống nhất
  → dev ít phải hỏi lại, các sprint so sánh được với nhau.
- **Rút ngắn thời gian fix.** Bug report có đủ bước tái hiện, môi trường, bằng chứng và
  phán đoán nguyên nhân giúp dev vào việc ngay.

**Về vận hành và tuân thủ.**

- Dữ liệu nội bộ không còn bị dán lên website bên thứ ba không kiểm soát được.
- Không cần cài đặt, không cần đăng nhập, không cần backend → triển khai và bảo trì gần như bằng 0.
- Onboarding QA mới nhanh hơn: có mẫu chuẩn để học và làm theo ngay từ ngày đầu.
- Mở rộng dễ: thêm một công cụ là thêm một file JavaScript.

**Về giới hạn cần nói rõ.** AI tạo bản nháp, **không thay thế QA**. Mọi test case, bug report
và test report do AI sinh ra đều phải được QA review trước khi dùng. Giá trị của công cụ là
rút ngắn thời gian từ "trang trắng" tới "bản nháp tốt", không phải tự động hóa việc ra quyết định.

---

## 8. Đối tượng sử dụng

**Người dùng chính**

- **QA/QC Engineer, Software Tester** — dùng hằng ngày cho toàn bộ chu kỳ: thiết kế test case,
  sinh test data, kiểm tra API, phân tích lỗi, viết bug report.

**Người dùng thường xuyên**

- **Test Lead / QA Lead** — chuẩn hóa tài liệu trong nhóm, tổng hợp test report, đánh giá
  chất lượng bản build để khuyến nghị phát hành.
- **QA mới vào nghề / thực tập sinh** — học cấu trúc test case và bug report chuẩn qua mẫu thực tế.

**Người dùng phụ**

- **Developer** — dùng các công cụ dữ liệu (JSON, JWT, Base64, SQL, timestamp, hash) và đọc
  phân tích log khi debug.
- **Business Analyst** — nhận danh sách "câu hỏi còn mở" mà AI phát hiện trong AC để làm rõ yêu cầu.
- **Project Manager** — đọc test report đã chuẩn hóa để nắm tình trạng chất lượng và rủi ro phát hành.
- **DevOps / Support** — phân tích log lỗi từ môi trường thật.

**Phạm vi triển khai đề xuất.** Bắt đầu ở phòng QA (dùng ngay, không cần hạ tầng), sau đó mở
cho toàn bộ đội phát triển qua một địa chỉ nội bộ với AI chạy ở chế độ proxy.
