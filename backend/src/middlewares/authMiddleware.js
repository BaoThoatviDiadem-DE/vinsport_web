
const { CognitoJwtVerifier } = require("aws-jwt-verify");
const { poolPromise, sql } = require("../db");

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

// Xác minh Access Token được cấp bởi Cognito
const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.COGNITO_CLIENT_ID,
});

// Xác thực người dùng
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Thiếu Access Token",
      });
    }

    req.token = token;

    // Thử xác minh chữ ký, User Pool, Client ID và thời hạn token Cognito
    let cognitoSub = null;
    try {
      const payload = await verifier.verify(token);
      cognitoSub = payload.sub;
    } catch (cognitoError) {
      // Fallback: hỗ trợ token đăng nhập nội bộ (legacy dev token) dạng user-<id>-<role>-token
      const match = token.match(/^user-(\d+)-(admin|user)-token$/);
      if (match) {
        const userId = parseInt(match[1]);
        const pool = await poolPromise;
        const result = await pool
          .request()
          .input("userId", sql.Int, userId)
          .query(`
            SELECT
              user_id,
              [name],
              [email],
              [phone],
              [address],
              [role],
              [cognito_sub]
            FROM Users
            WHERE user_id = @userId
          `);

        if (result.recordset.length === 0) {
          return res.status(401).json({ message: "Không tìm thấy người dùng" });
        }

        const user = result.recordset[0];

        if (user && isWhitelistedAdmin(user.email) && user.role !== "admin") {
          user.role = "admin";
          pool.request()
            .input("uid", sql.Int, user.user_id)
            .query("UPDATE Users SET role = 'admin' WHERE user_id = @uid")
            .catch(() => {});
        }

        req.user = {
          user_id: user.user_id,
          id: user.user_id,
          name: user.name,
          email: user.email,
          phone: user.phone || "",
          address: user.address || "",
          role: user.role,
          cognito_sub: user.cognito_sub,
        };

        return next();
      }

      console.error("Cognito authentication error:", cognitoError.message);
      return res.status(401).json({
        message: "Access Token không hợp lệ hoặc đã hết hạn",
      });
    }

    // sub là mã định danh duy nhất của tài khoản Cognito
    if (!cognitoSub) {
      return res.status(401).json({
        message: "Token không có mã định danh người dùng",
      });
    }

    // Tìm tài khoản đã được liên kết trong SQL Server
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("cognito_sub", sql.NVarChar(100), cognitoSub)
      .query(`
        SELECT
          user_id,
          [name],
          [email],
          [phone],
          [address],
          [role],
          [cognito_sub]
        FROM Users
        WHERE cognito_sub = @cognito_sub
      `);

    if (result.recordset.length === 0) {
      return res.status(403).json({
        message: "Tài khoản Cognito chưa được liên kết với VinSport",
        code: "ACCOUNT_NOT_LINKED",
      });
    }

    const user = result.recordset[0];

    if (user && isWhitelistedAdmin(user.email) && user.role !== "admin") {
      user.role = "admin";
      pool.request()
        .input("uid", sql.Int, user.user_id)
        .query("UPDATE Users SET role = 'admin' WHERE user_id = @uid")
        .catch(() => {});
    }

    // Quyền luôn lấy từ SQL Server, không lấy từ Cognito hoặc Frontend
    req.user = {
      user_id: user.user_id,
      id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
      role: user.role,
      cognito_sub: user.cognito_sub,
    };

    next();
  } catch (error) {
    console.error("Cognito authentication error:", error.message);

    return res.status(401).json({
      message: "Access Token không hợp lệ hoặc đã hết hạn",
    });
  }
};

// Kiểm tra quyền admin từ SQL Server
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Bạn không có quyền admin",
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireAdmin,
};
