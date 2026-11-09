import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  KeyRound,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { isValidVietnamesePhone } from "../utils/phoneValidator";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile, verifyEmailOtp, resendEmailOtp, refreshProfile } = useAuth();

  // Chế độ: "FORM" (nhập thông tin) hoặc "OTP_VERIFY" (popup nhỏ điền OTP đổi email)
  const [step, setStep] = useState<"FORM" | "OTP_VERIFY">("FORM");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Trạng thái xác thực OTP đổi email
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const prevIsOpenRef = useRef(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Khởi tạo và tự động làm mới quyền hạn/thông tin từ CSDL khi mở modal
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (user) {
        setName(user.name || "");
        setEmail(user.email || "");
        setPhone(user.phone || "");
        setAddress(user.address || "");
      }
      setPendingEmail("");
      setOtp("");
      setStep("FORM");
      setFormError("");

      // Luôn đồng bộ dữ liệu mới nhất từ CSDL SQL Server
      refreshProfile().then((fresh) => {
        if (fresh) {
          setName(fresh.name || "");
          setEmail(fresh.email || "");
          setPhone(fresh.phone || "");
          setAddress(fresh.address || "");
        }
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, user, refreshProfile]);

  // Tự động focus vào ô OTP khi chuyển sang popup nhỏ OTP_VERIFY
  useEffect(() => {
    if (step === "OTP_VERIFY") {
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 50);
    }
  }, [step]);

  // Bộ đếm ngược thời gian gửi lại mã OTP (60 giây)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "OTP_VERIFY" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Đóng modal khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  // BƯỚC 1: Xử lý submit form cập nhật thông tin
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setFormError("Họ và tên không được để trống");
      return;
    }

    if (!cleanEmail) {
      setFormError("Email không được để trống");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError("Định dạng email không hợp lệ");
      return;
    }

    if (phone.trim() && !isValidVietnamesePhone(phone)) {
      setFormError("Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 số di động của nhà mạng Việt Nam (03x, 05x, 07x, 08x, 09x).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res: any = await updateProfile({
        name: cleanName,
        email: cleanEmail,
        phone: phone.trim(),
        address: address.trim(),
      });

      // Nếu có đổi email -> Chuyển ngay sang popup nhỏ điền OTP
      if (res?.requireEmailOtp) {
        setPendingEmail(res.pendingEmail || cleanEmail);
        setStep("OTP_VERIFY");
        setOtp("");
        setCountdown(60);
        setCanResend(false);
      } else {
        // Cập nhật xong (không đổi email) -> đóng modal
        onClose();
      }
    } catch (err: any) {
      setFormError(err?.message || "Cập nhật thông tin thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  // BƯỚC 2: Xử lý submit mã OTP trong popup nhỏ
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setFormError("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }

    if (cleanOtp.length < 6) {
      setFormError("Mã OTP phải có đầy đủ 6 chữ số");
      return;
    }

    setIsSubmitting(true);
    try {
      await verifyEmailOtp(cleanOtp, pendingEmail);
      // Xác thực thành công -> đóng popup
      onClose();
    } catch (err: any) {
      setFormError(err?.message || "Mã xác thực không chính xác hoặc đã hết hạn");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!canResend || isSubmitting) return;
    setIsSubmitting(true);
    setFormError("");
    try {
      await resendEmailOtp(pendingEmail);
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      setFormError(err?.message || "Không thể gửi lại mã OTP");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      aria-modal="true"
      role="dialog"
    >
      {/* =========================================================================
          TRƯỜNG HỢP 1: BIỂU MẪU CẬP NHẬT THÔNG TIN CÁ NHÂN (max-w-lg)
         ========================================================================= */}
      {step === "FORM" && (
        <div
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Biểu mẫu */}
          <div className="relative px-6 py-5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
                <UserIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Cập nhật thông tin cá nhân
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Thông báo lỗi nếu có */}
          {formError && (
            <div className="mx-6 mt-4 p-3.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
            {/* Vai trò tài khoản */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium">
                Vai trò hệ thống:
              </span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    user?.role === "admin" ? "text-orange-600" : "text-blue-600"
                  }`}
                />
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                    user?.role === "admin"
                      ? "bg-orange-100 text-orange-700 border border-orange-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                  }`}
                >
                  {user?.role === "admin"
                    ? "Quản trị viên (Admin)"
                    : "Khách hàng (User)"}
                </span>
              </div>
            </div>

            {/* Trường Họ và tên */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Họ và tên</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Trường Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Địa chỉ Email</span>
                <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tenban@gmail.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Trường Số điện thoại */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Số điện thoại</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ví dụ: 0912345678"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Trường Địa chỉ */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Địa chỉ</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
              />
            </div>

            {/* Nút thao tác */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <span>Cập nhật</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          TRƯỜNG HỢP 2: POPUP NHỎ ĐIỀN MÃ OTP (max-w-sm - GỌN GÀNG, NHỎ XINH)
         ========================================================================= */}
      {step === "OTP_VERIFY" && (
        <div
          className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Popup nhỏ */}
          <div className="px-5 py-4 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shadow-orange-500/30">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Xác nhận mã OTP
                </h3>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form điền mã OTP */}
          <form onSubmit={handleOtpSubmit} className="p-5 space-y-4">
            {/* Thông báo lỗi nếu có */}
            {formError && (
              <div className="p-2.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            {/* Email nhận mã */}
            <div className="text-center space-y-1">
              <p className="text-xs text-slate-500">Mã xác thực 6 số đã gửi tới hòm thư:</p>
              <span className="inline-block px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 font-semibold text-xs rounded-full max-w-[280px] truncate">
                {pendingEmail}
              </span>
            </div>

            {/* Ô nhập mã OTP 6 số */}
            <div className="space-y-1.5">
              <input
                ref={otpInputRef}
                type="text"
                maxLength={6}
                autoFocus
                required
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setOtp(val);
                }}
                placeholder="••••••"
                className="w-full text-center tracking-[10px] text-2xl font-black py-2.5 px-3 bg-slate-50 border-2 border-orange-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 focus:bg-white text-slate-900 transition-all font-mono placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-300"
              />
            </div>

            {/* Đếm ngược và Gửi lại mã */}
            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Chưa nhận được mã?</span>
              {countdown > 0 ? (
                <span className="font-semibold text-orange-600">
                  Gửi lại ({countdown}s)
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isSubmitting}
                  className="font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer disabled:opacity-50"
                >
                  Gửi lại mã
                </button>
              )}
            </div>

            {/* Nút hành động */}
            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="submit"
                disabled={isSubmitting || otp.trim().length < 6}
                className="flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang kiểm tra...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Xác nhận</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
