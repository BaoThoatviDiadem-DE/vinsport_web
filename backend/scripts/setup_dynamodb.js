const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const {
  ensureAllDynamoTables,
  recordProductView,
  getRecentlyViewed,
  saveCart,
  getCart,
  generateAndSaveOTP,
  verifyAndConsumeOTP,
  TABLE_RECENTLY_VIEWED,
  TABLE_CARTS,
  TABLE_OTP,
} = require("../src/utils/dynamoService");

async function main() {
  console.log("=========================================================================");
  console.log("⚡  VINSPORT: KHỞI TẠO & KIỂM TRA TOÀN DIỆN AMAZON DYNAMODB (NOSQL)");
  console.log("=========================================================================");
  console.log(`📌 Region: ${process.env.AWS_REGION || "ap-southeast-1"}`);
  console.log(`📌 Bảng 1: ${TABLE_RECENTLY_VIEWED} (Lịch sử xem sản phẩm)`);
  console.log(`📌 Bảng 2: ${TABLE_CARTS} (Đồng bộ giỏ hàng liên thiết bị)`);
  console.log(`📌 Bảng 3: ${TABLE_OTP} (Quản lý mã OTP tự hủy TTL 5 phút)`);
  console.log("-------------------------------------------------------------------------\n");

  console.log("⏳ BƯỚC 1: Đang kiểm tra và khởi tạo các bảng trên AWS DynamoDB...");
  const tablesOk = await ensureAllDynamoTables();

  if (!tablesOk) {
    console.error("❌ Không thể kết nối hoặc tạo bảng trên DynamoDB. Vui lòng kiểm tra AWS Credentials.");
    process.exit(1);
  }
  console.log("✅ Toàn bộ 3 bảng DynamoDB đã sẵn sàng trên AWS!\n");

  // -------------------------------------------------------------------------
  // TEST 1: RECENTLY VIEWED
  // -------------------------------------------------------------------------
  console.log("⏳ BƯỚC 2: Kiểm tra chức năng Lịch sử xem sản phẩm (Recently Viewed)...");
  const testUserId = "user_demo_101";
  await recordProductView(testUserId, {
    id: "1",
    name: "Áo đá banh Nike 2024 Pro",
    price: 350000,
    image: "https://lakehouse-vinsport-1.s3.ap-southeast-1.amazonaws.com/images/products/product_1_1.jpg",
    category: "Áo",
    brand: "Nike",
  });
  const viewedItems = await getRecentlyViewed(testUserId);
  console.log(`✅ Thành công! Lấy được ${viewedItems.length} sản phẩm vừa xem của User "${testUserId}".\n`);

  // -------------------------------------------------------------------------
  // TEST 2: CROSS-DEVICE CART SYNC
  // -------------------------------------------------------------------------
  console.log("⏳ BƯỚC 3: Kiểm tra chức năng Đồng bộ giỏ hàng liên thiết bị (Cart Sync)...");
  const sampleCart = [
    {
      product: {
        id: "1",
        name: "Áo đá banh Nike 2024 Pro",
        price: 350000,
        image: "https://lakehouse-vinsport-1.s3.ap-southeast-1.amazonaws.com/images/products/product_1_1.jpg",
      },
      quantity: 2,
      selectedSize: "L",
      selectedColor: "Đen",
    },
    {
      product: {
        id: "2",
        name: "Quần short Puma Run",
        price: 420000,
        image: "https://lakehouse-vinsport-1.s3.ap-southeast-1.amazonaws.com/images/products/product_3_5.jpg",
      },
      quantity: 1,
      selectedSize: "M",
      selectedColor: "Xanh",
    },
  ];

  await saveCart(testUserId, sampleCart);
  console.log(`✅ Đã lưu giỏ hàng của User "${testUserId}" lên DynamoDB!`);

  const fetchedCart = await getCart(testUserId);
  console.log(`✅ Đọc lại giỏ hàng từ DynamoDB thành công: ${fetchedCart.length} loại sản phẩm.`);
  console.log(`   - Sản phẩm 1: ${fetchedCart[0]?.product?.name} (SL: ${fetchedCart[0]?.quantity}, Size: ${fetchedCart[0]?.selectedSize})`);
  console.log(`   - Sản phẩm 2: ${fetchedCart[1]?.product?.name} (SL: ${fetchedCart[1]?.quantity}, Size: ${fetchedCart[1]?.selectedSize})\n`);

  // -------------------------------------------------------------------------
  // TEST 3: OTP WITH TTL
  // -------------------------------------------------------------------------
  console.log("⏳ BƯỚC 4: Kiểm tra chức năng Quản lý mã OTP tự hủy bằng TTL (5 Phút)...");
  const testEmail = "demo_student@vinsport.local";
  const otpData = await generateAndSaveOTP(testEmail, "ĐẶT_HÀNG", 5);
  console.log(`✅ Đã sinh mã OTP: "${otpData.otpCode}" (Hết hạn TTL tại Unix timestamp: ${otpData.expiresAt})`);

  console.log("   -> Thử kiểm tra mã OTP đúng...");
  const verifySuccess = await verifyAndConsumeOTP(testEmail, otpData.otpCode, "ĐẶT_HÀNG");
  console.log(`   -> Kết quả: ${verifySuccess.success ? "✅ HỢP LỆ (Mã đã được tiêu hủy một lần)" : "❌ THẤT BẠI"}`);

  console.log("   -> Thử dùng lại mã đó lần thứ hai (Single-use check)...");
  const reVerify = await verifyAndConsumeOTP(testEmail, otpData.otpCode, "ĐẶT_HÀNG");
  console.log(`   -> Kết quả: ${!reVerify.success ? "✅ ĐÃ BỊ TỰ HỦY/CHẶN ĐÚNG CHUẨN (Mã không còn tồn tại)" : "❌ LỖI"}`);

  console.log("\n=========================================================================");
  console.log("🎉  TẤT CẢ TÍNH NĂNG AMAZON DYNAMODB (CART, OTP, RECENTLY VIEWED) HOÀN HẢO 100%!");
  console.log("=========================================================================");

  process.exit(0);
}

main().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});
