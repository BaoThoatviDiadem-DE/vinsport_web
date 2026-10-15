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

module.exports = {
  uploadOrderToS3,
  uploadUserToS3,
  uploadProductToS3,
  deleteFromS3,
};
