# Hướng Dẫn Phát Hành Bản Build Cho LG webOS 4.x / Chromium 53

Tài liệu này quy định quy trình phát triển, kiểm thử và phát hành file cài đặt IPK cho LG webOS 4 (Chromium 53) trên fork `NuvioWeb`.

---

## 1. Triết Lý Vận Hành

```text
Upstream mới
   │
   ▼
[1] Watcher phát hiện & mở Issue đề xuất (KHÔNG tự merge)
   │
   ▼
[2] Selective Port trên nhánh `test/webos4-*` (KHÔNG merge nguyên khối)
   │
   ▼
[3] Chạy toàn bộ Static Gates & Unit Tests Chromium 53
   │
   ▼
[4] Deploy & Nghiệm thu thực tế trên TV LG thật bằng Magic Remote
   │
   ▼
[5] Fast-forward merge vào nhánh stable `webos4-chromium53`
   │
   ▼
[6] Đặt Git Tag theo quy chuẩn `v<upstream>+webos4.<gen>.<rev>`
   │
   ▼
[7] GitHub Actions build IPK & tạo Draft GitHub Release (KHÔNG auto-publish)
   │
   ▼
[8] Cài đặt file IPK release từ Draft lên TV thật kiểm tra lần cuối
   │
   ▼
[9] Chuyển trạng thái sang Published
```

---

## 2. Quy Chuẩn Đặt Tên Phiên Bản & Git Tag

Mỗi bản phát hành chính thức bắt buộc sử dụng định dạng tag:

```text
v<upstream-base>+webos4.<generation>.<revision>
```

**Ví dụ:**
- `v1.0.5+webos4.r5.1`: Bản dựng dựa trên upstream base `1.0.5`, thế hệ tối ưu `r5`, bản vá số `1` của fork.
- `v1.0.6+webos4.r6.1`: Khi có upstream `1.0.6` và mở đợt tối ưu thế hệ `r6`.

Tên file IPK được sinh ra tự động:
```text
NuvioTV-webOS-v1.0.5+webos4.r5.1.ipk
NuvioTV-webOS-v1.0.5+webos4.r5.1.ipk.sha256
```

---

## 3. GitHub Secrets Cần Thiết

Để workflow `.github/workflows/release-legacy-webos53.yml` đóng gói được IPK có cấu hình runtime đầy đủ, cần cấu hình Secret trong GitHub repository:

| Secret Name | Bắt buộc | Mục đích |
|---|---|---|
| `LOCAL_PROPERTIES` (hoặc `NUVIO_LOCAL_PROPERTIES`) | **Bắt buộc** | Chứa toàn bộ nội dung file `local.properties` (Supabase, TMDB, Trakt keys) để nhúng vào `nuvio.env.js` |

> ⚠️ **LƯU Ý BẢO MẬT QUAN TRỌNG:**
> - Nội dung trong `LOCAL_PROPERTIES` sẽ được biên dịch thành file `nuvio.env.js` nằm bên trong file `.ipk`.
> - Do file `.ipk` là một gói nén thông thường (`ar` / `tar.gz`), bất kỳ ai có file `.ipk` đều có thể giải nén và đọc được các API key trong `nuvio.env.js`.
> - Do đó, **tuyệt đối KHÔNG auto-publish** release lên public. Các bản dựng CI thông thường cho PR luôn dùng file giả định `scripts/create-placeholder-properties.mjs` với giá trị `__NUVIO_PRIVATE_RUNTIME_VALUE__`.

---

## 4. Hệ Thống Kiểm Tra Bắt Buộc (Quality Gates)

Trước khi bất kỳ IPK nào được tạo, quy trình CI chạy qua 8 bước kiểm tra nghiêm ngặt:

