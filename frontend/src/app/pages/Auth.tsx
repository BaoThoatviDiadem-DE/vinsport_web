import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Package,
  Mail,
  Lock,
  User as UserIcon,
  Phone,
  KeyRound,
  Loader2,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

export const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isOtpStep, setIsOtpStep] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const navigate = useNavigate();
  const {
    loginDirect,
    registerDirect,
    confirmDirect,
    resendCodeDirect,
    loginWithCognitoUI,
    isAuthenticated,
  } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  // Xử lý Đăng nhập / Đăng ký
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      if (isLogin) {
        // Đăng nhập trực tiếp trên web VinSport
        await loginDirect(cleanEmail, password);
      } else {
        // Đăng ký tài khoản ngầm qua Cognito -> gửi mã xác thực về Gmail
        await registerDirect({ name: name.trim(), email: cleanEmail, password, phone: phone.trim() });
        toast.success("Mã xác thực OTP đã được gửi đến email của bạn!");
        setIsOtpStep(true);
      }
    } catch (err: any) {
      // Nếu tài khoản chưa xác nhận OTP -> chuyển thẳng sang màn hình OTP
      if (err?.requireConfirm) {
        setIsOtpStep(true);
        toast.error(err.message || "Vui lòng nhập mã OTP để kích hoạt tài khoản.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý Xác nhận mã OTP
  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      toast.error("Vui lòng nhập đầy đủ mã OTP 6 số!");
      return;
    }

    setIsSubmitting(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      await confirmDirect({
        email: cleanEmail,
        code: otpCode.trim(),
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      // Sau khi xác nhận thành công, AuthContext sẽ tự lưu user và useEffect chuyển về "/"
    } catch (err: any) {
      console.error("Lỗi xác nhận mã:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    setIsResending(true);
    try {
      await resendCodeDirect(email);
    } catch (err: any) {
      console.error("Lỗi gửi lại mã:", err);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Header VinSport */}
        <div className="bg-slate-900 p-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-3xl font-black text-white italic mb-2"
          >
            <Package className="w-8 h-8 text-orange-500" />
            VinSport
          </Link>
          <p className="text-slate-400">Nền tảng mua sắm thể thao hàng đầu</p>
        </div>

        <div className="p-8">
          {/* MÀN HÌNH NHẬP MÃ OTP KÍCH HOẠT */}
          {isOtpStep ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <KeyRound className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  Xác thực tài khoản
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Mã OTP 6 số đã được Cognito gửi tới:
                </p>
                <p className="text-sm font-semibold text-orange-600 bg-orange-50 py-1 px-3 rounded-full inline-block mt-1">
                  {email}
                </p>
              </div>

              <form onSubmit={handleConfirmOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                    Nhập mã xác thực (6 chữ số)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    className="block w-full py-3.5 px-4 text-center tracking-[0.5em] font-mono text-2xl font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all bg-slate-50 focus:bg-white"
                    placeholder="••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || otpCode.length < 6}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xác nhận mã...
                    </>
                  ) : (
                    "Kích Hoạt & Đăng Nhập Ngay"
                  )}
                </button>
              </form>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isResending}
                  className="text-orange-600 hover:text-orange-700 font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                  Gửi lại mã OTP
                </button>

                <button
                  type="button"
                  onClick={() => setIsOtpStep(false)}
                  className="text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Thay đổi email
                </button>
              </div>
            </div>
          ) : (
            /* MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ TRỰC TIẾP TRÊN WEB */
            <>
              {/* Tab chuyển đổi Đăng Nhập / Đăng Ký */}
              <div className="flex rounded-xl bg-slate-100 p-1 mb-8">
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    isLogin
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setIsLogin(true)}
                >
                  Đăng Nhập
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    !isLogin
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setIsLogin(false)}
                >
                  Đăng Ký
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Họ tên (chỉ khi đăng ký) */}
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Họ và tên
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <UserIcon className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors bg-slate-50 focus:bg-white text-sm"
                        placeholder="Nguyễn Văn A"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-5 w-5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value.toLowerCase())}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors bg-slate-50 focus:bg-white text-sm"
                      placeholder="you@gmail.com"
                    />
                  </div>
                </div>

                {/* Số điện thoại (chỉ khi đăng ký) */}
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Số điện thoại (tùy chọn)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Phone className="h-5 w-5" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors bg-slate-50 focus:bg-white text-sm"
                        placeholder="+84901234567"
                      />
                    </div>
                  </div>
                )}

                {/* Mật khẩu */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700">
                      Mật khẩu
                    </label>
                    {!isLogin && (
                      <span className="text-[11px] text-slate-400">
                        Ít nhất 8 ký tự (hoa, thường, số, ký tự đặc biệt)
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-5 w-5" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-colors bg-slate-50 focus:bg-white text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Nút gửi form trực tiếp */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : isLogin ? (
                    "Đăng Nhập Ngay"
                  ) : (
                    "Đăng Ký & Nhận Mã OTP"
                  )}
                </button>
              </form>

              {/* Đường kẻ phân cách */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">
                    Hoặc đăng nhập với
                  </span>
                </div>
              </div>

              {/* Nút Đăng nhập qua Cognito Hosted UI */}
              <button
                type="button"
                onClick={loginWithCognitoUI}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <span>Amazon Cognito Hosted UI (Google / SSO)</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
