require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { sendTechnicalAlert } = require("../src/utils/snsService");

async function main() {
  console.log("Đang bắn thử nghiệm cảnh báo kỹ thuật khẩn cấp qua Amazon SNS...");

  const fakeError = new Error("Connection lost to SQL Server (MSSQLSERVER) on localhost:1433");
  fakeError.code = "ETIMEDOUT";

  await sendTechnicalAlert({
    level: "CRITICAL",
    title: "MẤT KẾT NỐI CƠ SỞ DỮ LIỆU SQL SERVER",
    message: "Connection pool bị mất kết nối tới máy chủ CSDL, các truy vấn tạo đơn hàng đang bị gián đoạn.",
    error: fakeError,
    context: {
      serverHost: "localhost:1433",
      databaseName: process.env.DB_NAME || "QLbanhangquanao",
      affectedFeature: "Toàn bộ hệ thống Backend API",
    },
  });

  setTimeout(() => {
    console.log("Hoàn tất test cảnh báo kỹ thuật!");
    process.exit(0);
  }, 4000);
}

main();
