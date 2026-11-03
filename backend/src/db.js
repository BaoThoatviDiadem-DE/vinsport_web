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
    return pool;
  })
  .catch((error) => {
    console.error("Lỗi kết nối SQL Server:", error.message);
    throw error;
  });

const connectDB = async () => {
  return poolPromise;
};

module.exports = { sql, poolPromise, connectDB };