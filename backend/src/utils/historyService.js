const {
  getDocClient,
  TABLE_DATA_HISTORY,
  ensureAllDynamoTables,
  saveVoucher,
} = require("./dynamoService");
const {
  PutCommand,
  GetCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { sql, poolPromise } = require("../db");

/**
 * Đảm bảo bảng VinSport_DataHistory tồn tại trên Amazon DynamoDB
 */
async function ensureHistoryTable() {
  try {
    await ensureAllDynamoTables();
  } catch (err) {
    console.error("[DataHistory] Lỗi khởi tạo bảng DynamoDB:", err.message);
  }
}

/**
 * Ghi lại sự kiện thay đổi dữ liệu (Snapshot) vào AWS DynamoDB
 */
async function recordHistory({
  actionType = "DELETE",
  entityType = "product",
  title,
  description,
  snapshotData,
  itemCount = 1,
  createdBy = "Admin",
}) {
  try {
    const docClient = getDocClient();
    if (!docClient) {
      console.warn("[DataHistory] Bỏ qua ghi nhật ký vì DynamoDB client chưa sẵn sàng.");
      return false;
    }

    const cleanTitle = String(title || `${actionType} ${entityType}`).trim();
    const cleanDesc = String(description || cleanTitle).trim();
    const count = Number(itemCount) || 1;

    let cleanSnapshot = null;
    try {
      if (typeof snapshotData === "string") {
        cleanSnapshot = JSON.parse(snapshotData);
      } else {
        cleanSnapshot = JSON.parse(JSON.stringify(snapshotData));
      }
    } catch (_) {
      cleanSnapshot = snapshotData;
    }

    // Tạo ID định danh duy nhất dựa trên timestamp
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const item = {
      id,
      action_type: String(actionType || "DELETE"),
      entity_type: String(entityType || "product"),
      title: cleanTitle,
      description: cleanDesc,
      snapshot_data: cleanSnapshot,
      item_count: count,
      is_restored: false,
      restored_at: null,
      created_at: new Date().toISOString(),
      created_by: String(createdBy || "Admin"),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_DATA_HISTORY,
        Item: item,
      })
    );

    console.log(`[DataHistory DynamoDB] Đã lưu snapshot thành công: "${cleanTitle}" (ID: ${id})`);
    return true;
  } catch (err) {
    console.error("[DataHistory DynamoDB] Lỗi ghi lịch sử dữ liệu:", err.message);
    return false;
  }
}

/**
 * Lấy danh sách lịch sử dữ liệu từ AWS DynamoDB với bộ lọc, tìm kiếm và phân trang
 */
