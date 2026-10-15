const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../db");
const { uploadOrderToS3, uploadUserToS3 } = require("../utils/s3Service");
const { verifyToken } = require("../middlewares/authMiddleware");

function mapPaymentMethod(method) {
  const value = String(method || "").toLowerCase();

  if (value === "cod") return "COD";
  if (value === "banking") return "Bank";
  if (value === "momo") return "Momo";

  return "COD";
}

router.post("/orders", async (req, res) => {
  const { customer, items, totalAmount, paymentMethod, orderDate } = req.body || {};

  if (!customer || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      message: "Dữ liệu đơn hàng không hợp lệ",
    });
  }

  let transaction;

  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const email =
      customer.email && String(customer.email).trim()
        ? String(customer.email).trim()
        : `guest_${Date.now()}@vinsport.local`;

    const name = customer.name ? String(customer.name).trim() : "Khách hàng";
    const phone = customer.phone ? String(customer.phone).trim() : "";
    const address = customer.address ? String(customer.address).trim() : "";
    const payment = mapPaymentMethod(paymentMethod);

    const authHeader = req.headers.authorization || "";
    let authUserId = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const match = token.match(/^user-(\d+)-(admin|user)-token$/);
      if (match) {
        authUserId = Number(match[1]);
      }
    }

    let userId = authUserId;

    if (userId) {
      await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("name", sql.NVarChar, name)
        .input("phone", sql.NVarChar, phone)
        .input("address", sql.NVarChar, address)
        .query(`
          UPDATE Users
          SET
            name = CASE WHEN @name <> '' THEN @name ELSE name END,
            phone = CASE WHEN @phone <> '' THEN @phone ELSE phone END,
            address = CASE WHEN @address <> '' THEN @address ELSE address END
          WHERE user_id = @userId
        `);
    } else {
      const userCheck = await new sql.Request(transaction)
        .input("email", sql.NVarChar, email)
        .query(`
          SELECT TOP 1 user_id
          FROM Users
          WHERE email = @email
        `);

      if (userCheck.recordset.length > 0) {
        userId = userCheck.recordset[0].user_id;

        await new sql.Request(transaction)
          .input("userId", sql.Int, userId)
          .input("name", sql.NVarChar, name)
          .input("phone", sql.NVarChar, phone)
          .input("address", sql.NVarChar, address)
          .query(`
            UPDATE Users
            SET
              name = CASE WHEN @name <> '' THEN @name ELSE name END,
              phone = CASE WHEN @phone <> '' THEN @phone ELSE phone END,
              address = CASE WHEN @address <> '' THEN @address ELSE address END
            WHERE user_id = @userId
          `);
      } else {
        const insertUser = await new sql.Request(transaction)
          .input("name", sql.NVarChar, name)
          .input("email", sql.NVarChar, email)
          .input("password", sql.NVarChar, "123456")
          .input("phone", sql.NVarChar, phone)
          .input("address", sql.NVarChar, address)
          .query(`
            INSERT INTO Users (name, email, password, phone, address)
            OUTPUT INSERTED.user_id
            VALUES (@name, @email, @password, @phone, @address)
          `);

        userId = insertUser.recordset[0].user_id;
      }
    }

    // 2. Tạo order
    const orderInsert = await new sql.Request(transaction)
      .input("userId", sql.Int, userId)
      .input("orderDate", sql.DateTime, orderDate ? new Date(orderDate) : new Date())
      .input("status", sql.NVarChar, "Pending")
      .input("totalAmount", sql.Decimal(12, 2), Number(totalAmount) || 0)
      .query(`
        INSERT INTO Orders (user_id, order_date, status, total_amount)
        OUTPUT INSERTED.order_id, INSERTED.order_date, INSERTED.status, INSERTED.total_amount
        VALUES (@userId, @orderDate, @status, @totalAmount)
      `);

    const createdOrder = orderInsert.recordset[0];
    const orderId = createdOrder.order_id;

    // 3. Insert payment
    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .input("method", sql.NVarChar, payment)
      .input("status", sql.NVarChar, "Pending")
      .query(`
        INSERT INTO Payments (order_id, method, status)
        VALUES (@orderId, @method, @status)
      `);

    // 4. Insert shipping
    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .input("address", sql.NVarChar, address)
      .input("status", sql.NVarChar, "Pending")
      .query(`
        INSERT INTO Shipping (order_id, address, status)
        VALUES (@orderId, @address, @status)
      `);

    // 5. Insert order details + trừ stock
    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const sizeName = item.size ? String(item.size).trim() : "";
      const colorName = item.color ? String(item.color).trim() : "";
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;

      if (!productId || quantity <= 0 || price <= 0) {
        throw new Error("Thông tin sản phẩm trong đơn hàng không hợp lệ");
      }

      let variantResult;

      if (sizeName && colorName) {
        variantResult = await new sql.Request(transaction)
          .input("productId", sql.Int, productId)
          .input("sizeName", sql.NVarChar, sizeName)
          .input("colorName", sql.NVarChar, colorName)
          .query(`
            SELECT TOP 1 pv.variant_id, pv.stock, pv.price
            FROM ProductVariants pv
            INNER JOIN Sizes s ON pv.size_id = s.size_id
            INNER JOIN Colors c ON pv.color_id = c.color_id
            WHERE pv.product_id = @productId
              AND s.name = @sizeName
              AND c.name = @colorName
          `);
      } else {
        variantResult = await new sql.Request(transaction)
          .input("productId", sql.Int, productId)
          .query(`
            SELECT TOP 1 pv.variant_id, pv.stock, pv.price
            FROM ProductVariants pv
            WHERE pv.product_id = @productId
            ORDER BY pv.variant_id
          `);
      }

      if (variantResult.recordset.length === 0) {
        throw new Error(`Không tìm thấy biến thể cho sản phẩm ID ${productId}`);
      }

      const variant = variantResult.recordset[0];

      if (Number(variant.stock) < quantity) {
        throw new Error(`Sản phẩm ID ${productId} không đủ số lượng tồn kho`);
      }

      await new sql.Request(transaction)
        .input("orderId", sql.Int, orderId)
        .input("variantId", sql.Int, variant.variant_id)
        .input("quantity", sql.Int, quantity)
        .input("price", sql.Decimal(10, 2), price)
        .query(`
          INSERT INTO OrderDetails (order_id, variant_id, quantity, price)
          VALUES (@orderId, @variantId, @quantity, @price)
        `);

      await new sql.Request(transaction)
        .input("variantId", sql.Int, variant.variant_id)
        .input("quantity", sql.Int, quantity)
        .query(`
          UPDATE ProductVariants
          SET stock = stock - @quantity
          WHERE variant_id = @variantId
        `);
    }

    await transaction.commit();

    // Sau khi insert vào CSDL thành công, gọi hàm backup sang Amazon S3
    // Hàm này chạy ngầm (không await) để không làm chậm response trả về cho user
    uploadOrderToS3(orderId);
    uploadUserToS3(userId); // Backup luôn thông tin khách hàng nếu họ có đổi thông tin

    return res.status(201).json({
      message: "Tạo đơn hàng thành công",
      id: String(orderId),
      orderId: String(orderId),
      order: {
        id: String(orderId),
        customer,
        items,
        totalAmount: Number(totalAmount) || 0,
        paymentMethod,
        orderDate: createdOrder.order_date,
        status: createdOrder.status,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }

    console.error("POST /api/orders error:", error);
    return res.status(500).json({
      message: error.message || "Không thể tạo đơn hàng",
    });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        o.order_id,
        o.order_date,
        o.status,
        o.total_amount,
        u.name AS customer_name,
        u.email AS customer_email,
        u.phone AS customer_phone
      FROM Orders o
      INNER JOIN Users u ON o.user_id = u.user_id
      ORDER BY o.order_id DESC
    `);

    return res.json(
      result.recordset.map((row) => ({
        id: String(row.order_id),
        orderDate: row.order_date,
        status: row.status,
        totalAmount: Number(row.total_amount) || 0,
        customer: {
          name: row.customer_name || "",
          email: row.customer_email || "",
          phone: row.customer_phone || "",
        },
      }))
    );
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return res.status(500).json({
      message: "Không thể lấy danh sách đơn hàng",
    });
  }
});

// 1. LẤY DANH SÁCH ĐƠN HÀNG CỦA TÀI KHOẢN ĐANG ĐĂNG NHẬP (MY ORDERS)
router.get("/orders/my-orders", verifyToken, async (req, res) => {
  try {
    const pool = await poolPromise;
    const userId = req.user.user_id;

    const ordersResult = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT
          o.order_id,
          o.order_date,
          o.status AS order_status,
          o.total_amount,
          ISNULL(ship.address, u.address) AS shipping_address,
          ISNULL(ship.status, 'Pending') AS shipping_status,
          ISNULL(pay.method, 'COD') AS payment_method,
          ISNULL(pay.status, 'Pending') AS payment_status
        FROM Orders o
        INNER JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
          SELECT TOP 1 address, status
          FROM Shipping
          WHERE order_id = o.order_id
          ORDER BY shipping_id DESC
        ) ship
        OUTER APPLY (
          SELECT TOP 1 method, status
          FROM Payments
          WHERE order_id = o.order_id
          ORDER BY payment_id DESC
        ) pay
        WHERE o.user_id = @userId
        ORDER BY o.order_date DESC
      `);

    const orders = ordersResult.recordset;

    if (orders.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const orderIds = orders.map((o) => o.order_id);
    const itemsResult = await pool.request().query(`
      SELECT
        od.order_id,
        od.order_detail_id,
        od.quantity,
        od.price,
        p.product_id,
        p.name AS product_name,
        ISNULL(b.name, N'Khác') AS brand_name,
        ISNULL(s.name, N'-') AS size_name,
        ISNULL(c.name, N'-') AS color_name,
        c.hex_code,
        ISNULL(img.image_url, '') AS image_url
      FROM OrderDetails od
      INNER JOIN ProductVariants pv ON od.variant_id = pv.variant_id
      INNER JOIN Products p ON pv.product_id = p.product_id
      LEFT JOIN Brands b ON p.brand_id = b.brand_id
      LEFT JOIN Sizes s ON pv.size_id = s.size_id
      LEFT JOIN Colors c ON pv.color_id = c.color_id
      OUTER APPLY (
        SELECT TOP 1 image_url
        FROM ProductImages
        WHERE product_id = p.product_id
        ORDER BY image_id ASC
      ) img
      WHERE od.order_id IN (${orderIds.join(",")})
    `);

    const itemsByOrder = {};
    itemsResult.recordset.forEach((item) => {
      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }
      itemsByOrder[item.order_id].push({
        id: item.order_detail_id,
        productId: item.product_id,
        name: item.product_name,
        brand: item.brand_name,
        size: item.size_name,
        color: item.color_name,
        hexCode: item.hex_code,
        imageUrl: item.image_url,
        quantity: item.quantity,
        price: Number(item.price),
        subtotal: Number(item.price) * Number(item.quantity),
      });
    });

    const fullOrders = orders.map((o) => ({
      orderId: o.order_id,
      orderDate: o.order_date,
      orderStatus: o.order_status,
      totalAmount: Number(o.total_amount),
      shippingAddress: o.shipping_address,
      shippingStatus: o.shipping_status,
      paymentMethod: o.payment_method,
      paymentStatus: o.payment_status,
      items: itemsByOrder[o.order_id] || [],
    }));

    return res.json({ success: true, data: fullOrders });
  } catch (error) {
    console.error("GET /api/orders/my-orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách đơn hàng của bạn",
    });
  }
});

