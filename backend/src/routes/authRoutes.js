const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../db");
const crypto = require("crypto");
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
  cognitoLoginDirect,
  cognitoUpdateUserAttributes,
  cognitoVerifyUserAttribute,
  cognitoGetUserAttributeVerificationCode,
} = require("../utils/cognitoService");
const { verifyToken } = require("../middlewares/authMiddleware");
const { uploadUserToS3 } = require("../utils/s3Service");
const { sendOtpEmail } = require("../utils/emailService");
const { isValidVietnamesePhone } = require("../utils/phoneValidator");

// Bộ nhớ tạm lưu trữ yêu cầu đổi email đang chờ xác thực mã OTP
// key: userId (Number) -> value: { pendingEmail, otpCode, name, phone, address, expiresAt }
const pendingEmailChanges = new Map();

// Xác minh ID Token dùng cho bước liên kết tài khoản
let cognitoIdVerifier = null;
try {
  if (process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID) {
    cognitoIdVerifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: "id",
      clientId: process.env.COGNITO_CLIENT_ID,
    });
  }
} catch (err) {
  console.warn("Cảnh báo: Không thể khởi tạo CognitoJwtVerifier:", err.message);
}

// Danh sách email DUY NHẤT được hệ thống cấp quyền Quản trị viên (Admin Whitelist)
// Mọi email khác khi đăng ký LUÔN LUÔN mặc định 100% là "user"
const ADMIN_WHITELIST = [
  "chuducnhatminhbongro@gmail.com",
  "vinsport@gmail.com",
  ...(process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase()) : []),
];

function isWhitelistedAdmin(email) {
  if (!email) return false;
  return ADMIN_WHITELIST.includes(String(email).trim().toLowerCase());
}

/**
 * Hàm đồng bộ tài khoản Cognito với cơ sở dữ liệu SQL Server
 * Nếu email đã có sẵn (ví dụ admin vinsport@gmail.com) -> Giữ nguyên quyền admin và liên kết cognito_sub
 * Nếu chưa có -> Tự động tạo bản ghi mới
 */
