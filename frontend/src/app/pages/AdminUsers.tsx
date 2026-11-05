import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Filter, RefreshCw, Edit3, Check, Loader2 } from "lucide-react";
import api from "../api/api";

type UserItem = {
  id: number | string;
  user_id?: number | string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: "admin" | "user";
};

type RoleFilter = "all" | "admin" | "user";

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data?.data)) return data.data;
  return [];
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

function normalizeUser(item: any): UserItem {
  return {
    id: item?.id ?? item?.user_id,
    user_id: item?.user_id ?? item?.id,
    name: item?.name || "",
    email: item?.email || "",
    phone: item?.phone || "",
    address: item?.address || "",
    role: item?.role === "admin" ? "admin" : "user",
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingTable, setIsEditingTable] = useState(false);
  const [originalUsers, setOriginalUsers] = useState<UserItem[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // State tìm kiếm theo từng cột
  const [idSearch, setIdSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [phoneSearch, setPhoneSearch] = useState("");
  const [addressSearch, setAddressSearch] = useState("");

  // State tạm thời khi đang nhập trong popup (chỉ áp dụng khi bấm Đồng ý hoặc Enter)
  const [tempIdSearch, setTempIdSearch] = useState("");
  const [tempNameSearch, setTempNameSearch] = useState("");
  const [tempEmailSearch, setTempEmailSearch] = useState("");
  const [tempPhoneSearch, setTempPhoneSearch] = useState("");
  const [tempAddressSearch, setTempAddressSearch] = useState("");

  const handleApplyIdSearch = () => {
    setIdSearch(tempIdSearch.trim());
    setIdSearchOpen(false);
  };

  const handleApplyNameSearch = () => {
    setNameSearch(tempNameSearch.trim());
    setNameSearchOpen(false);
  };

  const handleApplyEmailSearch = () => {
    setEmailSearch(tempEmailSearch.trim());
    setEmailSearchOpen(false);
  };

  const handleApplyPhoneSearch = () => {
    setPhoneSearch(tempPhoneSearch.trim());
    setPhoneSearchOpen(false);
  };

  const handleApplyAddressSearch = () => {
    setAddressSearch(tempAddressSearch.trim());
    setAddressSearchOpen(false);
  };

  // Trạng thái mở/đóng popover tìm kiếm/lọc
  const [idSearchOpen, setIdSearchOpen] = useState(false);
  const [nameSearchOpen, setNameSearchOpen] = useState(false);
  const [emailSearchOpen, setEmailSearchOpen] = useState(false);
  const [phoneSearchOpen, setPhoneSearchOpen] = useState(false);
  const [addressSearchOpen, setAddressSearchOpen] = useState(false);
  const [roleFilterOpen, setRoleFilterOpen] = useState(false);

  // Ref cho popover để xử lý click ngoài
  const idSearchRef = useRef<HTMLDivElement>(null);
  const nameSearchRef = useRef<HTMLDivElement>(null);
  const emailSearchRef = useRef<HTMLDivElement>(null);
  const phoneSearchRef = useRef<HTMLDivElement>(null);
  const addressSearchRef = useRef<HTMLDivElement>(null);
  const roleFilterRef = useRef<HTMLDivElement>(null);

  const closeOtherPopovers = (except?: string) => {
    if (except !== "id") setIdSearchOpen(false);
    if (except !== "name") setNameSearchOpen(false);
    if (except !== "email") setEmailSearchOpen(false);
    if (except !== "phone") setPhoneSearchOpen(false);
    if (except !== "address") setAddressSearchOpen(false);
    if (except !== "role") setRoleFilterOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (idSearchRef.current && !idSearchRef.current.contains(target)) {
        setIdSearchOpen(false);
      }
      if (nameSearchRef.current && !nameSearchRef.current.contains(target)) {
        setNameSearchOpen(false);
      }
      if (emailSearchRef.current && !emailSearchRef.current.contains(target)) {
        setEmailSearchOpen(false);
      }
      if (phoneSearchRef.current && !phoneSearchRef.current.contains(target)) {
        setPhoneSearchOpen(false);
      }
      if (addressSearchRef.current && !addressSearchRef.current.contains(target)) {
        setAddressSearchOpen(false);
      }
      if (roleFilterRef.current && !roleFilterRef.current.contains(target)) {
        setRoleFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const adminCount = useMemo(() => {
    return users.filter((u) => u.role === "admin").length;
  }, [users]);

  const userCount = useMemo(() => {
    return users.filter((u) => u.role === "user").length;
  }, [users]);

  const hasActiveFilters =
    Boolean(idSearch.trim()) ||
    Boolean(nameSearch.trim()) ||
    Boolean(emailSearch.trim()) ||
    Boolean(phoneSearch.trim()) ||
    Boolean(addressSearch.trim()) ||
    roleFilter !== "all";

  const clearAllFilters = () => {
    setIdSearch("");
    setNameSearch("");
    setEmailSearch("");
    setPhoneSearch("");
    setAddressSearch("");
    setRoleFilter("all");

    setTempIdSearch("");
    setTempNameSearch("");
    setTempEmailSearch("");
    setTempPhoneSearch("");
    setTempAddressSearch("");

    setIdSearchOpen(false);
    setNameSearchOpen(false);
    setEmailSearchOpen(false);
    setPhoneSearchOpen(false);
    setAddressSearchOpen(false);
    setRoleFilterOpen(false);
  };

  const filteredUsers = useMemo(() => {
    const idQ = idSearch.trim().toLowerCase().replace(/^#/, "");
    const nameQRaw = nameSearch.trim().toLowerCase().normalize("NFC");
    const nameQClean = removeVietnameseTones(nameQRaw);
    const emailQ = emailSearch.trim().toLowerCase();
    const phoneInput = phoneSearch.trim();
    const phoneQDigits = phoneInput.replace(/\D/g, "");
    const addressQRaw = addressSearch.trim().toLowerCase().normalize("NFC");
    const addressQClean = removeVietnameseTones(addressQRaw);

    return users.filter((user) => {
      // 1. Phân quyền Role
      if (roleFilter !== "all" && user.role !== roleFilter) {
        return false;
      }

      // 2. Mã ID
      if (idQ) {
        const uId = String(user.id).toLowerCase();
        if (!uId.includes(idQ)) return false;
      }

      // 3. Tên người dùng (Hỗ trợ tiếng Việt có dấu, không dấu, và tách từng từ)
      if (nameQRaw) {
        const uNameRaw = (user.name || "").toLowerCase().normalize("NFC");
        const uNameClean = removeVietnameseTones(uNameRaw);

        // Khớp chuỗi trực tiếp
        const directMatch =
          uNameRaw.includes(nameQRaw) || uNameClean.includes(nameQClean);

        if (!directMatch) {
          // Khớp theo từng từ khóa
          const searchWords = nameQClean.split(/\s+/).filter(Boolean);
          const allWordsMatch =
            searchWords.length > 0 &&
            searchWords.every((word) => uNameClean.includes(word));
          if (!allWordsMatch) return false;
        }
      }

      // 4. Email
      if (emailQ) {
        const uEmail = (user.email || "").toLowerCase();
        if (!uEmail.includes(emailQ)) return false;
      }

      // 5. Số điện thoại (Hỗ trợ gõ từng phần, đầu 0, +84, 84 hoặc bỏ số 0 đầu)
      if (phoneInput) {
        const uPhoneRaw = (user.phone || "").toLowerCase();
        const uPhoneDigits = uPhoneRaw.replace(/\D/g, "");

        let phoneMatched =
          uPhoneRaw.includes(phoneInput.toLowerCase()) ||
          (phoneQDigits.length > 0 && uPhoneDigits.includes(phoneQDigits));

        // Hỗ trợ nếu người dùng nhập định dạng quốc tế +84 hoặc 84
        if (!phoneMatched && phoneQDigits.startsWith("84") && phoneQDigits.length > 2) {
          const localConverted = "0" + phoneQDigits.slice(2);
          phoneMatched = uPhoneDigits.includes(localConverted);
        }

        // Hỗ trợ nếu người dùng nhập số điện thoại không có số 0 ở đầu (ví dụ: 901 thay vì 0901)
        if (!phoneMatched && phoneQDigits.length > 0 && !phoneQDigits.startsWith("0")) {
          phoneMatched = uPhoneDigits.includes(phoneQDigits);
        }

        if (!phoneMatched) return false;
      }

      // 6. Địa chỉ (Hỗ trợ có dấu, không dấu, tách từ)
      if (addressQRaw) {
        const uAddrRaw = (user.address || "").toLowerCase().normalize("NFC");
        const uAddrClean = removeVietnameseTones(uAddrRaw);

        const directMatch =
          uAddrRaw.includes(addressQRaw) || uAddrClean.includes(addressQClean);

        if (!directMatch) {
          const searchWords = addressQClean.split(/\s+/).filter(Boolean);
          const allWordsMatch =
            searchWords.length > 0 &&
            searchWords.every((word) => uAddrClean.includes(word));
          if (!allWordsMatch) return false;
        }
      }

      return true;
    });
  }, [
    users,
    roleFilter,
    idSearch,
    nameSearch,
    emailSearch,
    phoneSearch,
    addressSearch,
  ]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const data = await api.get("/admin/users");
      setUsers(toArray(data).map(normalizeUser));
    } catch (error) {
      console.error("Lỗi tải user:", error);
      alert("Không tải được danh sách người dùng");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleFieldChange = (
    id: number | string,
    field: keyof UserItem,
    value: string
  ) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
            ...u,
            [field]: field === "role" ? (value as "admin" | "user") : value,
          }
          : u
      )
    );
  };

  const handleRoleFilterClick = (role: RoleFilter) => {
    setRoleFilter((prev) => (prev === role ? "all" : role));
  };

  const handleStartEdit = () => {
    setOriginalUsers(JSON.parse(JSON.stringify(users)));
    setIsEditingTable(true);
  };

  const handleCancelEdit = () => {
    setUsers(originalUsers);
    setIsEditingTable(false);
  };

  const handleSaveAllUsers = async () => {
    try {
      setIsSavingAll(true);

      const modifiedUsers = users.filter((u) => {
        const orig = originalUsers.find((o) => o.id === u.id);
        if (!orig) return false;
        return (
          u.name.trim() !== orig.name.trim() ||
          u.email.trim() !== orig.email.trim() ||
          (u.phone || "").trim() !== (orig.phone || "").trim() ||
          (u.address || "").trim() !== (orig.address || "").trim() ||
          u.role !== orig.role
        );
      });

      if (modifiedUsers.length === 0) {
        alert("Không có dữ liệu người dùng nào thay đổi.");
        setIsEditingTable(false);
        return;
      }

      for (const u of modifiedUsers) {
        if (!u.name.trim()) throw new Error(`Tên của người dùng ID #${u.id} không được để trống`);
        if (!u.email.trim()) throw new Error(`Email của người dùng ID #${u.id} không được để trống`);
      }

      // Gửi yêu cầu cập nhật lên cơ sở dữ liệu
      await Promise.all(
        modifiedUsers.map((u) =>
          api.put(`/admin/users/${u.id}`, {
            name: u.name.trim(),
            email: u.email.trim(),
            phone: u.phone ? u.phone.trim() : "",
            address: u.address ? u.address.trim() : "",
            role: u.role,
          })
        )
      );

      alert(`Cập nhật thành công ${modifiedUsers.length} người dùng vào cơ sở dữ liệu!`);
      setIsEditingTable(false);
      await loadUsers();
    } catch (error: any) {
      console.error("Lỗi cập nhật người dùng:", error);
      alert(error?.response?.data?.message || error?.message || "Không cập nhật được người dùng");
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-6 rounded-full bg-orange-500" />
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý người dùng
          </h1>
        </div>
      </div>

      {/* Danh sách người dùng & Bảng */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6">
        <div className="flex items-center gap-2.5 flex-wrap mb-4 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h2 className="text-xl font-bold text-slate-900">Danh sách người dùng</h2>
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
                title="Bấm để chỉnh sửa dữ liệu người dùng"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>
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
                  onClick={handleSaveAllUsers}
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
              onClick={loadUsers}
              disabled={isLoading || isSavingAll}
              className="flex items-center justify-center p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Đang tải danh sách người dùng...
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[380px]">
            <table className="w-full min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  {/* ID */}
                  <th className="p-3 border-b min-w-[120px] relative">
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
                        title="Bấm để tìm kiếm theo ID"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${idSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>ID</span>
                        {idSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {idSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm ID</div>
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
                            placeholder="Nhập ID (vd: 1)..."
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

                  {/* Tên */}
                  <th className="p-3 border-b min-w-[200px] relative">
                    <div ref={nameSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!nameSearchOpen) setTempNameSearch(nameSearch);
                          setNameSearchOpen((prev) => !prev);
                          closeOtherPopovers("name");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${nameSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm theo tên"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${nameSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Tên</span>
                        {nameSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {nameSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Tên</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempNameSearch}
                            onChange={(e) => setTempNameSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyNameSearch();
                              }
                            }}
                            placeholder="Nhập tên người dùng..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempNameSearch("");
                                setNameSearch("");
                                setNameSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyNameSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Email */}
                  <th className="p-3 border-b min-w-[260px] relative">
                    <div ref={emailSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!emailSearchOpen) setTempEmailSearch(emailSearch);
                          setEmailSearchOpen((prev) => !prev);
                          closeOtherPopovers("email");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${emailSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm theo email"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${emailSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Email</span>
                        {emailSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {emailSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Email</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempEmailSearch}
                            onChange={(e) => setTempEmailSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyEmailSearch();
                              }
                            }}
                            placeholder="Nhập email..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempEmailSearch("");
                                setEmailSearch("");
                                setEmailSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyEmailSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* SĐT */}
                  <th className="p-3 border-b min-w-[180px] relative">
                    <div ref={phoneSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!phoneSearchOpen) setTempPhoneSearch(phoneSearch);
                          setPhoneSearchOpen((prev) => !prev);
                          closeOtherPopovers("phone");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${phoneSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm theo số điện thoại"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${phoneSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>SĐT</span>
                        {phoneSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {phoneSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm SĐT</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempPhoneSearch}
                            onChange={(e) => setTempPhoneSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyPhoneSearch();
                              }
                            }}
                            placeholder="Nhập số điện thoại..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempPhoneSearch("");
                                setPhoneSearch("");
                                setPhoneSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyPhoneSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Địa chỉ */}
                  <th className="p-3 border-b min-w-[240px] relative">
                    <div ref={addressSearchRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!addressSearchOpen) setTempAddressSearch(addressSearch);
                          setAddressSearchOpen((prev) => !prev);
                          closeOtherPopovers("address");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${addressSearch ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để tìm kiếm theo địa chỉ"
                      >
                        <Search
                          className={`w-3.5 h-3.5 ${addressSearch ? "text-orange-600" : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        <span>Địa chỉ</span>
                        {addressSearch && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {addressSearchOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl p-3 font-normal text-slate-800"
                        >
                          <div className="text-xs font-bold text-slate-700 mb-2">Tìm kiếm Địa chỉ</div>
                          <input
                            autoFocus
                            type="text"
                            value={tempAddressSearch}
                            onChange={(e) => setTempAddressSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleApplyAddressSearch();
                              }
                            }}
                            placeholder="Nhập địa chỉ..."
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white mb-2"
                          />
                          <div className="flex items-center justify-between text-xs pt-1 border-t">
                            <button
                              type="button"
                              onClick={() => {
                                setTempAddressSearch("");
                                setAddressSearch("");
                                setAddressSearchOpen(false);
                              }}
                              className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                            >
                              Xóa
                            </button>
                            <button
                              type="button"
                              onClick={handleApplyAddressSearch}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>

                  {/* Role */}
                  <th className="p-3 border-b min-w-[150px] relative">
                    <div ref={roleFilterRef} className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoleFilterOpen((prev) => !prev);
                          closeOtherPopovers("role");
                        }}
                        className={`flex items-center gap-1.5 font-semibold text-sm transition-colors py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-200/80 cursor-pointer ${roleFilter !== "all" ? "text-orange-600 bg-orange-50/80" : "text-slate-800"
                          }`}
                        title="Bấm để lọc theo Role"
                      >
                        <span>Role</span>
                        <Filter
                          className={`w-3.5 h-3.5 transition-colors ${roleFilter !== "all"
                              ? "text-orange-600 fill-orange-500"
                              : "text-slate-400 group-hover:text-slate-600"
                            }`}
                        />
                        {roleFilter !== "all" && (
                          <span className="w-2 h-2 rounded-full bg-orange-600" />
                        )}
                      </button>

                      {roleFilterOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute left-0 top-full mt-2 z-40 w-[200px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden font-normal text-slate-800 p-2 text-xs"
                        >
                          <div className="font-bold text-slate-700 px-2 py-1 mb-1 border-b">
                            Lọc theo Role
                          </div>
                          <div className="space-y-1">
                            {[
                              { value: "all", label: "Tất cả" },
                              { value: "admin", label: "Admin" },
                              { value: "user", label: "User" },
                            ].map((item) => (
                              <label
                                key={item.value}
                                className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer text-xs"
                              >
                                <input
                                  type="radio"
                                  name="roleFilterDropdown"
                                  checked={roleFilter === item.value}
                                  onChange={() => setRoleFilter(item.value as RoleFilter)}
                                  className="w-3.5 h-3.5 text-orange-600 focus:ring-orange-500 cursor-pointer"
                                />
                                <span className="font-medium text-slate-700">{item.label}</span>
                              </label>
                            ))}
                          </div>
                          <div className="border-t px-2 pt-2 mt-1 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={() => setRoleFilter("all")}
                              className="text-slate-500 hover:text-slate-800 font-medium"
                            >
                              Đặt lại
                            </button>
                            <button
                              type="button"
                              onClick={() => setRoleFilterOpen(false)}
                              className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 font-medium cursor-pointer"
                            >
                              Đồng ý
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-16 text-center text-slate-500 font-medium"
                    >
                      <div className="max-w-md mx-auto space-y-2">
                        <p className="text-slate-600 text-sm font-semibold">
                          Không tìm thấy người dùng nào phù hợp với bộ lọc.
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
                  filteredUsers.map((user) => (
                    <tr key={String(user.id)} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 border-b whitespace-nowrap font-bold text-slate-400 text-sm">
                        #{user.id}
                      </td>

                      <td className="p-3 border-b min-w-[180px]">
                        {isEditingTable ? (
                          <input
                            value={user.name}
                            onChange={(e) =>
                              handleFieldChange(user.id, "name", e.target.value)
                            }
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 text-sm">{user.name}</span>
                        )}
                      </td>

                      <td className="p-3 border-b min-w-[240px]">
                        {isEditingTable ? (
                          <input
                            value={user.email}
                            onChange={(e) =>
                              handleFieldChange(user.id, "email", e.target.value)
                            }
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <span className="text-slate-600 text-sm">{user.email}</span>
                        )}
                      </td>

                      <td className="p-3 border-b min-w-[160px]">
                        {isEditingTable ? (
                          <input
                            value={user.phone || ""}
                            onChange={(e) =>
                              handleFieldChange(user.id, "phone", e.target.value)
                            }
                            placeholder="Số điện thoại..."
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <span className="text-slate-600 text-sm">{user.phone || "-"}</span>
                        )}
                      </td>

                      <td className="p-3 border-b min-w-[220px]">
                        {isEditingTable ? (
                          <input
                            value={user.address || ""}
                            onChange={(e) =>
                              handleFieldChange(user.id, "address", e.target.value)
                            }
                            placeholder="Địa chỉ..."
                            className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                          />
                        ) : (
                          <span className="text-slate-600 text-sm">{user.address || "-"}</span>
                        )}
                      </td>

                      <td className="p-3 border-b min-w-[140px]">
                        {isEditingTable ? (
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleFieldChange(user.id, "role", e.target.value)
                            }
                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-500 bg-white cursor-pointer"
                          >
                            <option value="user">user</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                              user.role === "admin"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {user.role}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
