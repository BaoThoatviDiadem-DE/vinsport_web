const { sql, poolPromise } = require("../db");
const { uploadUserToS3 } = require("../utils/s3Service");
const { recordHistory } = require("../utils/historyService");
const { isValidVietnamesePhone } = require("../utils/phoneValidator");

const getAdminUsers = async (req, res) => {
  try {
    const emailKeyword = String(req.query.email || "").trim();
    const pool = await poolPromise;

    const request = pool.request();
    let query = `
      SELECT
        user_id,
        name,
        email,
        phone,
        address,
        role,
        created_at
      FROM Users
    `;

    if (emailKeyword) {
      request.input("emailKeyword", sql.NVarChar(100), `%${emailKeyword}%`);
      query += ` WHERE email LIKE @emailKeyword `;
    }

    query += ` ORDER BY user_id DESC `;

    const result = await request.query(query);

    const users = result.recordset.map((row) => ({
      id: row.user_id,
      user_id: row.user_id,
      name: row.name || "",
      email: row.email || "",
      phone: row.phone || "",
      address: row.address || "",
      role: row.role || "user",
      createdAt: row.created_at,
    }));

    return res.json(users);
  } catch (error) {
    console.error("GET /api/admin/users error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không thể tải danh sách người dùng",
    });
  }
};

const updateAdminUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const {
      name = "",
      email = "",
      phone = "",
      address = "",
      role = "user",
    } = req.body || {};

    if (!userId) {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }

    if (!String(name).trim()) {
      return res.status(400).json({ message: "Tên người dùng không được để trống" });
    }

    if (!String(email).trim()) {
      return res.status(400).json({ message: "Email không được để trống" });
    }

    if (!["admin", "user"].includes(String(role))) {
      return res.status(400).json({ message: "Role không hợp lệ" });
    }

    if (String(phone).trim() && !isValidVietnamesePhone(phone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số di động của nhà mạng Việt Nam (03x, 05x, 07x, 08x, 09x).",
      });
    }

    const pool = await poolPromise;

    const existedUser = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP 1 *
        FROM Users
        WHERE user_id = @userId
      `);

    if (existedUser.recordset.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    const oldUser = existedUser.recordset[0];

    const existedEmail = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("email", sql.NVarChar(100), String(email).trim())
      .query(`
        SELECT TOP 1 user_id
        FROM Users
        WHERE email = @email AND user_id <> @userId
      `);

    if (existedEmail.recordset.length > 0) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("name", sql.NVarChar(100), String(name).trim())
      .input("email", sql.NVarChar(100), String(email).trim())
      .input("phone", sql.NVarChar(15), String(phone).trim() || null)
      .input("address", sql.NVarChar(255), String(address).trim() || null)
      .input("role", sql.NVarChar(20), String(role))
      .query(`
        UPDATE Users
        SET
          name = @name,
          email = @email,
          phone = @phone,
          address = @address,
          role = @role
        WHERE user_id = @userId
      `);

    const changes = [];
    if (oldUser.name !== String(name).trim()) changes.push(`Tên: "${oldUser.name}" ➔ "${String(name).trim()}"`);
    if (oldUser.email !== String(email).trim()) changes.push(`Email: "${oldUser.email}" ➔ "${String(email).trim()}"`);
    if ((oldUser.phone || "") !== String(phone).trim()) changes.push(`SĐT: "${oldUser.phone || "Trống"}" ➔ "${String(phone).trim() || "Trống"}"`);
    if (oldUser.role !== String(role)) changes.push(`Quyền: "${oldUser.role}" ➔ "${String(role)}"`);

    const { password: _pwd, ...safeOldUser } = oldUser;

    await recordHistory({
      actionType: "UPDATE",
      entityType: "user",
      title: `Cập nhật người dùng: ${String(name).trim()}`,
      description: `Người dùng #${userId} (${String(name).trim()}) - Email: ${String(email).trim()}.${changes.length > 0 ? " Thay đổi: " + changes.join(", ") : ""}`,
      snapshotData: [{
        user_id: userId,
        previous: safeOldUser,
        updated: { name, email, phone, address, role },
        changes,
      }],
      itemCount: 1,
      createdBy: req.user?.name || req.user?.email || "Admin",
    });

    // Gửi lên S3
    uploadUserToS3(userId).catch(console.error);

    return res.json({
      message: "Cập nhật người dùng thành công",
      user: {
        id: userId,
        user_id: userId,
        name: String(name).trim(),
        email: String(email).trim(),
        phone: String(phone).trim(),
        address: String(address).trim(),
        role: String(role),
      },
    });
  } catch (error) {
    console.error("PUT /api/admin/users/:id error:", error);
    return res.status(500).json({
      message:
        error?.originalError?.info?.message ||
        error.message ||
        "Không thể cập nhật người dùng",
    });
  }
};

const deleteAdminUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "ID người dùng không hợp lệ" });
    }
    if (req.user && req.user.user_id === userId) {
      return res.status(400).json({ message: "Không thể tự xóa tài khoản đang đăng nhập" });
    }

    const pool = await poolPromise;

    // Lưu snapshot người dùng vào DataHistory trước khi xóa
    const userRes = await pool.request().input("uid", sql.Int, userId).query("SELECT * FROM Users WHERE user_id = @uid");
    if (userRes.recordset.length > 0) {
      const { password: _pwd, ...safeUser } = userRes.recordset[0];
      await recordHistory({
        actionType: "DELETE",
        entityType: "user",
        title: `Xóa người dùng "${safeUser.name || safeUser.email}"`,
        description: `Xóa người dùng ${safeUser.name} (${safeUser.email}, Mã: #${userId})`,
        snapshotData: [safeUser],
        itemCount: 1,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    await pool.request().input("uid", sql.Int, userId).query(`
      DELETE FROM CartItems WHERE cart_id IN (SELECT cart_id FROM Cart WHERE user_id = @uid);
      DELETE FROM Cart WHERE user_id = @uid;
      DELETE FROM Reviews WHERE user_id = @uid;
      DELETE FROM OrderDetails WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
      DELETE FROM Payments WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
      DELETE FROM Shipping WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
      DELETE FROM Orders WHERE user_id = @uid;
      DELETE FROM Users WHERE user_id = @uid;
    `);

    return res.json({ success: true, message: "Đã xóa người dùng thành công" });
  } catch (error) {
    console.error("DELETE ADMIN USER ERROR:", error);
    return res.status(500).json({ message: error.message || "Không thể xóa người dùng" });
  }
};

const deleteAdminUsersBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Danh sách người dùng cần xóa không hợp lệ" });
    }

    const pool = await poolPromise;
    const cleanIds = ids.map(Number).filter((id) => !isNaN(id) && id > 0);

    // Thu thập snapshot người dùng trước khi xóa
    const snapshots = [];
    const userNames = [];

    for (const uid of cleanIds) {
      if (req.user && req.user.user_id === uid) continue;
      const userRes = await pool.request().input("uid", sql.Int, uid).query("SELECT * FROM Users WHERE user_id = @uid");
      if (userRes.recordset.length > 0) {
        const { password: _pwd, ...safeU } = userRes.recordset[0];
        userNames.push(safeU.name || safeU.email || `#${uid}`);
        snapshots.push(safeU);
      }
    }

    if (snapshots.length > 0) {
      const namesPreview = userNames.slice(0, 4).join(", ") + (userNames.length > 4 ? `, +${userNames.length - 4} người dùng khác` : "");
      await recordHistory({
        actionType: "BATCH_DELETE",
        entityType: "user",
        title: `Xóa ${snapshots.length} người dùng`,
        description: `Xóa ${snapshots.length} người dùng: ${namesPreview}`,
        snapshotData: snapshots,
        itemCount: snapshots.length,
        createdBy: req.user?.name || req.user?.email || "Admin",
      });
    }

    for (const uid of cleanIds) {
      if (req.user && req.user.user_id === uid) continue;
      await pool.request().input("uid", sql.Int, uid).query(`
        DELETE FROM CartItems WHERE cart_id IN (SELECT cart_id FROM Cart WHERE user_id = @uid);
        DELETE FROM Cart WHERE user_id = @uid;
        DELETE FROM Reviews WHERE user_id = @uid;
        DELETE FROM OrderDetails WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
        DELETE FROM Payments WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
        DELETE FROM Shipping WHERE order_id IN (SELECT order_id FROM Orders WHERE user_id = @uid);
        DELETE FROM Orders WHERE user_id = @uid;
        DELETE FROM Users WHERE user_id = @uid;
      `);
    }

    return res.json({ success: true, message: `Đã xóa thành công ${cleanIds.length} người dùng!` });
  } catch (error) {
    console.error("BATCH DELETE ADMIN USERS ERROR:", error);
    return res.status(500).json({ message: error.message || "Không thể xóa danh sách người dùng" });
  }
};

module.exports = {
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  deleteAdminUsersBatch,
};