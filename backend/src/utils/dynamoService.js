const {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const REGION = (process.env.AWS_REGION || "ap-southeast-1").trim();
const ACCESS_KEY = (process.env.AWS_ACCESS_KEY_ID || "").trim();
const SECRET_KEY = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();

// Tên các bảng DynamoDB
const TABLE_RECENTLY_VIEWED = (process.env.DYNAMODB_TABLE_RECENTLY_VIEWED || "VinSport_RecentlyViewed").trim();
const TABLE_CARTS = (process.env.DYNAMODB_TABLE_CARTS || "VinSport_Carts").trim();
const TABLE_OTP = (process.env.DYNAMODB_TABLE_OTP || "VinSport_OTP").trim();
const TABLE_VOUCHERS = (process.env.DYNAMODB_TABLE_VOUCHERS || "VinSport_Vouchers").trim();
const TABLE_DATA_HISTORY = (process.env.DYNAMODB_TABLE_DATA_HISTORY || "VinSport_DataHistory").trim();

let docClient = null;

function getDocClient() {
  if (docClient) return docClient;

  if (!ACCESS_KEY || !SECRET_KEY) {
    console.warn("[DynamoDB] Bỏ qua vì chưa cấu hình AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY trong .env.");
    return null;
  }

  const rawClient = new DynamoDBClient({
    region: REGION,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });

  docClient = DynamoDBDocumentClient.from(rawClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: true,
      convertClassInstanceToMap: true,
    },
  });

  return docClient;
}

function getRawClient() {
  return new DynamoDBClient({
    region: REGION,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });
}

/**
 * Tự động tạo bảng nếu chưa có (kèm Partition Key và On-Demand Billing)
 */
async function ensureTable(tableName, partitionKeyName) {
  const rawClient = getRawClient();
  try {
    await rawClient.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err.name === "ResourceNotFoundException") {
      console.log(`[DynamoDB] Đang tự động tạo bảng "${tableName}" trên AWS...`);
      try {
        await rawClient.send(
          new CreateTableCommand({
            TableName: tableName,
            KeySchema: [{ AttributeName: partitionKeyName, KeyType: "HASH" }],
            AttributeDefinitions: [{ AttributeName: partitionKeyName, AttributeType: "S" }],
            BillingMode: "PAY_PER_REQUEST", // Miễn phí hoàn toàn theo Free Tier
          })
        );
        console.log(`[DynamoDB] ✅ Đã gửi yêu cầu tạo bảng "${tableName}" thành công!`);
        return true;
      } catch (createErr) {
        console.error(`[DynamoDB] Lỗi khi tạo bảng "${tableName}":`, createErr.message);
        return false;
      }
    }
    return false;
  }
}

/**
 * Bật tính năng TTL (Time-To-Live tự động xóa bản ghi hết hạn) cho bảng
 */
async function enableTTL(tableName, attributeName = "expiresAt") {
  const rawClient = getRawClient();
  try {
    await rawClient.send(
      new UpdateTimeToLiveCommand({
        TableName: tableName,
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: attributeName,
        },
      })
    );
  } catch (_) {
    // TTL có thể đã được bật hoặc đang xử lý
  }
}

/**
 * Khởi tạo toàn bộ các bảng DynamoDB cần thiết cho VinSport
 */
async function ensureAllDynamoTables() {
  if (!ACCESS_KEY || !SECRET_KEY) return false;
  try {
    await Promise.all([
      ensureTable(TABLE_RECENTLY_VIEWED, "userId"),
      ensureTable(TABLE_CARTS, "userId"),
      ensureTable(TABLE_OTP, "identifier"),
      ensureTable(TABLE_VOUCHERS, "code"),
      ensureTable(TABLE_DATA_HISTORY, "id"),
    ]);

    // Bật TTL cho bảng OTP
    enableTTL(TABLE_OTP, "expiresAt").catch(() => {});
    return true;
  } catch (err) {
    console.warn("[DynamoDB] Không thể khởi tạo đầy đủ các bảng:", err.message);
    return false;
  }
}

/* ========================================================================= */
/* 1. MODULE: SẢN PHẨM VỪA XEM GẦN ĐÂY (RECENTLY VIEWED)                     */
/* ========================================================================= */

