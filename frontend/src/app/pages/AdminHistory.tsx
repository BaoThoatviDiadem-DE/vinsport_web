import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  History,
  RotateCcw,
  Search,
  Filter,
  RefreshCw,
  Undo2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Package,
  User,
  ShoppingBag,
  Ticket,
  ChevronDown,
  Loader2,
  CheckSquare,
  X,
  Layers,
  ArrowRight,
} from "lucide-react";
import api from "../api/api";
import toast from "react-hot-toast";

export interface HistoryItem {
  id: number;
  action_type: string; // 'DELETE', 'BATCH_DELETE', 'UPDATE'
  entity_type: string; // 'product', 'user', 'order', 'voucher'
  title: string;
  description: string;
  snapshot_data: any;
  item_count: number;
  is_restored: boolean;
  restored_at: string | null;
  created_at: string;
  created_by: string;
}

export interface HistoryStats {
  total: number;
  pending: number;
  restored: number;
  byEntity: {
    product: number;
    user: number;
    order: number;
    voucher: number;
  };
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function getEntityBadge(type: string) {
  switch (type?.toLowerCase()) {
    case "product":
      return {
        label: "Sản phẩm",
        icon: Package,
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "user":
      return {
        label: "Người dùng",
        icon: User,
        badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "order":
      return {
        label: "Đơn hàng",
        icon: ShoppingBag,
        badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "voucher":
      return {
        label: "Mã ưu đãi",
        icon: Ticket,
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      };
    default:
      return {
        label: type,
        icon: Layers,
        badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
      };
  }
}

function getActionBadge(type: string) {
  switch (type?.toUpperCase()) {
    case "BATCH_DELETE":
      return {
        label: "Xóa hàng loạt",
        badgeClass: "bg-red-50 text-red-700 border-red-200",
      };
    case "DELETE":
      return {
        label: "Xóa bản ghi",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      };
    case "UPDATE":
      return {
        label: "Cập nhật",
        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    default:
      return {
        label: type,
        badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
      };
  }
}

export default function AdminHistory() {
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<HistoryStats>({
    total: 0,
    pending: 0,
    restored: 0,
    byEntity: { product: 0, user: 0, order: 0, voucher: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  // Bộ lọc
  const [search, setSearch] = useState("");
  const [tempSearch, setTempSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'pending', 'restored'

  // Popover state
  const [searchOpen, setSearchOpen] = useState(false);
  const [entityFilterOpen, setEntityFilterOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const entityRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Chế độ Chọn & Xóa vĩnh viễn
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Modal Khôi phục
  const [restoringItem, setRestoringItem] = useState<HistoryItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Modal Xem chi tiết Snapshot
  const [viewingItem, setViewingItem] = useState<HistoryItem | null>(null);

  // Tự đóng popovers khi click ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) {
        setSearchOpen(false);
      }
      if (entityRef.current && !entityRef.current.contains(target)) {
        setEntityFilterOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(target)) {
        setStatusFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/admin/history", {
        params: {
          search: search.trim() || undefined,
          entityType: entityFilter !== "all" ? entityFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          limit: 100,
        },
      });

      if (res && res.items) {
        setHistoryList(res.items);
        if (res.stats) {
          setStats(res.stats);
        }
      } else if (Array.isArray(res)) {
        setHistoryList(res);
      } else if (res?.data?.items) {
        setHistoryList(res.data.items);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err: any) {
      console.error("Lỗi tải lịch sử dữ liệu:", err);
      toast.error(err?.response?.data?.message || "Không thể tải lịch sử dữ liệu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [search, entityFilter, statusFilter]);

  const hasActiveFilters = Boolean(search.trim()) || entityFilter !== "all" || statusFilter !== "all";

  const clearAllFilters = () => {
    setSearch("");
    setTempSearch("");
    setEntityFilter("all");
    setStatusFilter("all");
    setSearchOpen(false);
    setEntityFilterOpen(false);
    setStatusFilterOpen(false);
    if (hasActiveFilters) {
      toast.success("Đã xóa tất cả bộ lọc");
    } else {
      toast("Không có bộ lọc nào đang áp dụng", { icon: "ℹ️" });
    }
  };

  const handleApplySearch = () => {
    setSearch(tempSearch.trim());
    setSearchOpen(false);
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Thực hiện khôi phục bản ghi
  const handleConfirmRestore = async () => {
    if (!restoringItem) return;
    try {
      setIsRestoring(true);
      const res = await api.post(`/admin/history/${restoringItem.id}/restore`);
      toast.success(res?.message || "Khôi phục dữ liệu vào Database thành công!");
      setRestoringItem(null);
      await loadHistory();
    } catch (err: any) {
      console.error("Lỗi khôi phục:", err);
      toast.error(err?.response?.data?.message || "Không thể khôi phục dữ liệu.");
    } finally {
      setIsRestoring(false);
    }
  };

  // Thực hiện xóa vĩnh viễn nhiều bản ghi khỏi lịch sử
  const handleBatchDeleteHistory = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsDeletingBatch(true);
      const idsArray = Array.from(selectedIds);
      await api.post("/admin/history/batch-delete", { ids: idsArray });
      toast.success(`Đã xóa vĩnh viễn ${idsArray.length} bản ghi khỏi lịch sử!`);
      setSelectedIds(new Set());
      setIsSelecting(false);
      setShowBatchDeleteModal(false);
      await loadHistory();
    } catch (err: any) {
      console.error("Lỗi xóa lịch sử:", err);
      toast.error(err?.response?.data?.message || "Không thể xóa lịch sử dữ liệu.");
    } finally {
      setIsDeletingBatch(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Lịch sử dữ liệu
            </h1>
          </div>
          <p className="text-slate-500 text-xs md:text-sm">
            Theo dõi nhật ký thay đổi, snapshot dữ liệu đã xóa và khôi phục trực tiếp vào Database
          </p>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Tổng số sự kiện</div>
            <div className="text-xl font-extrabold text-slate-900">{stats.total}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-orange-200/80 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-orange-50/30">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-orange-700 font-medium">Chờ khôi phục</div>
            <div className="text-xl font-extrabold text-orange-600">{stats.pending}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center gap-3 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-emerald-700 font-medium">Đã khôi phục</div>
            <div className="text-xl font-extrabold text-emerald-600">{stats.restored}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-center">
          <div className="text-xs text-slate-500 font-medium mb-1">Theo đối tượng</div>
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600">
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              SP: {stats.byEntity?.product || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
              User: {stats.byEntity?.user || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Đơn: {stats.byEntity?.order || 0}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              Mã: {stats.byEntity?.voucher || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-6 rounded-full bg-orange-500" />
              <h2 className="text-xl font-bold text-slate-900">Nhật ký dữ liệu & Khôi phục</h2>
            </div>

            <button
              type="button"
              onClick={clearAllFilters}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                hasActiveFilters
                  ? "text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border-orange-200 shadow-sm active:scale-95"
                  : "text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200"
              }`}
              title="Xóa tất cả bộ lọc tìm kiếm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Xóa lọc</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {!isSelecting ? (
              <button
                type="button"
                onClick={() => {
                  setIsSelecting(true);
                  setSelectedIds(new Set());
                }}
                disabled={isLoading || historyList.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Bấm để chọn bản ghi lịch sử cần xóa vĩnh viễn"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Chọn</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsSelecting(false);
                    setSelectedIds(new Set());
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedIds.size === 0) {
                      toast.error("Vui lòng chọn ít nhất một bản ghi lịch sử để xóa!");
                      return;
                    }
                    setShowBatchDeleteModal(true);
                  }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer ${
                    selectedIds.size > 0 ? "bg-red-600 hover:bg-red-700" : "bg-red-500/80 hover:bg-red-600"
                  }`}
                  title="Xóa vĩnh viễn các bản ghi đã chọn khỏi lịch sử"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoading}
              className="flex items-center justify-center p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Bảng dữ liệu */}
        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
            Đang tải dữ liệu lịch sử...
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  {/* Cột chọn checkbox khi ở chế độ Chọn */}
                  {isSelecting && (
                    <th
                      className="p-3 border-b w-12 text-center cursor-pointer select-none"
                      onClick={() => {
                        const allSelected =
                          historyList.length > 0 && historyList.every((h) => selectedIds.has(h.id));
                        if (allSelected) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(historyList.map((h) => h.id)));
                        }
                      }}
                      title="Chọn tất cả"
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={
                            historyList.length > 0 && historyList.every((h) => selectedIds.has(h.id))
                          }
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(new Set(historyList.map((h) => h.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                        />
                      </div>
                    </th>
                  )}

                  {/* ID */}
                  <th className="p-3 border-b min-w-[70px] text-xs font-bold text-slate-700">Mã</th>

                  {/* Thời gian */}
                  <th className="p-3 border-b min-w-[160px] text-xs font-bold text-slate-700">Thời gian</th>

                  {/* Đối tượng (Popover filter) */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={entityRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEntityFilterOpen((prev) => !prev);
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-xs transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          entityFilter !== "all" ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để lọc theo đối tượng dữ liệu"
                      >
                        <span>Đối tượng</span>
                        <Filter
                          className={`w-3.5 h-3.5 ${
                            entityFilter !== "all" ? "text-orange-600 fill-orange-500" : "text-slate-400"
                          }`}
                        />
                        {entityFilter !== "all" && <span className="w-2 h-2 rounded-full bg-orange-600" />}
                      </button>

                      {entityFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Lọc theo đối tượng</div>
                          <div className="space-y-1">
                            {[
                              { value: "all", label: "Tất cả đối tượng" },
                              { value: "product", label: "Sản phẩm" },
                              { value: "user", label: "Người dùng" },
                              { value: "order", label: "Đơn hàng" },
                              { value: "voucher", label: "Mã ưu đãi" },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setEntityFilter(opt.value);
                                  setEntityFilterOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  entityFilter === opt.value
                                    ? "bg-orange-50 text-orange-600 font-bold"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Hành động */}
                  <th className="p-3 border-b min-w-[130px] text-xs font-bold text-slate-700">Hành động</th>

                  {/* Nội dung thay đổi (Search popover) */}
                  <th className="p-3 border-b min-w-[320px] relative">
                    <div ref={searchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!searchOpen) setTempSearch(search);
                          setSearchOpen((prev) => !prev);
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-xs transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          search ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm nội dung"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${search ? "text-orange-600" : "text-slate-400"}`}
                        />
                        <span>Nội dung thay đổi</span>
                        {search && <span className="w-2 h-2 rounded-full bg-orange-600" />}
                      </button>

                      {searchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm nội dung</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempSearch}
                            onChange={(e) => setTempSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplySearch();
                              }
                            }}
                            placeholder="Nhập tên sản phẩm, mã, email..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempSearch("");
                                setSearch("");
                                setSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplySearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Trạng thái (Popover filter) */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={statusRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilterOpen((prev) => !prev);
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-xs transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          statusFilter !== "all" ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để lọc theo trạng thái khôi phục"
                      >
                        <span>Trạng thái</span>
                        <Filter
                          className={`w-3.5 h-3.5 ${
                            statusFilter !== "all" ? "text-orange-600 fill-orange-500" : "text-slate-400"
                          }`}
                        />
                        {statusFilter !== "all" && <span className="w-2 h-2 rounded-full bg-orange-600" />}
                      </button>

                      {statusFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Lọc trạng thái</div>
                          <div className="space-y-1">
                            {[
                              { value: "all", label: "Tất cả trạng thái" },
                              { value: "pending", label: "Chờ khôi phục" },
                              { value: "restored", label: "Đã khôi phục" },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setStatusFilter(opt.value);
                                  setStatusFilterOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  statusFilter === opt.value
                                    ? "bg-orange-50 text-orange-600 font-bold"
                                    : "text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Thao tác */}
                  <th className="p-3 border-b min-w-[160px] text-center text-xs font-bold text-slate-700">
                    Thao tác
                  </th>
                </tr>
              </thead>

              <tbody>
                {historyList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isSelecting ? 8 : 7}
                      className="py-16 text-center text-slate-500 font-medium"
                    >
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="text-slate-600 text-sm font-semibold">
                          Chưa có lịch sử thay đổi dữ liệu nào phù hợp.
                        </p>
                        <p className="text-slate-400 text-xs">
                          Khi có bản ghi sản phẩm, người dùng, đơn hàng hoặc mã ưu đãi bị xóa, hệ thống sẽ lưu lại snapshot tại đây để bạn có thể khôi phục bất cứ lúc nào.
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
                  historyList.map((item) => {
                    const isChecked = selectedIds.has(item.id);
                    const entity = getEntityBadge(item.entity_type);
                    const EntityIcon = entity.icon;
                    const action = getActionBadge(item.action_type);

                    return (
                      <tr
                        key={item.id}
                        onClick={isSelecting ? () => toggleSelectId(item.id) : undefined}
                        className={`transition-colors select-none ${
                          isChecked ? "bg-orange-50/70 hover:bg-orange-100/60" : "hover:bg-slate-50/70"
                        } ${isSelecting ? "cursor-pointer" : ""}`}
                      >
                        {/* Checkbox khi ở chế độ Chọn */}
                        {isSelecting && (
                          <td
                            className="p-3 border-b text-center w-12 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectId(item.id);
                            }}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectId(item.id)}
                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                              />
                            </div>
                          </td>
                        )}

                        {/* ID */}
                        <td className="p-3 border-b whitespace-nowrap font-bold text-slate-400 text-xs">
                          #{item.id}
                        </td>

                        {/* Thời gian */}
                        <td className="p-3 border-b whitespace-nowrap text-xs text-slate-600">
                          {formatDate(item.created_at)}
                        </td>

                        {/* Đối tượng */}
                        <td className="p-3 border-b whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${entity.badgeClass}`}
                          >
                            <EntityIcon className="w-3.5 h-3.5" />
                            <span>{entity.label}</span>
                          </span>
                        </td>

                        {/* Hành động */}
                        <td className="p-3 border-b whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${action.badgeClass}`}
                          >
                            {action.label}
                          </span>
                        </td>

                        {/* Nội dung thay đổi */}
                        <td className="p-3 border-b">
                          <div className="font-semibold text-slate-900 text-xs">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {item.description}
                          </div>
                          {item.item_count > 1 && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {item.item_count} bản ghi
                            </span>
                          )}
                        </td>

                        {/* Trạng thái */}
                        <td className="p-3 border-b whitespace-nowrap">
                          {item.is_restored ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã khôi phục</span>
                              </span>
                              {item.restored_at && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {formatDate(item.restored_at)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3" />
                              <span>Chờ khôi phục</span>
                            </span>
                          )}
                        </td>

                        {/* Thao tác: Khôi phục & Xem chi tiết */}
                        <td className="p-3 border-b text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {!item.is_restored ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRestoringItem(item);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                                title="Bấm để khôi phục dữ liệu về Database"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>Khôi phục</span>
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 px-2 py-1">
                                Đã khôi phục
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingItem(item);
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Xem chi tiết snapshot dữ liệu sao lưu"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Xác nhận Khôi phục */}
      {restoringItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isRestoring && setRestoringItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto mb-4">
              <Undo2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-slate-900 mb-1">
              Khôi phục dữ liệu vào Database?
            </h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Hệ thống sẽ nạp lại chính xác bản ghi này vào cơ sở dữ liệu ({getEntityBadge(restoringItem.entity_type).label}). Dữ liệu sau khi phục hồi sẽ xuất hiện lại trên trang quản lý tương ứng.
            </p>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 mb-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Đối tượng:</span>
                <span className="font-bold text-slate-800">{getEntityBadge(restoringItem.entity_type).label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tiêu đề:</span>
                <span className="font-bold text-slate-800">{restoringItem.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Số lượng:</span>
                <span className="font-bold text-orange-600">{restoringItem.item_count} bản ghi</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <div className="text-slate-500 mb-1">Mô tả:</div>
                <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                  {restoringItem.description}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRestoringItem(null)}
                disabled={isRestoring}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang khôi phục...</span>
                  </>
                ) : (
                  <>
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Xác nhận khôi phục</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết Snapshot */}
      {viewingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setViewingItem(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150 text-slate-800 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Chi tiết Snapshot #{viewingItem.id} ({getEntityBadge(viewingItem.entity_type).label})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-3 overflow-y-auto flex-1 text-xs">
              <div>
                <span className="font-bold text-slate-700">Tiêu đề:</span>{" "}
                <span className="text-slate-900">{viewingItem.title}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Mô tả:</span>{" "}
                <span className="text-slate-600">{viewingItem.description}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Thời điểm tạo:</span>{" "}
                <span className="text-slate-600">{formatDate(viewingItem.created_at)}</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Trạng thái:</span>{" "}
                <span className="font-bold text-orange-600">
                  {viewingItem.is_restored ? "Đã khôi phục" : "Chưa khôi phục"}
                </span>
              </div>

              <div className="pt-2">
                <div className="font-bold text-slate-700 mb-1.5">Dữ liệu bản ghi (JSON Snapshot):</div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-80">
                  {JSON.stringify(viewingItem.snapshot_data, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              {!viewingItem.is_restored && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingItem;
                    setViewingItem(null);
                    setRestoringItem(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Khôi phục bản ghi này</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa Hàng Loạt Khỏi Lịch Sử */}
      {showBatchDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeletingBatch && setShowBatchDeleteModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-150 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-slate-900 mb-1">
              Xóa {selectedIds.size} bản ghi lịch sử?
            </h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Bạn có chắc chắn muốn xóa vĩnh viễn {selectedIds.size} bản ghi này khỏi lịch sử không? Sau khi xóa khỏi lịch sử, bạn sẽ không thể khôi phục lại dữ liệu của các bản ghi này nữa.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isDeletingBatch}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleBatchDeleteHistory}
                disabled={isDeletingBatch}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeletingBatch ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

