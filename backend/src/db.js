const sql = require("mssql");
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
  },
};

const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then(async (pool) => {
    console.log("Kết nối SQL Server thành công");

    // Lắng nghe lỗi runtime của connection pool và cảnh báo qua SNS
    pool.on("error", (err) => {
      console.error("Lỗi SQL Pool runtime:", err.message);
      try {
        const { sendTechnicalAlert } = require("./utils/snsService");
        sendTechnicalAlert({
          level: "CRITICAL",
          title: "SỰ CỐ RUNTIME CƠ SỞ DỮ LIỆU SQL SERVER",
          message: `Connection pool phát hiện lỗi runtime: ${err.message}`,
          error: err,
        });
      } catch (_) {}
    });

    // Tự động kiểm tra và tạo cột cognito_sub nếu chưa có
    try {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'cognito_sub'
        )
        BEGIN
          ALTER TABLE Users ADD cognito_sub NVARCHAR(100) NULL;
          PRINT 'Đã tự động thêm cột cognito_sub vào Users';
        END;

        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'IX_Users_cognito_sub' AND object_id = OBJECT_ID('Users')
        )
        BEGIN
          CREATE UNIQUE NONCLUSTERED INDEX IX_Users_cognito_sub
          ON Users (cognito_sub)
          WHERE cognito_sub IS NOT NULL;
        END;
      `);
      console.log("Đã xác nhận cấu trúc bảng Users (hỗ trợ cognito_sub)");
    } catch (migErr) {
      console.warn("Cảnh báo kiểm tra bảng Users:", migErr.message);
    }

    return pool;
  })
  .catch((error) => {
    console.error("Lỗi kết nối SQL Server:", error.message);
    try {
      const { sendTechnicalAlert } = require("./utils/snsService");
      sendTechnicalAlert({
        level: "CRITICAL",
        title: "MẤT KẾT NỐI CƠ SỞ DỮ LIỆU SQL SERVER",
        message: "Không thể kết nối tới SQL Server khi khởi động hoặc truy vấn.",
        error: error,
        context: {
          server: dbConfig.server,
          database: dbConfig.database,
        },
      });
    } catch (_) {}
    throw error;
  });

const connectDB = async () => {
  return poolPromise;
};

module.exports = { sql, poolPromise, connectDB };
