import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import {
  Home,
  ShoppingBag,
  Truck,
  BarChart3,
  ShieldCheck,
  Users,
  ClipboardList,
  ShoppingCart,
  User,
  LogOut,
  Package,
  Search,
  Menu,
  X,
  ChevronDown,
  UserCog,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";
import { ProfileModal } from "./ProfileModal";

export const Navbar = () => {
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Đóng dropdown tài khoản khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Đóng sidebar khi chuyển trang
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Đóng sidebar khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsSidebarOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
    navigate("/");
  };

  const isActive = (path: string, exact: boolean = false) => {
    if (exact || path === "/") {
      return location.pathname === "/" && (!location.search || location.search === "");
    }
    return location.pathname.startsWith(path);
  };

  // 1. Nhóm chức năng chính (Trang chủ, Sản phẩm, Đơn hàng của tôi)
  const mainLinks = [
    {
      name: "Trang chủ",
      path: "/",
      icon: Home,
      exact: true,
    },
    {
      name: "Sản phẩm",
      path: "/products",
      icon: ShoppingBag,
    },
    {
      name: "Đơn hàng của tôi",
      path: "/tracking",
      icon: Truck,
    },
  ];

  // 2. Nhóm quản trị (Thống kê & Báo cáo, Sản phẩm, Người dùng, Đơn hàng)
  const adminLinks = [
    {
      name: "Thống kê & Báo cáo",
      path: "/admin/analytics",
      icon: BarChart3,
    },
    {
      name: "Sản phẩm",
      path: "/admin/products",
      icon: ShieldCheck,
    },
    {
      name: "Người dùng",
      path: "/admin/users",
      icon: Users,
    },
    {
      name: "Đơn hàng",
      path: "/admin/orders",
      icon: ClipboardList,
    },
  ];

  return (
    <>
      {/* Lớp nền mờ khi mở menu sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          THANH ĐIỀU HƯỚNG DỌC (SIDEBAR DRAWER) - THU GỌN VÀ CHỈ MỞ KHI BẤM ICON 3 GẠCH
         ========================================================================= */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out select-none shadow-2xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo VinSport & Nút đóng */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <Link
            to="/"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-2.5 group"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-sm shadow-orange-500/30 group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black italic tracking-tighter text-slate-900">
                Vin<span className="text-orange-600">Sport</span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium -mt-1 tracking-wide">
                Hệ thống thể thao
              </p>
            </div>
          </Link>

          {/* Nút đóng sidebar */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng menu"
            title="Đóng menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Danh sách các tính năng dọc */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5 scrollbar-thin scrollbar-thumb-slate-200">
          {/* Nhóm chức năng chính */}
          <div className="space-y-1">
            <div className="px-3.5 pt-1 pb-1.5 text-[13px] font-medium text-[#8c9ba5]">
              Chính
            </div>

            <div className="space-y-1">
              {mainLinks.map((item) => {
                const active = isActive(item.path, item.exact);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] transition-all duration-150 ${
                      active
                        ? "bg-[#fff1ed] text-orange-600 font-semibold"
                        : "text-[#333e48] hover:bg-slate-50 hover:text-slate-900 font-normal"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-colors stroke-[1.75] ${
                        active
                          ? "text-orange-600"
                          : "text-[#4b5563] group-hover:text-slate-800"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}

              {/* Giỏ hàng */}
              <Link
                to="/cart"
                onClick={() => setIsSidebarOpen(false)}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[15px] transition-all duration-150 ${
                  isActive("/cart")
                    ? "bg-[#fff1ed] text-orange-600 font-semibold"
                    : "text-[#333e48] hover:bg-slate-50 hover:text-slate-900 font-normal"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <ShoppingCart
                    className={`w-5 h-5 shrink-0 transition-colors stroke-[1.75] ${
                      isActive("/cart")
                        ? "text-orange-600"
                        : "text-[#4b5563] group-hover:text-slate-800"
                    }`}
                  />
                  <span className="truncate">Giỏ hàng</span>
                </div>

                {totalItems > 0 && (
                  <span className="shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-full bg-orange-600 text-white min-w-5 text-center">
                    {totalItems}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Nhóm Quản trị (CHỈ hiển thị khi đã đăng nhập với vai trò Admin) */}
          {isAuthenticated && user?.role === "admin" && (
            <div className="space-y-1">
              <div className="px-3.5 pt-1 pb-1.5 text-[13px] font-medium text-[#8c9ba5] flex items-center justify-between">
                <span>Quản trị</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">
                  Admin
                </span>
              </div>

              <div className="space-y-1">
                {adminLinks.map((item) => {
                  const active = isActive(item.path);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`group flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[15px] transition-all duration-150 ${
                        active
                          ? "bg-[#fff1ed] text-orange-600 font-semibold"
                          : "text-[#333e48] hover:bg-slate-50 hover:text-slate-900 font-normal"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors stroke-[1.75] ${
                          active
                            ? "text-orange-600"
                            : "text-[#4b5563] group-hover:text-slate-800"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* =========================================================================
          THANH HEADER TRÊN CÙNG CỦA KHU VỰC NỘI DUNG (TOPBAR)
         ========================================================================= */}
      <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 flex items-center justify-between gap-4">
        {/* Nút bật menu (3 gạch) & Logo VinSport */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-2 -ml-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center"
            aria-label="Mở menu điều hướng"
            title="Mở menu điều hướng"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-black italic tracking-tighter text-slate-900 group"
          >
            <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <span>
              Vin<span className="text-orange-600">Sport</span>
            </span>
          </Link>
        </div>

        {/* Thanh tìm kiếm sản phẩm */}
        <div className="flex-1 max-w-lg hidden sm:block">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </form>
        </div>

        {/* Giỏ hàng nhanh & Trạng thái tài khoản */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link
            to="/cart"
            className="relative p-2.5 text-slate-700 hover:text-orange-600 hover:bg-slate-50 rounded-xl transition-all"
            title="Giỏ hàng"
          >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <span className="absolute top-1 right-1 bg-orange-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                {totalItems}
              </span>
            )}
          </Link>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {isAuthenticated ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm hover:bg-slate-100 transition-colors cursor-pointer select-none border border-transparent hover:border-slate-200"
                aria-expanded={isUserMenuOpen}
                aria-haspopup="true"
              >
                <span className="text-slate-500">Chào,</span>
                <span className="font-semibold text-slate-800">{user?.name}</span>
                {user?.role === "admin" && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                    Admin
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Menu Dropdown xuất hiện khi bấm vào phần tên */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-[11px] text-slate-400 font-medium">Tài khoản</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <UserCog className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">Cập nhật thông tin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-full shadow-xs transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập</span>
            </Link>
          )}
        </div>
      </header>

      {/* Modal cập nhật thông tin cá nhân */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
};
