/**
 * Kiểm tra định dạng số điện thoại di động Việt Nam chuẩn
 * - Đúng 10 chữ số
 * - Bắt đầu bằng 03, 05, 07, 08, 09 (hoặc +84)
 * - Không phải chuỗi số lặp vô nghĩa (ví dụ 0000000000, 0999999999)
 */
export function isValidVietnamesePhone(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = String(phone).trim().replace(/[\s\-\.]/g, "");

  // Chuẩn hóa +84 hoặc 84 về đầu 0
  let normalized = cleanPhone;
  if (normalized.startsWith("+84")) {
    normalized = "0" + normalized.slice(3);
  } else if (normalized.startsWith("84") && normalized.length === 11) {
    normalized = "0" + normalized.slice(2);
  }

  // Regex kiểm tra đúng 10 số với đầu số các nhà mạng VN (Viettel, Vina, Mobi, Vietnamobile, Wintel, Itelecom)
  const vnPhoneRegex = /^(03[2-9]|05[25689]|07[06-9]|08[1-9]|09[0-46-9])[0-9]{7}$/;
  if (!vnPhoneRegex.test(normalized)) {
    return false;
  }

  // Kiểm tra chống số ảo lặp (ví dụ 0999999999, 0888888888)
  const digitsOnly = normalized.slice(2);
  if (/^(\d)\1+$/.test(digitsOnly)) {
    return false;
  }

  return true;
}

