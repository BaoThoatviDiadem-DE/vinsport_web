const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { connectDB } = require("./db");
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminProductRoutes = require("./routes/adminProductRoutes");
const adminUserRoutes = require("./routes/adminUserRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const adminAnalyticsRoutes = require("./routes/adminAnalyticsRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());

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
  res.status(500).json({
    message: "Lỗi server",
  });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server chạy tại http://localhost:${PORT}`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
    });
  })
  .catch((err) => {
    console.error("Không thể khởi động server:", err.message);
  });