1. **`npm run check:source`**: Kiểm tra toàn bộ mã nguồn không sót conflict marker (`<<<<<<<`, `=======`) và mọi file CSS đều parse được bằng PostCSS.
2. **`npm run check:no-undef`**: Quét toàn bộ file `js/` và `scripts/` để đảm bảo không có biến/hàm mồ côi (chưa khai báo đã gọi).
3. **`npm run verify:webos53-policy`**: Xác nhận target Chromium 53, webOS 4.0.0, kiểm tra tính toàn vẹn của polyfills và fast-home.
4. **`npm run test:webos4`**: Chạy toàn bộ bộ unit test (44 test suites) bằng test runner tối ưu cho cả Linux CI và Termux Android.
5. **`npm run lint`**: Chạy ESLint trên các màn hình giao diện.
6. **`npm run check:legacy-regex`**: Quét toàn bộ bundle và lazy chunks đã build trong `dist/` để đảm bảo không chứa regex ES2018+ (không lookbehind `(?<=)`, không named group `(?<name>)`, không dotAll `s` flag).
7. **`npm run check:legacy-css`**: Báo cáo độ phủ fallback CSS cho các thuộc tính mà Chromium 53 không hỗ trợ (Grid, gap, min/max/clamp, backdrop-filter).
8. **`node scripts/verify-legacy-webos-package.mjs`**: Phân tích cú pháp acorn ECMAScript 2016 trên từng chunk JavaScript, kiểm tra trần dung lượng (bundle <= 750 KB).

---

## 5. Các Bước Thực Hiện Release Cụ Thể

Khi bạn đã hoàn tất phát triển và kiểm tra thực tế trên TV ở nhánh feature:

### Bước 1: Merge vào nhánh stable
```bash
git checkout webos4-chromium53
git pull origin webos4-chromium53
git merge --ff-only test/webos4-r5-selective-upgrades
git push origin webos4-chromium53
```

### Bước 2: Tạo và push Tag
```bash
git tag v1.0.5+webos4.r5.1
git push origin v1.0.5+webos4.r5.1
```

### Bước 3: Kiểm tra GitHub Actions
1. Vào tab **Actions** trên GitHub, theo dõi workflow `Release legacy webOS 4 IPK (Draft)`.
2. Workflow sẽ chạy đủ 8 gates, đóng gói `NuvioTV-webOS-v1.0.5+webos4.r5.1.ipk`, tính mã băm SHA-256 và tạo một **Draft Release**.

### Bước 4: Nghiệm thu trên TV vật lý
1. Tải file `NuvioTV-webOS-v1.0.5+webos4.r5.1.ipk` từ trang Draft Release về máy hoặc Termux.
2. Cài đặt trực tiếp lên TV:
   ```bash
   ares-install NuvioTV-webOS-v1.0.5+webos4.r5.1.ipk -d nuvio-tv
   ```
3. Cầm Magic Remote kiểm tra:
   - Khởi động app: Trang chủ hiển thị đủ poster và hàng Tiếp tục xem.
   - D-pad điều hướng mượt mà, không giật lag.
   - Mở màn hình Xem tất cả (See All) và cuộn xuống để xác nhận poster recycler hoạt động.
   - Thử mở một phim/luồng stream để đảm bảo trình phát video hoạt động.

### Bước 5: Publish Release
- Khi tất cả tiêu chí đạt: Vào trang GitHub Release, chỉnh sửa và bấm **Publish Release**.
- Nếu phát hiện lỗi: Xóa bản nháp (Delete Draft), tạo nhánh vá lỗi và lặp lại quy trình.

---

## 6. Định Hướng Mở Rộng Tương Lai

1. **Nuvio WebTV Installer Integration**:
   - Trình cài đặt đa nền tảng (Windows/macOS/Linux) có thể gọi GitHub API đến endpoint `/repos/HoanNguyen0212/NuvioWeb/releases` để tự động tải file `.ipk` mới nhất có tag khớp với `v*+webos4.*`.
2. **webOS Homebrew Channel Repository Metadata**:
   - Sau khi pipeline release ổn định, có thể bổ sung job cập nhật file `apps.json` cho Homebrew Channel để người dùng cài đặt/cập nhật trực tiếp từ TV.
   - Tạm thời chưa kích hoạt tự động để đảm bảo an toàn tuyệt đối và bảo mật credential.