async function syncUserWithSQLServer({ cognitoSub, email, name, phone }) {
  const pool = await poolPromise;
  const cleanEmail = String(email || "").trim().toLowerCase();
  const shouldBeAdmin = isWhitelistedAdmin(cleanEmail);

  // 1. Ưu tiên tìm theo cognito_sub
  let result = await pool
    .request()
    .input("cognito_sub", sql.NVarChar(100), cognitoSub)
    .query(`
      SELECT TOP 1
        user_id, [name], [email], [phone],
        [address], [role], [cognito_sub]
      FROM Users
      WHERE cognito_sub = @cognito_sub
    `);

  let user = result.recordset[0];

  // 2. Nếu chưa tìm thấy theo cognito_sub, tìm theo email
  if (!user) {
    result = await pool
      .request()
      .input("email", sql.NVarChar(100), cleanEmail)
      .query(`
        SELECT TOP 1
          user_id, [name], [email], [phone],
          [address], [role], [cognito_sub]
        FROM Users
        WHERE LOWER(LTRIM(RTRIM([email]))) = @email
      `);

    user = result.recordset[0];

    if (user) {
      // Cập nhật cognito_sub cho tài khoản có sẵn
      if (!user.cognito_sub) {
        await pool
          .request()
          .input("user_id", sql.Int, user.user_id)
          .input("cognito_sub", sql.NVarChar(100), cognitoSub)
          .query(`
            UPDATE Users
            SET cognito_sub = @cognito_sub
            WHERE user_id = @user_id
              AND cognito_sub IS NULL
          `);
        user.cognito_sub = cognitoSub;
        console.log(`[SQL SERVER] Đã liên kết cognito_sub vào tài khoản sẵn có: ${cleanEmail} (Quyền: ${user.role})`);
      }
    } else {
      // 3. Email chưa có trong SQL Server: Tạo tài khoản mới
      const displayName = String(name || cleanEmail.split("@")[0]).trim().slice(0, 100);
      const userPhone = phone ? String(phone).trim().slice(0, 15) : null;
      const passwordPlaceholder = crypto.randomBytes(48).toString("hex");

      const userRole = shouldBeAdmin ? "admin" : "user";

      await pool
        .request()
        .input("name", sql.NVarChar(100), displayName)
        .input("email", sql.NVarChar(100), cleanEmail)
        .input("password", sql.NVarChar(255), passwordPlaceholder)
        .input("phone", sql.NVarChar(15), userPhone)
        .input("cognito_sub", sql.NVarChar(100), cognitoSub)
        .input("role", sql.NVarChar(20), userRole)
        .query(`
          INSERT INTO Users
            ([name], [email], [password], [phone], [address], [role], [cognito_sub])
          VALUES
            (@name, @email, @password, @phone, NULL, @role, @cognito_sub)
        `);

      result = await pool
        .request()
        .input("cognito_sub", sql.NVarChar(100), cognitoSub)
        .query(`
          SELECT TOP 1
            user_id, [name], [email], [phone],
            [address], [role], [cognito_sub]
          FROM Users
          WHERE cognito_sub = @cognito_sub
          ORDER BY user_id DESC
        `);

      user = result.recordset[0];
      console.log(`[SQL SERVER] Đã tạo tài khoản mới: ${cleanEmail} (Quyền: ${user?.role || userRole})`);
    }
  }

  // Nếu email thuộc danh sách admin whitelist nhưng trong CSDL chưa có quyền admin -> Tự động cập nhật
  if (user && shouldBeAdmin && user.role !== "admin") {
    await pool
      .request()
      .input("user_id", sql.Int, user.user_id)
      .query(`
        UPDATE Users
        SET role = 'admin'
        WHERE user_id = @user_id
      `);
    user.role = "admin";
    console.log(`[SQL SERVER] Đã tự động cập nhật quyền Admin cho email whitelist: ${cleanEmail}`);
  }

  return user;
}

// =========================================================================
// 1. FLOW DÀNH CHO COGNITO HOSTED UI (CALLBACK REDIRECT)
// =========================================================================

// POST /api/auth/link
router.post("/auth/link", async (req, res) => {
  try {
    const { idToken } = req.body || {};

    if (!idToken) {
      return res.status(400).json({
        message: "Thiếu Cognito ID Token",
      });
    }

    // Xác minh ID Token với Cognito
    let payload;
    try {
      payload = await cognitoIdVerifier.verify(idToken);
    } catch (error) {
      console.error("Cognito token verification error:", error.message);
      return res.status(401).json({
        message: `Cognito ID Token không hợp lệ hoặc đã hết hạn: ${error.message}`,
      });
    }

    const cognitoSub = payload.sub;
    const email = String(payload.email || "").trim().toLowerCase();

    if (!cognitoSub || !email) {
      return res.status(400).json({
        message: "Token thiếu thông tin tài khoản (sub hoặc email)",
      });
    }

    const nameFromCognito =
      payload.name ||
      [payload.given_name, payload.family_name].filter(Boolean).join(" ") ||
      email.split("@")[0];

    const user = await syncUserWithSQLServer({
      cognitoSub,
      email,
      name: nameFromCognito,
      phone: payload.phone_number,
    });

    return res.json({
      message: "Liên kết tài khoản Cognito thành công",
      user: {
        id: user.user_id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role || "user",
      },
    });
  } catch (error) {
    const detailedMsg = error?.originalError?.info?.message || error.message || "Lỗi máy chủ";
    console.error("POST /api/auth/link error:", detailedMsg, error);

    return res.status(500).json({
      message: `Lỗi khi liên kết tài khoản Cognito với VinSport: ${detailedMsg}`,
    });
  }
});

