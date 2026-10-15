# VinSport - Website Bán Hàng Thể Thao

Dự án Bài tập lớn Cơ sở dữ liệu.

## Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- Microsoft SQL Server (tài khoản `sa`, mật khẩu mặc định: `123456`)

## Hướng dẫn cài đặt và chạy

### Bước 1: Cài đặt thư viện
Nhấp đúp chuột vào file `cai_dat.bat` tại thư mục gốc. Hệ thống sẽ tự động tạo cấu hình `.env` và cài đặt toàn bộ thư viện cho Backend và Frontend.

*(Hoặc mở Terminal chạy thủ công: `cd backend && npm install` và `cd ../frontend && npm install`).*

### Bước 2: Khởi động hệ thống
Nhấp đúp chuột vào file `VinSport_Manager.hta`:
1. Bấm nút **Nạp / Khởi tạo toàn bộ CSDL** (chỉ cần bấm 1 lần đầu để nạp bảng và dữ liệu mẫu).
2. Bấm nút **Khởi động Website Bán Hàng** để mở trang web tại `http://localhost:5173`.
3. Bật/tắt luồng Airflow (Docker) trực tiếp trên bảng điều khiển khi cần phân tích dữ liệu.

## Tính năng dữ liệu nổi bật
- Tự động sao lưu dữ liệu đơn hàng, sản phẩm, người dùng lên Amazon S3.
- Tích hợp pipeline ETL tự động chuyển đổi dữ liệu đơn hàng sang định dạng Parquet trên Data Lakehouse qua Apache Airflow (5 phút/lần).
- Thống kê, phân tích và trực quan hóa dữ liệu kinh doanh tương tác trực tiếp trên giao diện Quản trị (Admin Analytics).
