const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { sql, poolPromise } = require("../db");

// Địa chỉ email người gửi (chủ cửa hàng VinSport)
const SENDER_EMAIL = process.env.EMAIL_USER || "store@vinsport.local";

// Tạo transport Nodemailer sử dụng Gmail SMTP chính chủ
function createTransporter() {
  const appPassword = (process.env.EMAIL_APP_PASSWORD || "").trim().replace(/\s+/g, "");

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SENDER_EMAIL,
      pass: appPassword,
    },
  });
}

function formatVND(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);
}

function toVietnameseOrderStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  switch (s) {
    case "confirmed":
    case "completed":
      return "Hoàn tất";
    case "shipping":
      return "Đang giao hàng";
    case "cancelled":
      return "Đã hủy";
    case "pending":
    default:
      return "Chờ xử lý";
  }
}

function toVietnamesePaymentMethod(method) {
  const m = String(method || "").toLowerCase().trim();
  switch (m) {
    case "bank":
    case "banking":
      return "Chuyển khoản ngân hàng";
    case "cod":
    default:
      return "Thanh toán khi nhận hàng (COD)";
  }
}

function toVietnamesePaymentStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  switch (s) {
    case "paid":
      return "Đã thanh toán";
    case "failed":
      return "Thanh toán thất bại";
    case "pending":
    default:
      return "Chưa thanh toán";
  }
}

/**
 * Gửi email HTML chuẩn thương hiệu VinSport tới khách hàng
 * - Đặt ảnh banner VinSport trực tiếp ở đầu thư
 * - Các đề mục in màu cam #ea580c chuẩn thương hiệu
 * - Không có ký tự ==
 * - Kết thư: Trân trọng, \n Vinsport Team
 * - Không giới hạn sandbox, gửi được cho MỌI khách hàng, 100% vào Inbox
 */