// 2. TRA CỨU CHI TIẾT ĐƠN HÀNG THEO MÃ (CÔNG KHAI HOẶC USER)
router.get("/orders/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    const orderId = parseInt(String(rawId).replace(/\D/g, ""), 10);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    const pool = await poolPromise;

    const orderResult = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT
          o.order_id,
          o.order_date,
          o.status AS order_status,
          o.total_amount,
          u.user_id,
          u.name AS customer_name,
          u.phone AS customer_phone,
          u.email AS customer_email,
          ISNULL(ship.address, u.address) AS shipping_address,
          ISNULL(ship.status, 'Pending') AS shipping_status,
          ISNULL(pay.method, 'COD') AS payment_method,
          ISNULL(pay.status, 'Pending') AS payment_status
        FROM Orders o
        INNER JOIN Users u ON o.user_id = u.user_id
        OUTER APPLY (
          SELECT TOP 1 address, status
          FROM Shipping
          WHERE order_id = o.order_id
          ORDER BY shipping_id DESC
        ) ship
        OUTER APPLY (
          SELECT TOP 1 method, status
          FROM Payments
          WHERE order_id = o.order_id
          ORDER BY payment_id DESC
        ) pay
        WHERE o.order_id = @orderId
      `);

    if (orderResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy đơn hàng #${orderId} trong hệ thống`,
      });
    }

    const order = orderResult.recordset[0];

    const itemsResult = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT
          od.order_detail_id,
          od.quantity,
          od.price,
          p.product_id,
          p.name AS product_name,
          ISNULL(b.name, N'Khác') AS brand_name,
          ISNULL(s.name, N'-') AS size_name,
          ISNULL(c.name, N'-') AS color_name,
          c.hex_code,
          ISNULL(img.image_url, '') AS image_url
        FROM OrderDetails od
        INNER JOIN ProductVariants pv ON od.variant_id = pv.variant_id
        INNER JOIN Products p ON pv.product_id = p.product_id
        LEFT JOIN Brands b ON p.brand_id = b.brand_id
        LEFT JOIN Sizes s ON pv.size_id = s.size_id
        LEFT JOIN Colors c ON pv.color_id = c.color_id
        OUTER APPLY (
          SELECT TOP 1 image_url
          FROM ProductImages
          WHERE product_id = p.product_id
          ORDER BY image_id ASC
        ) img
        WHERE od.order_id = @orderId
      `);

    const items = itemsResult.recordset.map((item) => ({
      id: item.order_detail_id,
      productId: item.product_id,
      name: item.product_name,
      brand: item.brand_name,
      size: item.size_name,
      color: item.color_name,
      hexCode: item.hex_code,
      imageUrl: item.image_url,
      quantity: item.quantity,
      price: Number(item.price),
      subtotal: Number(item.price) * Number(item.quantity),
    }));

    return res.json({
      success: true,
      data: {
        orderId: order.order_id,
        orderDate: order.order_date,
        orderStatus: order.order_status,
        totalAmount: Number(order.total_amount),
        customer: {
          id: order.user_id,
          name: order.customer_name,
          phone: order.customer_phone,
          email: order.customer_email,
        },
        shippingAddress: order.shipping_address,
        shippingStatus: order.shipping_status,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        items,
      },
    });
  } catch (error) {
    console.error("GET /api/orders/:id error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi tra cứu thông tin đơn hàng",
    });
  }
});

// 3. HỦY ĐƠN HÀNG (DÀNH CHO NGƯỜI DÙNG KHI ĐƠN CÒN PENDING)
router.put("/orders/:id/cancel", verifyToken, async (req, res) => {
  let transaction;
  try {
    const rawId = req.params.id;
    const orderId = parseInt(String(rawId).replace(/\D/g, ""), 10);
    const userId = req.user.user_id;
    const role = req.user.role;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    const pool = await poolPromise;

    const checkResult = await pool.request()
      .input("orderId", sql.Int, orderId)
      .query(`
        SELECT order_id, user_id, status
        FROM Orders
        WHERE order_id = @orderId
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng",
      });
    }

    const currentOrder = checkResult.recordset[0];

    if (role !== "admin" && currentOrder.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền hủy đơn hàng này",
      });
    }

    const currentStatus = String(currentOrder.status || "").toLowerCase();
    if (["shipping", "completed", "cancelled"].includes(currentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Đơn hàng đang ở trạng thái '${currentOrder.status}', không thể hủy!`,
      });
    }

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // 1. Cập nhật trạng thái đơn
    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .query(`
        UPDATE Orders
        SET status = 'Cancelled'
        WHERE order_id = @orderId
      `);

    // 2. Cập nhật shipping
    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .query(`
        UPDATE Shipping
        SET status = 'Cancelled'
        WHERE order_id = @orderId
      `);

    // 3. Hoàn tồn kho
    await new sql.Request(transaction)
      .input("orderId", sql.Int, orderId)
      .query(`
        UPDATE pv
        SET pv.stock = pv.stock + od.quantity
        FROM ProductVariants pv
        INNER JOIN OrderDetails od ON pv.variant_id = od.variant_id
        WHERE od.order_id = @orderId
      `);

    await transaction.commit();

    // Đồng bộ sang Amazon S3 Data Lakehouse
    uploadOrderToS3(orderId);

    return res.json({
      success: true,
      message: `Đã hủy thành công đơn hàng #${orderId}. Số lượng tồn kho đã được hoàn trả.`,
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (_) {}
    }
    console.error("PUT /api/orders/:id/cancel error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể hủy đơn hàng",
      error: error.message,
    });
  }
});

module.exports = router;