# French Transcript Web App -- Design & Architecture README

> Phiên bản: v1.0 (Design Specification)

## Mục tiêu

Tài liệu này tổng hợp toàn bộ ngữ cảnh của dự án, yêu cầu người dùng,
hiện trạng notebook demo, kiến trúc web app đề xuất, luồng xử lý, các
case thực tế và lộ trình triển khai.

------------------------------------------------------------------------

# 1. Bài toán

Ứng dụng được xây dựng để hỗ trợ **sinh viên du học tại Pháp** chuyển
đổi file âm thanh/video thành transcript tiếng Pháp bằng mô hình AI chạy
trên GPU đám mây.

Hiện trạng:

-   chạy bằng Google Colab Notebook.
-   không dùng GPU máy cá nhân.
-   transcript theo từng đoạn 120 giây.

Vấn đề:

-   mất mạng → mất phiên.
-   sleep laptop → ngắt notebook.
-   phải chạy lại từ đầu.
-   giao diện Colab không phù hợp người dùng phổ thông.

------------------------------------------------------------------------

# 2. Mục tiêu sản phẩm

## Bắt buộc

-   Web app.
-   Không cần cài đặt.
-   Không dùng GPU máy người dùng.
-   GPU từ Colab/Kaggle miễn phí.
-   Có Resume from.
-   Realtime transcript.
-   Download cuối cùng.

## Không cần

-   Database.
-   Đăng nhập.
-   Lưu lịch sử lâu dài.

------------------------------------------------------------------------

# 3. Notebook demo

Notebook hiện có:

-   Upload file.
-   Chia 120 giây.
-   Transcribe từng đoạn.
-   Ghép kết quả cuối.

Hạn chế:

-   phụ thuộc browser.
-   phụ thuộc kết nối.
-   mất tiến độ.

------------------------------------------------------------------------

# 4. Kiến trúc đề xuất

Browser

↓

Render (API)

↓

Colab Worker

↓

Cloudflare R2 (temporary storage)

## Thành phần

### Browser

-   Upload
-   Results
-   Progress
-   Download

### Render

-   Job Queue
-   SSE
-   API

### Colab Worker

-   Poll server
-   Tải file
-   Chạy model
-   Gửi từng segment

### Cloudflare R2

-   audio gốc
-   transcript từng đoạn
-   final txt

TTL: 24 giờ.

------------------------------------------------------------------------

# 5. Luồng xử lý

1 Upload

2 Job tạo

3 Worker nhận

4 Chia segment

5 Transcribe

6 Gửi realtime

7 Ghép file

8 Download

------------------------------------------------------------------------

# 6. Giao diện

## Upload

-   Drop zone
-   Upload
-   Resume from
-   OK

## Results

-   Realtime transcript
-   Scroll
-   Progress x/y
-   Download

------------------------------------------------------------------------

# 7. Realtime

Dùng Server-Sent Events.

Worker gửi:

POST /segment

Server push browser.

------------------------------------------------------------------------

# 8. Resume from

Ví dụ

12 đoạn

Resume from 8

→ chỉ xử lý 8-11.

------------------------------------------------------------------------

# 9. Temporary Storage

  Dữ liệu   TTL
  --------- -----
  Audio     24h
  Segment   24h
  TXT       24h

------------------------------------------------------------------------

# 10. Case thực tế

## Case 1

Browser mở.

Job xong.

Download giữ 24h.

## Case 2

Laptop sleep.

Browser ngủ.

Worker vẫn chạy.

Nếu Colab timeout giữa chừng:

-   giữ 8/12.
-   Resume từ 8.

Nếu xong trước sleep:

-   reconnect.
-   Download còn.

## Case 3

Nhiều người dùng.

### Một worker

Queue.

### Nhiều worker

Parallel.

------------------------------------------------------------------------

# 11. Queue

Job:

``` json
{
 "job_id":"abc",
 "status":"processing",
 "done":8,
 "total":12
}
```

------------------------------------------------------------------------

# 12. API

POST /upload

POST /segment

GET /events/{job}

GET /download/{job}

------------------------------------------------------------------------

# 13. Cấu trúc dự án

    frontend/
    backend/
    worker/
    shared/

------------------------------------------------------------------------

# 14. Tech Stack

Frontend

-   Next.js
-   Tailwind

Backend

-   FastAPI

Worker

-   Colab

Storage

-   Cloudflare R2

Realtime

-   SSE

------------------------------------------------------------------------

# 15. Vì sao không dùng database?

Không cần lịch sử.

Dùng Object Storage.

Server có thể sleep.

------------------------------------------------------------------------

# 16. Vì sao chọn Render?

-   miễn phí
-   auto sleep
-   filesystem reset
-   URL cố định

------------------------------------------------------------------------

# 17. Rủi ro

Colab timeout.

Giải pháp:

-   polling worker.
-   Resume from.
-   Copy Results.

------------------------------------------------------------------------

# 18. Copy-safe Recovery

Nếu chết ở 8/12.

Người dùng vẫn:

-   Copy Results.
-   Resume from 8.

Không mất công chạy lại.

------------------------------------------------------------------------

# 19. Lộ trình

Phase 1 Worker

Phase 2 FastAPI

Phase 3 UI

Phase 4 SSE

Phase 5 Resume

Phase 6 Cleanup

------------------------------------------------------------------------

# 20. Tiêu chí thành công

-   không cài đặt
-   GPU cloud
-   realtime
-   Resume
-   Download
-   server auto sleep
-   temporary storage
-   nhiều người dùng
