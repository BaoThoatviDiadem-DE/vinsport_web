import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Filter, RefreshCw, ChevronDown, Loader2, Edit3, Check } from "lucide-react";
import api from "../api/api";

type PaymentMethod = "cod" | "banking" | "momo" | string;
type PaymentStatus = "pending" | "paid" | "failed" | string;
type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipping"
  | "completed"
  | "cancelled"
  | string;

type AdminOrder = {
  id: number | string;
  customerName: string;
  phone?: string;
  address?: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt?: string;
};

type SearchField = "all" | "id" | "customerName" | "phone" | "paymentMethod";

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ xác nhận" },
  { value: "paid", label: "Đã thanh toán" },
  { value: "failed", label: "Thất bại" },
];

const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Chờ xử lý" },
  { value: "confirmed", label: "Đã xác nhận" },
  { value: "shipping", label: "Đang giao" },
  { value: "completed", label: "Hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeOrder(item: any): AdminOrder {
  return {
    id: item?.id ?? item?.order_id ?? item?.orderId ?? "",
    customerName:
      item?.customerName ||
      item?.customer?.name ||
      item?.fullName ||
      item?.name ||
      "Khách hàng",
    phone: item?.phone || item?.customer?.phone || "",
    address: item?.address || item?.customer?.address || "-",
    totalAmount: Number(item?.totalAmount ?? item?.total_amount ?? 0),
    paymentMethod: item?.paymentMethod || item?.payment_method || "cod",
    paymentStatus: item?.paymentStatus || item?.payment_status || "pending",
    orderStatus: item?.orderStatus || item?.order_status || "pending",
    createdAt: item?.createdAt || item?.created_at || "",
  };
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
}

function formatPaymentMethod(method: string) {
  if (method === "banking") return "Chuyển khoản";
  if (method === "cod") return "COD";
  if (method === "momo") return "Momo";
  return method;
}

function paymentStatusLabel(status: string) {
  if (status === "paid") return "Đã thanh toán";
  if (status === "failed") return "Thất bại";
  return "Chờ xác nhận";
}

function orderStatusLabel(status: string) {
  if (status === "confirmed") return "Đã xác nhận";
  if (status === "shipping") return "Đang giao";
  if (status === "completed") return "Hoàn thành";
  if (status === "cancelled") return "Đã hủy";
  return "Chờ xử lý";
}

function paymentStatusClass(status: string) {
  if (status === "paid") return "bg-green-100 text-green-700 border-green-300 hover:bg-green-200 focus:ring-green-400";
  if (status === "failed") return "bg-red-100 text-red-700 border-red-300 hover:bg-red-200 focus:ring-red-400";
  return "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200 focus:ring-orange-400";
}