async function sendOrderEmail(orderId, actionType = "NEW_ORDER", specificRecipient = null) {
  // Chạy nền không chặn luồng response của khách
  setImmediate(async () => {
    try {
      const pool = await poolPromise;
      const orderQuery = await pool
        .request()
        .input("orderId", sql.Int, parseInt(orderId, 10))
        .query(`
          SELECT
            o.order_id,
            o.order_date,
            o.status AS order_status,
            o.total_amount,
            u.name AS customer_name,
            u.email AS customer_email,
            u.phone AS customer_phone,
            ISNULL(ship.address, N'Chưa cung cấp') AS shipping_address,
            ISNULL(pay.method, N'COD') AS payment_method,
            ISNULL(pay.status, N'Pending') AS payment_status
          FROM Orders o
          LEFT JOIN Users u ON o.user_id = u.user_id
          OUTER APPLY (
            SELECT TOP 1 address FROM Shipping WHERE order_id = o.order_id ORDER BY shipping_id DESC
          ) ship
          OUTER APPLY (
            SELECT TOP 1 method, status FROM Payments WHERE order_id = o.order_id ORDER BY payment_id DESC
          ) pay
          WHERE o.order_id = @orderId
        `);

      if (orderQuery.recordset.length === 0) return;
      const order = orderQuery.recordset[0];

      // Lấy danh sách sản phẩm
      const itemsQuery = await pool
        .request()
        .input("orderId", sql.Int, parseInt(orderId, 10))
        .query(`
          SELECT 
            p.name,
            s.name AS size,
            c.name AS color,
            od.quantity,
            od.price
          FROM OrderDetails od
          JOIN ProductVariants pv ON od.variant_id = pv.variant_id
          JOIN Products p ON pv.product_id = p.product_id
          LEFT JOIN Sizes s ON pv.size_id = s.size_id
          LEFT JOIN Colors c ON pv.color_id = c.color_id
          WHERE od.order_id = @orderId
        `);

      const vietnameseStatus = toVietnameseOrderStatus(order.order_status);
      const vietnamesePaymentMethod = toVietnamesePaymentMethod(order.payment_method);
      const vietnamesePaymentStatus = toVietnamesePaymentStatus(order.payment_status);

      let actionTitle = "ĐƠN HÀNG MỚI";
      let subject = `[VinSport] Đơn hàng mới #${order.order_id} - ${formatVND(order.total_amount)}`;

      if (actionType === "CANCELLED" || String(order.order_status).toLowerCase() === "cancelled") {
        actionTitle = "ĐƠN HÀNG ĐÃ BỊ HỦY";
        subject = `[VinSport] Đơn hàng #${order.order_id} ĐÃ BỊ HỦY`;
      } else if (actionType === "STATUS_UPDATED") {
        actionTitle = `CẬP NHẬT TRẠNG THÁI: ${vietnameseStatus.toUpperCase()}`;
        subject = `[VinSport] Cập nhật đơn hàng #${order.order_id}: ${vietnameseStatus}`;
      }

      const itemsHtml = itemsQuery.recordset
        .map(
          (item, idx) => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 12px 0; font-size: 14px; color: #1e293b;">
              <strong style="color: #0f172a;">${idx + 1}. ${item.name}</strong><br/>
              <span style="font-size: 13px; color: #64748b;">Kích cỡ: <b>${item.size || "-"}</b> | Màu sắc: <b>${item.color || "-"}</b></span>
            </td>
            <td style="padding: 12px 8px; text-align: center; font-size: 14px; color: #475569; font-weight: 600;">x${item.quantity}</td>
            <td style="padding: 12px 0; text-align: right; font-size: 14px; font-weight: bold; color: #ea580c;">${formatVND(item.price * item.quantity)}</td>
          </tr>`
        )
        .join("");

      let bannerPath = path.resolve(__dirname, "../../assets/vinsport_email_banner.jpg");
      if (!fs.existsSync(bannerPath)) {
        bannerPath = path.resolve(__dirname, "../assets/vinsport_email_banner.jpg");
      }

      const htmlContent = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="margin: 0; padding: 24px 12px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #fed7aa;">
          
          <!-- 1. ẢNH BANNER LOGO VINSPORT NẰM TRỰC TIẾP ĐẦU THƯ -->
          <div style="width: 100%; text-align: center; background-color: #ea580c;">
            <img src="cid:vinsport_banner" alt="VinSport - Web Bán Đồ Thể Thao" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0 auto;" />
          </div>

          <div style="padding: 28px 24px;">
            
            <!-- 2. LOẠI THÔNG BÁO (MÀU CAM) -->
            <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <h3 style="color: #ea580c; margin: 0 0 10px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                Loại thông báo: ${actionTitle}
              </h3>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Mã đơn hàng:</strong> <span style="font-size: 15px; font-weight: bold; color: #0f172a;">#${order.order_id}</span></p>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Thời gian:</strong> ${new Date(order.order_date || Date.now()).toLocaleString("vi-VN")}</p>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Trạng thái:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 6px; background-color: #ffedd5; color: #ea580c; font-weight: bold; font-size: 13px;">${vietnameseStatus}</span></p>
            </div>

            <!-- 3. THÔNG TIN KHÁCH HÀNG (MÀU CAM) -->
            <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9;">
              <h3 style="color: #ea580c; margin: 0 0 10px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                Thông tin khách hàng
              </h3>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Họ và tên:</strong> ${order.customer_name || "Khách vãng lai"}</p>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Số điện thoại:</strong> ${order.customer_phone || "-"}</p>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Địa chỉ nhận hàng:</strong> ${order.shipping_address}</p>
              <p style="margin: 6px 0; font-size: 14px; color: #334155;"><strong>Hình thức thanh toán:</strong> ${vietnamesePaymentMethod} (${vietnamesePaymentStatus})</p>
            </div>

            <!-- 4. DANH SÁCH SẢN PHẨM (MÀU CAM) -->
            <div style="margin-bottom: 24px;">
              <h3 style="color: #ea580c; margin: 0 0 12px 0; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                Danh sách sản phẩm
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tbody>
                  ${itemsHtml || '<tr><td style="padding: 8px 0; color: #94a3b8;">Không có dữ liệu chi tiết</td></tr>'}
                </tbody>
              </table>
            </div>

            <!-- 5. TỔNG TIỀN THANH TOÁN (MÀU CAM) -->
            <div style="background-color: #fff7ed; border: 1.5px solid #ffedd5; padding: 16px 20px; border-radius: 12px; margin-bottom: 28px;">
              <table style="width: 100%;">
                <tr>
                  <td style="font-size: 16px; font-weight: 800; color: #ea580c; text-transform: uppercase;">Tổng tiền thanh toán</td>
                  <td style="text-align: right; font-size: 22px; font-weight: 900; color: #ea580c;">${formatVND(order.total_amount)}</td>
                </tr>
              </table>
            </div>

            <!-- 6. KẾT THÚC THƯ (KHÔNG CÓ ==) -->
            <div style="font-size: 14px; color: #475569; line-height: 1.6; border-top: 1px solid #f1f5f9; padding-top: 16px;">
              <p style="margin: 0;">Trân trọng,</p>
              <p style="margin: 4px 0 0 0; font-weight: 800; color: #ea580c; font-size: 15px;">Vinsport Team</p>
            </div>

          </div>
        </div>
      </body>
      </html>
      `;

      // 1. Xác định email của khách hàng đã đặt đơn
      const customerEmail =
        order.customer_email &&
        !String(order.customer_email).toLowerCase().endsWith("@vinsport.local")
          ? String(order.customer_email).trim()
          : null;

      // Người nhận ưu tiên là chính email của khách hàng đặt đơn hàng đó
      let targetRecipient = specificRecipient || customerEmail || SENDER_EMAIL;

      const mailOptions = {
        from: `"VinSport Store" <${SENDER_EMAIL}>`,
        to: targetRecipient,
        subject: subject,
        html: htmlContent,
        attachments: [
          {
            filename: "vinsport_banner.jpg",
            path: bannerPath,
            cid: "vinsport_banner", // CID nhúng trực tiếp ảnh vào email
          },
        ],
      };

      const transporter = createTransporter();
      const info = await transporter.sendMail(mailOptions);
      console.log(`[VinSport Email] Đã gửi email HTML đơn #${order.order_id} thành công tới khách hàng: ${targetRecipient} (MessageId: ${info.messageId})`);
    } catch (err) {
      console.warn(`[VinSport Email] Chưa thể gửi email cho đơn #${orderId}: ${err.message}`);
    }
  });
}

/**
 * Gửi mã xác thực OTP qua Email (dùng khi đổi Email hoặc xác minh tài khoản)
 */
async function sendOtpEmail({
  toEmail,
  otpCode,
  userName = "Quý khách",
  purpose = "thay đổi địa chỉ email",
}) {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"VinSport Store" <${SENDER_EMAIL}>`,
      to: toEmail,
      subject: `[VinSport] Mã OTP xác nhận ${purpose}: ${otpCode}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #ffedd5; border-radius: 20px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background-color: #ea580c; color: #ffffff; font-weight: 900; font-style: italic; font-size: 20px; padding: 6px 14px; border-radius: 12px; margin-bottom: 8px;">
              VinSport
            </div>
            <p style="color: #64748b; font-size: 13px; margin: 0;">Hệ thống thời trang & dụng cụ thể thao</p>
          </div>
          <div style="padding: 24px; background-color: #fff7ed; border-radius: 16px; border: 1px solid #ffedd5; text-align: center;">
            <p style="color: #334155; font-size: 15px; margin-top: 0;">Xin chào <strong>${userName}</strong>,</p>
            <p style="color: #475569; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
              Bạn đang thực hiện yêu cầu <strong>${purpose}</strong> trên hệ thống VinSport. Vui lòng nhập mã OTP dưới đây để hoàn tất:
            </p>
            <div style="margin: 16px 0; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ea580c; background: #ffffff; padding: 14px 24px; display: inline-block; border-radius: 12px; border: 2px dashed #fb923c; font-family: monospace;">
              ${otpCode}
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0; margin-top: 14px;">
              ⏱️ Mã này có hiệu lực trong <strong>10 phút</strong>. Vì lý do an toàn, không chia sẻ mã này cho bất kỳ ai.
            </p>
          </div>
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px; margin-bottom: 0;">
            Nếu bạn không yêu cầu thay đổi thông tin này, vui lòng bỏ qua email hoặc liên hệ ngay với VinSport.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[VinSport OTP] Đã gửi mã OTP đến ${toEmail} (MessageId: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn(`[VinSport OTP] Gửi OTP qua Gmail lỗi: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOrderEmail,
  sendOtpEmail,
  SENDER_EMAIL,
};