async function recordProductView(userId, product) {
  const client = getDocClient();
  if (!client || !userId || !product || !product.id) return false;

  try {
    const safeUserId = String(userId).trim();
    const productId = String(product.id).trim();

    let existingItems = [];
    try {
      const getRes = await client.send(
        new GetCommand({
          TableName: TABLE_RECENTLY_VIEWED,
          Key: { userId: safeUserId },
        })
      );
      if (getRes.Item && Array.isArray(getRes.Item.products)) {
        existingItems = getRes.Item.products;
      }
    } catch (_) {}

    const filtered = existingItems.filter((p) => String(p.id) !== productId);
    const newItem = {
      id: productId,
      name: product.name || "Sản phẩm",
      price: Number(product.price || 0),
      image: product.image || "",
      category: product.category || "",
      brand: product.brand || "",
      viewedAt: new Date().toISOString(),
    };

    const updatedList = [newItem, ...filtered].slice(0, 10);

    await client.send(
      new PutCommand({
        TableName: TABLE_RECENTLY_VIEWED,
        Item: {
          userId: safeUserId,
          products: updatedList,
          updatedAt: new Date().toISOString(),
          totalViews: (existingItems.length || 0) + 1,
        },
      })
    );

    return true;
  } catch (err) {
    console.warn("[DynamoDB] Lỗi khi lưu sản phẩm vừa xem:", err.message);
    return false;
  }
}

async function getRecentlyViewed(userId) {
  const client = getDocClient();
  if (!client || !userId) return [];

  try {
    const safeUserId = String(userId).trim();
    const response = await client.send(
      new GetCommand({
        TableName: TABLE_RECENTLY_VIEWED,
        Key: { userId: safeUserId },
      })
    );

    if (response.Item && Array.isArray(response.Item.products)) {
      return response.Item.products;
    }
    return [];
  } catch (err) {
    console.warn("[DynamoDB] Lỗi khi đọc sản phẩm vừa xem:", err.message);
    return [];
  }
}

async function clearRecentlyViewed(userId) {
  const client = getDocClient();
  if (!client || !userId) return false;

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_RECENTLY_VIEWED,
        Key: { userId: String(userId).trim() },
      })
    );
    return true;
  } catch (err) {
    console.warn("[DynamoDB] Lỗi khi xóa lịch sử xem:", err.message);
    return false;
  }
}

/* ========================================================================= */
/* 2. MODULE: ĐỒNG BỘ GIỎ HÀNG LIÊN THIẾT BỊ (CROSS-DEVICE SHOPPING CART)    */
/* ========================================================================= */

/**
 * Lưu toàn bộ giỏ hàng của khách vào DynamoDB
 */
async function saveCart(userId, items = []) {
  const client = getDocClient();
  if (!client || !userId) return false;

  try {
    const safeUserId = String(userId).trim();
    const validItems = Array.isArray(items) ? items : [];

    const totalItems = validItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const totalPrice = validItems.reduce(
      (sum, item) => sum + (Number(item.product?.price) || 0) * (Number(item.quantity) || 1),
      0
    );

    await client.send(
      new PutCommand({
        TableName: TABLE_CARTS,
        Item: {
          userId: safeUserId,
          items: validItems,
          totalItems,
          totalPrice,
          updatedAt: new Date().toISOString(),
        },
      })
    );

    return true;
  } catch (err) {
    console.warn("[DynamoDB Cart] Lỗi khi lưu giỏ hàng:", err.message);
    return false;
  }
}

/**
 * Đọc giỏ hàng từ DynamoDB
 */
async function getCart(userId) {
  const client = getDocClient();
  if (!client || !userId) return [];

  try {
    const safeUserId = String(userId).trim();
    const response = await client.send(
      new GetCommand({
        TableName: TABLE_CARTS,
        Key: { userId: safeUserId },
      })
    );

    if (response.Item && Array.isArray(response.Item.items)) {
      return response.Item.items;
    }
    return [];
  } catch (err) {
    console.warn("[DynamoDB Cart] Lỗi khi đọc giỏ hàng:", err.message);
    return [];
  }
}

/**
 * Xóa giỏ hàng trên DynamoDB (sau khi đã đặt hàng thành công)
 */
async function clearCart(userId) {
  const client = getDocClient();
  if (!client || !userId) return false;

  try {
    await client.send(
      new DeleteCommand({
        TableName: TABLE_CARTS,
        Key: { userId: String(userId).trim() },
      })
    );
    return true;
  } catch (err) {
    console.warn("[DynamoDB Cart] Lỗi khi xóa giỏ hàng:", err.message);
    return false;
  }
}

/* ========================================================================= */
/* 3. MODULE: QUẢN LÝ MÃ OTP TỰ HỦY BẰNG TTL (OTP LIFECYCLE MANAGEMENT)      */
/* ========================================================================= */