// =========================================================================
// 2. FLOW ĐĂNG KÝ / ĐĂNG NHẬP TRỰC TIẾP TRÊN WEB VINSPORT (KHÔNG QUA HOSTED UI)
// =========================================================================

// POST /api/auth/cognito-direct/register
// Đăng ký ngầm bên Cognito -> Gửi mã OTP về email
router.post("/auth/cognito-direct/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ Email và Mật khẩu.",
      });
    }

    if (phone && !isValidVietnamesePhone(phone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số di động của nhà mạng Việt Nam (03x, 05x, 07x, 08x, 09x).",
      });
    }

    const result = await cognitoSignUp({ email, password, name, phone });

    return res.json({
      success: true,
      message: "Đăng ký thành công! Mã xác thực OTP đã được gửi về Gmail của bạn.",
      email: email.trim().toLowerCase(),
      userSub: result.UserSub,
      destination: result.CodeDeliveryDetails?.Destination || email,
    });
  } catch (error) {
    console.error("cognito-direct/register error:", error.message);
    return res.status(400).json({
      message: error.message || "Không thể đăng ký tài khoản qua Cognito",
    });
  }
});

// POST /api/auth/cognito-direct/confirm
// Xác nhận mã OTP do Cognito gửi về Email -> Kích hoạt tài khoản và đồng bộ SQL Server
router.post("/auth/cognito-direct/confirm", async (req, res) => {
  try {
    const { email, code, name, phone, password } = req.body || {};

    if (!email || !code) {
      return res.status(400).json({
        message: "Vui lòng cung cấp Email và Mã xác thực OTP.",
      });
    }

    // 1. Xác nhận mã với Cognito
    await cognitoConfirmSignUp({ email, code });

    // 2. Nếu có gửi kèm password -> Thử đăng nhập luôn để cấp token ngay lập tức
    let authResult = null;
    if (password) {
      try {
        const loginRes = await cognitoLoginDirect({ email, password });
        authResult = loginRes.AuthenticationResult;
      } catch (loginErr) {
        console.warn("Tự động đăng nhập sau confirm:", loginErr.message);
      }
    }

    // 3. Lấy cognitoSub từ token hoặc tạo tài khoản trong SQL
    let cognitoSub = null;
    let token = null;

    if (authResult?.IdToken) {
      token = authResult.AccessToken;
      try {
        const payload = await cognitoIdVerifier.verify(authResult.IdToken);
        cognitoSub = payload.sub;
      } catch (e) {
        console.warn("Verify IdToken error:", e.message);
      }
    }

    // 4. Đồng bộ vào SQL Server
    const user = await syncUserWithSQLServer({
      cognitoSub: cognitoSub || `cognito-${email.trim().toLowerCase()}`,
      email,
      name,
      phone,
    });

    return res.json({
      success: true,
      message: "Xác thực tài khoản thành công!",
      user: {
        id: user.user_id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role || "user",
      },
      token,
    });
  } catch (error) {
    console.error("cognito-direct/confirm error:", error.message);
    return res.status(400).json({
      message: error.message || "Xác thực mã không thành công",
    });
  }
});

// POST /api/auth/cognito-direct/resend-code
// Gửi lại mã OTP
router.post("/auth/cognito-direct/resend-code", async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ message: "Thiếu email để gửi lại mã." });
    }

    await cognitoResendCode({ email });

    return res.json({
      success: true,
      message: "Mã xác thực mới đã được gửi lại vào Gmail của bạn.",
    });
  } catch (error) {
    console.error("cognito-direct/resend-code error:", error.message);
    return res.status(400).json({
      message: error.message || "Không thể gửi lại mã xác thực",
    });
  }
});

