/**
 * Kiểm tra định dạng số điện thoại di động Việt Nam chuẩn
 * - Đúng 10 chữ số
 * - Bắt đầu bằng 03, 05, 07, 08, 09 (hoặc +84)
 * - Thuộc dải đầu số các nhà mạng chính thức: Viettel, Mobifone, Vinaphone, Vietnamobile, Wintel, Itelecom
 * - Không phải chuỗi số ảo lặp vô nghĩa (ví dụ 0000000000, 0999999999)
 */
function isValidVietnamesePhone(phone) {
  if (!phone) return false;
  const cleanPhone = String(phone).trim().replace(/[\s\-\.]/g, "");

  let normalized = cleanPhone;
  if (normalized.startsWith("+84")) {
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("84") && normalized.length === 11) {
    normalized = "0" + normalized.slice(2);
  }

  const vnPhoneRegex = /^(03[2-9]|05[25689]|07[06-9]|08[1-9]|09[0-46-9])[0-9]{7}$/;
  if (!vnPhoneRegex.test(normalized)) {
    return false;
  }

  const digitsOnly = normalized.slice(2);
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  return true;
}

module.exports = {
  isValidVietnamesePhone,
};

