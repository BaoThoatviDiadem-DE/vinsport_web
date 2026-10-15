import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckCircle2,
  Package,
  MapPin,
  CreditCard,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { formatPrice } from "../data/mockData";
import api from "../api/api";

const BANK_INFO = {
  bankName: "TP Bank",
  bankCode: "tpbank",
  accountNumber: "0867788204",
  accountName: "CHU DUC NHAT MINH",
};

export const Checkout = () => {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isSuccess, setIsSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [paymentSnapshot, setPaymentSnapshot] = useState<{
    amount: number;
    transferContent: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    paymentMethod: "cod",
  });

  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: prev.fullName || user.name || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (items.length === 0 && !isSuccess) {
      navigate("/cart");
    }
  }, [items.length, isSuccess, navigate]);

  const previewOrderCode = useMemo(() => {
    return `VNSP-${Date.now().toString().slice(-6)}`;
  }, []);

  const transferContent = useMemo(() => {
    return paymentSnapshot?.transferContent ?? previewOrderCode;
  }, [paymentSnapshot, previewOrderCode]);

  const qrUrl = useMemo(() => {
    const amount = Math.round(paymentSnapshot?.amount ?? totalPrice ?? 0);
    const encodedAccountName = encodeURIComponent(BANK_INFO.accountName);
    const encodedNote = encodeURIComponent(transferContent);

    return `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedNote}&accountName=${encodedAccountName}`;
  }, [paymentSnapshot, totalPrice, transferContent]);

  const successAmount = paymentSnapshot?.amount ?? totalPrice;
  const successTransferContent =
    paymentSnapshot?.transferContent ?? transferContent;

  const successQrUrl = useMemo(() => {
    const amount = Math.round(paymentSnapshot?.amount ?? totalPrice ?? 0);
    const encodedAccountName = encodeURIComponent(BANK_INFO.accountName);
    const encodedNote = encodeURIComponent(successTransferContent);

    return `https://img.vietqr.io/image/${BANK_INFO.bankCode}-${BANK_INFO.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodedNote}&accountName=${encodedAccountName}`;
  }, [paymentSnapshot, totalPrice, successTransferContent]);

  const copyText = async (value: string, field: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch (error) {
      console.error("Không sao chép được:", error);
      alert("Không sao chép được nội dung.");
    }
  };

  if (items.length === 0 && !isSuccess) {
    return null;
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const snapshot = {
      amount: totalPrice,
      transferContent,
    };
    setPaymentSnapshot(snapshot);

    const orderData = {
      customer: {
        name: formData.fullName,
        phone: formData.phone,
        email: user?.email || "",
        address: `${formData.address}, ${formData.city}`,
      },
      items: items.map((item) => ({
        productId: Number(item.product.id) || item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        size: item.selectedSize,
        color: item.selectedColor,
        price: item.product.price,
      })),
      totalAmount: totalPrice,
      paymentMethod: formData.paymentMethod,
      orderDate: new Date().toISOString(),
    };

    try {
      const response: any = await api.post("/orders", orderData);

      setOrderId(
        String(
          response?.id ||
            response?.orderId ||
            "VS" + Math.floor(Math.random() * 100000)
        )
      );
      setIsSuccess(true);
      clearCart();
    } catch (error: any) {
      console.error("Lỗi tạo đơn hàng:", error);

      if (import.meta.env.VITE_USE_MOCK === "true") {
        setOrderId("VS" + Math.floor(Math.random() * 100000));
        setIsSuccess(true);
        clearCart();
      } else {
        alert(
          error?.message ||
            error?.response?.data?.message ||
            "Lỗi kết nối hệ thống, không thể đặt hàng!"
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 text-center">
          <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Đặt hàng thành công!
          </h1>

          <p className="text-slate-600 mb-8 text-lg">
            Cảm ơn bạn đã mua sắm tại VinSport. Mã đơn hàng của bạn là:
            <span className="font-bold text-orange-600 ml-2">#{orderId}</span>
            <br />
            {formData.paymentMethod === "banking"
              ? "Vui lòng chuyển khoản đúng số tiền và nội dung để chúng tôi xác nhận thanh toán."
              : "Chúng tôi sẽ liên hệ với bạn sớm nhất để xác nhận."}
          </p>

          {formData.paymentMethod === "banking" && (
            <div className="mb-8 rounded-2xl border border-orange-200 bg-orange-50 p-6 text-left">
              <h3 className="text-xl font-bold text-slate-900 mb-4">
                Thông tin chuyển khoản
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-3 text-sm text-slate-700">
                  <p>
                    <strong>Ngân hàng:</strong> {BANK_INFO.bankName}
                  </p>
                  <p>
                    <strong>Số tài khoản:</strong> {BANK_INFO.accountNumber}
                  </p>
                  <p>
                    <strong>Chủ tài khoản:</strong> {BANK_INFO.accountName}
                  </p>
                  <p>
                    <strong>Số tiền:</strong>{" "}
                    <span className="text-orange-600 font-bold">
                      {formatPrice(successAmount)}
                    </span>
                  </p>
                  <p>
                    <strong>Nội dung CK:</strong>{" "}
                    <span className="font-bold">{successTransferContent}</span>
                  </p>
                </div>

                <div className="flex flex-col items-center">
                  <img
                    src={successQrUrl}
                    alt="QR chuyển khoản"
                    className="w-56 h-56 object-contain rounded-xl border bg-white p-2"
                  />
                  <p className="text-xs text-slate-500 mt-3 text-center">
                    Quét mã để chuyển khoản nhanh
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(`/tracking?id=${orderId}`)}
              className="py-3 px-8 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 shadow-md transition-all flex items-center justify-center gap-2"
            >
              Xem & theo dõi đơn hàng #{orderId}
            </button>
            <button
              onClick={() => navigate("/")}
              className="py-3 px-8 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors"
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-black text-slate-900 mb-8">Thanh toán</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-grow order-2 lg:order-1">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <MapPin className="text-orange-600" />
                Thông tin giao hàng
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  required
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Họ và tên *"
                />
                <input
                  required
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Số điện thoại *"
                />
                <select
                  required
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none md:col-span-2"
                >
                  <option value="">Chọn Tỉnh/Thành phố *</option>
                  <option value="Hà Nội">Hà Nội</option>
                  <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                  <option value="Đà Nẵng">Đà Nẵng</option>
                </select>
                <input
                  required
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none md:col-span-2"
                  placeholder="Địa chỉ cụ thể *"
                />
              </div>
            </div>

            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <CreditCard className="text-orange-600" />
                Phương thức thanh toán
              </h2>

              <div className="space-y-3">
                <label
                  className={`block border rounded-xl p-4 cursor-pointer transition-colors ${
                    formData.paymentMethod === "cod"
                      ? "border-orange-600 bg-orange-50"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={formData.paymentMethod === "cod"}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <span className="font-bold block">
                    Thanh toán khi nhận hàng (COD)
                  </span>
                </label>

                <label
                  className={`block border rounded-xl p-4 cursor-pointer transition-colors ${
                    formData.paymentMethod === "banking"
                      ? "border-orange-600 bg-orange-50"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="banking"
                    checked={formData.paymentMethod === "banking"}
                    onChange={handleInputChange}
                    className="hidden"
                  />
                  <span className="font-bold block">Chuyển khoản ngân hàng</span>
                  <span className="text-sm text-slate-500 block mt-1">
                    Quét mã QR hoặc chuyển khoản đúng nội dung để xác nhận thanh
                    toán.
                  </span>
                </label>
              </div>

              {formData.paymentMethod === "banking" && (
                <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Thông tin chuyển khoản
                  </h3>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6 items-start">
                    <div className="space-y-4">
                      <div className="rounded-xl bg-white border p-4">
                        <p className="text-sm text-slate-500 mb-1">Ngân hàng</p>
                        <p className="font-bold text-slate-900">
                          {BANK_INFO.bankName}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-500 mb-1">
                              Số tài khoản
                            </p>
                            <p className="font-bold text-slate-900">
                              {BANK_INFO.accountNumber}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(BANK_INFO.accountNumber, "accountNumber")
                            }
                            className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
                          >
                            {copiedField === "accountNumber" ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                Đã copy
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Sao chép
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border p-4">
                        <p className="text-sm text-slate-500 mb-1">
                          Chủ tài khoản
                        </p>
                        <p className="font-bold text-slate-900">
                          {BANK_INFO.accountName}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-500 mb-1">
                              Số tiền
                            </p>
                            <p className="font-bold text-orange-600 text-lg">
                              {formatPrice(paymentSnapshot?.amount ?? totalPrice)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(
                                String(
                                  Math.round(
                                    paymentSnapshot?.amount ?? totalPrice ?? 0
                                  )
                                ),
                                "amount"
                              )
                            }
                            className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
                          >
                            {copiedField === "amount" ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                Đã copy
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Sao chép
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-slate-500 mb-1">
                              Nội dung chuyển khoản
                            </p>
                            <p className="font-bold text-slate-900 break-all">
                              {transferContent}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(transferContent, "transferContent")
                            }
                            className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm font-medium flex items-center gap-2"
                          >
                            {copiedField === "transferContent" ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                Đã copy
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Sao chép
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white border p-4 flex flex-col items-center">
                      <img
                        src={qrUrl}
                        alt="QR chuyển khoản"
                        className="w-48 h-48 object-contain"
                      />
                      <p className="text-xs text-slate-500 mt-3 text-center leading-relaxed">
                        Quét mã QR để chuyển khoản nhanh
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white font-bold py-4 rounded-xl hover:bg-orange-700 transition-colors text-lg shadow-lg disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xử lý đơn hàng...
                </>
              ) : (
                "Hoàn tất đặt hàng"
              )}
            </button>
          </form>
        </div>

        <div className="w-full lg:w-[400px] flex-shrink-0 order-1 lg:order-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-24">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Package className="text-orange-600" />
              Tóm tắt đơn hàng
            </h2>

            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-16 h-16 bg-slate-50 rounded border flex-shrink-0 overflow-hidden relative">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute -top-2 -right-2 bg-slate-800 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                      {item.quantity}
                    </span>
                  </div>

                  <div className="flex-grow">
                    <h4 className="text-sm font-bold text-slate-800 line-clamp-2">
                      {item.product.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Size: {item.selectedSize} | Màu: {item.selectedColor}
                    </p>
                    <p className="text-sm font-medium text-orange-600">
                      {formatPrice(item.product.price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex justify-between text-slate-600 text-sm">
                <span>Tạm tính</span>
                <span className="font-medium">{formatPrice(totalPrice)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-3">
                <span className="font-bold text-slate-900">Tổng cộng</span>
                <span className="font-black text-2xl text-orange-600">
                  {formatPrice(totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};