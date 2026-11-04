const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: require("path").resolve(__dirname, "../.env") });

const { connectDB } = require("./db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");
const { sendTechnicalAlert } = require("./utils/snsService");
const { startOrderWorker } = require("./utils/sqsService");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "VinSport backend is running",
    api: "/api",
  });
});

app.use("/api/products", productRoutes);
app.use("/api", authRoutes);
app.use("/api", orderRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route không tồn tại",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  // Phát cảnh báo khẩn cấp qua Amazon SNS tới Admin (bnam72862@gmail.com)
  sendTechnicalAlert({
    level: err.status >= 500 || !err.status ? "HIGH" : "MEDIUM",
    title: `Lỗi Server tại ${req.method} ${req.originalUrl}`,
    message: `Một request gặp lỗi nghiêm trọng: ${err.message}`,
    error: err,
    req: req,
  });

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Dữ liệu gửi lên quá lớn. Vui lòng giảm số dòng trong file Excel rồi thử lại.",
    });
  }

  res.status(500).json({
    message: "Lỗi server",
  });
});

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server chạy tại http://localhost:${PORT}`);
      console.log(`API base URL: http://localhost:${PORT}/api`);

      // Khởi động AWS SQS Background Worker
      startOrderWorker();
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n❌ CỔNG ${PORT} ĐÃ BỊ CHIẾM BỞI TIẾN TRÌNH KHÁC!`);
        console.error(`👉 Hãy chạy lệnh sau trên PowerShell để giải phóng cổng:`);
        console.error(`   Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
      } else {
        console.error("Lỗi khởi động server:", err.message);
      }
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error("Không thể khởi động server:", err.message);
  });
