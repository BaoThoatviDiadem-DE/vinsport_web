const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql, poolPromise } = require("../db");
const { uploadUserToS3 } = require("../utils/s3Service");

const login = async (req, res) => {
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
        SELECT user_id, name, email, password, phone, address, role
        FROM Users
        WHERE email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        message: "Tài khoản hoặc mật khẩu không chính xác",
      });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(String(password), String(user.password));

    if (!isMatch) {
      return res.status(401).json({
        message: "Tài khoản hoặc mật khẩu không chính xác",
      });
    }

    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Đăng nhập thành công",
      token,
      user: {
        user_id: user.user_id,
        id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        address: user.address || "",
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      message: error?.originalError?.info?.message || error.message || "Lỗi đăng nhập",
    });
  }
};

const register = async (req, res) => {
  try {
    const { name, email, password, phone = "", address = "" } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Thiếu thông tin đăng ký",
      });
    }

    const pool = await poolPromise;

    const existed = await pool
      .request()
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`
        SELECT user_id
        FROM Users
        WHERE email = @email
      `);

    if (existed.recordset.length > 0) {
      return res.status(400).json({
        message: "Email đã tồn tại",
      });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    await pool
      .request()
      .input("name", sql.NVarChar(100), String(name).trim())
      .input("email", sql.NVarChar(100), String(email).trim())
      .input("password", sql.NVarChar(255), hashedPassword)
      .input("phone", sql.NVarChar(15), String(phone).trim() || null)
      .input("address", sql.NVarChar(255), String(address).trim() || null)
      .input("role", sql.NVarChar(20), "user")
      .query(`
        INSERT INTO Users (name, email, password, phone, address, role)
        VALUES (@name, @email, @password, @phone, @address, @role)
      `);

    const userResult = await pool
      .request()
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`
        SELECT TOP 1 user_id, name, email, phone, address, role
        FROM Users
        WHERE email = @email
        ORDER BY user_id DESC
      `);

    const newUser = userResult.recordset[0];

    // Gửi lên S3 (bất đồng bộ, không block luồng)
    uploadUserToS3(newUser.user_id).catch(console.error);

    const token = jwt.sign(
      {
        user_id: newUser.user_id,
        email: newUser.email,
        role: newUser.role,
      },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "Đăng ký thành công",
      token,
      user: {
        user_id: newUser.user_id,
        id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone || "",
        address: newUser.address || "",
        role: newUser.role || "user",
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      message: error?.originalError?.info?.message || error.message || "Lỗi đăng ký tài khoản",
    });
  }
};

module.exports = { login, register };