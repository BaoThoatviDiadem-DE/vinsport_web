import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import {
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  ShoppingBag,
  Zap,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { formatPrice } from "../data/mockData";
import api from "../api/api";
import toast from "react-hot-toast";

export const Cart = () => {
  const { items, updateQuantity, removeFromCart, totalPrice } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Trạng thái mã giảm giá xử lý bằng AWS Lambda Serverless
  const [voucherInput, setVoucherInput] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoResult, setPromoResult] = useState<any>(null);
  const [promoError, setPromoError] = useState("");

  // Khôi phục mã giảm giá đã lưu nếu có
  useEffect(() => {
    try {
      const savedPromo = localStorage.getItem("vinsport_lambda_promo");
      if (savedPromo) {
        setPromoResult(JSON.parse(savedPromo));
      }
    } catch (_) {}
  }, []);

  // Tự động tính toán lại khi tổng tiền giỏ hàng thay đổi
  useEffect(() => {
    if (promoResult && promoResult.appliedVoucher?.code) {
      handleApplyVoucher(promoResult.appliedVoucher.code, false);
    }
  }, [totalPrice]);

  const handleApplyVoucher = async (codeToUse?: string, showToast = true) => {
    const code = String(codeToUse || voucherInput).trim().toUpperCase();
    if (!code) {
      setPromoError("Vui lòng nhập mã giảm giá");
      return;
    }

    setIsApplyingPromo(true);
    setPromoError("");

    try {
      const res: any = await api.post("/lambda/promotion", {
        voucherCode: code,
        subtotal: totalPrice,
        items: items.map((it) => ({
          id: it.product.id,
          name: it.product.name,
          price: it.product.price,
          quantity: it.quantity,
        })),
        userId: user?.id || user?.user_id,
      });

      if (res && res.success) {
        setPromoResult(res);
        localStorage.setItem("vinsport_lambda_promo", JSON.stringify(res));
        if (showToast) {
          toast.success(res.message || "Áp dụng mã giảm giá thành công!");
        }
      } else {
        setPromoError(res?.message || "Mã giảm giá không hợp lệ");
        if (showToast) toast.error(res?.message || "Không thể áp dụng mã");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Không thể áp dụng mã giảm giá";
      setPromoError(msg);
      if (showToast) toast.error(msg);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const handleRemoveVoucher = () => {
    setPromoResult(null);
    setVoucherInput("");
    setPromoError("");
    localStorage.removeItem("vinsport_lambda_promo");
    toast.success("Đã hủy áp dụng mã giảm giá");
  };

  const finalCartTotal = promoResult ? promoResult.finalAmount : totalPrice;

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/login");
    } else {
      navigate("/checkout");
    }
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-slate-100 rounded-full text-slate-400 mb-6">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">Giỏ hàng của bạn đang trống</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          Bạn chưa có sản phẩm nào trong giỏ hàng. Hãy tham khảo thêm các sản phẩm tại cửa hàng nhé.
        </p>
        <Link
          to="/products"
          className="inline-flex items-center gap-2 bg-orange-600 text-white font-bold py-4 px-8 rounded-full hover:bg-orange-700 transition-colors"
        >
          Tiếp tục mua sắm <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-black text-slate-900 mb-8">Giỏ Hàng</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Cart Items List */}
        <div className="flex-grow">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-6 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm">
              <div className="col-span-6">Sản phẩm</div>
              <div className="col-span-2 text-center">Đơn giá</div>
              <div className="col-span-2 text-center">Số lượng</div>
              <div className="col-span-2 text-right">Thành tiền</div>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-100">
              {items.map((item) => (
                <div key={`${item.product.id}-${item.selectedSize}-${item.selectedColor}`} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Product Info */}
                    <div className="col-span-1 md:col-span-6 flex gap-4">
                      <div className="w-24 h-24 bg-slate-50 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col justify-center">
                        <Link to={`/product/${item.product.id}`} className="font-bold text-slate-900 hover:text-orange-600 line-clamp-2 mb-1">
                          {item.product.name}
                        </Link>
                        <span className="text-sm text-slate-500 mb-2">
                          Size: {item.selectedSize} {item.selectedColor && item.selectedColor !== "Mặc định" ? `| Màu: ${item.selectedColor}` : ""} | {item.product.brand}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.selectedSize, item.selectedColor)}
                          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600 w-fit cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" /> Xóa
                        </button>
                      </div>
                    </div>

                    {/* Price (Mobile & Desktop) */}
                    <div className="col-span-1 md:col-span-2 text-left md:text-center font-medium">
                      <span className="md:hidden text-slate-500 mr-2">Đơn giá:</span>
                      {formatPrice(item.product.price)}
                    </div>

                    {/* Quantity */}
                    <div className="col-span-1 md:col-span-2 flex justify-start md:justify-center">
                      <div className="inline-flex items-center border border-slate-200 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-l-lg transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="w-10 h-8 flex items-center justify-center font-bold text-sm border-x border-slate-200">
                          {item.quantity}
                        </div>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.selectedSize, item.selectedColor, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-r-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Subtotal */}
                    <div className="col-span-1 md:col-span-2 text-left md:text-right font-bold text-orange-600">
                      <span className="md:hidden text-slate-500 font-normal mr-2">Thành tiền:</span>
                      {formatPrice(item.product.price * item.quantity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary & AWS Lambda Promotion Engine */}
        <div className="w-full lg:w-96 flex-shrink-0 space-y-6">
          {/* Card Mã giảm giá */}
          <div className="bg-gradient-to-br from-white to-amber-50/50 rounded-2xl shadow-sm border border-amber-200/80 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center text-white shadow-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Mã ưu đãi</h3>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  placeholder="Nhập mã (VINSPORT10, ...)"
                  className="flex-1 px-3 py-2 text-xs uppercase font-mono font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => handleApplyVoucher()}
                  disabled={isApplyingPromo || !voucherInput.trim()}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                >
                  {isApplyingPromo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Áp dụng"
                  )}
                </button>
              </div>

              {promoError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {promoError}
                </p>
              )}

              {/* Các mã gợi ý sẵn */}
              <div className="pt-2">
                <p className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-1">
                  <Ticket className="w-3 h-3 text-orange-500" /> Mã ưu đãi có sẵn:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["VINSPORT10", "LAMBDA50K", "FREESHIP"].map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        setVoucherInput(code);
                        handleApplyVoucher(code);
                      }}
                      className="px-2 py-1 text-[10px] font-mono font-bold bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 rounded-lg transition-colors cursor-pointer"
                    >
                      +{code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Kết quả áp dụng */}
              {promoResult && promoResult.appliedVoucher && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1 font-bold text-emerald-900">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{promoResult.appliedVoucher.code}</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      {promoResult.appliedVoucher.description}
                    </p>
                  </div>
                  <button
                    onClick={handleRemoveVoucher}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md cursor-pointer"
                    title="Xóa mã"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Card Tổng đơn hàng */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Tổng đơn hàng</h2>

            <div className="space-y-4 text-slate-600 mb-6 text-sm">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span className="font-medium">{formatPrice(totalPrice)}</span>
              </div>

              {promoResult && promoResult.voucherDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Giảm giá Voucher</span>
                  <span>-{formatPrice(promoResult.voucherDiscount)}</span>
                </div>
              )}

              {promoResult && promoResult.tierDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Ưu đãi bậc đơn hàng</span>
                  <span>-{formatPrice(promoResult.tierDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Phí vận chuyển</span>
                <span className="font-medium text-emerald-600">
                  {promoResult && promoResult.shippingFee > 0
                    ? formatPrice(promoResult.shippingFee)
                    : "Miễn phí"}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 mb-8">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900">Tổng thanh toán</span>
                <span className="text-2xl font-black text-orange-600">
                  {formatPrice(finalCartTotal)}
                </span>
              </div>
              <p className="text-xs text-slate-500 text-right mt-1">
                {promoResult
                  ? `(Đã tiết kiệm được ${formatPrice(promoResult.totalDiscount)})`
                  : "(Đã bao gồm VAT nếu có)"}
              </p>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 cursor-pointer"
            >
              Tiến hành thanh toán <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
