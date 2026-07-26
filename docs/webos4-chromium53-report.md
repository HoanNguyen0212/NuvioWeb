# Báo cáo tối ưu LG webOS 4.9 / Chromium 53

Branch: `webos4-chromium53`  
Nền: `legacy-webos53-v49-opt` tại `1e8ffe0`  
Ngày kiểm tra cuối: 2026-07-26

## 1. Phạm vi và nguyên tắc đo

Nhánh này tối ưu Focus Engine, CSS legacy, Search, Home, Router, Player, boot instrumentation, package verifier và QR loader. Fix timeline Magic Remote từ commit nền `1e8ffe0` được giữ nguyên.

Các số runtime bên dưới là **mẫu chức năng đơn lẻ trên TV thật qua CDP**, không phải benchmark thống kê. Không dùng `router-ready` hoặc `home-shell-rendered` để tuyên bố Home đã sẵn sàng. Các thao tác chuột/phím được phát tổng hợp qua CDP; chúng không thay thế hoàn toàn kiểm tra bằng Magic Remote cầm tay.

## 2. Các phase và commit

| Commit | Nội dung |
|---|---|
| `20bfc60` | Ghi baseline trước tối ưu |
| `29f7cd9` | Focus Engine init/destroy idempotent, cache focus, metrics |
| `c00c02a` | Thay wildcard transitions bằng profile CSS legacy |
| `6f24e89` | Search không chờ watched metadata, event delegation, LRU đúng |
| `6f7dd3a` | Patch từng provider Search bằng node ổn định |
| `568c5e8` | Hủy XHR catalog cũ khi query đổi/cleanup/timeout |
| `f732e25` | Bỏ MutationObserver toàn document, bỏ poster layers không dùng |
| `1d9dcf4` | Router loại bỏ navigation async đã stale |
| `32eee66` | Coalesce player UI tick, giữ nguyên DOM control row |
| `8249c33` | Binary-search/index subtitle cues, timer theo cue boundary |
| `c57da79` | Marks boot thực, package integrity và fail-closed PIN cache |
| `fe92853` | Lazy-load QR generator tại lần sử dụng đầu tiên |

## 3. So sánh artifact tĩnh

| Artifact | Baseline | Cuối | Chênh lệch |
|---|---:|---:|---:|
| Startup bundle | 697,310 B | 704,813 B | +7,503 B (+1.08%) |
| Tổng application JS | 2,354,180 B | 2,369,311 B | +15,131 B (+0.64%) |
| Player route chunk | 531,919 B | 535,776 B | +3,857 B |
| Search route chunk | 90,093 B | 93,026 B | +2,933 B |
| CSS tổng | 410,471 B | 412,728 B | +2,257 B |
| IPK | 3,828,470 B | 3,831,578 B | +3,108 B |
| Route/lazy chunks | 28 | 28 | Không đổi |

Kích thước tăng nhẹ vì thêm lifecycle, cancellation, instrumentation và các guard tương thích. Không có bằng chứng cho thấy kích thước bundle giảm; mục tiêu đạt được chủ yếu là giảm công việc DOM/event không cần thiết và tăng tính đúng đắn runtime.

Verifier cuối xác nhận:

- app id `space.nuvio.webos`, version `0.3.24`, required webOS `4.0.0`;
- target Chromium 53;
- mọi JavaScript phía app trong staged package parse được với Acorn `ecmaVersion: 2016`;
- không có source map trong package;
- mọi `src`/`href` tĩnh trong generated `index.html` tồn tại;
- không có `local.properties` trong package công khai;
- runtime environment của artifact kiểm tra chỉ chứa placeholder;
- startup JS `704,813 B`, tổng application JS `2,369,311 B`, 28 chunks;
- hash của ba legacy overlay khớp source và staged package.

## 4. Focus Engine, Magic Remote và D-pad

Thay đổi chính:

- `init()` không thể bind listener hai lần;
- thêm `destroy()` để remove đúng function reference, RAF và timer;
- cache focused element thay vì scan toàn screen ở mỗi thay đổi;
- native focus chỉ dành cho input/control hoặc phần tử opt-in;
- giữ mouse threshold 8 px, D-pad lock 450 ms và activation dedupe;
- metrics debug theo dõi mouse/focus/activation.