async function getHistoryList({
  search = "",
  entityType = "all",
  status = "all", // 'all', 'pending', 'restored'
  page = 1,
  limit = 20,
}) {
  const docClient = getDocClient();
  if (!docClient) {
    return {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      stats: { total: 0, pending: 0, restored: 0, byEntity: { product: 0, user: 0, order: 0, voucher: 0 } },
    };
  }

  // Quét toàn bộ bảng VinSport_DataHistory từ DynamoDB
  let rawItems = [];
  let lastEvaluatedKey = undefined;

  do {
    const scanRes = await docClient.send(
      new ScanCommand({
        TableName: TABLE_DATA_HISTORY,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (Array.isArray(scanRes.Items)) {
      rawItems.push(...scanRes.Items);
    }
    lastEvaluatedKey = scanRes.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Sắp xếp thời gian giảm dần (mới nhất lên đầu)
  rawItems.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  // Thống kê toàn cục
  const stats = {
    total: rawItems.length,
    pending: rawItems.filter((x) => !x.is_restored).length,
    restored: rawItems.filter((x) => Boolean(x.is_restored)).length,
    byEntity: {
      product: rawItems.filter((x) => x.entity_type === "product").length,
      user: rawItems.filter((x) => x.entity_type === "user").length,
      order: rawItems.filter((x) => x.entity_type === "order").length,
      voucher: rawItems.filter((x) => x.entity_type === "voucher").length,
    },
  };

  // Áp dụng bộ lọc
  let filtered = rawItems;

  if (entityType && entityType !== "all") {
    filtered = filtered.filter((x) => String(x.entity_type || "").toLowerCase() === entityType.toLowerCase());
  }

  if (status === "pending") {
    filtered = filtered.filter((x) => !x.is_restored);
  } else if (status === "restored") {
    filtered = filtered.filter((x) => Boolean(x.is_restored));
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter((x) =>
      String(x.title || "").toLowerCase().includes(q) ||
      String(x.description || "").toLowerCase().includes(q) ||
      String(x.id || "").toLowerCase().includes(q)
    );
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
  const total = filtered.length;
  const offset = (pageNum - 1) * limitNum;
  const paginatedItems = filtered.slice(offset, offset + limitNum).map((item) => ({
    ...item,
    is_restored: Boolean(item.is_restored),
  }));

  return {
    items: paginatedItems,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
    stats,
  };
}

/**
 * Khôi phục bản ghi từ snapshot trong AWS DynamoDB vào Database
 */
async function restoreHistory(historyId, restoredBy = "Admin") {
  const docClient = getDocClient();
  if (!docClient) {
    throw new Error("Không thể kết nối AWS DynamoDB");
  }

  const cleanId = String(historyId).trim();
  if (!cleanId) throw new Error("ID lịch sử không hợp lệ");

  const getRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_DATA_HISTORY,
      Key: { id: cleanId },
    })
  );

  const record = getRes.Item;
  if (!record) {
    throw new Error(`Không tìm thấy bản ghi lịch sử "${cleanId}" trên AWS DynamoDB`);
  }

  if (record.is_restored) {
    throw new Error("Bản ghi này đã được khôi phục vào cơ sở dữ liệu trước đó rồi.");
  }

  let snapshot = record.snapshot_data;
  if (typeof snapshot === "string") {
    try {
      snapshot = JSON.parse(snapshot);
    } catch (_) {}
  }
  if (!Array.isArray(snapshot)) {
    snapshot = [snapshot];
  }

  const entityType = record.entity_type;
  const pool = await poolPromise;
  let restoredCount = 0;

  // 1. XỬ LÝ KHÔI PHỤC CHO HÀNH ĐỘNG CẬP NHẬT (REVERT UPDATE)
  if (record.action_type === "UPDATE") {
    if (entityType === "order") {
      for (const item of snapshot) {
        const orderId = Number(item.order_id || item.orderId);
        const prev = item.previous || {};
        if (!orderId || !prev) continue;

        if (prev.order_status) {
          await pool
            .request()
            .input("oid", sql.Int, orderId)
            .input("status", sql.NVarChar(50), prev.order_status)
            .query("UPDATE Orders SET status = @status WHERE order_id = @oid");
        }

        if (prev.payment_status) {
          const payCheck = await pool
            .request()
            .input("oid", sql.Int, orderId)
            .query("SELECT TOP 1 payment_id FROM Payments WHERE order_id = @oid ORDER BY payment_id DESC");

          if (payCheck.recordset.length > 0) {
            await pool
              .request()
              .input("pid", sql.Int, payCheck.recordset[0].payment_id)
              .input("status", sql.NVarChar(50), prev.payment_status)
              .query("UPDATE Payments SET status = @status WHERE payment_id = @pid");
          } else {
            await pool
              .request()
              .input("oid", sql.Int, orderId)
              .input("method", sql.NVarChar(50), prev.payment_method || "COD")
              .input("status", sql.NVarChar(50), prev.payment_status)
              .query("INSERT INTO Payments (order_id, method, status) VALUES (@oid, @method, @status)");
          }
        }

        restoredCount++;
      }
    } else if (entityType === "product") {
      for (const item of snapshot) {
        const productId = Number(item.product_id || item.productId);
        const prev = item.previous || {};
        const prevProd = prev.product || prev;
        if (!productId || !prevProd) continue;

        await pool
          .request()
          .input("pid", sql.Int, productId)
          .input("name", sql.NVarChar(255), prevProd.name)
          .input("desc", sql.NVarChar(sql.MAX), prevProd.description || "")
          .input("brand_id", sql.Int, prevProd.brand_id || null)
          .input("category_id", sql.Int, prevProd.category_id || null)
          .query(`
            UPDATE Products
            SET name = @name, description = @desc, brand_id = @brand_id, category_id = @category_id
            WHERE product_id = @pid
          `);

        if (Array.isArray(prev.variants)) {
          await pool.request().input("pid", sql.Int, productId).query("DELETE FROM ProductVariants WHERE product_id = @pid");
          for (const v of prev.variants) {
            await pool
              .request()
              .input("pid", sql.Int, productId)
              .input("size_id", sql.Int, v.size_id)
              .input("color_id", sql.Int, v.color_id)
              .input("price", sql.Decimal(10, 2), Number(v.price) || 0)
              .input("stock", sql.Int, Number(v.stock) || 0)
              .query("INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock) VALUES (@pid, @size_id, @color_id, @price, @stock)");
          }
        }

        if (Array.isArray(prev.images)) {
          await pool.request().input("pid", sql.Int, productId).query("DELETE FROM ProductImages WHERE product_id = @pid");
          for (const img of prev.images) {
            const url = typeof img === "string" ? img : img.image_url;
            if (url) {
              await pool.request().input("pid", sql.Int, productId).input("url", sql.NVarChar, url).query("INSERT INTO ProductImages (product_id, image_url) VALUES (@pid, @url)");
            }
          }
        }

        restoredCount++;
      }
    } else if (entityType === "user") {
      for (const item of snapshot) {
        const userId = Number(item.user_id || item.userId);
        const prev = item.previous || item;
        if (!userId || !prev) continue;

        await pool
          .request()
          .input("uid", sql.Int, userId)
          .input("name", sql.NVarChar(100), prev.name || "Người dùng")
          .input("email", sql.NVarChar(100), prev.email)
          .input("phone", sql.NVarChar(20), prev.phone || "")
          .input("addr", sql.NVarChar(255), prev.address || "")
          .input("role", sql.NVarChar(20), prev.role === "admin" ? "admin" : "user")
          .query(`
            UPDATE Users
            SET name = @name, email = @email, phone = @phone, address = @addr, role = @role
            WHERE user_id = @uid
          `);

        restoredCount++;
      }
    } else if (entityType === "voucher") {
      for (const item of snapshot) {
        const prev = item.previous || item;
        if (prev?.code) {
          await saveVoucher(prev);
          restoredCount++;
        }
      }
    }

    // Cập nhật trạng thái đã khôi phục trên AWS DynamoDB
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_DATA_HISTORY,
        Key: { id: cleanId },
        UpdateExpression: "SET is_restored = :r, restored_at = :ra, restored_by = :rb",
        ExpressionAttributeValues: {
          ":r": true,
          ":ra": new Date().toISOString(),
          ":rb": String(restoredBy || "Admin"),
        },
      })
    );

    return {
      success: true,
      restoredCount,
      entityType,
      message: `Đã khôi phục thành công trạng thái cũ cho ${restoredCount} bản ghi (${entityType}) từ AWS DynamoDB.`,
    };
  }

  // 2. KHÔI PHỤC SẢN PHẨM BỊ XÓA (Products, ProductVariants, ProductImages)
  if (entityType === "product") {
    for (const item of snapshot) {
      const prod = item.product || item;
      const variants = item.variants || prod.variants || [];
      const images = item.images || prod.images || [];

      if (!prod || !prod.name) continue;

      let productId = prod.product_id ? Number(prod.product_id) : null;
      let targetProductId = null;

      if (productId) {
        const check = await pool
          .request()
          .input("pid", sql.Int, productId)
          .query("SELECT product_id FROM Products WHERE product_id = @pid");

        if (check.recordset.length === 0) {
          await pool
            .request()
            .input("pid", sql.Int, productId)
            .input("name", sql.NVarChar(255), prod.name)
            .input("desc", sql.NVarChar(sql.MAX), prod.description || "")
            .input("brand_id", sql.Int, prod.brand_id || null)
            .input("category_id", sql.Int, prod.category_id || null)
            .query(`
              SET IDENTITY_INSERT Products ON;
              INSERT INTO Products (product_id, name, description, brand_id, category_id)
              VALUES (@pid, @name, @desc, @brand_id, @category_id);
              SET IDENTITY_INSERT Products OFF;
            `);
          targetProductId = productId;
        }
      }

      if (!targetProductId) {
        const insertRes = await pool
          .request()
          .input("name", sql.NVarChar(255), prod.name)
          .input("desc", sql.NVarChar(sql.MAX), prod.description || "")
          .input("brand_id", sql.Int, prod.brand_id || null)
          .input("category_id", sql.Int, prod.category_id || null)
          .query(`
            INSERT INTO Products (name, description, brand_id, category_id)
            OUTPUT INSERTED.product_id AS id
            VALUES (@name, @desc, @brand_id, @category_id);
          `);
        targetProductId = insertRes.recordset[0]?.id;
      }

      if (targetProductId && Array.isArray(images)) {
        for (const img of images) {
          const imgUrl = typeof img === "string" ? img : img.image_url;
          if (imgUrl) {
            await pool
              .request()
              .input("pid", sql.Int, targetProductId)
              .input("url", sql.NVarChar, imgUrl)
              .query("INSERT INTO ProductImages (product_id, image_url) VALUES (@pid, @url);");
          }
        }
      }

      if (targetProductId && Array.isArray(variants)) {
        for (const v of variants) {
          let sizeId = v.size_id ? Number(v.size_id) : null;
          let colorId = v.color_id ? Number(v.color_id) : null;

          if (!sizeId) {
            const firstSize = await pool.request().query("SELECT TOP 1 size_id FROM Sizes ORDER BY size_id");
            sizeId = firstSize.recordset[0]?.size_id || 1;
          }
          if (!colorId) {
            const firstColor = await pool.request().query("SELECT TOP 1 color_id FROM Colors ORDER BY color_id");
            colorId = firstColor.recordset[0]?.color_id || 1;
          }

          await pool
            .request()
            .input("pid", sql.Int, targetProductId)
            .input("size_id", sql.Int, sizeId)
            .input("color_id", sql.Int, colorId)
            .input("price", sql.Decimal(10, 2), Number(v.price) || 0)
            .input("stock", sql.Int, Number(v.stock) || 0)
            .query(`
              INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
              VALUES (@pid, @size_id, @color_id, @price, @stock);
            `);
        }
      }

      restoredCount++;
    }
  }

  // 3. KHÔI PHỤC NGƯỜI DÙNG BỊ XÓA (Users)
  else if (entityType === "user") {
    for (const item of snapshot) {
      const u = item.user || item;
      if (!u || !u.email) continue;

      const userId = u.user_id ? Number(u.user_id) : null;
      const checkEmail = await pool
        .request()
        .input("email", sql.NVarChar(100), u.email)
        .query("SELECT user_id FROM Users WHERE email = @email");

      if (checkEmail.recordset.length > 0) continue;

      let inserted = false;
      if (userId) {
        const checkId = await pool
          .request()
          .input("uid", sql.Int, userId)
          .query("SELECT user_id FROM Users WHERE user_id = @uid");

        if (checkId.recordset.length === 0) {
          await pool
            .request()
            .input("uid", sql.Int, userId)
            .input("name", sql.NVarChar(100), u.name || "Người dùng")
            .input("email", sql.NVarChar(100), u.email)
            .input("pass", sql.NVarChar(255), u.password || u.password_hash || "$2b$10$defaultPasswordHashVinSport")
            .input("phone", sql.NVarChar(20), u.phone || "")
            .input("addr", sql.NVarChar(255), u.address || "")
            .input("role", sql.NVarChar(20), u.role === "admin" ? "admin" : "user")
            .input("sub", sql.NVarChar(100), u.cognito_sub || null)
            .query(`
              SET IDENTITY_INSERT Users ON;
              INSERT INTO Users (user_id, name, email, password, phone, address, role, cognito_sub)
              VALUES (@uid, @name, @email, @pass, @phone, @addr, @role, @sub);
              SET IDENTITY_INSERT Users OFF;
            `);
          inserted = true;
        }
      }

      if (!inserted) {
        await pool
          .request()
          .input("name", sql.NVarChar(100), u.name || "Người dùng")
          .input("email", sql.NVarChar(100), u.email)
          .input("pass", sql.NVarChar(255), u.password || u.password_hash || "$2b$10$defaultPasswordHashVinSport")
          .input("phone", sql.NVarChar(20), u.phone || "")
          .input("addr", sql.NVarChar(255), u.address || "")
          .input("role", sql.NVarChar(20), u.role === "admin" ? "admin" : "user")
          .input("sub", sql.NVarChar(100), u.cognito_sub || null)
          .query(`
            INSERT INTO Users (name, email, password, phone, address, role, cognito_sub)
            VALUES (@name, @email, @pass, @phone, @addr, @role, @sub);
          `);
      }

      restoredCount++;
    }
  }

  // 4. KHÔI PHỤC ĐƠN HÀNG BỊ XÓA (Orders, OrderDetails, Payments, Shipping)
  else if (entityType === "order") {
    for (const item of snapshot) {
      const order = item.order || item;
      const details = item.details || [];
      const payments = item.payments || [];

      if (!order) continue;
      const orderId = order.order_id ? Number(order.order_id) : null;
      let targetOrderId = null;

      let userId = order.user_id ? Number(order.user_id) : 1;
      const userCheck = await pool
        .request()
        .input("uid", sql.Int, userId)
        .query("SELECT user_id FROM Users WHERE user_id = @uid");

      if (userCheck.recordset.length === 0) {
        const firstUser = await pool.request().query("SELECT TOP 1 user_id FROM Users ORDER BY user_id");
        userId = firstUser.recordset[0]?.user_id || 1;
      }

      const normalizeDbOrderStatus = (raw) => {
        const s = String(raw || "").toLowerCase();
        if (s.includes("xác nhận") || s === "confirmed") return "Confirmed";
        if (s.includes("giao") || s === "shipping") return "Shipping";
        if (s.includes("hoàn thành") || s === "completed") return "Completed";
        if (s.includes("hủy") || s === "cancelled") return "Cancelled";
        return "Pending";
      };

      const dbOrderStatus = normalizeDbOrderStatus(order.status);

      if (orderId) {
        const checkOid = await pool
          .request()
          .input("oid", sql.Int, orderId)
          .query("SELECT order_id FROM Orders WHERE order_id = @oid");

        if (checkOid.recordset.length === 0) {
          await pool
            .request()
            .input("oid", sql.Int, orderId)
            .input("uid", sql.Int, userId)
            .input("status", sql.NVarChar(50), dbOrderStatus)
            .input("total", sql.Decimal(12, 2), Number(order.total_amount) || 0)
            .query(`
              SET IDENTITY_INSERT Orders ON;
              INSERT INTO Orders (order_id, user_id, status, total_amount)
              VALUES (@oid, @uid, @status, @total);
              SET IDENTITY_INSERT Orders OFF;
            `);
          targetOrderId = orderId;
        }
      }

      if (!targetOrderId) {
        const orderInsert = await pool
          .request()
          .input("uid", sql.Int, userId)
          .input("status", sql.NVarChar(50), dbOrderStatus)
          .input("total", sql.Decimal(12, 2), Number(order.total_amount) || 0)
          .query(`
            INSERT INTO Orders (user_id, status, total_amount)
            VALUES (@uid, @status, @total);
            SELECT SCOPE_IDENTITY() AS id;
          `);
        targetOrderId = orderInsert.recordset[0]?.id;
      }

      if (targetOrderId) {
        const paymentMethod = item.paymentMethod || payments[0]?.method || "cod";
        const paymentStatus = item.paymentStatus || payments[0]?.status || "pending";
        await pool
          .request()
          .input("oid", sql.Int, targetOrderId)
          .input("method", sql.NVarChar(50), paymentMethod)
          .input("status", sql.NVarChar(50), paymentStatus)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM Payments WHERE order_id = @oid)
            BEGIN
              INSERT INTO Payments (order_id, method, status) VALUES (@oid, @method, @status);
            END
          `);

        if (Array.isArray(details) && details.length > 0) {
          for (const d of details) {
            const variantId = d.variant_id ? Number(d.variant_id) : null;
            if (variantId) {
              await pool
                .request()
                .input("oid", sql.Int, targetOrderId)
                .input("vid", sql.Int, variantId)
                .input("qty", sql.Int, Number(d.quantity) || 1)
                .input("price", sql.Decimal(12, 2), Number(d.price) || 0)
                .query(`
                  INSERT INTO OrderDetails (order_id, variant_id, quantity, price)
                  VALUES (@oid, @vid, @qty, @price);
                `);
            }
          }
        }
      }

      restoredCount++;
    }
  }

  // 5. KHÔI PHỤC MÃ ƯU ĐÃI BỊ XÓA (Vouchers trên Amazon DynamoDB)
  else if (entityType === "voucher") {
    for (const v of snapshot) {
      if (v && v.code) {
        await saveVoucher(v);
        restoredCount++;
      }
    }
  }

  // Cập nhật trạng thái đã khôi phục trên AWS DynamoDB
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_DATA_HISTORY,
      Key: { id: cleanId },
      UpdateExpression: "SET is_restored = :r, restored_at = :ra, restored_by = :rb",
      ExpressionAttributeValues: {
        ":r": true,
        ":ra": new Date().toISOString(),
        ":rb": String(restoredBy || "Admin"),
      },
    })
  );

  return {
    success: true,
    historyId: cleanId,
    entityType,
    restoredCount,
    message: `Đã khôi phục thành công ${restoredCount} bản ghi vào cơ sở dữ liệu từ AWS DynamoDB!`,
  };
}

/**
 * Xóa vĩnh viễn 1 bản ghi lịch sử khỏi bảng DynamoDB
 */
async function deleteHistoryPermanently(historyId) {
  const docClient = getDocClient();
  if (!docClient) throw new Error("Không thể kết nối AWS DynamoDB");

  const cleanId = String(historyId).trim();
  if (!cleanId) throw new Error("ID không hợp lệ");

  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_DATA_HISTORY,
      Key: { id: cleanId },
    })
  );

  return true;
}

/**
 * Xóa vĩnh viễn nhiều bản ghi lịch sử khỏi bảng DynamoDB
 */
async function deleteHistoryBatch(historyIds) {
  const docClient = getDocClient();
  if (!docClient) throw new Error("Không thể kết nối AWS DynamoDB");

  const cleanIds = (Array.isArray(historyIds) ? historyIds : [])
    .map(String)
    .map((s) => s.trim())
    .filter(Boolean);

  if (cleanIds.length === 0) {
    throw new Error("Danh sách ID không hợp lệ");
  }

  for (const id of cleanIds) {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_DATA_HISTORY,
        Key: { id },
      })
    );
  }

  return cleanIds.length;
}

module.exports = {
  ensureHistoryTable,
  recordHistory,
  getHistoryList,
  restoreHistory,
  deleteHistoryPermanently,
  deleteHistoryBatch,
};
