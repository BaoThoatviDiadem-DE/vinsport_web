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
  .then((pool) => {
    console.log("Kết nối SQL Server thành công");
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