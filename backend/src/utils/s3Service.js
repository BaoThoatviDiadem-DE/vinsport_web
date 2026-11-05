const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { sql, poolPromise } = require("../db");

// Cấu hình AWS S3 Client
const s3Client = new S3Client({
  region: (process.env.AWS_REGION || "ap-southeast-1").trim(),
  credentials: {
    accessKeyId: (process.env.AWS_ACCESS_KEY_ID || "").trim(),
    secretAccessKey: (process.env.AWS_SECRET_ACCESS_KEY || "").trim(),
  },
});

const BUCKET_NAME = (process.env.AWS_BUCKET_NAME || "").trim();

/**
 * Lấy thông tin chi tiết đơn hàng từ DB và đẩy lên S3 dưới dạng file JSON.
 * Được gọi mỗi khi có đơn hàng mới (INSERT) hoặc cập nhật (UPDATE).
 */
async function uploadOrderToS3(orderId) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log("[S3 Backup] Bỏ qua vì chưa cấu hình thông tin AWS_ACCESS_KEY_ID.");
    return;
  }

  try {
    const pool = await poolPromise;
    
    // 1. Lấy thông tin đơn hàng từ SQL Server
    const result = await pool.request()
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
          ship.address AS shipping_address,
          pay.method AS payment_method,
          pay.status AS payment_status
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

    if (result.recordset.length === 0) {
      console.log(`[S3 Backup] Không tìm thấy đơn hàng ID ${orderId} trong cơ sở dữ liệu.`);
      return;
    }

    const orderData = result.recordset[0];
    
    // Thêm metadata thời gian đồng bộ
    orderData.synced_to_s3_at = new Date().toISOString();

    // 2. Định dạng thành JSON
    const jsonContent = JSON.stringify(orderData, null, 2);
    const objectKey = `backup/orders/order_${orderId}.json`;

    // 3. Đẩy lên Amazon S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      Body: jsonContent,
      ContentType: "application/json",
    });

    await s3Client.send(command);
    console.log(`[S3 Backup] Đã cập nhật đơn hàng ${orderId} lên S3: s3://${BUCKET_NAME}/${objectKey}`);

  } catch (error) {
    console.error(`[S3 Backup] Lỗi khi đẩy đơn hàng ${orderId} lên S3:`, error.message);
    try {
      const { sendTechnicalAlert } = require("./snsService");
      sendTechnicalAlert({
        level: "MEDIUM",
        title: "LỖI ĐỒNG BỘ ĐƠN HÀNG LÊN AMAZON S3 LAKEHOUSE",
        message: `Không thể đồng bộ dữ liệu đơn hàng #${orderId} lên bucket S3: ${BUCKET_NAME}`,
        error: error,
        context: { orderId, bucket: BUCKET_NAME },
      });
    } catch (_) {}
  }
}

async function uploadUserToS3(userId) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT user_id, name, email, phone, address, role FROM Users WHERE user_id = @userId");
    
    if (result.recordset.length === 0) return;
    
    const userData = result.recordset[0];
    userData.synced_to_s3_at = new Date().toISOString();
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `backup/users/user_${userId}.json`,
      Body: JSON.stringify(userData, null, 2),
      ContentType: "application/json",
    });
    await s3Client.send(command);
    console.log(`[S3 Backup] Đã cập nhật người dùng ${userId} lên S3.`);
  } catch (error) {
    console.error(`[S3 Backup] Lỗi khi đẩy người dùng ${userId}:`, error.message);
  }
}

async function uploadProductToS3(productId) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("productId", sql.Int, productId)
      .query("SELECT product_id, name, category_id, description FROM Products WHERE product_id = @productId");
    
    if (result.recordset.length === 0) return;
    
    const productData = result.recordset[0];
    productData.synced_to_s3_at = new Date().toISOString();
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `backup/products/product_${productId}.json`,
      Body: JSON.stringify(productData, null, 2),
      ContentType: "application/json",
    });
    await s3Client.send(command);
    console.log(`[S3 Backup] Đã cập nhật sản phẩm ${productId} lên S3.`);
  } catch (error) {
    console.error(`[S3 Backup] Lỗi khi đẩy sản phẩm ${productId}:`, error.message);
  }
}

