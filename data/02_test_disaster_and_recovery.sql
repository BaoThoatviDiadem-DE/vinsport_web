-- ==========================================
-- PHẦN 1: MÔ PHỎNG LÀM MẤT DỮ LIỆU
-- ==========================================
USE [QLbanhangquanao];
GO

PRINT 'Dang mo phong xoa toan bo du lieu bang Orders...';
DELETE FROM [dbo].[Orders];
GO

-- (Tùy chọn) Drop luôn Database để test mạnh tay hơn:
-- USE master;
-- GO
-- DROP DATABASE [QLbanhangquanao];
-- GO


-- ==========================================
-- PHẦN 2: KHÔI PHỤC DỮ LIỆU TỪ S3
-- ==========================================
USE master;
GO

PRINT 'Dang ngat cac ket noi toi database QLbanhangquanao...';
-- Ngắt kết nối các user đang truy cập (cần thiết để Restore)
IF DB_ID('QLbanhangquanao') IS NOT NULL
BEGIN
    ALTER DATABASE [QLbanhangquanao] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
END
GO

PRINT 'Dang khoi phuc du lieu tu file Backup Local...';
-- Khôi phục đè (REPLACE) từ file ở ổ cứng
-- Lưu ý: Đường dẫn này là nơi file Python vừa tải về
RESTORE DATABASE [QLbanhangquanao] 
FROM DISK = 'D:\study\ky4\CSDL\BTL\VINSPORT\vinsp\data\vinsport_db.bak'
WITH REPLACE, STATS = 10;
GO

PRINT 'Dang dua database tro lai hoat dong binh thuong...';
-- Đưa database về chế độ đa người dùng
ALTER DATABASE [QLbanhangquanao] SET MULTI_USER;
GO

PRINT 'Phuc hoi hoan tat!';
