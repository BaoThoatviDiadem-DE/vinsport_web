/**
 * VINSPORT - TỰ ĐỘNG ĐỒNG BỘ ẢNH SẢN PHẨM TỪ SQL SERVER LÊN AMAZON S3 & CLOUDFRONT CDN
 * 
 * Chức năng:
 * 1. Đọc toàn bộ ảnh sản phẩm hiện có trong bảng ProductImages của SQL Server.
 * 2. Tự động tải ảnh từ các link bên ngoài (Unsplash, Adidas, Puma, v.v.).
 * 3. Tự động đẩy file ảnh lên Amazon S3 (thư mục: images/products/product_X_Y.jpg).
 * 4. Tự động cập nhật đường dẫn trong Database thành domain CloudFront (hoặc link S3 trực tiếp nếu chưa có CloudFront).
 * 5. Bỏ qua các ảnh đã được đồng bộ để tránh tải lại.
 * 
 * Cách chạy:
 *   node scripts/sync_images_to_s3.js
 *   hoặc chỉ định tên miền CloudFront:
 *   node scripts/sync_images_to_s3.js --cloudfront d1234xxxx.cloudfront.net
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { sql, poolPromise } = require("../src/db");

// 1. Đọc cấu hình
const BUCKET_NAME = (process.env.AWS_BUCKET_NAME || "").trim();
const AWS_REGION = (process.env.AWS_REGION || "ap-southeast-1").trim();
const ACCESS_KEY = (process.env.AWS_ACCESS_KEY_ID || "").trim();
const SECRET_KEY = (process.env.AWS_SECRET_ACCESS_KEY || "").trim();

// Kiểm tra tham số CLI --cloudfront nếu người dùng truyền trực tiếp
let CLOUDFRONT_DOMAIN = (process.env.AWS_CLOUDFRONT_DOMAIN || "").trim();
const cfArgIndex = process.argv.indexOf("--cloudfront");
if (cfArgIndex !== -1 && process.argv[cfArgIndex + 1]) {
  CLOUDFRONT_DOMAIN = process.argv[cfArgIndex + 1].trim();
}
CLOUDFRONT_DOMAIN = CLOUDFRONT_DOMAIN.replace(/^https?:\/\//i, "").replace(/\/$/, "");

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error("❌ Lỗi: Chưa cấu hình AWS_ACCESS_KEY_ID hoặc AWS_SECRET_ACCESS_KEY trong file .env!");
  process.exit(1);
}

if (!BUCKET_NAME) {
  console.error("❌ Lỗi: Chưa cấu hình AWS_BUCKET_NAME trong file .env!");
  process.exit(1);
}

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

function getExtensionFromUrlOrType(url, contentType) {
  const type = (contentType || "").toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  if (type.includes("svg")) return "svg";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";

  // Thử đoán qua URL
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".png")) return "png";
  if (cleanUrl.endsWith(".webp")) return "webp";
  if (cleanUrl.endsWith(".gif")) return "gif";
  if (cleanUrl.endsWith(".svg")) return "svg";
  return "jpg";
}

async function syncAllImages() {
  console.log("=====================================================================");
  console.log("⚡  VINSPORT: TỰ ĐỘNG ĐỒNG BỘ ẢNH SẢN PHẨM LÊN AMAZON S3 & CLOUDFRONT");
  console.log("=====================================================================");
  console.log(`📦 Bucket S3:         ${BUCKET_NAME} (${AWS_REGION})`);
  console.log(`🌐 CloudFront Domain:  ${CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}` : "(Chưa có -> Dùng link S3 trực tiếp)"}`);
  console.log("---------------------------------------------------------------------\n");

  let pool;
  try {
    pool = await poolPromise;
  } catch (err) {
    console.error("❌ Không thể kết nối SQL Server:", err.message);
    process.exit(1);
  }

  // Lấy toàn bộ ảnh trong ProductImages
  console.log("🔍 Đang đọc danh sách ảnh từ cơ sở dữ liệu...");
  const queryResult = await pool.request().query(`
    SELECT pi.image_id, pi.product_id, pi.image_url, p.name AS product_name
    FROM ProductImages pi
    LEFT JOIN Products p ON pi.product_id = p.product_id
    WHERE pi.image_url IS NOT NULL AND LTRIM(RTRIM(pi.image_url)) <> ''
    ORDER BY pi.product_id ASC, pi.image_id ASC
  `);

  const images = queryResult.recordset;
  console.log(`📊 Tìm thấy tổng cộng: ${images.length} ảnh trong database.\n`);

  if (images.length === 0) {
    console.log("ℹ️ Không có ảnh nào cần xử lý. Kết thúc.");
    process.exit(0);
  }

  let countSuccess = 0;
  let countSkipped = 0;
  let countUpdatedDomainOnly = 0;
  let countFailed = 0;

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const { image_id, product_id, image_url, product_name } = item;
    const progress = `[${i + 1}/${images.length}]`;

    // 1. Trường hợp: Ảnh đã ở trên S3 hoặc CloudFront
    const isAlreadyOnS3 = image_url.includes(BUCKET_NAME);
    const isAlreadyOnCurrentCF = CLOUDFRONT_DOMAIN && image_url.includes(CLOUDFRONT_DOMAIN);

    // Nếu đã ở CloudFront hiện tại thì bỏ qua luôn
    if (isAlreadyOnCurrentCF) {
      console.log(`⏩ ${progress} SP #${product_id} (${product_name || "SP"}): Đã ở CloudFront, bỏ qua.`);
      countSkipped++;
      continue;
    }

    // Nếu ảnh đã ở S3 và bây giờ có CloudFront mới -> Chỉ cần UPDATE lại URL sang CloudFront, không cần tải lại file!
    if (isAlreadyOnS3 && CLOUDFRONT_DOMAIN) {
      const pathMatch = image_url.match(/images\/products\/[^\s?#]+/);
      if (pathMatch) {
        const s3Key = pathMatch[0];
        const newCfUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
        await pool.request()
          .input("imgId", sql.Int, image_id)
          .input("newUrl", sql.NVarChar, newCfUrl)
          .query("UPDATE ProductImages SET image_url = @newUrl WHERE image_id = @imgId");

        console.log(`🔄 ${progress} SP #${product_id}: Cập nhật link sang CloudFront mới -> ${newCfUrl}`);
        countUpdatedDomainOnly++;
        continue;
      }
    }

    // Nếu đã ở S3 và chưa có CloudFront -> đã sẵn sàng trên S3
    if (isAlreadyOnS3 && !CLOUDFRONT_DOMAIN) {
      console.log(`⏩ ${progress} SP #${product_id}: Đã ở trên S3 (${image_url}), bỏ qua.`);
      countSkipped++;
      continue;
    }

    // 2. Trường hợp: Link bên ngoài -> Tải về và đẩy lên S3
    if (!image_url.startsWith("http://") && !image_url.startsWith("https://")) {
      console.log(`⚠️ ${progress} SP #${product_id}: Link không hợp lệ (${image_url}), bỏ qua.`);
      countSkipped++;
      continue;
    }

    try {
      console.log(`⏳ ${progress} Đang tải SP #${product_id} (${product_name || "SP"})...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(image_url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const ext = getExtensionFromUrlOrType(image_url, contentType);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Đặt tên file gọn gàng trên S3
      const s3Key = `images/products/product_${product_id}_${image_id}.${ext}`;

      // Upload lên S3
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      }));

      // Tính toán URL mới
      let targetUrl = "";
      if (CLOUDFRONT_DOMAIN) {
        targetUrl = `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
      } else {
        targetUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
      }

      // Cập nhật lại vào cơ sở dữ liệu SQL Server
      await pool.request()
        .input("imgId", sql.Int, image_id)
        .input("newUrl", sql.NVarChar, targetUrl)
        .query("UPDATE ProductImages SET image_url = @newUrl WHERE image_id = @imgId");

      console.log(`✅ ${progress} SP #${product_id}: Đã đẩy lên S3 -> ${targetUrl}`);
      countSuccess++;

    } catch (err) {
      console.error(`❌ ${progress} SP #${product_id}: Thất bại (${err.message}) - Giữ nguyên link cũ.`);
      countFailed++;
    }
  }

  console.log("\n=====================================================================");
  console.log("🏁  KẾT QUẢ ĐỒNG BỘ ẢNH");
  console.log("=====================================================================");
  console.log(`✨ Thành công đẩy mới lên S3:       ${countSuccess} ảnh`);
  console.log(`🔄 Cập nhật tên miền CloudFront:     ${countUpdatedDomainOnly} ảnh`);
  console.log(`⏩ Đã có sẵn (bỏ qua):              ${countSkipped} ảnh`);
  console.log(`❌ Lỗi (link ngoài hỏng/chết):      ${countFailed} ảnh`);
  console.log("=====================================================================");
  console.log("👉 Dữ liệu trong database đã được cập nhật chuẩn chỉnh!");

  process.exit(0);
}

syncAllImages().catch((err) => {
  console.error("Lỗi không mong muốn trong quá trình đồng bộ:", err);
  process.exit(1);
});