Kiểm tra TV qua CDP:

- chỉ một `.focusable.focused` sau điều hướng;
- mouse lock sau D-pad hoạt động;
- Magic Remote activation giả lập mở Detail/Stream không cần D-pad nudge;
- timeline tại 10%, 50%, 95% hit đúng `#playerProgressShell`;
- ba chuỗi `mousedown → mouseup → click` tạo đúng ba `seeking` event;
- không có double seek;
- D-pad ArrowLeft phát bằng legacy event giảm playback khoảng 9 giây trong mẫu cuối;
- Player route vẫn tồn tại, không hiện startup error.

Chưa hoàn tất kiểm tra rung/jitter và giữ phím lâu bằng Magic Remote vật lý.

## 5. Search

Kết quả kiến trúc:

- shell/input không chờ tải tối đa 5.000 watched items;
- watched badge được patch nền;
- một event-delegation pipeline thay listener từng card;
- cache hit refresh đúng thứ tự LRU;
- mỗi provider có row node/signature ổn định;
- provider hoàn tất sau không rebuild provider trước hoặc giành focus input;
- catalog dùng XHR cancelable, không phụ thuộc `AbortController`;
- query đổi, cleanup và timeout đều abort request đang bay;
- generation token vẫn ngăn response cũ patch DOM.

Kiểm tra TV:

- `godzilla → matrix` ghi nhận hai request cũ bị hủy và chỉ giữ Matrix;
- marker DOM của provider nhanh được giữ khi provider tiếp theo hoàn tất;
- mẫu cuối nhập `oppenheimer` giữ focus tại `.search-input-field` và nội dung kết quả có Oppenheimer;
- một mẫu trước đó trả 2 rows / 16 cards trong 1.455 ms. Đây chỉ là mẫu chức năng, không phải benchmark trung bình.

## 6. Home và Router

Home:

- bỏ `MutationObserver` toàn `document.documentElement`;
- renderer gọi hook tối ưu trực tiếp;
- khi poster expansion/trailer tắt, không tạo backdrop/trailer/gradient/brand layer;
- collection row tuân theo row limit thay vì render toàn bộ;
- persistent cache vẫn hydrate trước network và card ảnh vẫn được hydrate thủ công.

Mẫu Home sau phase Home: 17 rows, 167 cards, 730 DOM elements, 0 expanded poster layer và 48 ảnh có `src`. Số card/element không thể so trực tiếp với baseline như một cải thiện vì dữ liệu catalog giữa hai lần đo khác nhau.

Router:

- mỗi navigation có token;
- lazy route hoặc mount cũ không được phép ghi route/history sau navigation mới;
- test Search → Settings nhanh kết thúc đúng ở Settings, không có route cũ patch lại.

## 7. Player

### UI tick và control row

- `timeupdate`, `progress` và interval đi qua `scheduleUiTick()`;
- chỉ giữ một timer/RAF pending;
- controls hiện giới hạn khoảng 240 ms/tick, controls ẩn khoảng 900 ms/tick;
- cleanup hủy timer/RAF pending;
- control row chỉ rebuild khi action/icon structure thật sự đổi;
- play/pause/title/icon state được patch trên node hiện có.

Mẫu debug TV sau startup Player:

- `controlRenderRequests`: 54;
- `controlRowRebuilds`: 1;
- `uiTickRequests`: 20;
- `uiTickFlushes`: 13.

Sau play/pause và các tick tiếp theo, `controlRowRebuilds` vẫn là 1. Đây là counter chức năng của một session, không phải phép đo FPS.

### Subtitle

- cue array được index bằng prefix max-end;
- tìm upper bound theo start time bằng binary search;
- chỉ scan các cue có khả năng overlap;
- timer dùng start/end boundary kế tiếp thay vì quét toàn bộ mỗi 120 ms;
- seek tự tìm lại bằng binary search, không phụ thuộc index tuyến tính cũ.