async function deleteFromS3(type, id) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return;
  try {
    let folder = "";
    let prefix = "";
    if (type === "product") { folder = "products"; prefix = "product"; }
    else if (type === "order") { folder = "orders"; prefix = "order"; }
    else if (type === "user") { folder = "users"; prefix = "user"; }
    else return;

    const key = `backup/${folder}/${prefix}_${id}.json`;
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));
    console.log(`[S3 Backup] Đã đồng bộ thao tác XOÁ ${type} ${id} trên S3.`);
  } catch (error) {
    console.error(`[S3 Backup] Lỗi khi xoá ${type} ${id} trên S3:`, error.message);
  }
}

/**
 * Tự động tải ảnh từ URL bên ngoài và lưu trữ lên Amazon S3 (images/products/), cập nhật lại DB
 */
async function syncSingleProductImage(productId, imageId, imageUrl) {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return;
  if (!imageUrl || (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://"))) return;

  const bucketName = (process.env.AWS_BUCKET_NAME || "").trim();
  const region = (process.env.AWS_REGION || "ap-southeast-1").trim();
  const cfDomain = (process.env.AWS_CLOUDFRONT_DOMAIN || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");

  // Nếu ảnh đã nằm trên S3 hoặc CloudFront thì bỏ qua
  if (bucketName && imageUrl.includes(bucketName)) return;
  if (cfDomain && imageUrl.includes(cfDomain)) return;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (imageId) {
        const pool = await poolPromise;
        await pool.request()
          .input("imgId", sql.Int, imageId)
          .query("DELETE FROM ProductImages WHERE image_id = @imgId");
        console.warn(`[S3 Image Sync] Link gốc hỏng (HTTP ${response.status}) -> Đã xóa ảnh lỗi SP #${productId} khỏi database.`);
      }
      return;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    let ext = "jpg";
    if (contentType.includes("png") || imageUrl.includes(".png")) ext = "png";
    else if (contentType.includes("webp") || imageUrl.includes(".webp")) ext = "webp";
    else if (contentType.includes("gif") || imageUrl.includes(".gif")) ext = "gif";

    const s3Key = `images/products/product_${productId}_${imageId || Date.now()}.${ext}`;
    const arrayBuffer = await response.arrayBuffer();

    await s3Client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: Buffer.from(arrayBuffer),
      ContentType: contentType,
    }));

    const finalUrl = cfDomain
      ? `https://${cfDomain}/${s3Key}`
      : `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;

    const pool = await poolPromise;
    await pool.request()
      .input("imgId", sql.Int, imageId)
      .input("newUrl", sql.NVarChar, finalUrl)
      .query("UPDATE ProductImages SET image_url = @newUrl WHERE image_id = @imgId");

    console.log(`[S3 Image Sync] Tự động tải ảnh SP #${productId} lên S3: ${finalUrl}`);
  } catch (err) {
    console.warn(`[S3 Image Sync] Link gốc bị lỗi (${err.message}) -> Đang tự động xóa khỏi database...`);
    if (imageId) {
      try {
        const pool = await poolPromise;
        await pool.request()
          .input("imgId", sql.Int, imageId)
          .query("DELETE FROM ProductImages WHERE image_id = @imgId");
        console.log(`[S3 Image Sync] Đã xóa ảnh lỗi SP #${productId} (image_id: ${imageId}).`);
      } catch (_) {}
    }
  }
}

module.exports = {
  uploadOrderToS3,
  uploadUserToS3,
  uploadProductToS3,
  deleteFromS3,
  syncSingleProductImage,
};