// POST /api/auth/cognito-direct/login
// Đăng nhập trực tiếp bằng Email & Password trên web VinSport (yêu cầu bật USER_PASSWORD_AUTH trên Cognito)
router.post("/auth/cognito-direct/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        message: "Vui lòng nhập Email và Mật khẩu",
      });
    }

    // 1. Xác thực với Cognito bằng USER_PASSWORD_AUTH
    let authRes;
    try {
      authRes = await cognitoLoginDirect({ email, password });
    } catch (cognitoErr) {
      if (cognitoErr.code === "UserNotConfirmedException") {
        return res.status(403).json({
          requireConfirm: true,
          email: email.trim().toLowerCase(),
          message: "Tài khoản của bạn chưa được xác minh mã OTP. Vui lòng nhập mã để kích hoạt.",
        });
      }

      if (cognitoErr.originalMessage?.includes("USER_PASSWORD_AUTH") || cognitoErr.code === "NotAuthorizedException") {
        // Nếu Cognito App Client chưa tích chọn ALLOW_USER_PASSWORD_AUTH
        if (cognitoErr.originalMessage?.includes("USER_PASSWORD_AUTH")) {
          return res.status(400).json({
            message: "App Client trên AWS Cognito chưa bật flow USER_PASSWORD_AUTH. Vui lòng bật ALLOW_USER_PASSWORD_AUTH trong App Client hoặc bấm nút 'Đăng nhập qua Amazon Cognito' bên dưới.",
            code: "FLOW_NOT_ENABLED",
          });
        }
      }

      throw cognitoErr;
    }

    const authResult = authRes.AuthenticationResult;
    if (!authResult?.IdToken || !authResult?.AccessToken) {
      throw new Error("Cognito không trả về token xác thực");
    }

    // 2. Xác minh IdToken để lấy sub và email
    const payload = await cognitoIdVerifier.verify(authResult.IdToken);
    const cognitoSub = payload.sub;
    const userEmail = String(payload.email || email).trim().toLowerCase();
    const userName = payload.name || payload.given_name || userEmail.split("@")[0];

    // 3. Tìm / Liên kết với tài khoản trong SQL Server
    const user = await syncUserWithSQLServer({
      cognitoSub,
      email: userEmail,
      name: userName,
      phone: payload.phone_number,
    });

    console.log(`[LOGIN DIRECT] Đăng nhập thành công: ${user.email} (Quyền: ${user.role})`);

    return res.json({
      success: true,
      message: "Đăng nhập thành công",
      user: {
        id: user.user_id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role || "user",
      },
      token: authResult.AccessToken,
      idToken: authResult.IdToken,
    });
  } catch (error) {
    console.error("cognito-direct/login error:", error.message);
    return res.status(401).json({
      message: error.message || "Đăng nhập không thành công",
    });
  }
});

