const {
  SNSClient,
  PublishCommand,
} = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({
  region: (process.env.AWS_REGION || "ap-southeast-1").trim(),
});

const ALERT_TOPIC_ARN = (process.env.AWS_SNS_ALERT_TOPIC_ARN || process.env.AWS_SNS_TOPIC_ARN || "").trim();

// Bộ nhớ đệm chống bão cảnh báo (Chống gửi hàng trăm email nếu lỗi lặp liên tục)
const alertCooldowns = new Map();
const alertCounts = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 phút



/**
 * Gửi cảnh báo lỗi kỹ thuật hệ thống tới Quản trị viên qua Amazon SNS
 * @param {Object} options
 * @param {'CRITICAL'|'HIGH'|'MEDIUM'|'WARNING'} [options.level='HIGH'] Mức độ nghiêm trọng
 * @param {string} options.title Tiêu đề ngắn gọn của sự cố
 * @param {string} [options.message] Mô tả thêm về ngữ cảnh lỗi
 * @param {Error|any} [options.error] Đối tượng lỗi (lấy stack trace, mã lỗi)
 * @param {import('express').Request} [options.req] Express request (lấy URL, method, IP)
 * @param {Object} [options.context] Dữ liệu bổ sung (ví dụ: orderId, step)
 */
async function sendTechnicalAlert({
  level = "HIGH",
  title = "Sự cố kỹ thuật hệ thống",
  message = "",
  error = null,
  req = null,
  context = null,
} = {}) {

  // Khóa nhận diện sự cố để chống bão thông báo (Rate Limiting)
  const alertKey = `${level}:${title}:${error?.message || ""}`;
  const now = Date.now();
  const lastSent = alertCooldowns.get(alertKey) || 0;

  if (now - lastSent < COOLDOWN_MS) {
    const currentCount = (alertCounts.get(alertKey) || 0) + 1;
    alertCounts.set(alertKey, currentCount);
    console.log(`[AWS SNS Alert Throttled] Đã chặn cảnh báo trùng lặp (${alertKey}). Số lần lặp lại: ${currentCount}`);
    return;
  }

  // Cập nhật thời điểm gửi và reset đếm
  alertCooldowns.set(alertKey, now);
  const repeatedTimes = alertCounts.get(alertKey) || 0;
  alertCounts.set(alertKey, 0);

  // Chạy nền không chặn luồng server
  setImmediate(async () => {
    try {
      const topicArn = ALERT_TOPIC_ARN;
      if (!topicArn) return;

      const timeStr = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

      // Trích xuất thông tin Request nếu có
      let requestInfo = "";
      if (req) {
        requestInfo = `
THÔNG TIN REQUEST:
- API Path   : ${req.method} ${req.originalUrl || req.url}
- Client IP  : ${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "Unknown"}
- User-Agent : ${req.headers["user-agent"] || "Unknown"}
`;
      }

      // Trích xuất thông tin lỗi nếu có
      let errorDetails = "";
      if (error) {
        errorDetails = `
CHI TIẾT LỖI (EXCEPTION):
- Tên lỗi    : ${error.name || "Error"}
- Mã lỗi     : ${error.code || error.number || "N/A"}
- Thông báo  : ${error.message || String(error)}
- Stack Trace:
${error.stack ? error.stack.split("\n").slice(0, 7).join("\n") : "Không có stack trace"}
`;
      }

      // Trích xuất thông tin ngữ cảnh nếu có
      let contextInfo = "";
      if (context && Object.keys(context).length > 0) {
        contextInfo = `
NGỮ CẢNH DỮ LIỆU:
${JSON.stringify(context, null, 2)}
`;
      }

      // Biểu tượng mức độ
      const levelBadge = {
        CRITICAL: "[!!! NGUY CẤP - CRITICAL !!!]",
        HIGH: "[!! CẢNH BÁO CAO - HIGH !!]",
        MEDIUM: "[! CẢNH BÁO - MEDIUM !]",
        WARNING: "[CẢNH BÁO - WARNING]",
      }[level] || `[${level}]`;

      const subject = `[VinSport Alert] ${level}: ${title}`.slice(0, 100);

      const alertBody = `
==================================================
        HỆ THỐNG CẢNH BÁO SỰ CỐ VINSPORT DEVOPS
==================================================
Mức độ    : ${levelBadge}
Sự cố     : ${title}
Thời gian : ${timeStr} (Giờ Việt Nam)
Môi trường: ${process.env.NODE_ENV || "development"} / Port ${process.env.PORT || 5000}
${repeatedTimes > 0 ? `LƯU Ý     : Sự cố này đã xảy ra ${repeatedTimes} lần trong 5 phút trước!` : ""}

MÔ TẢ SỰ CỐ:
${message || "Hệ thống phát hiện lỗi bất thường cần kiểm tra."}
${requestInfo}${errorDetails}${contextInfo}
HÀNH ĐỘNG KHUYẾN NGHỊ:
1. Đăng nhập máy chủ kiểm tra log chi tiết: "pm2 logs" hoặc log tiến trình.
2. Kiểm tra trạng thái SQL Server và kết nối mạng AWS.
3. Liên hệ ngay đội ngũ phụ trách nếu sự cố kéo dài.
==================================================
Hệ thống tự động thông báo qua Amazon SNS Topic
Recipient: ${process.env.EMAIL_USER || process.env.AWS_SNS_ADMIN_EMAIL || "System Admin"}
`;

      const publishCommand = new PublishCommand({
        TopicArn: topicArn,
        Subject: subject,
        Message: alertBody.trim(),
      });

      const res = await snsClient.send(publishCommand);
      console.log(`[AWS SNS Alert] Đã phát cảnh báo khẩn cấp tới ${topicArn} (MessageId: ${res.MessageId})`);
    } catch (snsErr) {
      console.warn(`[AWS SNS Alert] Không thể phát cảnh báo: ${snsErr.message}`);
    }
  });
}

module.exports = {
  sendTechnicalAlert,
};
