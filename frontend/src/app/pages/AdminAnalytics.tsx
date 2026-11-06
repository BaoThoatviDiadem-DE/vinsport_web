import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router";
import {
  TrendingUp,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Layers,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  ExternalLink,
  ChevronRight,
  Boxes,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../api/api";
import toast from "react-hot-toast";

type RangeType = "7days" | "30days" | "all" | "custom";

interface AnalyticsData {
  filterRange: string;
  startDate?: string | null;
  endDate?: string | null;
  kpi: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    completedOrders: number;
    cancelledOrders: number;
    totalCustomers: number;
    completionRate: number;
    revenueGrowth?: number;
    ordersGrowth?: number;
    aovGrowth?: number;
    completionRateGrowth?: number;
  };
  timeSeries: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
  paymentMethods: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
  orderSizes: Array<{
    name: string;
    count: number;
    revenue: number;
  }>;
  orderStatuses: Array<{
    name: string;
    count: number;
  }>;
  topProducts: Array<{
    productId: number;
    name: string;
    brand: string;
    category: string;
    image?: string;
    totalSold: number;
    totalRevenue: number;
  }>;
  categories: Array<{
    id: number;
    name: string;
    productCount: number;
    totalSold: number;
    totalRevenue: number;
  }>;
  lowStockAlerts: Array<{
    productId: number;
    name: string;
    brand: string;
    category: string;
    image?: string;
    totalStock: number;
    status: string;
    isLow: boolean;
  }>;
  recentOrders: Array<{
    orderId: number;
    orderDate: string;
    totalAmount: number;
    orderStatus: string;
    customerName: string;
    paymentMethod: string;
    paymentStatus: string;
  }>;
  lakehouseInfo: {
    storage: string;
    bucketName: string;
    format: string;
    interval: string;
  };
}

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];
const BAR_COLORS = ["#3b82f6", "#10b981", "#f97316"];
const CATEGORY_COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4"];

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [range, setRange] = useState<RangeType>("all");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Bộ lọc ngày tùy chọn
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);
  const customPickerRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Tự động đóng popover ngày khi bấm ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customPickerRef.current &&
        !customPickerRef.current.contains(event.target as Node)
      ) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchAnalytics = async (
    selectedRange: RangeType,
    showToast = false,
    sDate?: string,
    eDate?: string
  ) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      let url = `/admin/analytics?range=${selectedRange}`;
      if (selectedRange === "custom") {
        const start = sDate || startDate;
        const end = eDate || endDate;
        url += `&startDate=${start}&endDate=${end}`;
      }

      const res: any = await api.get(url);
      if (res?.success && res?.data) {
        setData(res.data);
        if (showToast) {
          toast.success("Đã đồng bộ và làm mới số liệu phân tích!");
        }
      } else {
        toast.error("Không thể tải dữ liệu phân tích.");
      }
    } catch (err: any) {
      console.error("Lỗi khi tải dữ liệu phân tích:", err);
      toast.error(err?.response?.data?.message || "Lỗi nạp dữ liệu phân tích");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (range !== "custom") {
      fetchAnalytics(range);
    }
  }, [range]);

  const handleApplyCustomDate = () => {
    if (!startDate || !endDate) {
      toast.error("Vui lòng chọn cả từ ngày và đến ngày");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Từ ngày không được lớn hơn đến ngày");
      return;
    }
    setRange("custom");
    fetchAnalytics("custom", true, startDate, endDate);
    setShowCustomPicker(false);
  };

  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  const formatShortNumber = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  const renderGrowthBadge = (growth?: number) => {
    if (growth === undefined || growth === null) return null;
    const isPositive = growth > 0;
    const isZero = growth === 0;

    if (isZero) {
      return (
        <span className="inline-flex items-center text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          0% so với kỳ trước
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md ${isPositive
          ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
          : "text-red-700 bg-red-50 border border-red-200/60"
          }`}
      >
        {isPositive ? (
          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
        ) : (
          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
        )}
        {isPositive ? `+${growth}%` : `${growth}%`} so với kỳ trước
      </span>
    );
  };

  // Tính tổng doanh thu của tất cả danh mục để ra tỷ trọng %
  const totalCategoryRevenue = (data?.categories || []).reduce(
    (acc, c) => acc + c.totalRevenue,
    0
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Thống kê & Báo cáo kinh doanh
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Bộ lọc thời gian nhanh */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setShowCustomPicker(false);
                setRange("7days");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${range === "7days"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => {
                setShowCustomPicker(false);
                setRange("30days");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${range === "30days"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              30 ngày qua
            </button>
            <button
              onClick={() => {
                setShowCustomPicker(false);
                setRange("all");
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${range === "all"
                ? "bg-white text-orange-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
                }`}
            >
              Toàn bộ
            </button>

            {/* Nút Tùy chọn thời gian với popover nhỏ gọn gắn liền */}
            <div ref={customPickerRef} className="relative">
              <button
                type="button"
                onClick={() => setShowCustomPicker((prev) => !prev)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${range === "custom" || showCustomPicker
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Tùy chọn</span>
              </button>

              {showCustomPicker && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 z-50 w-[270px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 text-slate-800 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-100 font-bold text-xs text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" />
                      <span>Khoảng thời gian</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomPicker(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Từ ngày:
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Đến ngày:
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-orange-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setStartDate(d.toISOString().split("T")[0]);
                        setEndDate(new Date().toISOString().split("T")[0]);
                      }}
                      className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      Đặt lại
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomDate}
                      disabled={loading}
                      className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-sm cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nút làm mới */}
          <button
            onClick={() => fetchAnalytics(range, true, startDate, endDate)}
            disabled={loading || refreshing}
            className="flex items-center justify-center p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Làm mới số liệu"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* 3. Thẻ Chỉ Số KPI Cốt Lõi (Kèm so sánh tăng trưởng kỳ trước) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Tổng doanh thu */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tổng Doanh Thu
            </span>
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900">
              {loading ? "..." : formatVND(data?.kpi?.totalRevenue || 0)}
            </h2>
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {renderGrowthBadge(data?.kpi?.revenueGrowth)}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Doanh số bán hàng thực nhận
            </div>
          </div>
        </div>

        {/* KPI 2: Tổng đơn hàng */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tổng Đơn Hàng
            </span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900">
              {loading ? "..." : `${data?.kpi?.totalOrders || 0} đơn`}
            </h2>
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {renderGrowthBadge(data?.kpi?.ordersGrowth)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Khách hàng: <span className="font-semibold text-slate-700">{data?.kpi?.totalCustomers || 0} người</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Giá trị trung bình đơn (AOV) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Giá Trị Đơn TB (AOV)
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900">
              {loading ? "..." : formatVND(data?.kpi?.avgOrderValue || 0)}
            </h2>
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {renderGrowthBadge(data?.kpi?.aovGrowth)}
            </div>
            <div className="text-xs text-slate-400 mt-1.5">
              Doanh thu bình quân mỗi đơn
            </div>
          </div>
        </div>

        {/* KPI 4: Tỷ lệ hoàn tất */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Tỷ Lệ Hoàn Tất Đơn
            </span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900">
              {loading ? "..." : `${data?.kpi?.completionRate || 0}%`}
            </h2>
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {renderGrowthBadge(data?.kpi?.completionRateGrowth)}
            </div>
            <div className="text-xs text-slate-500 mt-1.5">
              Hoàn thành: <span className="font-semibold text-emerald-600">{data?.kpi?.completedOrders || 0}</span> | Hủy: <span className="font-semibold text-red-500">{data?.kpi?.cancelledOrders || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Hàng biểu đồ 1: Doanh thu theo thời gian & Cơ cấu thanh toán */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ xu hướng doanh thu (2 cột) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  Xu Hướng Doanh Thu & Lượng Đơn Theo Thời Gian
                </h3>
              </div>
            </div>

            <div className="h-72 w-full mt-2">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Đang tải biểu đồ...
                </div>
              ) : data?.timeSeries && data.timeSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.timeSeries}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={formatShortNumber}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === "revenue" ? formatVND(Number(val)) : `${val} đơn`,
                        name === "revenue" ? "Doanh thu" : "Số đơn hàng",
                      ]}
                      labelFormatter={(label) => `Ngày: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#f97316"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Chưa có dữ liệu đơn hàng trong khoảng thời gian này
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Biểu đồ tròn cơ cấu thanh toán (1 cột) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="font-bold text-base text-slate-800">
                Phương Thức Thanh Toán
              </h3>
              <p className="text-xs text-slate-500">
                Tỷ trọng doanh thu theo hình thức thanh toán
              </p>
            </div>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Đang tải biểu đồ...
                </div>
              ) : data?.paymentMethods && data.paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="revenue"
                    >
                      {data.paymentMethods.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatVND(Number(val)), "Doanh thu"]}
                    />
                    <Legend
                      formatter={(value) => (
                        <span className="text-xs text-slate-700 font-medium">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Chưa có dữ liệu thanh toán
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. NÂNG CẤP MỚI: Thống Kê Theo Danh Mục Sản Phẩm (Category Analytics) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Doanh Thu & Sản Lượng Theo Danh Mục Sản Phẩm
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Biểu đồ thanh ngang Danh mục */}
          <div className="lg:col-span-6 h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Đang tải biểu đồ danh mục...
              </div>
            ) : data?.categories && data.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.categories}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 35, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={formatShortNumber}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#64748b"
                    fontSize={11}
                    width={100}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatVND(Number(val)), "Doanh thu"]}
                  />
                  <Bar
                    dataKey="totalRevenue"
                    name="Doanh thu"
                    radius={[0, 6, 6, 0]}
                  >
                    {data.categories.map((entry, index) => (
                      <Cell
                        key={`cat-cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                Chưa có dữ liệu danh mục
              </div>
            )}
          </div>

          {/* Bảng chi tiết doanh số từng danh mục */}
          <div className="lg:col-span-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Danh mục</th>
                  <th className="py-2.5 px-3 text-center">Số mẫu</th>
                  <th className="py-2.5 px-3 text-center">Đã bán</th>
                  <th className="py-2.5 px-3 text-right">Doanh thu</th>
                  <th className="py-2.5 px-3 text-right">Tỷ trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {data?.categories && data.categories.length > 0 ? (
                  data.categories.map((c, idx) => {
                    const ratio =
                      totalCategoryRevenue > 0
                        ? Math.round((c.totalRevenue / totalCategoryRevenue) * 100)
                        : 0;
                    return (
                      <tr key={c.id || idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-slate-800 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
                            }}
                          />
                          <span>{c.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">
                          {c.productCount} mẫu
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                          {c.totalSold}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-orange-600">
                          {formatVND(c.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {ratio}%
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Chưa có dữ liệu danh mục
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Hàng 3: Top Sản phẩm bán chạy & Cảnh báo tồn kho thấp (Low Stock Alert) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Sản Phẩm Bán Chạy Nhất */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-800">
                Top Sản Phẩm Bán Chạy Nhất
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400">Top 5</span>
          </div>

          <div className="space-y-3 mt-4">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Đang tải...</div>
            ) : data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.map((p, idx) => (
                <div
                  key={p.productId || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 text-xs font-bold rounded-full flex-shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 overflow-hidden flex-shrink-0">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Package className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {p.brand} • {p.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2.5 py-1 bg-white text-orange-600 rounded-lg border border-slate-200">
                      Đã bán {p.totalSold}
                    </span>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      {formatVND(p.totalRevenue)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                Chưa có dữ liệu sản phẩm
              </div>
            )}
          </div>
        </div>

        {/* NÂNG CẤP MỚI: Báo Cáo Tồn Kho & Cảnh Báo Sắp Hết Hàng */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-800">
                    Cảnh Báo Tồn Kho Thấp
                  </h3>
                </div>
              </div>

              <Link
                to="/admin/products"
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-xl transition-colors"
              >
                <span>Kho hàng</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {loading ? (
                <div className="py-12 text-center text-slate-400">Đang tải tồn kho...</div>
              ) : data?.lowStockAlerts && data.lowStockAlerts.length > 0 ? (
                data.lowStockAlerts.map((item, idx) => (
                  <div
                    key={item.productId || idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <Boxes className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">
                          {item.name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {item.brand} • {item.category}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg border ${item.totalStock <= 20
                          ? "bg-red-50 text-red-600 border-red-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                      >
                        Còn {item.totalStock} chiếc
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.totalStock <= 20 ? "Cần nhập gấp" : "Sắp hết hàng"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-emerald-600 text-sm font-medium">
                  Kho hàng ổn định, chưa có sản phẩm nào chạm ngưỡng cảnh báo.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. Hàng 4: Phân Loại Quy Mô Đơn Hàng & Giao Dịch Mới Nhất */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ phân loại quy mô đơn hàng (1 cột) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-4">
              <h3 className="font-bold text-base text-slate-800">
                Phân Loại Quy Mô Đơn Hàng
              </h3>
            </div>

            <div className="h-64 w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  Đang tải...
                </div>
              ) : data?.orderSizes && data.orderSizes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.orderSizes}
                    margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === "count" ? `${val} đơn` : formatVND(Number(val)),
                        name === "count" ? "Số lượng đơn" : "Tổng doanh thu",
                      ]}
                    />
                    <Bar
                      dataKey="count"
                      fill="#3b82f6"
                      radius={[8, 8, 0, 0]}
                      name="count"
                    >
                      {data.orderSizes.map((entry, index) => (
                        <Cell
                          key={`size-bar-${index}`}
                          fill={BAR_COLORS[index % BAR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  Chưa có dữ liệu
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bảng đơn hàng mới nhất (2 cột) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  Giao Dịch Đơn Hàng Mới Nhất
                </h3>
              </div>
              <Link
                to="/admin/orders"
                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 px-3 py-1.5 rounded-xl transition-colors"
              >
                Tất cả đơn hàng
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Mã Đơn</th>
                    <th className="py-3 px-4">Khách Hàng</th>
                    <th className="py-3 px-4">Thời Gian</th>
                    <th className="py-3 px-4">Tổng Tiền</th>
                    <th className="py-3 px-4">Thanh Toán</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Đang nạp dữ liệu...
                      </td>
                    </tr>
                  ) : data?.recentOrders && data.recentOrders.length > 0 ? (
                    data.recentOrders.map((order) => (
                      <tr key={order.orderId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          #{order.orderId}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {order.customerName}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(order.orderDate).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 font-bold text-orange-600">
                          {formatVND(order.totalAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700">
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${order.orderStatus?.toLowerCase() === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : order.orderStatus?.toLowerCase() === "cancelled"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                              }`}
                          >
                            {order.orderStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có giao dịch đơn hàng nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