// =========================================================================
// 3. CÁC API LEGACY (FALLBACK)
// =========================================================================

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`
        SELECT user_id, [name], [email], [password], [phone], [address], [role]
        FROM Users
        WHERE [email] = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không chính xác" });
    }

    const user = result.recordset[0];
    if (String(user.password) !== String(password)) {
      return res.status(401).json({ message: "Tài khoản hoặc mật khẩu không chính xác" });
    }

    const role = user.role || "user";
    const token = `user-${user.user_id}-${role}-token`;

    return res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role,
      },
    });
  } catch (error) {
    console.error("POST /api/login error:", error);
    return res.status(500).json({
      message: error?.originalError?.info?.message || error.message || "Lỗi đăng nhập",
    });
  }
});

// POST /api/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone = "", address = "" } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Thiếu thông tin đăng ký" });
    }

    const pool = await poolPromise;
    const existed = await pool
      .request()
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`SELECT user_id FROM Users WHERE [email] = @email`);

    if (existed.recordset.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    await pool
      .request()
      .input("name", sql.NVarChar(100), String(name).trim())
      .input("email", sql.NVarChar(100), String(email).trim())
      .input("password", sql.NVarChar(255), String(password))
      .input("phone", sql.NVarChar(15), String(phone).trim() || null)
      .input("address", sql.NVarChar(255), String(address).trim() || null)
      .input("role", sql.NVarChar(20), "user")
      .query(`
        INSERT INTO Users ([name], [email], [password], [phone], [address], [role])
        VALUES (@name, @email, @password, @phone, @address, @role)
      `);

    const userResult = await pool
      .request()
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`
        SELECT TOP 1 user_id, [name], [email], [phone], [address], [role]
        FROM Users
        WHERE [email] = @email
        ORDER BY user_id DESC
      `);

    const newUser = userResult.recordset[0];
    const role = newUser.role || "user";
    const token = `user-${newUser.user_id}-${role}-token`;

    return res.json({
      message: "Đăng ký thành công",
      token,
      user: {
        id: newUser.user_id,
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone || "",
        address: newUser.address || "",
        role,
      },
    });
  } catch (error) {
    console.error("POST /api/register error:", error);
    return res.status(500).json({
      message: error?.originalError?.info?.message || error.message || "Lỗi đăng ký tài khoản",
    });
  }
});

// =========================================================================
// 4. QUẢN LÝ THÔNG TIN CÁ NHÂN (PROFILE)
// =========================================================================

// GET /api/auth/profile
// Lấy thông tin cá nhân mới nhất từ cơ sở dữ liệu
router.get("/auth/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 1
          user_id, [name], [email], [phone], [address], [role], [cognito_sub]
        FROM Users
        WHERE user_id = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const u = result.recordset[0];
    return res.json({
      success: true,
      user: {
        id: u.user_id,
        user_id: u.user_id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        address: u.address || "",
        role: u.role || "user",
      },
    });
  } catch (error) {
    console.error("GET /api/auth/profile error:", error);
    return res.status(500).json({
      message: error?.message || "Không thể tải thông tin cá nhân",
    });
  }
});

// PUT /api/auth/profile
// Cập nhật thông tin cá nhân người dùng:
// - Nếu KHÔNG đổi email: Cập nhật trực tiếp SQL Server + AWS Cognito + AWS S3.
// - Nếu ĐỔI EMAIL: Bắt buộc gửi mã OTP về email mới để xác thực trước khi cập nhật!
router.put("/auth/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      name = "",
      email = "",
      phone = "",
      address = "",
    } = req.body || {};

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone).trim();
    const cleanAddress = String(address).trim();

    if (!cleanName) {
      return res.status(400).json({ message: "Họ và tên không được để trống" });
    }

    if (!cleanEmail) {
      return res.status(400).json({ message: "Email không được để trống" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: "Định dạng email không hợp lệ" });
    }

    if (cleanPhone && !isValidVietnamesePhone(cleanPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số di động của nhà mạng Việt Nam (03x, 05x, 07x, 08x, 09x).",
      });
    }

    const pool = await poolPromise;

    // Lấy thông tin user hiện tại trong CSDL
    const currentRes = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT TOP 1 user_id, email, name FROM Users WHERE user_id = @userId");

    if (currentRes.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const currentEmail = String(currentRes.recordset[0].email || "").trim().toLowerCase();
    const isEmailChanging = cleanEmail !== currentEmail;

    // 1. Kiểm tra xem email mới có bị trùng với tài khoản khác không
    if (isEmailChanging) {
      const existedEmail = await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("email", sql.NVarChar(100), cleanEmail)
        .query(`
          SELECT TOP 1 user_id
          FROM Users
          WHERE LOWER(LTRIM(RTRIM(email))) = @email AND user_id <> @userId
        `);

      if (existedEmail.recordset.length > 0) {
        return res.status(400).json({
          message: "Email này đã được sử dụng bởi một tài khoản khác trong hệ thống",
        });
      }
    }

    // 2. Nếu email KHÔNG đổi: cập nhật trực tiếp như bình thường
    if (!isEmailChanging) {
      await pool
        .request()
        .input("userId", sql.Int, userId)
        .input("name", sql.NVarChar(100), cleanName)
        .input("email", sql.NVarChar(100), cleanEmail)
        .input("phone", sql.NVarChar(15), cleanPhone || null)
        .input("address", sql.NVarChar(255), cleanAddress || null)
        .query(`
          UPDATE Users
          SET
            name = @name,
            email = @email,
            phone = @phone,
            address = @address
          WHERE user_id = @userId
        `);

      console.log(`[SQL SERVER] Cập nhật thông tin (không đổi email) user_id=${userId}`);

      // Đồng bộ AWS Cognito
      let cognitoSyncStatus = "Not applicable";
      if (req.token && !req.token.startsWith("user-")) {
        try {
          const cognitoRes = await cognitoUpdateUserAttributes({
            accessToken: req.token,
            name: cleanName,
            phone: cleanPhone,
            address: cleanAddress,
          });
          cognitoSyncStatus = cognitoRes?.error
            ? `Cảnh báo: ${cognitoRes.error}`
            : "Đồng bộ AWS Cognito thành công";
        } catch (cognitoErr) {
          console.warn("[AWS COGNITO SYNC WARNING]:", cognitoErr.message);
          cognitoSyncStatus = `Lỗi: ${cognitoErr.message}`;
        }
      }

      // Đồng bộ AWS S3
      try {
        uploadUserToS3(userId).catch(console.error);
      } catch (s3Err) {
        console.warn("[S3 SYNC ERROR]:", s3Err.message);
      }

      return res.json({
        success: true,
        requireEmailOtp: false,
        message: "Cập nhật thông tin cá nhân thành công!",
        cognitoStatus: cognitoSyncStatus,
        user: {
          id: userId,
          user_id: userId,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          address: cleanAddress,
          role: req.user.role || "user",
        },
      });
    }

    // 3. NẾU CÓ ĐỔI EMAIL:
    // Cập nhật trước Họ tên, SĐT, Địa chỉ vào SQL Server (giữ nguyên email cũ)
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("name", sql.NVarChar(100), cleanName)
      .input("phone", sql.NVarChar(15), cleanPhone || null)
      .input("address", sql.NVarChar(255), cleanAddress || null)
      .query(`
        UPDATE Users
        SET
          name = @name,
          phone = @phone,
          address = @address
        WHERE user_id = @userId
      `);

    const isCognitoUser = Boolean(req.token && !req.token.startsWith("user-"));

    // 1. Luôn tạo mã OTP 6 số bảo mật
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Luôn gửi mã OTP trực tiếp qua VinSport Mail Server (Gmail SMTP chính chủ)
    // Đảm bảo 100% người dùng nhận được mã tức thì, kể cả email trường học/cơ quan (@stu.ptit.edu.vn)
    try {
      await sendOtpEmail({
        toEmail: cleanEmail,
        otpCode,
        userName: cleanName,
        purpose: "thay đổi địa chỉ email",
      });
      console.log(`[VinSport OTP] Đã gửi mã OTP đến ${cleanEmail} qua Gmail SMTP`);
    } catch (mailErr) {
      console.warn("[VinSport OTP WARNING] Gửi mail qua Gmail thất bại:", mailErr.message);
    }

    // 3. Nếu là tài khoản Cognito, đồng thời kích hoạt cập nhật trên AWS Cognito
    if (isCognitoUser) {
      try {
        await cognitoUpdateUserAttributes({
          accessToken: req.token,
          email: cleanEmail,
          name: cleanName,
          phone: cleanPhone,
        });
        console.log(
          `[AWS COGNITO] Đã kích hoạt đổi email cho user_id=${userId}. AWS Cognito: ${cleanEmail}`
        );
      } catch (cogErr) {
        console.warn("[AWS COGNITO UPDATE EMAIL WARNING]:", cogErr.message);
      }
    }

    // Lưu vào bộ nhớ chờ xác nhận trong 10 phút
    pendingEmailChanges.set(userId, {
      pendingEmail: cleanEmail,
      otpCode,
      isCognito: isCognitoUser,
      name: cleanName,
      phone: cleanPhone,
      address: cleanAddress,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    console.log(
      `[EMAIL CHANGE] Khởi tạo yêu cầu đổi email cho user_id=${userId}: ${currentEmail} -> ${cleanEmail} (Cognito: ${isCognitoUser})`
    );

    return res.json({
      success: true,
      requireEmailOtp: true,
      pendingEmail: cleanEmail,
      message: `Mã OTP xác nhận gồm 6 chữ số đã được gửi đến email mới (${cleanEmail}). Vui lòng nhập mã để hoàn tất đổi email!`,
      user: {
        id: userId,
        user_id: userId,
        name: cleanName,
        email: currentEmail, // Email trong database chưa đổi cho đến khi xác minh OTP
        phone: cleanPhone,
        address: cleanAddress,
        role: req.user.role || "user",
      },
    });
  } catch (error) {
    console.error("PUT /api/auth/profile error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không thể cập nhật thông tin người dùng",
    });
  }
});

// POST /api/auth/profile/verify-email-otp
// Xác thực mã OTP và chính thức cập nhật email trong SQL Server + AWS Cognito + AWS S3
router.post("/auth/profile/verify-email-otp", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { otp, pendingEmail } = req.body || {};

    const cleanOtp = String(otp || "").trim();
    const cleanPendingEmail = String(pendingEmail || "").trim().toLowerCase();

    if (!cleanOtp) {
      return res.status(400).json({ message: "Vui lòng nhập mã OTP gồm 6 chữ số." });
    }

    const pending = pendingEmailChanges.get(userId);

    if (!pending || pending.pendingEmail !== cleanPendingEmail) {
      return res.status(400).json({
        message: "Không tìm thấy yêu cầu đổi email đang chờ hoặc phiên xác thực đã kết thúc.",
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingEmailChanges.delete(userId);
      return res.status(400).json({
        message: "Mã OTP đã hết hạn (quá 10 phút). Vui lòng gửi lại mã mới.",
      });
    }

    // Kiểm tra tính hợp lệ của mã OTP
    let isOtpValid = false;
    let cognitoStatus = "Not applicable";

    // Cách 1: Khớp mã OTP do VinSport gửi qua Email
    if (pending.otpCode && cleanOtp === pending.otpCode) {
      isOtpValid = true;
      console.log(`[OTP VERIFIED] Khớp mã OTP VinSport gửi qua hòm thư: ${cleanPendingEmail}`);

      // Nếu là tài khoản Cognito, đồng thời kích hoạt xác nhận thuộc tính trên Cognito
      if (pending.isCognito && req.token && !req.token.startsWith("user-")) {
        try {
          await cognitoVerifyUserAttribute({
            accessToken: req.token,
            code: cleanOtp,
            attributeName: "email",
          });
          cognitoStatus = "Đã xác thực và cập nhật email trên AWS Cognito (Email verified: Yes)";
          console.log(`[AWS COGNITO] Xác thực email thành công! Email verified: Yes`);
        } catch (cognitoErr) {
          console.warn("[AWS COGNITO VERIFY ATTRIBUTE]:", cognitoErr.message);
          cognitoStatus = "Đã xác thực chính chủ qua email VinSport";
        }
      }
    } else if (pending.isCognito && req.token && !req.token.startsWith("user-")) {
      // Cách 2: Dự phòng nếu người dùng nhập mã riêng do AWS Cognito gửi
      try {
        await cognitoVerifyUserAttribute({
          accessToken: req.token,
          code: cleanOtp,
          attributeName: "email",
        });
        isOtpValid = true;
        cognitoStatus = "Đã xác thực và cập nhật email trên AWS Cognito (Email verified: Yes)";
        console.log(`[AWS COGNITO] Xác thực email thành công qua mã Cognito!`);
      } catch (cognitoErr) {
        console.warn("[AWS COGNITO VERIFY ATTRIBUTE FAILED]:", cognitoErr.message);
      }
    }

    if (!isOtpValid) {
      return res.status(400).json({
        message: "Mã OTP không chính xác hoặc đã hết hạn. Vui lòng kiểm tra lại hộp thư email.",
      });
    }

    // Mã hợp lệ -> Cập nhật email chính thức vào CSDL SQL Server
    const pool = await poolPromise;
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("email", sql.NVarChar(100), cleanPendingEmail)
      .query(`
        UPDATE Users
        SET email = @email
        WHERE user_id = @userId
      `);

    console.log(
      `[SQL SERVER] Đã xác nhận OTP và cập nhật email chính thức cho user_id=${userId} -> ${cleanPendingEmail}`
    );

    // Xóa yêu cầu đang chờ
    pendingEmailChanges.delete(userId);

    // Đồng bộ sao lưu lên AWS S3 Data Lakehouse
    try {
      uploadUserToS3(userId).catch(console.error);
    } catch (e) {
      console.warn("S3 sync error:", e);
    }

    // Lấy thông tin người dùng hoàn chỉnh sau khi cập nhật
    const userResult = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 1 user_id, [name], [email], [phone], [address], [role]
        FROM Users
        WHERE user_id = @userId
      `);

    const updatedUser = userResult.recordset[0];

    return res.json({
      success: true,
      message: "Xác thực email thành công! Địa chỉ email của bạn đã được cập nhật.",
      cognitoStatus,
      user: {
        id: updatedUser.user_id,
        user_id: updatedUser.user_id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone || "",
        address: updatedUser.address || "",
        role: updatedUser.role || "user",
      },
    });
  } catch (error) {
    console.error("POST /auth/profile/verify-email-otp error:", error);
    return res.status(500).json({
      message: error?.message || "Lỗi máy chủ khi xác thực OTP",
    });
  }
});