function orderStatusClass(status: string) {
  if (status === "completed") return "bg-green-100 text-green-700 border-green-300 hover:bg-green-200 focus:ring-green-400";
  if (status === "confirmed") return "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 focus:ring-emerald-400";
  if (status === "shipping") return "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200 focus:ring-blue-400";
  if (status === "cancelled") return "bg-red-100 text-red-700 border-red-300 hover:bg-red-200 focus:ring-red-400";
  return "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 focus:ring-slate-400";
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [originalOrders, setOriginalOrders] = useState<AdminOrder[]>([]);
  const [idSearch, setIdSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [paymentMethodSearch, setPaymentMethodSearch] = useState("");

  // State tạm thời khi đang nhập trong popup (chỉ áp dụng khi bấm Đồng ý hoặc Enter)
  const [tempIdSearch, setTempIdSearch] = useState("");
  const [tempCustomerSearch, setTempCustomerSearch] = useState("");
  const [tempPaymentMethodSearch, setTempPaymentMethodSearch] = useState("");

  const handleApplyIdSearch = () => {
    setIdSearch(tempIdSearch.trim());
    setIdSearchOpen(false);
  };

  const handleApplyCustomerSearch = () => {
    setCustomerSearch(tempCustomerSearch.trim());
    setCustomerSearchOpen(false);
  };

  const handleApplyPaymentMethodSearch = () => {
    setPaymentMethodSearch(tempPaymentMethodSearch.trim());
    setPaymentMethodSearchOpen(false);
  };

  const [idSearchOpen, setIdSearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [paymentMethodSearchOpen, setPaymentMethodSearchOpen] = useState(false);

  const idSearchRef = useRef<HTMLDivElement>(null);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const paymentMethodSearchRef = useRef<HTMLDivElement>(null);

  const [paymentStatusFilters, setPaymentStatusFilters] = useState<string[]>([]);
  const [orderStatusFilters, setOrderStatusFilters] = useState<string[]>([]);

  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [orderFilterOpen, setOrderFilterOpen] = useState(false);

  const [paymentFilterKeyword, setPaymentFilterKeyword] = useState("");
  const [orderFilterKeyword, setOrderFilterKeyword] = useState("");

  const [savingId, setSavingId] = useState<number | string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const paymentFilterRef = useRef<HTMLDivElement>(null);
  const orderFilterRef = useRef<HTMLDivElement>(null);

  const closeOtherPopovers = (except?: string) => {
    if (except !== "id") setIdSearchOpen(false);
    if (except !== "customer") setCustomerSearchOpen(false);
    if (except !== "paymentMethod") setPaymentMethodSearchOpen(false);
    if (except !== "paymentStatus") setPaymentFilterOpen(false);
    if (except !== "orderStatus") setOrderFilterOpen(false);
  };

  // Tự động đóng menu bộ lọc và tìm kiếm khi click chuột ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (idSearchRef.current && !idSearchRef.current.contains(target)) {
        setIdSearchOpen(false);
      }
      if (customerSearchRef.current && !customerSearchRef.current.contains(target)) {
        setCustomerSearchOpen(false);
      }
      if (paymentMethodSearchRef.current && !paymentMethodSearchRef.current.contains(target)) {
        setPaymentMethodSearchOpen(false);
      }
      if (paymentFilterRef.current && !paymentFilterRef.current.contains(target)) {
        setPaymentFilterOpen(false);
      }
      if (orderFilterRef.current && !orderFilterRef.current.contains(target)) {
        setOrderFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await api.get("/admin/orders");
      const normalized = toArray(data).map(normalizeOrder);
      setOrders(normalized);
    } catch (error) {
      console.error("Lỗi tải đơn hàng:", error);
      alert("Không tải được danh sách đơn hàng");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredPaymentOptions = useMemo(() => {
    const qRaw = paymentFilterKeyword.trim().toLowerCase();
    const qClean = removeVietnameseTones(qRaw);
    if (!qRaw) return PAYMENT_STATUS_OPTIONS;
    return PAYMENT_STATUS_OPTIONS.filter((item) => {
      const labelRaw = item.label.toLowerCase();
      const labelClean = removeVietnameseTones(labelRaw);
      const val = item.value.toLowerCase();
      return labelRaw.includes(qRaw) || labelClean.includes(qClean) || val.includes(qRaw);
    });
  }, [paymentFilterKeyword]);

  const shippingOrdersCount = useMemo(
    () => orders.filter((o) => o.orderStatus?.toLowerCase() === "shipping").length,
    [orders]
  );
  const completedOrdersCount = useMemo(
    () => orders.filter((o) => o.orderStatus?.toLowerCase() === "completed").length,
    [orders]
  );
  const cancelledOrdersCount = useMemo(
    () => orders.filter((o) => o.orderStatus?.toLowerCase() === "cancelled").length,
    [orders]
  );

  const filteredOrderOptions = useMemo(() => {
    const qRaw = orderFilterKeyword.trim().toLowerCase();
    const qClean = removeVietnameseTones(qRaw);
    if (!qRaw) return ORDER_STATUS_OPTIONS;
    return ORDER_STATUS_OPTIONS.filter((item) => {
      const labelRaw = item.label.toLowerCase();
      const labelClean = removeVietnameseTones(labelRaw);
      const val = item.value.toLowerCase();
      return labelRaw.includes(qRaw) || labelClean.includes(qClean) || val.includes(qRaw);
    });
  }, [orderFilterKeyword]);

  const togglePaymentStatusFilter = (value: string) => {
    setPaymentStatusFilters((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const toggleOrderStatusFilter = (value: string) => {
    setOrderStatusFilters((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  const clearAllFilters = () => {
    setIdSearch("");
    setCustomerSearch("");
    setPaymentMethodSearch("");
    setPaymentStatusFilters([]);
    setOrderStatusFilters([]);
    setPaymentFilterKeyword("");
    setOrderFilterKeyword("");

    setTempIdSearch("");
    setTempCustomerSearch("");
    setTempPaymentMethodSearch("");

    setIdSearchOpen(false);
    setCustomerSearchOpen(false);
    setPaymentMethodSearchOpen(false);
    setPaymentFilterOpen(false);
    setOrderFilterOpen(false);
  };

  const hasActiveFilters =
    Boolean(idSearch.trim()) ||
    Boolean(customerSearch.trim()) ||
    Boolean(paymentMethodSearch.trim()) ||
    paymentStatusFilters.length > 0 ||
    orderStatusFilters.length > 0;

  const filteredOrders = useMemo(() => {
    const idQ = idSearch.trim().toLowerCase().replace(/^#/, "");
    const custQRaw = customerSearch.trim().toLowerCase();
    const custQClean = removeVietnameseTones(custQRaw);
    const custQDigits = custQRaw.replace(/\D/g, "");

    const methodQRaw = paymentMethodSearch.trim().toLowerCase();
    const methodQClean = removeVietnameseTones(methodQRaw);

    return orders.filter((order) => {
      const orderId = String(order.id).toLowerCase();
      const customerName = String(order.customerName ?? "");
      const phone = String(order.phone ?? "");
      const address = String(order.address ?? "");
      const paymentMethod = String(order.paymentMethod ?? "");
      const paymentMethodVi = formatPaymentMethod(order.paymentMethod);

      const matchesId = !idQ || orderId.includes(idQ);

      const nameRaw = customerName.toLowerCase();
      const nameClean = removeVietnameseTones(customerName);
      const phoneRaw = phone.toLowerCase();
      const phoneDigits = phoneRaw.replace(/\D/g, "");
      const addressRaw = address.toLowerCase();
      const addressClean = removeVietnameseTones(address);

      const matchesCustomer =
        !custQRaw ||
        nameRaw.includes(custQRaw) ||
        nameClean.includes(custQClean) ||
        (custQDigits.length > 0 && phoneDigits.includes(custQDigits)) ||
        phoneRaw.includes(custQRaw) ||
        addressRaw.includes(custQRaw) ||
        addressClean.includes(custQClean);

      const methodRaw = paymentMethod.toLowerCase();
      const methodViRaw = paymentMethodVi.toLowerCase();
      const methodClean = removeVietnameseTones(paymentMethod);
      const methodViClean = removeVietnameseTones(paymentMethodVi);

      const matchesMethod =
        !methodQRaw ||
        methodRaw.includes(methodQRaw) ||
        methodViRaw.includes(methodQRaw) ||
        methodClean.includes(methodQClean) ||
        methodViClean.includes(methodQClean);

      const matchesPaymentStatus =
        paymentStatusFilters.length === 0 ||
        paymentStatusFilters.includes(order.paymentStatus);

      const matchesOrderStatus =
        orderStatusFilters.length === 0 ||
        orderStatusFilters.includes(order.orderStatus);

      return (
        matchesId &&
        matchesCustomer &&
        matchesMethod &&
        matchesPaymentStatus &&
        matchesOrderStatus
      );
    });
  }, [
    orders,
    idSearch,
    customerSearch,
    paymentMethodSearch,
    paymentStatusFilters,
    orderStatusFilters,
  ]);

  const handleFieldChange = (
    id: number | string,
    field: "paymentStatus" | "orderStatus",
    value: string
  ) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === id ? { ...order, [field]: value } : order
      )
    );
  };

  const handleStatusChange = async (
    orderId: number | string,
    field: "paymentStatus" | "orderStatus",
    newValue: string
  ) => {
    const prevOrders = [...orders];
    const targetOrder = orders.find((o) => o.id === orderId);

    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, [field]: newValue } : order
      )
    );

    try {
      setUpdatingField(`${orderId}-${field}`);

      if (field === "paymentStatus") {
        await api.put(`/admin/orders/${orderId}/payment-status`, {
          status: newValue,
          paymentMethod: targetOrder?.paymentMethod || "cod",
        });
      } else {
        await api.put(`/admin/orders/${orderId}/status`, {
          status: newValue,
        });
      }
    } catch (error: any) {
      console.error(`Lỗi cập nhật ${field}:`, error);
      alert(
        error?.response?.data?.message ||
        "Không cập nhật được trạng thái. Đang hoàn tác lại..."
      );
      setOrders(prevOrders);
    } finally {
      setUpdatingField(null);
    }
  };

  const handleStartEdit = () => {
    setOriginalOrders(JSON.parse(JSON.stringify(orders)));
    setIsEditingTable(true);
  };

  const handleCancelEdit = () => {
    setOrders(originalOrders);
    setIsEditingTable(false);
  };

  const handleSaveAllOrders = async () => {
    try {
      setIsUpdating(true);

      const modifiedOrders = orders.filter((o) => {
        const orig = originalOrders.find((origO) => origO.id === o.id);
        if (!orig) return false;
        return (
          o.paymentStatus !== orig.paymentStatus ||
          o.orderStatus !== orig.orderStatus
        );
      });

      if (modifiedOrders.length === 0) {
        alert("Không có thay đổi nào để cập nhật.");
        setIsEditingTable(false);
        return;
      }

      // Gửi yêu cầu cập nhật lên cơ sở dữ liệu
      await Promise.all(
        modifiedOrders.map((order) =>
          api.put(`/admin/orders/${order.id}`, {
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod || "cod",
          })
        )
      );

      alert(`Cập nhật thành công ${modifiedOrders.length} đơn hàng vào cơ sở dữ liệu!`);
      setIsEditingTable(false);
      await loadOrders();
    } catch (error: any) {
      console.error("Lỗi cập nhật đơn hàng:", error);
      alert(error?.response?.data?.message || "Không cập nhật được đơn hàng.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-6 rounded-full bg-orange-500" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý đơn hàng
          </h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h2 className="text-xl font-bold text-slate-900">Danh sách đơn hàng</h2>
          </div>

          <div className="flex items-center gap-2.5">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
              >
                Xóa tất cả lọc
              </button>
            )}

            {!isEditingTable ? (
              <button
                type="button"
                onClick={handleStartEdit}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Bấm để chỉnh sửa trạng thái đơn hàng"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllOrders}
                  disabled={isUpdating}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  title="Cập nhật các thay đổi vào cơ sở dữ liệu"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Cập nhật</span>
                    </>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadOrders}
              disabled={isLoading || isUpdating}
              className="flex items-center justify-center p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
            Đang tải danh sách đơn hàng...
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[360px]">
            <table className="w-full min-w-[1240px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-3 border-b min-w-[130px] relative">
                    <div ref={idSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!idSearchOpen) setTempIdSearch(idSearch);
                          setIdSearchOpen((prev) => !prev);
                          closeOtherPopovers("id");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${idSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm theo mã đơn"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${idSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Mã đơn</span>
                        {idSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {idSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Mã đơn</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempIdSearch}
                            onChange={(e) => setTempIdSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyIdSearch();
                              }
                            }}
                            placeholder="Nhập mã đơn (vd: 13)..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempIdSearch("");
                                setIdSearch("");
                                setIdSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyIdSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  <th className="p-3 border-b min-w-[280px] relative">
                    <div ref={customerSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!customerSearchOpen) setTempCustomerSearch(customerSearch);
                          setCustomerSearchOpen((prev) => !prev);
                          closeOtherPopovers("customer");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${customerSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm khách hàng"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${customerSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Khách hàng</span>
                        {customerSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {customerSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Khách hàng</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempCustomerSearch}
                            onChange={(e) => setTempCustomerSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyCustomerSearch();
                              }
                            }}
                            placeholder="Nhập tên, SĐT hoặc địa chỉ..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempCustomerSearch("");
                                setCustomerSearch("");
                                setCustomerSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyCustomerSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  <th className="p-3 border-b min-w-[140px] font-semibold text-sm text-slate-800">Tổng tiền</th>

                  <th className="p-3 border-b min-w-[170px] relative">
                    <div ref={paymentMethodSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!paymentMethodSearchOpen) setTempPaymentMethodSearch(paymentMethodSearch);
                          setPaymentMethodSearchOpen((prev) => !prev);
                          closeOtherPopovers("paymentMethod");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${paymentMethodSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm phương thức thanh toán"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${paymentMethodSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Phương thức</span>
                        {paymentMethodSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {paymentMethodSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Phương thức</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempPaymentMethodSearch}
                            onChange={(e) => setTempPaymentMethodSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyPaymentMethodSearch();
                              }
                            }}
                            placeholder="Nhập COD hoặc Chuyển khoản..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempPaymentMethodSearch("");
                                setPaymentMethodSearch("");
                                setPaymentMethodSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyPaymentMethodSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  <th className="p-3 border-b min-w-[210px] relative">
                    <div ref={paymentFilterRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentFilterOpen((prev) => !prev);
                          setOrderFilterOpen(false);
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${paymentStatusFilters.length > 0 ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để lọc theo trạng thái thanh toán"
                      >
                        <span>TT thanh toán</span>
                        <Filter
                          className={`w-3.5 h-3.5 transition-colors ${paymentStatusFilters.length > 0
                            ? "text-orange-600 fill-orange-500"
                            : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        {paymentStatusFilters.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">
                            {paymentStatusFilters.length}
                          </span>
                        )}
                      </button>

                      {paymentFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[270px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden font-normal text-slate-800"
                        >
                          <div className="p-2.5 border-b bg-slate-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                value={paymentFilterKeyword}
                                onChange={(e) => setPaymentFilterKeyword(e.target.value)}
                                placeholder="Tìm kiếm trạng thái..."
                                className="w-full border rounded-lg pl-8 pr-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                              />
                            </div>
                          </div>

                          <div className="max-h-[190px] overflow-y-auto py-1.5">
                            {filteredPaymentOptions.map((item) => (
                              <label
                                key={item.value}
                                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={paymentStatusFilters.includes(item.value)}
                                  onChange={() => togglePaymentStatusFilter(item.value)}
                                  className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="font-medium text-slate-700">{item.label}</span>
                              </label>
                            ))}
                          </div>

                          <div className="border-t px-3 py-2 flex items-center justify-between bg-slate-50 text-xs">
                            <button
                              type="button"
                              onClick={() => setPaymentStatusFilters([])}
                              className="text-slate-500 hover:text-slate-800 font-medium"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setPaymentFilterOpen(false)}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  <th className="p-3 border-b min-w-[210px] relative">
                    <div ref={orderFilterRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderFilterOpen((prev) => !prev);
                          setPaymentFilterOpen(false);
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${orderStatusFilters.length > 0 ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để lọc theo trạng thái đơn hàng"
                      >
                        <span>TT đơn hàng</span>
                        <Filter
                          className={`w-3.5 h-3.5 transition-colors ${orderStatusFilters.length > 0
                            ? "text-orange-600 fill-orange-500"
                            : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        {orderStatusFilters.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">
                            {orderStatusFilters.length}
                          </span>
                        )}
                      </button>

                      {orderFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[270px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden font-normal text-slate-800"
                        >
                          <div className="p-2.5 border-b bg-slate-50">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                value={orderFilterKeyword}
                                onChange={(e) => setOrderFilterKeyword(e.target.value)}
                                placeholder="Tìm kiếm trạng thái..."
                                className="w-full border rounded-lg pl-8 pr-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                              />
                            </div>
                          </div>

                          <div className="max-h-[190px] overflow-y-auto py-1.5">
                            {filteredOrderOptions.map((item) => (
                              <label
                                key={item.value}
                                className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={orderStatusFilters.includes(item.value)}
                                  onChange={() => toggleOrderStatusFilter(item.value)}
                                  className="w-3.5 h-3.5 rounded text-orange-600 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="font-medium text-slate-700">{item.label}</span>
                              </label>
                            ))}
                          </div>

                          <div className="border-t px-3 py-2 flex items-center justify-between bg-slate-50 text-xs">
                            <button
                              type="button"
                              onClick={() => setOrderStatusFilters([])}
                              className="text-slate-500 hover:text-slate-800 font-medium"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderFilterOpen(false)}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                  <th className="p-3 border-b min-w-[130px] font-semibold text-sm text-slate-800">Ngày tạo</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-16 text-center text-slate-500 font-medium"
                    >
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="text-slate-600 text-sm font-semibold">
                          Không tìm thấy đơn hàng nào phù hợp.
                        </p>
                        <p className="text-slate-400 text-xs">
                          Thử kiểm tra lại từ khóa tìm kiếm hoặc bấm &quot;Xóa lọc&quot; để xem toàn bộ danh sách.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-semibold border border-orange-200 transition-colors cursor-pointer"
                          >
                            Xóa bộ lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={String(order.id)} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 border-b whitespace-nowrap font-bold text-slate-400 text-sm">
                        #{order.id}
                      </td>

                      <td className="p-3 border-b min-w-[220px]">
                        <div className="font-semibold text-slate-800 text-sm">
                          {order.customerName}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          SĐT: {order.phone || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Địa chỉ: {order.address || "-"}
                        </div>
                      </td>

                      <td className="p-3 border-b font-bold text-orange-600 text-sm whitespace-nowrap">
                        {Number(order.totalAmount || 0).toLocaleString("vi-VN")} đ
                      </td>

                      <td className="p-3 border-b text-slate-600 text-sm whitespace-nowrap">
                        {formatPaymentMethod(order.paymentMethod)}
                      </td>

                      {/* Cột TT thanh toán */}
                      <td className="p-3 border-b">
                        {isEditingTable ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={order.paymentStatus}
                              onChange={(e) =>
                                handleLocalStatusChange(order.id, "paymentStatus", e.target.value)
                              }
                              className={`appearance-none cursor-pointer pl-3.5 pr-8 py-1.5 rounded-full text-xs font-semibold border transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${paymentStatusClass(
                                order.paymentStatus
                              )}`}
                              title="Bấm để chọn trạng thái thanh toán"
                            >
                              {PAYMENT_STATUS_OPTIONS.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                  className="bg-white text-slate-800 font-medium py-1"
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none opacity-60" />
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${paymentStatusClass(
                              order.paymentStatus
                            )}`}
                          >
                            {paymentStatusLabel(order.paymentStatus)}
                          </span>
                        )}
                      </td>

                      {/* Cột TT đơn hàng */}
                      <td className="p-3 border-b">
                        {isEditingTable ? (
                          <div className="relative inline-flex items-center">
                            <select
                              value={order.orderStatus}
                              onChange={(e) =>
                                handleLocalStatusChange(order.id, "orderStatus", e.target.value)
                              }
                              className={`appearance-none cursor-pointer pl-3.5 pr-8 py-1.5 rounded-full text-xs font-semibold border transition-all hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${orderStatusClass(
                                order.orderStatus
                              )}`}
                              title="Bấm để chọn trạng thái đơn hàng"
                            >
                              {ORDER_STATUS_OPTIONS.map((item) => (
                                <option
                                  key={item.value}
                                  value={item.value}
                                  className="bg-white text-slate-800 font-medium py-1"
                                >
                                  {item.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none opacity-60" />
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${orderStatusClass(
                              order.orderStatus
                            )}`}
                          >
                            {orderStatusLabel(order.orderStatus)}
                          </span>
                        )}
                      </td>

                      <td className="p-3 border-b text-slate-600 text-sm whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                    </tr>
                  )))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}