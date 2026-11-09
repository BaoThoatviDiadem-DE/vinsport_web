const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const {
  getAllVouchers,
  getVoucherByCode,
  saveVoucher,
} = require("../src/utils/dynamoService");

async function main() {
  const args = process.argv.slice(2);
  const codeArg = args[0] ? args[0].toUpperCase().trim() : null;
  const limitArg = args[1] ? Number(args[1]) : null;

  console.log("=========================================================================");
  console.log("⚡  VINSPORT: QUẢN LÝ SỐ LẦN ÁP DỤNG VOUCHER (AMAZON DYNAMODB)");
  console.log("=========================================================================\n");

  if (!codeArg || isNaN(limitArg) || limitArg <= 0) {
    console.log("📌 HƯỚNG DẪN SỬ DỤNG:");
    console.log("   node backend/scripts/update_voucher_limit.js <MÃ_VOUCHER> <SỐ_LẦN_TỐI_ĐA>");
    console.log("   Ví dụ: node backend/scripts/update_voucher_limit.js VINSPORT10 3");
    console.log("          node backend/scripts/update_voucher_limit.js FREESHIP 5\n");
    console.log("📋 DANH SÁCH MÃ VOUCHER HIỆN TẠI:");

    try {
      const vouchers = await getAllVouchers();
      vouchers.forEach((v) => {
        const usageCount = v.usages ? Object.keys(v.usages).length : 0;
        console.log(`   - Mã: [${v.code.padEnd(12)}] | Tối đa/Tài khoản: ${String(v.maxUsagePerUser || 1).padEnd(2)} lần | Số tài khoản đã dùng: ${usageCount} | ${v.description}`);
      });
    } catch (e) {
      console.error("Lỗi khi đọc danh sách:", e.message);
    }

    console.log("\n=========================================================================");
    process.exit(0);
  }

  try {
    const voucher = await getVoucherByCode(codeArg);
    if (!voucher) {
      console.error(`❌ Không tìm thấy mã voucher "${codeArg}" trong hệ thống!`);
      process.exit(1);
    }

    const oldLimit = voucher.maxUsagePerUser || 1;
    voucher.maxUsagePerUser = limitArg;

    await saveVoucher(voucher);

    console.log(`✅ CẬP NHẬT THÀNH CÔNG CHO MÃ "${codeArg}":`);
    console.log(`   - Giới hạn cũ : ${oldLimit} lần / tài khoản`);
    console.log(`   - Giới hạn mới: ${limitArg} lần / tài khoản`);
    console.log(`   - Mô tả       : ${voucher.description}`);
    console.log(`\n🎉 Mã đã sẵn sàng áp dụng tối đa ${limitArg} lần cho mỗi khách hàng!`);
    console.log("=========================================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Lỗi khi cập nhật voucher:", err.message);
    process.exit(1);
  }
}

main();

