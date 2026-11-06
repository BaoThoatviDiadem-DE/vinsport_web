import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Ticket,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  X,
  Edit3,
  Check,
  RotateCcw,
  CheckSquare,
} from "lucide-react";
import api from "../api/api";
import toast from "react-hot-toast";

export interface VoucherItem {
  code: string;
  description: string;
  discountType: "PERCENT" | "FIXED" | "SHIPPING";
  discountValue: number;
  maxDiscount: number;
  minOrderAmount: number;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function removeVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();
}

function formatPrice(val: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(val || 0);
}

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [originalVouchers, setOriginalVouchers] = useState<VoucherItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Chế độ chỉnh sửa trực tiếp trên bảng
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // State tìm kiếm theo từng cột
  const [codeSearch, setCodeSearch] = useState("");
  const [descSearch, setDescSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [discountValueSearch, setDiscountValueSearch] = useState("");
  const [minOrderSearch, setMinOrderSearch] = useState("");
  const [maxDiscountSearch, setMaxDiscountSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State tạm thời khi nhập trong Popover tìm kiếm
  const [tempCodeSearch, setTempCodeSearch] = useState("");
  const [tempDescSearch, setTempDescSearch] = useState("");
  const [tempDiscountValueSearch, setTempDiscountValueSearch] = useState("");
  const [tempMinOrderSearch, setTempMinOrderSearch] = useState("");
  const [tempMaxDiscountSearch, setTempMaxDiscountSearch] = useState("");

  // Trạng thái mở/đóng Popover ở từng cột
  const [codeSearchOpen, setCodeSearchOpen] = useState(false);
  const [descSearchOpen, setDescSearchOpen] = useState(false);
  const [typeFilterOpen, setTypeFilterOpen] = useState(false);
  const [discountValueSearchOpen, setDiscountValueSearchOpen] = useState(false);
  const [minOrderSearchOpen, setMinOrderSearchOpen] = useState(false);
  const [maxDiscountSearchOpen, setMaxDiscountSearchOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  // Ref cho các Popover
  const codeSearchRef = useRef<HTMLDivElement>(null);
  const descSearchRef = useRef<HTMLDivElement>(null);
  const typeFilterRef = useRef<HTMLDivElement>(null);
  const discountValueSearchRef = useRef<HTMLDivElement>(null);
  const minOrderSearchRef = useRef<HTMLDivElement>(null);
  const maxDiscountSearchRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);

  // Modal Thêm mã mới
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState<VoucherItem>({
    code: "",
    description: "",
    discountType: "PERCENT",
    discountValue: 10,
    maxDiscount: 100000,
    minOrderAmount: 200000,
    isActive: true,
    expiresAt: "",
  });

  // Chế độ Chọn (Select mode) để xóa nhiều bản ghi
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const toggleSelectCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedCodes.size === 0) return;
    setIsDeletingBatch(true);
    try {
      const codesArray = Array.from(selectedCodes);
      await api.post("/admin/vouchers/batch-delete", { codes: codesArray });
      toast.success(`Đã xóa thành công ${codesArray.length} mã ưu đãi!`);
      setVouchers((prev) => prev.filter((v) => !selectedCodes.has(v.code)));
      setOriginalVouchers((prev) => prev.filter((v) => !selectedCodes.has(v.code)));
      setSelectedCodes(new Set());
      setIsSelecting(false);
      setShowBatchDeleteModal(false);
    } catch (err: any) {
      console.error("Lỗi xóa hàng loạt mã ưu đãi:", err);
      toast.error(err?.response?.data?.message || "Không thể xóa các mã ưu đãi đã chọn");
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Modal Xóa lẻ
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const closeOtherPopovers = (except?: string) => {
    if (except !== "code") setCodeSearchOpen(false);
    if (except !== "desc") setDescSearchOpen(false);
    if (except !== "type") setTypeFilterOpen(false);
    if (except !== "discountValue") setDiscountValueSearchOpen(false);
    if (except !== "minOrder") setMinOrderSearchOpen(false);
    if (except !== "maxDiscount") setMaxDiscountSearchOpen(false);
    if (except !== "status") setStatusFilterOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (codeSearchRef.current && !codeSearchRef.current.contains(target)) {
        setCodeSearchOpen(false);
      }
      if (descSearchRef.current && !descSearchRef.current.contains(target)) {
        setDescSearchOpen(false);
      }
      if (typeFilterRef.current && !typeFilterRef.current.contains(target)) {
        setTypeFilterOpen(false);
      }
      if (discountValueSearchRef.current && !discountValueSearchRef.current.contains(target)) {
        setDiscountValueSearchOpen(false);
      }
      if (minOrderSearchRef.current && !minOrderSearchRef.current.contains(target)) {
        setMinOrderSearchOpen(false);
      }
      if (maxDiscountSearchRef.current && !maxDiscountSearchRef.current.contains(target)) {
        setMaxDiscountSearchOpen(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(target)) {
        setStatusFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleApplyCodeSearch = () => {
    setCodeSearch(tempCodeSearch.trim());
    setCodeSearchOpen(false);
  };

  const handleApplyDescSearch = () => {
    setDescSearch(tempDescSearch.trim());
    setDescSearchOpen(false);
  };

  const handleApplyDiscountValueSearch = () => {
    setDiscountValueSearch(tempDiscountValueSearch.trim());
    setDiscountValueSearchOpen(false);
  };

  const handleApplyMinOrderSearch = () => {
    setMinOrderSearch(tempMinOrderSearch.trim());
    setMinOrderSearchOpen(false);
  };

  const handleApplyMaxDiscountSearch = () => {
    setMaxDiscountSearch(tempMaxDiscountSearch.trim());
    setMaxDiscountSearchOpen(false);
  };

  // Tải danh sách mã ưu đãi
  const fetchVouchers = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      else setIsLoading(true);

      const res: any = await api.get("/admin/vouchers");
      if (res?.success && Array.isArray(res?.vouchers)) {
        setVouchers(res.vouchers);
        setOriginalVouchers(JSON.parse(JSON.stringify(res.vouchers)));
        if (showToast) {
          toast.success("Đã làm mới danh sách mã ưu đãi!");
        }
      }
    } catch (err: any) {
      console.error("Lỗi nạp vouchers:", err);
      toast.error(err?.response?.data?.message || "Không thể tải danh sách mã ưu đãi");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const hasActiveFilters =
    Boolean(codeSearch.trim()) ||
    Boolean(descSearch.trim()) ||
    typeFilter !== "all" ||
    Boolean(discountValueSearch.trim()) ||
    Boolean(minOrderSearch.trim()) ||
    Boolean(maxDiscountSearch.trim()) ||
    statusFilter !== "all";

  const clearAllFilters = () => {
    setCodeSearch("");
    setTempCodeSearch("");
    setDescSearch("");
    setTempDescSearch("");
    setTypeFilter("all");
    setDiscountValueSearch("");
    setTempDiscountValueSearch("");
    setMinOrderSearch("");
    setTempMinOrderSearch("");
    setMaxDiscountSearch("");
    setTempMaxDiscountSearch("");
    setStatusFilter("all");

    if (hasActiveFilters) {
      toast.success("Đã xóa tất cả bộ lọc");
    } else {
      toast("Không có bộ lọc nào đang áp dụng", { icon: "ℹ️" });
    }
  };

  // Lọc danh sách theo popovers ở các cột
  const filteredVouchers = useMemo(() => {
    const codeQ = codeSearch.trim().toLowerCase();
    const descQRaw = descSearch.trim().toLowerCase();
    const descQClean = removeVietnameseTones(descQRaw);

    const discountDigits = discountValueSearch.trim().replace(/\D/g, "");
    const discountRaw = discountValueSearch.trim().toLowerCase();

    const minDigits = minOrderSearch.trim().replace(/\D/g, "");
    const minRaw = minOrderSearch.trim().toLowerCase();
    const minClean = removeVietnameseTones(minRaw);

    const maxDigits = maxDiscountSearch.trim().replace(/\D/g, "");
    const maxRaw = maxDiscountSearch.trim().toLowerCase();
    const maxClean = removeVietnameseTones(maxRaw);

    return vouchers.filter((v) => {
      const code = (v.code || "").toLowerCase();
      const desc = (v.description || "").toLowerCase();
      const descClean = removeVietnameseTones(v.description || "");

      const matchesCode = !codeQ || code.includes(codeQ);
      const matchesDesc =
        !descQRaw || desc.includes(descQRaw) || descClean.includes(descQClean);
      const matchesType = typeFilter === "all" || v.discountType === typeFilter;

      const matchesDiscountValue =
        !discountRaw ||
        String(v.discountValue).includes(discountDigits || discountRaw) ||
        (v.discountType === "PERCENT" && `${v.discountValue}%`.toLowerCase().includes(discountRaw)) ||
        formatPrice(v.discountValue).toLowerCase().includes(discountRaw);

      const matchesMinOrder =
        !minRaw ||
        (minDigits.length > 0 && String(v.minOrderAmount).includes(minDigits)) ||
        formatPrice(v.minOrderAmount).toLowerCase().includes(minRaw) ||
        (v.minOrderAmount === 0 && (minRaw.includes("0") || minClean.includes("khong")));

      const matchesMaxDiscount =
        !maxRaw ||
        (maxDigits.length > 0 && String(v.maxDiscount).includes(maxDigits)) ||
        formatPrice(v.maxDiscount).toLowerCase().includes(maxRaw) ||
        (v.maxDiscount === 0 && (maxRaw.includes("0") || maxClean.includes("khong")));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && v.isActive) ||
        (statusFilter === "inactive" && !v.isActive);

      return (
        matchesCode &&
        matchesDesc &&
        matchesType &&
        matchesDiscountValue &&
        matchesMinOrder &&
        matchesMaxDiscount &&
        matchesStatus
      );
    });
  }, [
    vouchers,
    codeSearch,
    descSearch,
    typeFilter,
    discountValueSearch,
    minOrderSearch,
    maxDiscountSearch,
    statusFilter,
  ]);

  // Xử lý bật/tắt chế độ Chỉnh sửa trực tiếp
  const handleStartEdit = () => {
    setOriginalVouchers(JSON.parse(JSON.stringify(vouchers)));
    setIsEditingTable(true);
  };

  const handleCancelEdit = () => {
    setVouchers(JSON.parse(JSON.stringify(originalVouchers)));
    setIsEditingTable(false);
  };

  const handleFieldChange = (code: string, field: keyof VoucherItem, value: any) => {
    setVouchers((prev) =>
      prev.map((v) => (v.code === code ? { ...v, [field]: value } : v))
    );
  };

  const handleTableKeyDown = (e: React.KeyboardEvent<any>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isSavingAll) {
        handleSaveAllVouchers();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Cập nhật tất cả các thay đổi vào DB
  const handleSaveAllVouchers = async () => {
    try {
      setIsSavingAll(true);

      const modifiedVouchers = vouchers.filter((v) => {
        const orig = originalVouchers.find((o) => o.code === v.code);
        if (!orig) return false;
        return (
          v.description !== orig.description ||
          v.discountType !== orig.discountType ||
          Number(v.discountValue) !== Number(orig.discountValue) ||
          Number(v.maxDiscount) !== Number(orig.maxDiscount) ||
          Number(v.minOrderAmount) !== Number(orig.minOrderAmount) ||
          v.isActive !== orig.isActive
        );
      });

      if (modifiedVouchers.length === 0) {
        alert("Không có dữ liệu mã ưu đãi nào thay đổi.");
        setIsEditingTable(false);
        return;
      }

      for (const v of modifiedVouchers) {
        if (!v.description?.trim()) {
          throw new Error(`Mô tả của mã "${v.code}" không được để trống`);
        }
        const val = Number(v.discountValue);
        if (isNaN(val) || val <= 0) {
          throw new Error(`Mức giảm của mã "${v.code}" phải lớn hơn 0`);
        }
      }

      await Promise.all(
        modifiedVouchers.map((v) =>
          api.put(`/admin/vouchers/${v.code}`, {
            description: v.description.trim(),
            discountType: v.discountType,
            discountValue: Number(v.discountValue),
            maxDiscount: Number(v.maxDiscount) || 0,
            minOrderAmount: Number(v.minOrderAmount) || 0,
            isActive: v.isActive,
          })
        )
      );

      toast.success(`Cập nhật thành công ${modifiedVouchers.length} mã ưu đãi!`);
      setIsEditingTable(false);
      await fetchVouchers();
    } catch (error: any) {
      console.error("Lỗi cập nhật mã ưu đãi:", error);
      toast.error(error?.response?.data?.message || error?.message || "Không cập nhật được mã ưu đãi");
    } finally {
      setIsSavingAll(false);
    }
  };

  // Mở modal thêm mới
  const handleOpenAddModal = () => {
    setFormData({
      code: "",
      description: "",
      discountType: "PERCENT",
      discountValue: 10,
      maxDiscount: 100000,
      minOrderAmount: 200000,
      isActive: true,
      expiresAt: "",
    });
    setFormError("");
    setIsModalOpen(true);
  };

  // Submit modal thêm mới
  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError("Mã ưu đãi không được để trống");
      return;
    }

    if (!formData.description.trim()) {
      setFormError("Mô tả ưu đãi không được để trống");
      return;
    }

    if (Number(formData.discountValue) <= 0) {
      setFormError("Giá trị giảm giá phải lớn hơn 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/admin/vouchers", {
        code: cleanCode,
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxDiscount: Number(formData.maxDiscount) || 0,
        minOrderAmount: Number(formData.minOrderAmount) || 0,
        isActive: formData.isActive,
        expiresAt: formData.expiresAt || null,
      });

      toast.success(`Thêm mới mã "${cleanCode}" thành công!`);
      setIsModalOpen(false);
      fetchVouchers();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Lỗi lưu mã ưu đãi";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác nhận xóa mã
  const handleDeleteVoucher = async () => {
    if (!deletingCode) return;
    setIsDeleting(true);
    try {
      await api.delete(`/admin/vouchers/${deletingCode}`);
      toast.success(`Đã xóa mã "${deletingCode}"`);
      setVouchers((prev) => prev.filter((v) => v.code !== deletingCode));
      setDeletingCode(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Lỗi khi xóa mã ưu đãi");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* 1. Header Tiêu đề */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-6 rounded-full bg-orange-500" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý mã ưu đãi
          </h1>
        </div>
      </div>

      {/* 2. Danh Sách & Bảng Mã Ưu Đãi */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-6 rounded-full bg-orange-500" />
              <h2 className="text-xl font-bold text-slate-900">Danh sách mã ưu đãi</h2>
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
            {!isEditingTable ? (
              <>
                {!isSelecting ? (
                  <>
                    <button
                      type="button"
                      onClick={handleOpenAddModal}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
                      title="Thêm mã ưu đãi mới"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm mã ưu đãi</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartEdit}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Bấm để chỉnh sửa dữ liệu mã ưu đãi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsSelecting(true);
                        setSelectedCodes(new Set());
                      }}
                      disabled={isLoading || vouchers.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Bấm để chọn bản ghi cần xóa"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Chọn</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSelecting(false);
                        setSelectedCodes(new Set());
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Hủy
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedCodes.size === 0) {
                          toast.error("Vui lòng chọn ít nhất một bản ghi để xóa!");
                          return;
                        }
                        setShowBatchDeleteModal(true);
                      }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer ${
                        selectedCodes.size > 0
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-red-500/80 hover:bg-red-600"
                      }`}
                      title="Xóa các bản ghi đã chọn"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa{selectedCodes.size > 0 ? ` (${selectedCodes.size})` : ""}</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSavingAll}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllVouchers}
                  disabled={isSavingAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  title="Cập nhật các thay đổi vào cơ sở dữ liệu"
                >
                  {isSavingAll ? (
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
              onClick={() => fetchVouchers(true)}
              disabled={isLoading || isRefreshing}
              className="flex items-center justify-center p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading || isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Đang tải danh sách mã ưu đãi...
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[380px] rounded-2xl border border-slate-100">
            <table className="w-full min-w-[950px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  {/* Ô chọn hàng loạt khi bật chế độ Chọn */}
                  {isSelecting && (
                    <th
                      className="p-3 border-b w-12 text-center cursor-pointer select-none"
                      onClick={() => {
                        const allSelected =
                          filteredVouchers.length > 0 &&
                          filteredVouchers.every((v) => selectedCodes.has(v.code));
                        if (allSelected) {
                          setSelectedCodes(new Set());
                        } else {
                          setSelectedCodes(new Set(filteredVouchers.map((v) => v.code)));
                        }
                      }}
                      title="Chọn tất cả bản ghi"
                    >
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredVouchers.length > 0 &&
                            filteredVouchers.every((v) => selectedCodes.has(v.code))
                          }
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCodes(new Set(filteredVouchers.map((v) => v.code)));
                            } else {
                              setSelectedCodes(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                        />
                      </div>
                    </th>
                  )}

                  {/* Mã ưu đãi */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={codeSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!codeSearchOpen) setTempCodeSearch(codeSearch);
                          setCodeSearchOpen((prev) => !prev);
                          closeOtherPopovers("code");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          codeSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm theo Mã ưu đãi"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${
                            codeSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span>Mã ưu đãi</span>
                        {codeSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {codeSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Mã ưu đãi</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempCodeSearch}
                            onChange={(e) => setTempCodeSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyCodeSearch();
                              }
                            }}
                            placeholder="Nhập mã (vd: VINSPORT10)..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2 uppercase font-mono"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempCodeSearch("");
                                setCodeSearch("");
                                setCodeSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyCodeSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Mô tả */}
                  <th className="p-3 border-b min-w-[220px] relative">
                    <div ref={descSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!descSearchOpen) setTempDescSearch(descSearch);
                          setDescSearchOpen((prev) => !prev);
                          closeOtherPopovers("desc");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          descSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm theo mô tả"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${
                            descSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span>Mô tả</span>
                        {descSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {descSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[260px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Mô tả</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempDescSearch}
                            onChange={(e) => setTempDescSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyDescSearch();
                              }
                            }}
                            placeholder="Nhập từ khóa mô tả..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempDescSearch("");
                                setDescSearch("");
                                setDescSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyDescSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Loại giảm giá */}
                  <th className="p-3 border-b min-w-[160px] relative">
                    <div ref={typeFilterRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTypeFilterOpen((prev) => !prev);
                          closeOtherPopovers("type");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          typeFilter !== "all" ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để lọc theo loại ưu đãi"
                      >
                        <span>Loại giảm giá</span>
                        <Filter
                          className={`w-3.5 h-3.5 transition-colors ${
                            typeFilter !== "all"
                              ? "text-orange-600 fill-orange-500"
                              : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        {typeFilter !== "all" && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {typeFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[220px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Lọc theo loại</div>
                          <div className="space-y-1.5">
                            {[
                              { value: "all", label: "Tất cả loại" },
                              { value: "PERCENT", label: "Giảm phần trăm (%)" },
                              { value: "FIXED", label: "Giảm tiền mặt (đ)" },
                              { value: "SHIPPING", label: "Miễn phí ship" },
                            ].map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                  setTypeFilter(opt.value);
                                  setTypeFilterOpen(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                                  typeFilter === opt.value
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

                  {/* Mức giảm */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={discountValueSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!discountValueSearchOpen) setTempDiscountValueSearch(discountValueSearch);
                          setDiscountValueSearchOpen((prev) => !prev);
                          closeOtherPopovers("discountValue");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          discountValueSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm theo mức giảm"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${
                            discountValueSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span>Mức giảm</span>
                        {discountValueSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {discountValueSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Mức giảm</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempDiscountValueSearch}
                            onChange={(e) => setTempDiscountValueSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyDiscountValueSearch();
                              }
                            }}
                            placeholder="Nhập mức giảm (vd: 10, 50000)..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempDiscountValueSearch("");
                                setDiscountValueSearch("");
                                setDiscountValueSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyDiscountValueSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Đơn tối thiểu */}
                  <th className="p-3 border-b min-w-[160px] relative">
                    <div ref={minOrderSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!minOrderSearchOpen) setTempMinOrderSearch(minOrderSearch);
                          setMinOrderSearchOpen((prev) => !prev);
                          closeOtherPopovers("minOrder");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          minOrderSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm theo đơn tối thiểu"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${
                            minOrderSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span>Đơn tối thiểu</span>
                        {minOrderSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {minOrderSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Đơn tối thiểu</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempMinOrderSearch}
                            onChange={(e) => setTempMinOrderSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyMinOrderSearch();
                              }
                            }}
                            placeholder="Nhập số tiền (vd: 200000)..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempMinOrderSearch("");
                                setMinOrderSearch("");
                                setMinOrderSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyMinOrderSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Giảm tối đa */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={maxDiscountSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!maxDiscountSearchOpen) setTempMaxDiscountSearch(maxDiscountSearch);
                          setMaxDiscountSearchOpen((prev) => !prev);
                          closeOtherPopovers("maxDiscount");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          maxDiscountSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để tìm kiếm theo giảm tối đa"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${
                            maxDiscountSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        <span>Giảm tối đa</span>
                        {maxDiscountSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {maxDiscountSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Giảm tối đa</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempMaxDiscountSearch}
                            onChange={(e) => setTempMaxDiscountSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyMaxDiscountSearch();
                              }
                            }}
                            placeholder="Nhập số tiền (vd: 100000)..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempMaxDiscountSearch("");
                                setMaxDiscountSearch("");
                                setMaxDiscountSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyMaxDiscountSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Trạng thái */}
                  <th className="p-3 border-b min-w-[140px] text-center relative">
                    <div ref={statusFilterRef} className="relative inline-block text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusFilterOpen((prev) => !prev);
                          closeOtherPopovers("status");
                        }}
                        className={`inline-flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-200/80 cursor-pointer ${
                          statusFilter !== "all" ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                        }`}
                        title="Bấm để lọc theo trạng thái"
                      >
                        <span>Trạng thái</span>
                        <Filter
                          className={`w-3.5 h-3.5 transition-colors ${
                            statusFilter !== "all"
                              ? "text-orange-600 fill-orange-500"
                              : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        {statusFilter !== "all" && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {statusFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-2 z-40 w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800 text-left"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Lọc trạng thái</div>
                          <div className="space-y-1.5">
                            {[
                              { value: "all", label: "Tất cả trạng thái" },
                              { value: "active", label: "Hoạt động" },
                              { value: "inactive", label: "Tạm dừng" },
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
                </tr>
              </thead>

              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={isSelecting ? 8 : 7} className="py-16 text-center text-slate-500 font-medium">
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="text-slate-600 text-sm font-semibold">
                          Không tìm thấy mã ưu đãi nào phù hợp với bộ lọc.
                        </p>
                        <p className="text-slate-400 text-xs">
                          Thử kiểm tra lại từ khóa tìm kiếm hoặc bấm &quot;Xóa tất cả lọc&quot; để xem toàn bộ danh sách.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 text-xs font-semibold border border-orange-200 transition-colors cursor-pointer"
                          >
                            Xóa tất cả lọc
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((v) => {
                    const isChecked = selectedCodes.has(v.code);
                    return (
                      <tr
                        key={v.code}
                        onClick={isSelecting ? () => toggleSelectCode(v.code) : undefined}
                        className={`transition-colors select-none ${
                          isChecked
                            ? "bg-orange-50/70 hover:bg-orange-100/60"
                            : "hover:bg-slate-50/70"
                        } ${isSelecting ? "cursor-pointer" : ""}`}
                      >
                        {/* Ô trống chọn bản ghi */}
                        {isSelecting && (
                          <td
                            className="p-3 border-b text-center w-12 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectCode(v.code);
                            }}
                          >
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => toggleSelectCode(v.code)}
                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                              />
                            </div>
                          </td>
                        )}

                        {/* Mã code (Read-only partition key) */}
                        <td className="p-3 border-b whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                          {v.code}
                        </span>
                      </td>

                      {/* Mô tả */}
                      <td className="p-3 border-b min-w-[200px]">
                        {isEditingTable ? (
                          <input
                            type="text"
                            value={v.description}
                            onChange={(e) => handleFieldChange(v.code, "description", e.target.value)}
                            onKeyDown={handleTableKeyDown}
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <span className="text-slate-800 text-xs font-medium line-clamp-2">
                            {v.description}
                          </span>
                        )}
                      </td>

                      {/* Loại giảm giá */}
                      <td className="p-3 border-b min-w-[150px]">
                        {isEditingTable ? (
                          <select
                            value={v.discountType}
                            onChange={(e) => handleFieldChange(v.code, "discountType", e.target.value)}
                            onKeyDown={handleTableKeyDown}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white font-medium"
                          >
                            <option value="PERCENT">Giảm phần trăm (%)</option>
                            <option value="FIXED">Giảm tiền mặt (đ)</option>
                            <option value="SHIPPING">Miễn phí ship</option>
                          </select>
                        ) : (
                          <>
                            {v.discountType === "PERCENT" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                                Giảm theo %
                              </span>
                            )}
                            {v.discountType === "FIXED" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Giảm tiền mặt
                              </span>
                            )}
                            {v.discountType === "SHIPPING" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                                Miễn phí ship
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Mức giảm */}
                      <td className="p-3 border-b min-w-[120px]">
                        {isEditingTable ? (
                          <input
                            type="number"
                            value={v.discountValue}
                            onChange={(e) => handleFieldChange(v.code, "discountValue", Number(e.target.value))}
                            onKeyDown={handleTableKeyDown}
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white font-medium"
                          />
                        ) : (
                          <span className="font-semibold text-slate-900 text-xs">
                            {v.discountType === "PERCENT"
                              ? `${v.discountValue}%`
                              : formatPrice(v.discountValue)}
                          </span>
                        )}
                      </td>

                      {/* Đơn tối thiểu */}
                      <td className="p-3 border-b min-w-[130px]">
                        {isEditingTable ? (
                          <input
                            type="number"
                            value={v.minOrderAmount}
                            onChange={(e) => handleFieldChange(v.code, "minOrderAmount", Number(e.target.value))}
                            onKeyDown={handleTableKeyDown}
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white font-medium"
                          />
                        ) : (
                          <span className="text-slate-600 text-xs font-medium">
                            {v.minOrderAmount > 0 ? formatPrice(v.minOrderAmount) : "Không yêu cầu"}
                          </span>
                        )}
                      </td>

                      {/* Giảm tối đa */}
                      <td className="p-3 border-b min-w-[130px]">
                        {isEditingTable ? (
                          <input
                            type="number"
                            value={v.maxDiscount}
                            onChange={(e) => handleFieldChange(v.code, "maxDiscount", Number(e.target.value))}
                            onKeyDown={handleTableKeyDown}
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white font-medium"
                          />
                        ) : (
                          <span className="text-slate-600 text-xs font-medium">
                            {v.maxDiscount > 0 ? formatPrice(v.maxDiscount) : "Không giới hạn"}
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="p-3 border-b text-center min-w-[130px]">
                        {isEditingTable ? (
                          <select
                            value={v.isActive ? "true" : "false"}
                            onChange={(e) => handleFieldChange(v.code, "isActive", e.target.value === "true")}
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white font-medium"
                          >
                            <option value="true">Hoạt động</option>
                            <option value="false">Tạm dừng</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                              v.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {v.isActive ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Hoạt động</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span>Tạm dừng</span>
                              </>
                            )}
                          </span>
                        )}
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

      {/* 3. Modal Thêm Mã Ưu Đãi Mới */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-orange-500/5 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs">
                  <Ticket className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Thêm mã ưu đãi mới</h3>
                  <p className="text-xs text-slate-500">Tạo mã giảm giá mới cho khách hàng</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã Ưu Đãi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="VD: VINSPORT10, HELLO2026..."
                  className="w-full px-3.5 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mô Tả Chi Tiết <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="VD: Giảm 10% cho đơn hàng đầu tiên..."
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Loại giảm giá</label>
                  <select
                    value={formData.discountType}
                    onChange={(e: any) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium cursor-pointer"
                  >
                    <option value="PERCENT">Giảm phần trăm (%)</option>
                    <option value="FIXED">Giảm tiền mặt (đ)</option>
                    <option value="SHIPPING">Miễn phí ship (đ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {formData.discountType === "PERCENT" ? "Mức giảm (%)" : "Số tiền giảm (đ)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Đơn tối thiểu (đ)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                    placeholder="0 nếu không yêu cầu"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giảm tối đa (đ)</label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    placeholder="0 nếu không giới hạn"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="voucherIsActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded border-slate-300 focus:ring-orange-500 cursor-pointer"
                />
                <label htmlFor="voucherIsActive" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Kích hoạt mã ngay sau khi tạo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu mã ưu đãi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Xác Nhận Xóa */}
      {deletingCode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isDeleting && setDeletingCode(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-slate-900 mb-1">Xóa mã ưu đãi?</h3>
            <p className="text-xs text-center text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa mã{" "}
              <span className="font-mono font-bold text-red-600">&quot;{deletingCode}&quot;</span>?
              Thao tác này không thể hoàn tác.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingCode(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteVoucher}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xác nhận xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Xác Nhận Xóa Hàng Loạt Khi Bấm Chọn */}
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
              Xóa {selectedCodes.size} mã ưu đãi đã chọn?
            </h3>
            <p className="text-xs text-center text-slate-500 mb-4">
              Bạn có chắc chắn muốn xóa {selectedCodes.size} mã ưu đãi này không? Thao tác này sẽ xóa vĩnh viễn dữ liệu trên hệ thống và không thể hoàn tác.
            </p>

            <div className="max-h-32 overflow-y-auto mb-5 p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap gap-1.5 justify-center">
              {Array.from(selectedCodes).map((c) => (
                <span
                  key={c}
                  className="px-2 py-0.5 font-mono text-xs font-bold bg-white text-red-600 border border-red-200 rounded-md"
                >
                  {c}
                </span>
              ))}
            </div>

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
                onClick={handleBatchDelete}
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
