USE master;
GO

-- 1. Tạo Master Key (Nếu chưa có)
-- Chú ý: Bạn chỉ cần chạy lệnh này 1 lần duy nhất trên máy chủ SQL Server của mình
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE name = '##MS_DatabaseMasterKey##')
BEGIN
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = 'YourStrongPassword123!';
END
GO

-- 2. Xóa Credential cũ (nếu bạn muốn cập nhật lại Key)
IF EXISTS (SELECT * FROM sys.credentials WHERE name = 's3://s3.ap-southeast-1.amazonaws.com/lakehouse-vinsport-1')
BEGIN
    DROP CREDENTIAL [s3://s3.ap-southeast-1.amazonaws.com/lakehouse-vinsport-1];
END
GO

-- 3. Tạo Credential xác thực với S3
-- !!QUAN TRỌNG!! Hãy điền Access Key và Secret Key của bạn vào phần SECRET trước khi chạy
-- Định dạng bắt buộc: 'AccessKey:SecretKey'
CREATE CREDENTIAL [s3://s3.ap-southeast-1.amazonaws.com/lakehouse-vinsport-1]
WITH 
    IDENTITY = 'S3 Access Key',
    SECRET = '<YOUR_AWS_ACCESS_KEY>:<YOUR_AWS_SECRET_KEY>';
GO

PRINT 'Da tao chung chi AWS S3 thanh cong! (Luu y: Can dien dung Key truoc khi thuc thi)';
