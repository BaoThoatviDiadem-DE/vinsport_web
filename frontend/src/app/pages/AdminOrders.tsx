import React, { useEffect, useMemo, useState } from "react";
import { Search, Filter, RefreshCw } from "lucide-react";
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
  if (status === "paid") return "bg-green-100 text-green-700 border-green-200";
  if (status === "failed") return "bg-red-100 text-red-700 border-red-200";
  return "bg-orange-100 text-orange-700 border-orange-200";
}

function orderStatusClass(status: string) {
  if (status === "completed") return "bg-green-100 text-green-700 border-green-200";
  if (status === "confirmed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "shipping") return "bg-blue-100 text-blue-700 border-blue-200";
  if (status === "cancelled") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");

  const [paymentStatusFilters, setPaymentStatusFilters] = useState<string[]>([]);
  const [orderStatusFilters, setOrderStatusFilters] = useState<string[]>([]);

  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [orderFilterOpen, setOrderFilterOpen] = useState(false);

  const [paymentFilterKeyword, setPaymentFilterKeyword] = useState("");
  const [orderFilterKeyword, setOrderFilterKeyword] = useState("");

  const [savingId, setSavingId] = useState<number | string | null>(null);

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
    const q = paymentFilterKeyword.trim().toLowerCase();
    if (!q) return PAYMENT_STATUS_OPTIONS;
    return PAYMENT_STATUS_OPTIONS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q)
    );
  }, [paymentFilterKeyword]);

  const filteredOrderOptions = useMemo(() => {
    const q = orderFilterKeyword.trim().toLowerCase();
    if (!q) return ORDER_STATUS_OPTIONS;
    return ORDER_STATUS_OPTIONS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q)
    );
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
    setKeyword("");
    setSearchField("all");
    setPaymentStatusFilters([]);
    setOrderStatusFilters([]);
    setPaymentFilterKeyword("");
    setOrderFilterKeyword("");
  };

  const filteredOrders = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return orders.filter((order) => {
      const orderId = String(order.id).toLowerCase();
      const customerName = String(order.customerName ?? "").toLowerCase();
      const phone = String(order.phone ?? "").toLowerCase();
      const paymentMethod = String(order.paymentMethod ?? "").toLowerCase();

      let matchesSearch = true;

      if (q) {
        switch (searchField) {
          case "id":
            matchesSearch = orderId.includes(q);
            break;
          case "customerName":
            matchesSearch = customerName.includes(q);
            break;
          case "phone":
            matchesSearch = phone.includes(q);
            break;
          case "paymentMethod":
            matchesSearch = paymentMethod.includes(q);
            break;
          case "all":
          default:
            matchesSearch =
              orderId.includes(q) ||
              customerName.includes(q) ||
              phone.includes(q) ||
              paymentMethod.includes(q);
            break;
        }
      }

      const matchesPaymentStatus =
        paymentStatusFilters.length === 0 ||
        paymentStatusFilters.includes(order.paymentStatus);

      const matchesOrderStatus =
        orderStatusFilters.length === 0 ||
        orderStatusFilters.includes(order.orderStatus);

      return matchesSearch && matchesPaymentStatus && matchesOrderStatus;
    });
  }, [orders, keyword, searchField, paymentStatusFilters, orderStatusFilters]);

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

  const handleUpdateOrder = async (order: AdminOrder) => {
    try {
      setSavingId(order.id);

      await api.put(`/admin/orders/${order.id}`, {
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
      });

      alert("Cập nhật đơn hàng thành công.");
      await loadOrders();
    } catch (error: any) {
      console.error("Lỗi cập nhật đơn hàng:", error);
      alert(error?.response?.data?.message || "Không cập nhật được đơn hàng.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Quản lý đơn hàng</h1>
        <p className="text-slate-600 mt-2">
          Tìm kiếm theo từng tiêu chí và lọc nhanh theo trạng thái.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold">Danh sách đơn hàng</h2>
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-semibold">
                Tổng số: {orders.length}
              </span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                Đang hiển thị: {filteredOrders.length}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
              <select
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as SearchField)}
                className="border rounded-xl px-4 py-3 outline-none focus:ring min-w-[190px]"
              >
                <option value="all">Tất cả</option>
                <option value="id">Mã đơn</option>
                <option value="customerName">Khách hàng</option>
                <option value="phone">SĐT</option>
                <option value="paymentMethod">Phương thức</option>
              </select>

              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Nhập từ khóa tìm kiếm..."
                className="w-full xl:w-80 border rounded-xl px-4 py-3 outline-none focus:ring"
              />

              <button
                type="button"
                onClick={clearAllFilters}
                className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
              >
                Xóa lọc
              </button>

              <button
                type="button"
                onClick={loadOrders}
                disabled={isLoading}
                className="px-4 py-3 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 transition-colors"
                title="Làm mới danh sách đơn hàng"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setPaymentFilterOpen((prev) => !prev);
                  setOrderFilterOpen(false);
                }}
                className="px-4 py-3 rounded-xl border bg-white hover:bg-slate-50 min-w-[220px] text-left flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  TT thanh toán
                  {paymentStatusFilters.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700">
                      {paymentStatusFilters.length}
                    </span>
                  )}
                </span>
              </button>

              {paymentFilterOpen && (
                <div className="absolute z-20 mt-2 w-[320px] bg-white border rounded-xl shadow-lg overflow-hidden">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={paymentFilterKeyword}
                        onChange={(e) => setPaymentFilterKeyword(e.target.value)}
                        placeholder="Tìm kiếm bộ lọc"
                        className="w-full border rounded-lg pl-9 pr-3 py-2 outline-none focus:ring"
                      />
                    </div>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto py-2">
                    {filteredPaymentOptions.map((item) => (
                      <label
                        key={item.value}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={paymentStatusFilters.includes(item.value)}
                          onChange={() => togglePaymentStatusFilter(item.value)}
                          className="w-4 h-4"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t px-3 py-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setPaymentStatusFilters([])}
                      className="text-slate-400 hover:text-slate-600 text-sm"
                    >
                      Xóa chọn
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentFilterOpen(false)}
                      className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
                    >
                      Đồng ý
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setOrderFilterOpen((prev) => !prev);
                  setPaymentFilterOpen(false);
                }}
                className="px-4 py-3 rounded-xl border bg-white hover:bg-slate-50 min-w-[220px] text-left flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  TT đơn hàng
                  {orderStatusFilters.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                      {orderStatusFilters.length}
                    </span>
                  )}
                </span>
              </button>

              {orderFilterOpen && (
                <div className="absolute z-20 mt-2 w-[320px] bg-white border rounded-xl shadow-lg overflow-hidden">
                  <div className="p-3 border-b">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={orderFilterKeyword}
                        onChange={(e) => setOrderFilterKeyword(e.target.value)}
                        placeholder="Tìm kiếm bộ lọc"
                        className="w-full border rounded-lg pl-9 pr-3 py-2 outline-none focus:ring"
                      />
                    </div>
                  </div>

                  <div className="max-h-[220px] overflow-y-auto py-2">
                    {filteredOrderOptions.map((item) => (
                      <label
                        key={item.value}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={orderStatusFilters.includes(item.value)}
                          onChange={() => toggleOrderStatusFilter(item.value)}
                          className="w-4 h-4"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="border-t px-3 py-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setOrderStatusFilters([])}
                      className="text-slate-400 hover:text-slate-600 text-sm"
                    >
                      Xóa chọn
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilterOpen(false)}
                      className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
                    >
                      Đồng ý
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-slate-500">
            Đang tải đơn hàng...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            Không có đơn hàng nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] border-collapse">
              <thead>
  <tr className="bg-slate-100 text-left">
    <th className="p-3 border-b min-w-[90px]">Mã đơn</th>
    <th className="p-3 border-b min-w-[280px]">Khách hàng</th>
    <th className="p-3 border-b min-w-[140px]">Tổng tiền</th>
    <th className="p-3 border-b min-w-[150px]">Phương thức</th>
    <th className="p-3 border-b min-w-[190px]">TT thanh toán</th>
    <th className="p-3 border-b min-w-[190px]">TT đơn hàng</th>
    <th className="p-3 border-b min-w-[130px]">Ngày tạo</th>
    <th className="p-3 border-b min-w-[140px] sticky right-0 bg-slate-100 z-20 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.08)]">
      Thao tác
    </th>
  </tr>
</thead>

<tbody>
  {filteredOrders.map((order) => (
    <tr key={String(order.id)} className="hover:bg-slate-50 align-top">
      <td className="p-3 border-b font-semibold whitespace-nowrap">
        #{order.id}
      </td>

      <td className="p-3 border-b">
        <div className="font-medium text-slate-900">
          {order.customerName}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          SĐT: {order.phone || "-"}
        </div>
        <div className="text-sm text-slate-500">
          Địa chỉ: {order.address || "-"}
        </div>
      </td>

      <td className="p-3 border-b font-medium whitespace-nowrap">
        {Number(order.totalAmount || 0).toLocaleString("vi-VN")} đ
      </td>

      <td className="p-3 border-b whitespace-nowrap">
        {formatPaymentMethod(order.paymentMethod)}
      </td>

      <td className="p-3 border-b">
        <div className="mb-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${paymentStatusClass(
              order.paymentStatus
            )}`}
          >
            {paymentStatusLabel(order.paymentStatus)}
          </span>
        </div>

        <select
          value={order.paymentStatus}
          onChange={(e) =>
            handleFieldChange(order.id, "paymentStatus", e.target.value)
          }
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="pending">pending</option>
          <option value="paid">paid</option>
          <option value="failed">failed</option>
        </select>
      </td>

      <td className="p-3 border-b">
        <div className="mb-2">
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${orderStatusClass(
              order.orderStatus
            )}`}
          >
            {orderStatusLabel(order.orderStatus)}
          </span>
        </div>

        <select
          value={order.orderStatus}
          onChange={(e) =>
            handleFieldChange(order.id, "orderStatus", e.target.value)
          }
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="pending">pending</option>
          <option value="confirmed">confirmed</option>
          <option value="shipping">shipping</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
      </td>

      <td className="p-3 border-b whitespace-nowrap text-sm text-slate-600">
        {formatDate(order.createdAt)}
      </td>

      <td className="p-3 border-b whitespace-nowrap sticky right-0 bg-white z-10 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.08)]">
        <button
          onClick={() => handleUpdateOrder(order)}
          disabled={savingId === order.id}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {savingId === order.id ? "Đang lưu..." : "Cập nhật"}
        </button>
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}