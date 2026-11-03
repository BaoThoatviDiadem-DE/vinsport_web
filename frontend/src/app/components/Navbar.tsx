import React, { useState } from "react";
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
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";

export const Navbar = () => {
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setIsMobileOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsMobileOpen(false);
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
      {/* CSS đảm bảo khu vực main & footer luôn lùi sang phải 16rem (256px) trên màn hình máy tính */}
      <style>{`
        @media (min-width: 768px) {
          main {
            margin-left: 16rem !important;
          }
          footer {
            margin-left: 16rem !important;
          }
        }
      `}</style>

      {/* Lớp nền mờ khi mở menu trên điện thoại */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* =========================================================================
          THANH ĐIỀU HƯỚNG DỌC Ở BÊN TRÁI (SIDEBAR)
         ========================================================================= */}
      <aside
        className={`fixed top-0 left-0 z-50 md:z-40 h-screen w-64 bg-white border-r border-slate-100 flex flex-col transition-transform duration-300 ease-in-out select-none ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo VinSport */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <Link
            to="/"
            onClick={() => setIsMobileOpen(false)}
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

          {/* Nút đóng trên mobile */}
          <button
            onClick={() => setIsMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 md:hidden"
            aria-label="Đóng menu"
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
                    onClick={() => setIsMobileOpen(false)}
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
                onClick={() => setIsMobileOpen(false)}
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
                      onClick={() => setIsMobileOpen(false)}
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

        {/* Khối tài khoản người dùng ở góc dưới */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          {isAuthenticated ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-100 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm shrink-0">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {user?.name}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">
                    {user?.role === "admin" ? "Quản trị viên" : "Khách hàng"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <User className="w-4 h-4 text-orange-600" />
              <span>Đăng nhập tài khoản</span>
            </Link>
          )}
        </div>
      </aside>

      {/* =========================================================================
          THANH HEADER TRÊN CÙNG CỦA KHU VỰC NỘI DUNG (TOPBAR)
         ========================================================================= */}
      <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 flex items-center justify-between gap-4 md:ml-64">
        {/* Nút bật menu & Logo trên Mobile */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileOpen((prev) => !prev)}
            className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl md:hidden transition-colors"
            aria-label="Mở menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-black italic tracking-tighter text-slate-900 md:hidden"
          >
            <Package className="w-6 h-6 text-orange-600" />
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
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 text-sm">
                <span className="text-slate-500">Chào,</span>
                <span className="font-semibold text-slate-800">{user?.name}</span>
                {user?.role === "admin" && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                    Admin
                  </span>
                )}
              </div>

              <button
                onClick={handleLogout}
                title="Đăng xuất"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
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
    </>
  );
};
