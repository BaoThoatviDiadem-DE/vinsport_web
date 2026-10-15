@echo off
chcp 65001 >nul
title Cài Đặt Hệ Thống VinSport
color 0B

echo ======================================================================
echo           🚀 VINSPORT - CÀI ĐẶT THƯ VIỆN HỆ THỐNG TỰ ĐỘNG
echo ======================================================================
echo.

:: 1. Kiểm tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [LỖI] Máy tính của bạn chưa cài đặt Node.js!
    echo Vui lòng tải và cài đặt Node.js từ https://nodejs.org trước khi tiếp tục.
    echo.
    pause
    exit /b
)

:: 2. Khởi tạo file .env nếu chưa có
echo [1/3] Đang kiểm tra và khởi tạo file cấu hình môi trường (.env)...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo       -> Đã tự động tạo backend\.env từ file mẫu.
    )
) else (
    echo       -> File backend\.env đã có sẵn.
)

:: 3. Cài đặt Backend
echo.
echo [2/3] Đang cài đặt thư viện cho Backend (Node.js/Express)...
cd backend
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [LỖI] Cài đặt thư viện Backend thất bại. Vui lòng kiểm tra lại kết nối mạng.
    pause
    exit /b
)
cd ..

:: 4. Cài đặt Frontend
echo.
echo [3/3] Đang cài đặt thư viện cho Frontend (React/Vite)...
cd frontend
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [LỖI] Cài đặt thư viện Frontend thất bại. Vui lòng kiểm tra lại kết nối mạng.
    pause
    exit /b
)
cd ..

:: 5. Hoàn tất
echo.
echo ======================================================================
color 0A
echo  🎉 HOÀN TẤT CÀI ĐẶT 100%!
echo ======================================================================
echo.
echo Bước tiếp theo:
echo 👉 Hãy nhấp đúp vào file "VinSport_Manager.hta" trong thư mục này
echo    để nạp CSDL và mở Website bán hàng chỉ với 1 cú click!
echo.
pause
