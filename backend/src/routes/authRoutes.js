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
} = require("../utils/cognitoService");

// Xác minh ID Token dùng cho bước liên kết tài khoản
const cognitoIdVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: process.env.COGNITO_CLIENT_ID,
});

/**
 * Hàm đồng bộ tài khoản Cognito với cơ sở dữ liệu SQL Server
 * Nếu email đã có sẵn (ví dụ admin vinsport@gmail.com) -> Giữ nguyên quyền admin và liên kết cognito_sub
 * Nếu chưa có -> Tự động tạo bản ghi mới
 */
async function syncUserWithSQLServer({ cognitoSub, email, name, phone }) {
  const pool = await poolPromise;
  const cleanEmail = String(email || "").trim().toLowerCase();

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

      await pool
        .request()
        .input("name", sql.NVarChar(100), displayName)
        .input("email", sql.NVarChar(100), cleanEmail)
        .input("password", sql.NVarChar(255), passwordPlaceholder)
        .input("phone", sql.NVarChar(15), userPhone)
        .input("cognito_sub", sql.NVarChar(100), cognitoSub)
        .input("role", sql.NVarChar(20), "user")
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
      console.log(`[SQL SERVER] Đã tạo tài khoản mới: ${cleanEmail}`);
    }
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

module.exports = router;
