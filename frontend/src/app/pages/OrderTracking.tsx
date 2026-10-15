import React, { useState, useEffect } from "react";
import {
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Calendar,
  MapPin,
  CreditCard,
  Ban,
  ArrowRight,
  User,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";
import { Link, useSearchParams, useLocation } from "react-router";
import api from "../api/api";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

interface OrderItem {
  id: number;
  productId: number;
  name: string;
  brand: string;
  size: string;
  color: string;
  hexCode?: string;
  imageUrl?: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface OrderDetail {
  orderId: number;
  orderDate: string;
  orderStatus: string;
  totalAmount: number;
  shippingAddress: string;
  shippingStatus?: string;
  paymentMethod: string;
  paymentStatus: string;
  customer?: {
    id: number;
    name: string;
    phone: string;
    email: string;
  };
  items: OrderItem[];
}

export const OrderTracking = () => {
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Tab: 'my-orders' (nếu đã login) hoặc 'track'
  const [activeTab, setActiveTab] = useState<"my-orders" | "track">(
    isAuthenticated ? "my-orders" : "track"
  );

  // State cho Tra cứu theo mã
  const [searchOrderId, setSearchOrderId] = useState<string>(
    searchParams.get("id") || (location.state as any)?.orderId || ""
  );
  const [searchedOrder, setSearchedOrder] = useState<OrderDetail | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string>("");

  // State cho Danh sách đơn hàng của tôi
  const [myOrders, setMyOrders] = useState<OrderDetail[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State hủy đơn
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);

  // Tải danh sách đơn hàng của tôi khi vào tab my-orders
  const fetchMyOrders = async (showToast = false) => {
    if (!isAuthenticated) return;
    try {
      setLoadingOrders(true);
      const res: any = await api.get("/orders/my-orders");
      if (res?.success && Array.isArray(res?.data)) {
        setMyOrders(res.data);
        if (showToast) {
          toast.success("Đã cập nhật danh sách đơn hàng mới nhất!");
        }
      }
    } catch (err: any) {
      console.error("Lỗi tải đơn hàng:", err);
      if (showToast) {
        toast.error("Không thể tải danh sách đơn hàng");
      }
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === "my-orders" && isAuthenticated) {
      fetchMyOrders();
    }
  }, [activeTab, isAuthenticated]);

  // Tự động tìm kiếm nếu URL có ?id=... hoặc location.state
  useEffect(() => {
    const idFromUrl = searchParams.get("id") || (location.state as any)?.orderId;
    if (idFromUrl) {
      setActiveTab("track");
      setSearchOrderId(String(idFromUrl));
      handleSearchById(String(idFromUrl));
    }
  }, [searchParams, location.state]);

  const handleSearchById = async (idToSearch?: string) => {
    const targetId = (idToSearch || searchOrderId).trim();
    if (!targetId) {
      toast.error("Vui lòng nhập mã đơn hàng");
      return;
    }

    try {
      setIsSearching(true);
      setSearchError("");
      setSearchedOrder(null);

      const res: any = await api.get(`/orders/${targetId}`);
      if (res?.success && res?.data) {
        setSearchedOrder(res.data);
      } else {
        setSearchError(res?.message || "Không tìm thấy đơn hàng");
      }
    } catch (err: any) {
      console.error("Lỗi tra cứu đơn:", err);
      setSearchError(
        err?.response?.data?.message || `Không tìm thấy đơn hàng #${targetId} trong hệ thống.`
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const confirmCancel = window.confirm(
      `Bạn có chắc chắn muốn hủy đơn hàng #${orderId} không? Số lượng sản phẩm sẽ được hoàn lại vào kho.`
    );
    if (!confirmCancel) return;

    try {
      setCancellingOrderId(orderId);
      const res: any = await api.put(`/orders/${orderId}/cancel`);
      if (res?.success) {
        toast.success(res.message || "Hủy đơn hàng thành công!");

        // Cập nhật lại danh sách và đơn tra cứu
        if (searchedOrder && searchedOrder.orderId === orderId) {
          setSearchedOrder({ ...searchedOrder, orderStatus: "Cancelled" });
        }
        if (isAuthenticated) {
          fetchMyOrders();
        }
      }
    } catch (err: any) {
      console.error("Lỗi khi hủy đơn:", err);
      toast.error(err?.response?.data?.message || "Không thể hủy đơn hàng");
    } finally {
      setCancellingOrderId(null);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || "").toLowerCase();
    if (s === "completed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> Giao thành công
        </span>
      );
    }
    if (s === "shipping") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
          <Truck className="w-3.5 h-3.5" /> Đang giao hàng
        </span>
      );
    }
    if (s === "confirmed") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
          <Package className="w-3.5 h-3.5" /> Đã xác nhận
        </span>
      );
    }
    if (s === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
          <XCircle className="w-3.5 h-3.5" /> Đã hủy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
        <Clock className="w-3.5 h-3.5" /> Chờ xử lý
      </span>
    );
  };

  // Lọc danh sách my orders
  const filteredMyOrders = myOrders.filter((ord) => {
    if (statusFilter === "all") return true;
    return ord.orderStatus?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* 1. Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2">
          Quản Lý & Theo Dõi Đơn Hàng
        </h1>
        <p className="text-slate-500 text-base max-w-xl mx-auto">
          Tra cứu lộ trình vận chuyển thời gian thực và quản lý các đơn hàng đã đặt tại VinSport.
        </p>
      </div>

      {/* 2. Tabs chuyển đổi */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTab("my-orders")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "my-orders"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Đơn hàng của tôi {isAuthenticated && myOrders.length > 0 && `(${myOrders.length})`}
          </button>
          <button
            onClick={() => setActiveTab("track")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === "track"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Search className="w-4 h-4" />
            Tra cứu theo mã đơn
          </button>
        </div>
      </div>

      {/* 3. NỘI DUNG TAB 1: ĐƠN HÀNG CỦA TÔI */}
      {activeTab === "my-orders" && (
        <div>
          {!isAuthenticated ? (
            /* Chưa đăng nhập */
            <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm text-center max-w-lg mx-auto">
              <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Bạn chưa đăng nhập
              </h2>
              <p className="text-slate-500 text-sm mb-6">
                Vui lòng đăng nhập để xem lại toàn bộ lịch sử các đơn hàng bạn đã mua và trạng thái giao hàng.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-sm transition-colors text-sm"
              >
                Đăng nhập ngay <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            /* Đã đăng nhập */
            <div className="space-y-6">
              {/* Bộ lọc trạng thái */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Lọc trạng thái:
                  </span>
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "pending", label: "Chờ xử lý" },
                    { key: "confirmed", label: "Đã xác nhận" },
                    { key: "shipping", label: "Đang giao" },
                    { key: "completed", label: "Hoàn thành" },
                    { key: "cancelled", label: "Đã hủy" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setStatusFilter(filter.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        statusFilter === filter.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => fetchMyOrders(true)}
                  disabled={loadingOrders}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors disabled:opacity-50"
                  title="Làm mới danh sách đơn hàng"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? "animate-spin" : ""}`} />
                  Làm mới
                </button>
              </div>

              {/* Danh sách các đơn */}
              {loadingOrders ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 text-slate-400">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  Đang tải đơn hàng của bạn...
                </div>
              ) : filteredMyOrders.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-700">Chưa có đơn hàng nào</h3>
                  <p className="text-slate-400 text-sm mt-1 mb-5">
                    Bạn chưa có đơn hàng nào trong mục này.
                  </p>
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-2 bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-700 transition-colors"
                  >
                    Khám phá sản phẩm ngay
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMyOrders.map((ord) => {
                    const isPending = ord.orderStatus?.toLowerCase() === "pending";

                    return (
                      <div
                        key={ord.orderId}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden p-6"
                      >
                        {/* Header của thẻ đơn */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-black text-lg text-slate-900">
                              #{ord.orderId}
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(ord.orderDate).toLocaleDateString("vi-VN")}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusBadge(ord.orderStatus)}
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                              {ord.paymentMethod}
                            </span>
                          </div>
                        </div>

                        {/* Danh sách sản phẩm thu gọn */}
                        <div className="space-y-3 mb-5">
                          {ord.items && ord.items.length > 0 ? (
                            ord.items.map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between text-sm py-1.5"
                              >
                                <div className="flex items-center gap-3">
                                  {it.imageUrl ? (
                                    <img
                                      src={it.imageUrl}
                                      alt={it.name}
                                      className="w-12 h-12 object-cover rounded-lg border border-slate-100"
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                      <Package className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-semibold text-slate-800 line-clamp-1">
                                      {it.name}
                                    </h4>
                                    <p className="text-xs text-slate-500">
                                      Size: <span className="font-medium text-slate-700">{it.size}</span> | Màu:{" "}
                                      <span className="font-medium text-slate-700">{it.color}</span> x {it.quantity}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right font-bold text-slate-900">
                                  {formatVND(it.subtotal || it.price * it.quantity)}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-slate-400 italic">Đơn hàng không có chi tiết</p>
                          )}
                        </div>

                        {/* Footer của thẻ đơn */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-4 border-t border-slate-100 gap-3">
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-md">{ord.shippingAddress || "Chưa có địa chỉ"}</span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4">
                            <div>
                              <span className="text-xs text-slate-400 block text-right">Tổng tiền:</span>
                              <span className="text-lg font-black text-orange-600">
                                {formatVND(ord.totalAmount)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Nút xem lộ trình */}
                              <button
                                onClick={() => {
                                  setActiveTab("track");
                                  setSearchOrderId(String(ord.orderId));
                                  handleSearchById(String(ord.orderId));
                                }}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                              >
                                Chi tiết
                              </button>

                              {/* Nút hủy đơn nếu còn Pending */}
                              {isPending && (
                                <button
                                  onClick={() => handleCancelOrder(ord.orderId)}
                                  disabled={cancellingOrderId === ord.orderId}
                                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                  {cancellingOrderId === ord.orderId ? "Đang hủy..." : "Hủy đơn"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. NỘI DUNG TAB 2: TRA CỨU THEO MÃ ĐƠN */}
      {activeTab === "track" && (
        <div className="space-y-8">
          {/* Form tìm kiếm */}
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchById();
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={searchOrderId}
                  onChange={(e) => setSearchOrderId(e.target.value)}
                  placeholder="Nhập mã đơn hàng (VD: 1, 15...)"
                  className="w-full pl-11 pr-4 py-3.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 text-base font-medium"
                />
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-7 rounded-xl transition-colors whitespace-nowrap text-sm disabled:opacity-50"
              >
                {isSearching ? "Đang tra cứu..." : "Kiểm tra ngay"}
              </button>
            </form>
          </div>

          {/* Lỗi tra cứu */}
          {searchError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center text-red-600 max-w-2xl mx-auto flex items-center justify-center gap-2 text-sm font-semibold">
              <AlertCircle className="w-5 h-5" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Kết quả tra cứu thật từ SQL Server */}
          {searchedOrder && (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-8">
              {/* Header kết quả */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-100 gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-slate-900">
                      Đơn hàng #{searchedOrder.orderId}
                    </h2>
                    {getStatusBadge(searchedOrder.orderStatus)}
                  </div>
                  <p className="text-slate-500 text-sm mt-1">
                    Đặt ngày: {new Date(searchedOrder.orderDate).toLocaleString("vi-VN")}
                  </p>
                </div>

                {searchedOrder.orderStatus?.toLowerCase() === "pending" && isAuthenticated && (
                  <button
                    onClick={() => handleCancelOrder(searchedOrder.orderId)}
                    disabled={cancellingOrderId === searchedOrder.orderId}
                    className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Ban className="w-4 h-4" />
                    {cancellingOrderId === searchedOrder.orderId ? "Đang hủy..." : "Hủy đơn hàng này"}
                  </button>
                )}
              </div>

              {/* TIMELINE TRẠNG THÁI THẬT DỰA TRÊN DATABASE */}
              {(() => {
                const status = searchedOrder.orderStatus?.toLowerCase();
                const isCancelled = status === "cancelled";

                if (isCancelled) {
                  return (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3 text-red-700">
                      <XCircle className="w-8 h-8 shrink-0 text-red-500" />
                      <div>
                        <h4 className="font-bold text-base">Đơn hàng đã bị hủy</h4>
                        <p className="text-xs text-red-600 mt-0.5">
                          Đơn hàng này đã được hủy và hoàn lại số lượng tồn kho.
                        </p>
                      </div>
                    </div>
                  );
                }

                // Tiến trình 4 bước: Pending -> Confirmed -> Shipping -> Completed
                const steps = [
                  { key: "pending", title: "Đặt hàng thành công", desc: "Đơn hàng đã được lưu trên hệ thống" },
                  { key: "confirmed", title: "Đã xác nhận đơn hàng", desc: "Cửa hàng đã duyệt đơn và chuẩn bị kiện hàng" },
                  { key: "shipping", title: "Đang vận chuyển", desc: "Đơn vị vận chuyển đang giao đến bạn" },
                  { key: "completed", title: "Giao hàng thành công", desc: "Khách hàng đã nhận kiện hàng" },
                ];

                const currentStepIndex =
                  status === "completed" ? 3 : status === "shipping" ? 2 : status === "confirmed" ? 1 : 0;

                return (
                  <div>
                    <h3 className="font-bold text-base text-slate-800 mb-6">
                      Tiến Trình Đơn Hàng
                    </h3>
                    <div className="relative pl-6 md:pl-10 space-y-8 before:absolute before:left-3.5 md:before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                      {steps.map((step, idx) => {
                        const isDone = idx <= currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                          <div key={step.key} className="relative flex items-start gap-4">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-white font-bold text-xs transition-colors ${
                                isDone
                                  ? isCurrent
                                    ? "bg-orange-500 ring-4 ring-orange-100"
                                    : "bg-emerald-500"
                                  : "bg-slate-300"
                              }`}
                            >
                              {isDone ? "✓" : idx + 1}
                            </div>
                            <div className="pt-0.5">
                              <h4
                                className={`font-bold text-sm ${
                                  isDone ? "text-slate-900" : "text-slate-400"
                                }`}
                              >
                                {step.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {step.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Thông tin giao hàng & thanh toán */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Địa chỉ nhận hàng
                  </h4>
                  <p className="font-bold text-slate-800 text-sm">
                    {searchedOrder.customer?.name} ({searchedOrder.customer?.phone || "Chưa có SĐT"})
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {searchedOrder.shippingAddress || "Chưa có địa chỉ"}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Hình thức thanh toán
                  </h4>
                  <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-orange-500" />
                    {searchedOrder.paymentMethod}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Trạng thái thanh toán:{" "}
                    <span className="font-semibold text-slate-700">
                      {searchedOrder.paymentStatus}
                    </span>
                  </p>
                </div>
              </div>

              {/* Danh sách mặt hàng */}
              <div>
                <h3 className="font-bold text-base text-slate-800 mb-4">
                  Sản Phẩm Trong Đơn ({searchedOrder.items?.length || 0})
                </h3>

                <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {searchedOrder.items && searchedOrder.items.length > 0 ? (
                    searchedOrder.items.map((it) => (
                      <div
                        key={it.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50"
                      >
                        <div className="flex items-center gap-3">
                          {it.imageUrl ? (
                            <img
                              src={it.imageUrl}
                              alt={it.name}
                              className="w-14 h-14 object-cover rounded-xl border border-slate-100"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm line-clamp-1">
                              {it.name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {it.brand} • Size:{" "}
                              <span className="font-medium text-slate-700">{it.size}</span> • Màu:{" "}
                              <span className="font-medium text-slate-700">{it.color}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              Số lượng: x{it.quantity}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-slate-900 text-sm">
                            {formatVND(it.subtotal || it.price * it.quantity)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatVND(it.price)}/sp
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      Không có chi tiết sản phẩm
                    </div>
                  )}
                </div>
              </div>

              {/* Tổng cộng */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <span className="font-bold text-slate-600 text-base">Tổng tiền thanh toán:</span>
                <span className="text-2xl font-black text-orange-600">
                  {formatVND(searchedOrder.totalAmount)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
