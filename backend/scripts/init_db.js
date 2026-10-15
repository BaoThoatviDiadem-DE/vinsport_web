const fs = require("fs");
const path = require("path");
const sql = require("mssql");

// 1. Kiểm tra và tự động khởi tạo .env nếu chưa có
const envPath = path.join(__dirname, "../.env");
const envExamplePath = path.join(__dirname, "../.env.example");

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log("ℹ️  Chưa tìm thấy backend/.env. Đang tự động tạo từ .env.example...");
  fs.copyFileSync(envExamplePath, envPath);
}

require("dotenv").config({ path: envPath });

const DB_USER = process.env.DB_USER || "sa";
const DB_PASSWORD = process.env.DB_PASSWORD || "123456";
const DB_SERVER = process.env.DB_SERVER || "localhost";
const DB_NAME = process.env.DB_NAME || "QLbanhangquanao";
const DB_ENCRYPT = process.env.DB_ENCRYPT === "true";
const DB_TRUST_CERT = process.env.DB_TRUST_SERVER_CERTIFICATE !== "false";

const DATA_DIR = path.join(__dirname, "../../data");

// Danh sách các file SQL cần chạy theo đúng thứ tự logic
const SQL_FILES = [
  "TAODATABASE_TABLE.sql",
  "DATATEST.sql",
  "Index.sql",
  "PROCEDURE.sql",
  "TRIGGER.sql",
  "VIEW.sql",
];