/**
 * Sinh mã OTP 6 số ngẫu nhiên và lưu vào DynamoDB kèm hạn sử dụng TTL
 * @param {string} identifier - Email hoặc số điện thoại của người nhận
 * @param {string} purpose - Mục đích (e.g. "REGISTRATION", "LOGIN", "ORDER_VERIFY")
 * @param {number} ttlMinutes - Số phút trước khi AWS tự động hủy mã (mặc định 5 phút)
 */
async function generateAndSaveOTP(identifier, purpose = "REGISTRATION", ttlMinutes = 5) {
  const client = getDocClient();
  if (!client || !identifier) return null;

  try {
    const safeIdentifier = String(identifier).trim().toLowerCase();
    // Sinh mã OTP 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Unix timestamp (tính bằng giây) phục vụ tính năng TTL của AWS DynamoDB
    const nowUnix = Math.floor(Date.now() / 1000);
    const expiresAt = nowUnix + Math.max(1, ttlMinutes) * 60;

    await client.send(
      new PutCommand({
        TableName: TABLE_OTP,
        Item: {
          identifier: safeIdentifier,
          otpCode,
          purpose,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date().toISOString(),
          expiresAt, // DynamoDB sẽ tự động xóa dòng này khi thời gian > expiresAt
        },
      })
    );

    console.log(`[DynamoDB OTP] Đã tạo mã OTP cho "${safeIdentifier}": ${otpCode} (Hết hạn sau ${ttlMinutes} phút)`);
    return { otpCode, expiresAt };
  } catch (err) {
    console.warn("[DynamoDB OTP] Lỗi khi tạo mã OTP:", err.message);
    return null;
  }
}

/**
 * Xác minh mã OTP từ DynamoDB
 * Nếu đúng -> Xóa ngay lập tức (không cho dùng lại)
 * Nếu sai -> Tăng số lần thử (quá 3 lần sẽ xóa mã để chống brute-force)
 */
