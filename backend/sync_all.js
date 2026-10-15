require("dotenv").config();
const { poolPromise } = require("./src/db");
const { uploadOrderToS3 } = require("./src/utils/s3Service");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

async function syncAllData() {
  console.log("==========================================");
  console.log("BẮT ĐẦU ĐỒNG BỘ TOÀN BỘ DỮ LIỆU LÊN S3...");
  console.log("==========================================");

  try {
    const pool = await poolPromise;

    // Lấy danh sách ID của TẤT CẢ các đơn hàng đang có trong Database
    const result = await pool.request().query(`SELECT order_id FROM Orders`);
    const orders = result.recordset;

    console.log(`Đã tìm thấy ${orders.length} đơn hàng trong hệ thống.`);

    // Lặp qua từng đơn hàng và tái sử dụng lại hàm đẩy lên S3 đã viết lúc nãy
    let successCount = 0;
    for (let i = 0; i < orders.length; i++) {
      const orderId = orders[i].order_id;
      console.log(`Đang đẩy đơn hàng số [${orderId}] lên S3... (${i + 1}/${orders.length})`);
      
      await uploadOrderToS3(orderId);
      successCount++;
    }

    // ĐỒNG BỘ NGƯỜI DÙNG (USERS)
    console.log("------------------------------------------");
    console.log("Đang lấy danh sách Người Dùng (Users)...");
    const usersResult = await pool.request().query("SELECT user_id, name, email, phone, address, role FROM Users");
    const users = usersResult.recordset;
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const objectKey = `backup/users/user_${user.user_id}.json`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: JSON.stringify(user, null, 2),
        ContentType: "application/json",
      }));
      console.log(`Đã đẩy User ID [${user.user_id}] lên S3.`);
    }

    // ĐỒNG BỘ SẢN PHẨM (PRODUCTS)
    console.log("------------------------------------------");
    console.log("Đang lấy danh sách Sản Phẩm (Products)...");
    const productsResult = await pool.request().query("SELECT product_id, name, category_id, description FROM Products");
    const products = productsResult.recordset;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const objectKey = `backup/products/product_${product.product_id}.json`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: objectKey,
        Body: JSON.stringify(product, null, 2),
        ContentType: "application/json",
      }));
      console.log(`Đã đẩy Product ID [${product.product_id}] lên S3.`);
    }

    console.log("==========================================");
    console.log(`HOÀN TẤT! Đã đẩy thành công:`);
    console.log(`- ${successCount} Đơn hàng`);
    console.log(`- ${users.length} Người dùng`);
    console.log(`- ${products.length} Sản phẩm`);
    console.log("Kể từ bây giờ, mọi thay đổi mới sẽ được tự động đồng bộ (Real-time).");
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("Lỗi khi đồng bộ:", error);
    process.exit(1);
  }
}

syncAllData();