Trên TV với subtitle tiếng Việt đang hoạt động, một mẫu hiển thị đúng `Tỉnh lại đi.`. Counter ghi 75 lookup nhưng chỉ 26 cue candidates trong giai đoạn gồm seek và playback; không còn `.filter()` toàn cue array ở mỗi lần render.

### Timeline không regression

Giữ nguyên toàn bộ fix nền:

- hit area 40 px;
- shell `pointer-events:auto`, child layers `pointer-events:none`;
- direct capture `mousedown` và delegated `click` fallback;
- dedupe 600 ms / 8 px;
- hidden/modal guards;
- explicit listener cleanup.

## 8. Boot readiness và PIN

Marks cuối gồm:

- `html-start`, `compat-start`, `compat-ready`;
- `bundle-start`, `bundle-ready`;
- `platform-ready`, `i18n-local-ready`, `router-ready`;
- `route-mounted`, `first-row`, `first-poster`;
- `first-focus`, `home-focused`, `boot-ready`;
- `boot-welcome-hidden`;
- `home-cache-row`, `home-network-row` khi đúng nguồn dữ liệu;
- `background-sync-start`, `background-sync-ready`.

`NuvioBootGuard.ready()` chỉ chạy khi route hiện tại có focused element thực sự còn trong DOM và visible. Marks giữ giá trị đầu tiên, không bị lần gọi sau ghi đè.

Hai mẫu launch TV thật:

1. Launch đi thẳng Home với dữ liệu sẵn: `first-row` 6.443 ms, `first-poster` 6.444 ms, `home-focused` 6.464 ms, welcome hidden 6.467 ms.
2. Launch khi lock-state cache chưa biết: profile selector có first focus 1.715 ms, welcome hidden 1.717 ms. Đây không phải Home-ready và không được báo cáo như Home-ready.

Logic remember-last-profile chỉ được bỏ qua picker khi cache **có key rõ ràng** cho active profile và giá trị là không PIN. Lock state thiếu/không biết sẽ fail closed sang profile selection. Cần test thêm account thật có PIN và timeout Supabase để xác nhận toàn bộ flow verification, không chỉ routing decision.

## 9. QR lazy loading

`assets/libs/qrcode-generator.js` không nằm trên startup path. `QrCodeGenerator`:

- dùng chung một load Promise;
- chống chèn script trùng;
- timeout 2 giây;
- hỗ trợ các canvas caller cũ;
- Trakt device auth chờ local QR library trước lần render QR cuối.

Trên TV, trước khi bấm Trakt Login không có QR script. Sau click, script được chèn và `window.qrcode` là function. Request Trakt của mẫu đó trả `Failed to fetch`, vì vậy chưa xác nhận QR image end-to-end với device code thật; chỉ xác nhận lazy loader/runtime factory.

## 10. Build và kiểm tra cuối

Đã chạy thành công:

```bash
npm run lint
npm run build:webos53-fastboot
/data/data/com.termux/files/usr/bin/node --test --test-isolation=none tests/*.test.mjs
npm run package:webos53-fastboot
node scripts/verify-legacy-webos-package.mjs
```

Test suite hiện chỉ có một test legacy-polyfills (`1 pass, 0 fail`), nên phần lớn regression coverage vẫn là kiểm tra TV/CDP.

IPK cuối:

```text
/data/data/com.termux/files/home/projects/NuvioWeb-legacy-webos53/space.nuvio.webos_0.3.24_all.ipk
```

Bản cài cuối trên TV:

```text
/tmp/webos4_qr_final.ipk
```

## 11. Việc còn cần kiểm tra thủ công

- Magic Remote vật lý: jitter, click sát hai mép timeline, padding trên/dưới và mở/đóng ít nhất ba video;
- giữ D-pad left/right lâu, Play/Pause, Subtitle, Audio, Sources, Back và auto-hide;
- offline, cache hỏng, cold start không cache, addon timeout, Supabase timeout và token expired;
- account thật có PIN/no-PIN khi lock cache thiếu hoặc stale;
- live/HLS/DASH không seekable và duration chưa có;
- Trakt QR end-to-end khi endpoint trả device code;
- benchmark cold/warm nhiều lần với cùng định nghĩa `home-focused`.

Không có preview hover kiểu Lampa trong nhánh này.
