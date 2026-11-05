const express = require("express");
const router = express.Router();
const { generateAndSaveOTP, verifyAndConsumeOTP } = require("../utils/dynamoService");
const nodemailer = require("nodemailer");

function createTransporter() {
  const SENDER_EMAIL = process.env.EMAIL_USER || "store@vinsport.local";
  const appPassword = (process.env.EMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");
  if (!appPassword || !process.env.EMAIL_USER) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SENDER_EMAIL,
      pass: appPassword,
    },
  });
}

// POST /api/otp/send: Sinh mã OTP, lưu vào DynamoDB (TTL 5 phút) và gửi qua Gmail
router.post("/otp/send", async (req, res) => {
  try {
    const { email, purpose = "XÁC THỰC" } = req.body || {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: "Vui lòng cung cấp địa chỉ email" });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Sinh mã OTP và lưu vào Amazon DynamoDB với hạn tự hủy TTL = 5 phút
    const otpResult = await generateAndSaveOTP(cleanEmail, purpose, 5);

    if (!otpResult) {
      return res.status(500).json({ message: "Không thể tạo mã OTP trên DynamoDB" });
    }

    const { otpCode, expiresAt } = otpResult;

    // 2. Gửi email thông báo mã OTP qua Gmail SMTP nếu đã cấu hình
    const transporter = createTransporter();
    let emailSent = false;

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"VinSport Security" <${process.env.EMAIL_USER}>`,
          to: cleanEmail,
          subject: `[VinSport] Mã OTP xác thực của bạn: ${otpCode}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 16px;">
              <h2 style="color: #ea580c; text-align: center; margin-bottom: 8px;">VINSPORT SECURITY</h2>
              <p style="text-align: center; color: #64748b; font-size: 14px;">Mã xác thực một lần (OTP) - Quản lý bởi Amazon DynamoDB NoSQL</p>
              <div style="background-color: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #c2410c;">${otpCode}</span>
              </div>
              <p style="color: #475569; font-size: 13px; line-height: 1.6;">
                Mục đích: <strong>${purpose}</strong><br/>
                Mã này có hiệu lực trong <strong>5 phút</strong> và sẽ được <strong>Amazon DynamoDB tự động tiêu hủy vĩnh viễn</strong> sau thời gian trên.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin-top: 20px; text-align: center;">
                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
              </p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr) {
        console.warn("[OTP Email] Không thể gửi Gmail:", mailErr.message);
      }
    }

    res.json({
      success: true,
      source: "Amazon DynamoDB (TTL 5 Phút)",
      message: emailSent
        ? `Mã OTP đã được gửi về email ${cleanEmail}`
        : `Mã OTP đã được tạo trên DynamoDB (Hết hạn sau 5 phút)`,
      email: cleanEmail,
      expiresAt,
      // Phục vụ test tiện lợi ngay cả khi chưa mở email
      previewCode: otpCode,
    });
  } catch (err) {
    console.error("POST /api/otp/send error:", err.message);
    res.status(500).json({ message: "Lỗi hệ thống khi gửi OTP" });
  }
});

// POST /api/otp/verify: Xác thực mã OTP từ DynamoDB
router.post("/otp/verify", async (req, res) => {
  try {
    const { email, code, purpose = "XÁC THỰC" } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({ message: "Thiếu email hoặc mã OTP" });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const result = await verifyAndConsumeOTP(cleanEmail, code, purpose);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json({
      success: true,
      source: "Amazon DynamoDB (NoSQL)",
      message: result.message,
    });
  } catch (err) {
    console.error("POST /api/otp/verify error:", err.message);
    res.status(500).json({ message: "Lỗi hệ thống khi kiểm tra OTP" });
  }
});

module.exports = router;