// POST /api/auth/profile/resend-email-otp
// Gửi lại mã OTP tới email mới
router.post("/auth/profile/resend-email-otp", verifyToken, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pending = pendingEmailChanges.get(userId);

    if (!pending) {
      return res.status(400).json({
        message: "Không có yêu cầu đổi email nào đang chờ xác nhận.",
      });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    pending.otpCode = newOtp;
    pending.expiresAt = Date.now() + 10 * 60 * 1000;

    // 1. Luôn gửi lại mã OTP qua VinSport Mail Server (Gmail SMTP)
    try {
      await sendOtpEmail({
        toEmail: pending.pendingEmail,
        otpCode: newOtp,
        userName: pending.name || req.user.name,
        purpose: "thay đổi địa chỉ email",
      });
      console.log(`[VinSport OTP RESEND] Đã gửi mã mới ${newOtp} đến ${pending.pendingEmail}`);
    } catch (mailErr) {
      console.warn("[VinSport OTP RESEND WARNING]:", mailErr.message);
    }

    // 2. Gửi lại mã qua Cognito song song nếu là tài khoản Cognito
    if (pending.isCognito && req.token && !req.token.startsWith("user-")) {
      try {
        await cognitoGetUserAttributeVerificationCode({
          accessToken: req.token,
          attributeName: "email",
        });
      } catch (e) {
        console.warn("Cognito resend code warning:", e.message);
      }
    }

    return res.json({
      success: true,
      message: `Mã OTP mới đã được gửi lại vào hòm thư: ${pending.pendingEmail}`,
    });
  } catch (error) {
    console.error("POST /auth/profile/resend-email-otp error:", error);
    return res.status(500).json({
      message: error?.message || "Không thể gửi lại mã OTP",
    });
  }
});

module.exports = router;
