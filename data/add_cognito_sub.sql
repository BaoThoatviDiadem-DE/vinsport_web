-- ==============================================
-- MIGRATION: Thêm cột cognito_sub vào bảng Users
-- Chạy script này trên SQL Server Management Studio
-- để cho phép đăng nhập bằng Amazon Cognito
-- ==============================================

USE QLbanhangquanao;
GO

-- Kiểm tra nếu cột chưa tồn tại thì mới thêm
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users'
      AND COLUMN_NAME = 'cognito_sub'
)
BEGIN
    ALTER TABLE Users
    ADD cognito_sub NVARCHAR(100) NULL;

    PRINT N'Đã thêm cột cognito_sub vào bảng Users';
END
ELSE
BEGIN
    PRINT N'Cột cognito_sub đã tồn tại';
END
GO

-- Tạo unique index (filtered) cho cognito_sub
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Users_cognito_sub'
      AND object_id = OBJECT_ID('Users')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX IX_Users_cognito_sub
    ON Users (cognito_sub)
    WHERE cognito_sub IS NOT NULL;

    PRINT N'Đã tạo index IX_Users_cognito_sub';
END
ELSE
BEGIN
    PRINT N'Index IX_Users_cognito_sub đã tồn tại';
END
GO

PRINT N'Migration hoàn tất! Cognito login đã sẵn sàng.';
GO