// Hàm tách các khối lệnh (batch) ngăn cách bởi từ khóa GO trong T-SQL
function splitSqlBatches(sqlContent) {
  const normalized = sqlContent.replace(/\r\n/g, "\n");
  const rawBatches = normalized.split(/^\s*GO\s*(?:--.*)?$/gim);
  return rawBatches
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

// Kiểm tra xem batch có phải là lệnh tạo CSDL (vì đã tạo ở bước 0)
function isCreateDatabaseBatch(batch, dbName) {
  const clean = batch
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  const regex = new RegExp(`^CREATE\\s+DATABASE\\s+(\\[?${dbName}\\]?)`, "i");
  return regex.test(clean);
}

async function initDatabase() {
  console.log("===============================================================");
  console.log("🚀  BẮT ĐẦU QUÁ TRÌNH TỰ ĐỘNG KHỞI TẠO CƠ SỞ DỮ LIỆU VINSPORT");
  console.log("===============================================================");
  console.log(`📌 Server:       ${DB_SERVER}`);
  console.log(`📌 User:         ${DB_USER}`);
  console.log(`📌 Database mục tiêu: ${DB_NAME}`);
  console.log("---------------------------------------------------------------\n");

  // Bước 1: Kết nối vào database 'master' để tạo mới / làm sạch DB mục tiêu
  const masterConfig = {
    user: DB_USER,
    password: DB_PASSWORD,
    server: DB_SERVER,
    database: "master",
    options: {
      encrypt: DB_ENCRYPT,
      trustServerCertificate: DB_TRUST_CERT,
    },
  };

  let masterPool;
  try {
    process.stdout.write("⏳ Đang kết nối tới SQL Server (master)... ");
    masterPool = await new sql.ConnectionPool(masterConfig).connect();
    console.log("Thành công! ✅");
  } catch (err) {
    console.log("Thất bại! ❌");
    console.error("\n❌ LỖI KẾT NỐI SQL SERVER:", err.message);
    console.error("\n💡 GỢI Ý KHẮC PHỤC:");
    console.error("1. Đảm bảo dịch vụ SQL Server (MSSQLSERVER hoặc SQLEXPRESS) đang BẬT.");
    console.error("2. Kiểm tra thông tin DB_USER và DB_PASSWORD trong file 'backend/.env'.");
    console.error("3. Đảm bảo SQL Server đã bật chế độ 'SQL Server and Windows Authentication'.");
    process.exit(1);
  }

  try {
    process.stdout.write(`⏳ Đang làm mới database [${DB_NAME}]... `);
    const dropAndCreateQuery = `
      IF EXISTS (SELECT 1 FROM sys.databases WHERE name = '${DB_NAME}')
      BEGIN
        ALTER DATABASE [${DB_NAME}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${DB_NAME}];
      END;
      CREATE DATABASE [${DB_NAME}];
    `;
    await masterPool.request().query(dropAndCreateQuery);
    console.log("Đã tạo mới sạch sẽ! ✅");
  } catch (err) {
    console.log("Lỗi! ❌");
    console.error(`❌ Không thể tạo database [${DB_NAME}]:`, err.message);
    await masterPool.close();
    process.exit(1);
  } finally {
    await masterPool.close();
  }

  // Bước 2: Kết nối trực tiếp vào database mục tiêu vừa tạo
  const targetConfig = {
    user: DB_USER,
    password: DB_PASSWORD,
    server: DB_SERVER,
    database: DB_NAME,
    options: {
      encrypt: DB_ENCRYPT,
      trustServerCertificate: DB_TRUST_CERT,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  let targetPool;
  try {
    process.stdout.write(`⏳ Đang kết nối vào database [${DB_NAME}]... `);
    targetPool = await new sql.ConnectionPool(targetConfig).connect();
    console.log("Thành công! ✅\n");
  } catch (err) {
    console.log("Thất bại! ❌");
    console.error(`❌ Không thể kết nối vào [${DB_NAME}]:`, err.message);
    process.exit(1);
  }

  // Bước 3: Lần lượt chạy 6 file SQL
  let totalBatches = 0;
  let successFiles = 0;

  for (let idx = 0; idx < SQL_FILES.length; idx++) {
    const fileName = SQL_FILES[idx];
    const filePath = path.join(DATA_DIR, fileName);

    console.log(`[${idx + 1}/${SQL_FILES.length}] 📂 Đang xử lý file: ${fileName}`);

    if (!fs.existsSync(filePath)) {
      console.warn(`    ⚠️ CẢNH BÁO: Không tìm thấy file ${filePath}, bỏ qua!`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const batches = splitSqlBatches(content);
    console.log(`    Tìm thấy ${batches.length} khối lệnh (batches). Đang thực thi...`);

    let fileBatchCount = 0;
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];

      // Bỏ qua lệnh CREATE DATABASE nếu còn sót trong file
      if (isCreateDatabaseBatch(batch, DB_NAME)) {
        continue;
      }

      try {
        await targetPool.request().query(batch);
        fileBatchCount++;
        totalBatches++;
      } catch (batchErr) {
        // Một số lệnh DROP nếu đối tượng chưa tồn tại có thể báo lỗi nhẹ, ta bỏ qua cảnh báo này
        const msg = batchErr.message || "";
        if (
          msg.includes("Cannot drop") ||
          msg.includes("does not exist") ||
          msg.includes("Cannot find the object")
        ) {
          // Bỏ qua cảnh báo vô hại
        } else {
          console.error(`    ⚠️ Lỗi tại batch #${bIdx + 1} (${fileName}): ${msg}`);
        }
      }
    }

    console.log(`    ✅ Hoàn thành file ${fileName} (${fileBatchCount} batches đã chạy)`);
    successFiles++;
  }

  await targetPool.close();

  console.log("\n===============================================================");
  console.log(`🎉  CHÚC MỪNG! KHỞI TẠO CƠ SỞ DỮ LIỆU HOÀN TẤT THÀNH CÔNG!`);
  console.log(`📊  Tổng kết: Đã nạp ${successFiles}/${SQL_FILES.length} files (${totalBatches} batches SQL)`);
  console.log(`🌐  Hệ thống Database [${DB_NAME}] đã sẵn sàng cho VinSport.`);
  console.log("===============================================================");
}

initDatabase().catch((err) => {
  console.error("\n❌ LỖI CHƯA XÁC ĐỊNH:", err);
  process.exit(1);
});
