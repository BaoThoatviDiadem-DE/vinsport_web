import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  BarChart3,
  ShoppingBag,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  Cloud,
  Database,
  ArrowUpRight,
  Clock,
  Sparkles,
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

type RangeType = "7days" | "30days" | "all";

interface AnalyticsData {
  filterRange: string;
  kpi: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    completedOrders: number;
    cancelledOrders: number;
    totalCustomers: number;
    completionRate: number;
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
    totalSold: number;
    totalRevenue: number;
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

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"];
const BAR_COLORS = ["#3b82f6", "#10b981", "#f97316"];

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [range, setRange] = useState<RangeType>("all");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchAnalytics = async (selectedRange: RangeType, showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      else setLoading(true);

      const res: any = await api.get(`/admin/analytics?range=${selectedRange}`);
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
    fetchAnalytics(range);
  }, [range]);

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

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Trung Tâm Phân Tích & Báo Cáo Kinh Doanh
            </h1>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              Live BI
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Trực quan hoá chuyên sâu dữ liệu bán hàng, phân bổ doanh thu & đồng bộ Cloud Data Lakehouse
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Bộ lọc thời gian */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setRange("7days")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                range === "7days"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              7 ngày qua
            </button>
            <button
              onClick={() => setRange("30days")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                range === "30days"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              30 ngày qua
            </button>
            <button
              onClick={() => setRange("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                range === "all"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Toàn bộ
            </button>
          </div>

          {/* Nút làm mới */}
          <button
            onClick={() => fetchAnalytics(range, true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium text-sm rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>Làm mới số liệu</span>
          </button>
        </div>
      </div>

      {/* 2. Banner Thông Tin Data Lakehouse */}
      {data?.lakehouseInfo && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl text-blue-300">
              <Cloud className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Kiến trúc Data Lakehouse (Amazon S3)
                </h3>
                <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 text-xs rounded-full border border-blue-400/30 font-medium">
                  {data.lakehouseInfo.format}
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Bucket: <span className="font-mono text-white">{data.lakehouseInfo.bucketName}</span> | Chu kỳ ETL: {data.lakehouseInfo.interval}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-sm text-blue-100">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Tự động trích xuất & nạp snapshot Parquet bởi Apache Airflow</span>
          </div>
        </div>
      )}

      {/* 3. Thẻ Chỉ Số KPI Cốt Lõi */}
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
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Ghi nhận từ SQL Server & S3</span>
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
            <div className="text-xs text-slate-500 mt-1">
              Khách hàng: <span className="font-semibold text-slate-700">{data?.kpi?.totalCustomers || 0} người</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Giá trị trung bình đơn (AOV) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Giá Trị Đơn Trung Bình (AOV)
            </span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-2xl font-black text-slate-900">
              {loading ? "..." : formatVND(data?.kpi?.avgOrderValue || 0)}
            </h2>
            <div className="text-xs text-slate-500 mt-1">
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
            <div className="text-xs text-slate-500 mt-1">
              Hoàn thành: <span className="font-semibold text-emerald-600">{data?.kpi?.completedOrders || 0}</span> | Hủy: <span className="font-semibold text-red-500">{data?.kpi?.cancelledOrders || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Hàng biểu đồ 1: Doanh thu theo thời gian (Area) & Cơ cấu thanh toán (Pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ xu hướng doanh thu (2 cột) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  Xu Hướng Doanh Thu & Lượng Đơn Theo Thời Gian
                </h3>
                <p className="text-xs text-slate-500">
                  Phân tích chuỗi thời gian doanh số thực tế từ SQL Server
                </p>
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
                      formatter={(value, entry: any) => (
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

      {/* 5. Hàng biểu đồ 2: Phân loại quy mô đơn hàng & Top sản phẩm bán chạy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ phân loại quy mô đơn hàng (Thay thế orders_by_size.png) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-base text-slate-800">
              Phân Loại Quy Mô Đơn Hàng
            </h3>
            <p className="text-xs text-slate-500">
              Số lượng đơn theo các mức giá trị (Nhỏ, Trung bình, Lớn)
            </p>
          </div>

          <div className="h-72 w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400">
                Đang tải...
              </div>
            ) : data?.orderSizes && data.orderSizes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.orderSizes}
                  margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
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

        {/* Top 5 Sản Phẩm Bán Chạy Nhất */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="mb-4">
            <h3 className="font-bold text-base text-slate-800">
              Top Sản Phẩm Bán Chạy Nhất
            </h3>
            <p className="text-xs text-slate-500">
              Sản phẩm có số lượng bán và doanh thu cao nhất
            </p>
          </div>

          <div className="space-y-3.5 mt-4">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Đang tải...</div>
            ) : data?.topProducts && data.topProducts.length > 0 ? (
              data.topProducts.map((p, idx) => (
                <div
                  key={p.productId || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                      #{idx + 1}
                    </span>
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
      </div>

      {/* 6. Đơn Hàng Mới Nhất (Real-time Feed) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-800">
              Giao Dịch Đơn Hàng Mới Nhất
            </h3>
            <p className="text-xs text-slate-500">
              Dữ liệu được cập nhật thời gian thực từ SQL Server
            </p>
          </div>
          <span className="text-xs text-slate-500">5 đơn gần nhất</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-3 px-6">Mã Đơn</th>
                <th className="py-3 px-6">Khách Hàng</th>
                <th className="py-3 px-6">Thời Gian</th>
                <th className="py-3 px-6">Tổng Tiền</th>
                <th className="py-3 px-6">Thanh Toán</th>
                <th className="py-3 px-6">Trạng Thái Đơn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Đang nạp dữ liệu...
                  </td>
                </tr>
              ) : data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      #{order.orderId}
                    </td>
                    <td className="py-3.5 px-6 font-medium">
                      {order.customerName}
                    </td>
                    <td className="py-3.5 px-6 text-xs text-slate-500">
                      {new Date(order.orderDate).toLocaleString("vi-VN")}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-orange-600">
                      {formatVND(order.totalAmount)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700">
                        {order.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          order.orderStatus?.toLowerCase() === "completed"
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
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">
                    Chưa có giao dịch đơn hàng nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