async function verifyAndConsumeOTP(identifier, inputCode, purpose = "REGISTRATION") {
  const client = getDocClient();
  if (!client || !identifier || !inputCode) {
    return { success: false, message: "Thiếu thông tin xác thực" };
  }

  try {
    const safeIdentifier = String(identifier).trim().toLowerCase();
    const cleanCode = String(inputCode).trim();

    const response = await client.send(
      new GetCommand({
        TableName: TABLE_OTP,
        Key: { identifier: safeIdentifier },
      })
    );

    const record = response.Item;
    if (!record) {
      return {
        success: false,
        message: "Mã xác thực không tồn tại hoặc đã hết hạn tự hủy (quá 5 phút).",
      };
    }

    // Kiểm tra TTL thủ công (đề phòng AWS TTL daemon xóa trễ vài giây)
    const nowUnix = Math.floor(Date.now() / 1000);
    if (record.expiresAt && nowUnix > record.expiresAt) {
      await client.send(new DeleteCommand({ TableName: TABLE_OTP, Key: { identifier: safeIdentifier } }));
      return { success: false, message: "Mã OTP đã hết hạn sử dụng. Vui lòng lấy mã mới." };
    }

    // Kiểm tra mục đích
    if (record.purpose && record.purpose !== purpose) {
      return { success: false, message: "Mã OTP không đúng mục đích sử dụng." };
    }

    // Kiểm tra số lần nhập sai
    if (record.attempts >= (record.maxAttempts || 3)) {
      await client.send(new DeleteCommand({ TableName: TABLE_OTP, Key: { identifier: safeIdentifier } }));
      return { success: false, message: "Bạn đã nhập sai quá số lần cho phép. Mã OTP đã bị khóa." };
    }

    // So khớp mã OTP
    if (record.otpCode !== cleanCode) {
      // Tăng số lần nhập sai
      const newAttempts = (record.attempts || 0) + 1;
      await client.send(
        new PutCommand({
          TableName: TABLE_OTP,
          Item: {
            ...record,
            attempts: newAttempts,
          },
        })
      );
      const remaining = Math.max(0, (record.maxAttempts || 3) - newAttempts);
      return {
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`,
      };
    }

    // Khớp mã thành công -> Tiêu hủy mã ngay lập tức để tránh dùng lại (Single-use)
    await client.send(
      new DeleteCommand({
        TableName: TABLE_OTP,
        Key: { identifier: safeIdentifier },
      })
    );

    return {
      success: true,
      message: "Xác thực mã OTP thành công!",
    };
  } catch (err) {
    console.error("[DynamoDB OTP] Lỗi khi xác thực OTP:", err.message);
    return { success: false, message: "Lỗi hệ thống khi kiểm tra OTP" };
  }
}

/* ========================================================================= */
/* 4. MODULE: QUẢN LÝ MÃ ƯU ĐÃI (AMAZON DYNAMODB VOUCHERS)                   */
/* ========================================================================= */

// Bộ nhớ đệm dự phòng (Fallback cache) để luôn đảm bảo tính sẵn sàng 100%
const fallbackVouchersCache = new Map([
  [
    "VINSPORT10",
    {
      code: "VINSPORT10",
      description: "Giảm 10% tổng đơn hàng (Tối đa 100.000đ)",
      discountType: "PERCENT",
      discountValue: 10,
      maxDiscount: 100000,
      minOrderAmount: 200000,
      maxUsagePerUser: 1,
      usages: {},
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "LAMBDA50K",
    {
      code: "LAMBDA50K",
      description: "Ưu đãi công nghệ AWS Lambda: Giảm thẳng 50.000đ",
      discountType: "FIXED",
      discountValue: 50000,
      maxDiscount: 50000,
      minOrderAmount: 300000,
      maxUsagePerUser: 1,
      usages: {},
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "FREESHIP",
    {
      code: "FREESHIP",
      description: "Miễn phí vận chuyển toàn quốc (Giảm 30.000đ phí ship)",
      discountType: "SHIPPING",
      discountValue: 30000,
      maxDiscount: 30000,
      minOrderAmount: 150000,
      maxUsagePerUser: 1,
      usages: {},
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    "VIPSPORT",
    {
      code: "VIPSPORT",
      description: "Đặc quyền thành viên VIP: Giảm 15% cho đơn từ 500.000đ",
      discountType: "PERCENT",
      discountValue: 15,
      maxDiscount: 200000,
      minOrderAmount: 500000,
      maxUsagePerUser: 1,
      usages: {},
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: new Date().toISOString(),
    },
  ],
]);

/**
 * Lấy tất cả mã ưu đãi từ DynamoDB
 */
async function getAllVouchers() {
  const client = getDocClient();
  if (!client) {
    return Array.from(fallbackVouchersCache.values());
  }

  try {
    const response = await client.send(
      new ScanCommand({
        TableName: TABLE_VOUCHERS,
      })
    );

    if (response.Items && response.Items.length > 0) {
      // Cập nhật lại cache đồng thời
      response.Items.forEach((item) => {
        fallbackVouchersCache.set(item.code, item);
      });
      return response.Items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }

    // Nếu bảng DynamoDB chưa có dữ liệu, tự động seed danh sách mặc định
    await seedDefaultVouchers();
    return Array.from(fallbackVouchersCache.values());
  } catch (err) {
    console.warn("[DynamoDB Vouchers] Không thể đọc từ cloud DynamoDB, dùng fallback cache:", err.message);
    return Array.from(fallbackVouchersCache.values());
  }
}

/**
 * Lấy chi tiết 1 mã ưu đãi theo Code
 */
async function getVoucherByCode(code) {
  if (!code) return null;
  const cleanCode = String(code).trim().toUpperCase();

  const client = getDocClient();
  if (client) {
    try {
      const response = await client.send(
        new GetCommand({
          TableName: TABLE_VOUCHERS,
          Key: { code: cleanCode },
        })
      );

      if (response.Item) {
        fallbackVouchersCache.set(cleanCode, response.Item);
        return response.Item;
      }
    } catch (err) {
      console.warn("[DynamoDB Vouchers] Lỗi GetItem:", err.message);
    }
  }

  // Fallback từ memory cache
  return fallbackVouchersCache.get(cleanCode) || null;
}

/**
 * Thêm hoặc Cập nhật mã ưu đãi trên DynamoDB
 */
async function saveVoucher(voucherData) {
  if (!voucherData || !voucherData.code) {
    throw new Error("Mã ưu đãi (code) là bắt buộc");
  }

  const cleanCode = String(voucherData.code).trim().toUpperCase();
  const now = new Date().toISOString();

  const existing = await getVoucherByCode(cleanCode);

  const voucherItem = {
    code: cleanCode,
    description: String(voucherData.description || "").trim(),
    discountType: String(voucherData.discountType || "PERCENT").toUpperCase(),
    discountValue: Number(voucherData.discountValue) || 0,
    maxDiscount: Number(voucherData.maxDiscount) || 0,
    minOrderAmount: Number(voucherData.minOrderAmount) || 0,
    maxUsagePerUser: Number(voucherData.maxUsagePerUser) > 0 ? Number(voucherData.maxUsagePerUser) : (existing?.maxUsagePerUser || 1),
    usages: existing?.usages || voucherData.usages || {},
    isActive: voucherData.isActive !== false,
    expiresAt: voucherData.expiresAt || null,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  // Cập nhật fallback cache
  fallbackVouchersCache.set(cleanCode, voucherItem);

  const client = getDocClient();
  if (client) {
    try {
      await client.send(
        new PutCommand({
          TableName: TABLE_VOUCHERS,
          Item: voucherItem,
        })
      );
      console.log(`[DynamoDB Vouchers] Đã lưu mã "${cleanCode}" lên DynamoDB thành công!`);
    } catch (err) {
      console.warn(`[DynamoDB Vouchers] Lưu lên DynamoDB lỗi (${err.message}), đã lưu vào bộ nhớ cục bộ.`);
    }
  }

  return voucherItem;
}

/**
 * Xóa mã ưu đãi khỏi DynamoDB
 */
async function deleteVoucher(code) {
  if (!code) return false;
  const cleanCode = String(code).trim().toUpperCase();

  fallbackVouchersCache.delete(cleanCode);

  const client = getDocClient();
  if (client) {
    try {
      await client.send(
        new DeleteCommand({
          TableName: TABLE_VOUCHERS,
          Key: { code: cleanCode },
        })
      );
      console.log(`[DynamoDB Vouchers] Đã xóa mã "${cleanCode}" khỏi DynamoDB!`);
      return true;
    } catch (err) {
      console.warn(`[DynamoDB Vouchers] Lỗi khi xóa trên DynamoDB: ${err.message}`);
    }
  }

  return true;
}

/**
 * Lấy số lần 1 tài khoản đã sử dụng voucher này
 */
async function getVoucherUsageForUser(code, userId) {
  if (!code || !userId) return 0;
  const cleanCode = String(code).trim().toUpperCase();
  const cleanUserId = String(userId).trim();
  const voucher = await getVoucherByCode(cleanCode);
  if (!voucher || !voucher.usages) return 0;
  return Number(voucher.usages[cleanUserId] || 0);
}

/**
 * Ghi nhận 1 lượt sử dụng voucher cho tài khoản khi đặt hàng thành công
 */
async function recordVoucherUsage(code, userId) {
  if (!code || !userId) return false;
  const cleanCode = String(code).trim().toUpperCase();
  const cleanUserId = String(userId).trim();

  const voucher = await getVoucherByCode(cleanCode);
  if (!voucher) return false;

  const usages = voucher.usages || {};
  usages[cleanUserId] = (Number(usages[cleanUserId]) || 0) + 1;
  voucher.usages = usages;
  voucher.updatedAt = new Date().toISOString();

  fallbackVouchersCache.set(cleanCode, voucher);

  const client = getDocClient();
  if (client) {
    try {
      await client.send(
        new PutCommand({
          TableName: TABLE_VOUCHERS,
          Item: voucher,
        })
      );
      console.log(`[DynamoDB Vouchers] Đã ghi nhận sử dụng mã "${cleanCode}" cho tài khoản ${cleanUserId} (Lần thứ ${usages[cleanUserId]})`);
    } catch (err) {
      console.warn(`[DynamoDB Vouchers] Ghi nhận usage lên DynamoDB lỗi (${err.message}), đã lưu cục bộ.`);
    }
  }

  return true;
}

/**
 * Tự động khởi tạo dữ liệu mẫu nếu bảng DynamoDB còn trống
 */
async function seedDefaultVouchers() {
  const defaultList = Array.from(fallbackVouchersCache.values());
  const client = getDocClient();
  if (!client) return;

  try {
    for (const v of defaultList) {
      await client.send(
        new PutCommand({
          TableName: TABLE_VOUCHERS,
          Item: v,
        })
      );
    }
    console.log("[DynamoDB Vouchers] Đã nạp 4 mã ưu đãi khởi tạo vào DynamoDB.");
  } catch (err) {
    console.warn("[DynamoDB Vouchers] Seed DynamoDB lỗi:", err.message);
  }
}

module.exports = {
  ensureAllDynamoTables,
  // 1. Recently viewed
  recordProductView,
  getRecentlyViewed,
  clearRecentlyViewed,
  // 2. Shopping cart
  saveCart,
  getCart,
  clearCart,
  // 3. OTP lifecycle
  generateAndSaveOTP,
  verifyAndConsumeOTP,
  // 4. Vouchers Management
  getAllVouchers,
  getVoucherByCode,
  saveVoucher,
  deleteVoucher,
  seedDefaultVouchers,
  getVoucherUsageForUser,
  recordVoucherUsage,
  // Table names
  TABLE_RECENTLY_VIEWED,
  TABLE_CARTS,
  TABLE_OTP,
  TABLE_VOUCHERS,
  TABLE_DATA_HISTORY,
  getDocClient,
};
