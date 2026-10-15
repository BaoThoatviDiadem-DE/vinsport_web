USE master;
GO

PRINT 'Dang xu ly de dua database ve lai trang thai binh thuong...';
GO

-- Kịch bản: Nếu bạn chạy file 02 bị lỗi ở giữa chừng, database sẽ bị kẹt ở chế độ SINGLE_USER.
-- Script này sẽ "cứu" nó bằng cách tắt hết các kết nối ngầm và bật lại MULTI_USER.
DECLARE @kill varchar(8000) = '';  
SELECT @kill = @kill + 'kill ' + CONVERT(varchar(5), session_id) + ';'  
FROM sys.dm_exec_sessions
WHERE database_id  = db_id('QLbanhangquanao') AND session_id <> @@SPID;

EXEC(@kill);
GO

ALTER DATABASE [QLbanhangquanao] SET MULTI_USER;
GO

PRINT 'Da UNDO thanh cong! Database da mo lai cho nhieu nguoi dung truy cap.';
GO
