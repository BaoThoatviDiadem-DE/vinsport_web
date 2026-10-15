import React from "react";
import { Link, useNavigate, useLocation } from "react-router";
import {
  ShoppingCart,
  User,
  Search,
  Menu,
  X,
  Package,
  LogOut,
  ShieldCheck,
  Users,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";

export const Navbar = () => {
  const { totalItems } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setIsMenuOpen(false);
    }
  };

  const navLinks = [
    { name: "Trang chủ", path: "/" },
    { name: "Sản phẩm", path: "/products" },
    { name: "Đơn hàng của tôi", path: "/tracking" },
  ];

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-black text-orange-600 tracking-tighter italic"
        >
          <Package className="w-8 h-8" />
          VinSport
        </Link>

        <nav className="hidden md:flex items-center gap-8 font-medium">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`hover:text-orange-600 transition-colors ${
                location.pathname === link.path ? "text-orange-600" : "text-slate-700"
              }`}
            >
              {link.name}
            </Link>
          ))}

          {user?.role === "admin" && (
            <>
              <Link
                to="/admin/analytics"
                className={`hover:text-orange-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith("/admin/analytics")
                    ? "text-orange-600 font-bold"
                    : "text-slate-700"
                }`}
              >
                <BarChart3 className="w-4 h-4 text-orange-500" />
                Thống kê & Báo cáo
              </Link>

              <Link
                to="/admin/products"
                className={`hover:text-orange-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith("/admin/products")
                    ? "text-orange-600 font-bold"
                    : "text-slate-700"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Sản phẩm
              </Link>

              <Link
                to="/admin/users"
                className={`hover:text-orange-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith("/admin/users")
                    ? "text-orange-600 font-bold"
                    : "text-slate-700"
                }`}
              >
                <Users className="w-4 h-4" />
                Người dùng
              </Link>

              <Link
                to="/admin/orders"
                className={`hover:text-orange-600 transition-colors flex items-center gap-1.5 ${
                  location.pathname.startsWith("/admin/orders")
                    ? "text-orange-600 font-bold"
                    : "text-slate-700"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                Đơn hàng
              </Link>
            </>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-full bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm w-64"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </form>

          <Link to="/cart" className="relative p-2 text-slate-700 hover:text-orange-600">
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-orange-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {totalItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-4 border-l pl-4 ml-2 border-slate-200">
              <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-orange-600" />
                <span>Chào, {user?.name}</span>
                {user?.role === "admin" && (
                  <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                    Admin
                  </span>
                )}
              </div>

              <button
                onClick={logout}
                className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 p-2 text-slate-700 hover:text-orange-600 font-medium"
            >
              <User className="w-6 h-6" />
              <span className="text-sm">Đăng nhập</span>
            </Link>
          )}
        </div>

        <div className="flex md:hidden items-center gap-4">
          <Link to="/cart" className="relative p-2 text-slate-700">
            <ShoppingCart className="w-6 h-6" />
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-orange-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {totalItems}
              </span>
            )}
          </Link>

          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="md:hidden border-t bg-white px-4 py-4 space-y-4">
          <form onSubmit={handleSearch} className="relative mb-4">
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-3 border rounded-lg bg-slate-50 w-full focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </form>

          <nav className="flex flex-col gap-4 font-medium">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setIsMenuOpen(false)}
                className={`text-lg ${
                  location.pathname === link.path ? "text-orange-600" : "text-slate-700"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {user?.role === "admin" && (
              <>
                <Link
                  to="/admin/analytics"
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-lg flex items-center gap-2 ${
                    location.pathname.startsWith("/admin/analytics")
                      ? "text-orange-600 font-bold"
                      : "text-slate-700"
                  }`}
                >
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  Thống kê & Báo cáo
                </Link>

                <Link
                  to="/admin/products"
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-lg flex items-center gap-2 ${
                    location.pathname.startsWith("/admin/products")
                      ? "text-orange-600"
                      : "text-slate-700"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                  Quản lý sản phẩm
                </Link>

                <Link
                  to="/admin/users"
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-lg flex items-center gap-2 ${
                    location.pathname.startsWith("/admin/users")
                      ? "text-orange-600"
                      : "text-slate-700"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  Quản lý người dùng
                </Link>

                <Link
                  to="/admin/orders"
                  onClick={() => setIsMenuOpen(false)}
                  className={`text-lg flex items-center gap-2 ${
                    location.pathname.startsWith("/admin/orders")
                      ? "text-orange-600"
                      : "text-slate-700"
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  Quản lý đơn hàng
                </Link>
              </>
            )}

            <div className="h-px bg-slate-100 my-2"></div>

            {isAuthenticated ? (
              <>
                <div className="text-lg text-orange-600 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Chào, {user?.name}
                  {user?.role === "admin" && (
                    <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                      Admin
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="text-lg text-slate-500 flex items-center gap-2 text-left"
                >
                  <LogOut className="w-5 h-5" />
                  Đăng xuất
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setIsMenuOpen(false)}
                className="text-lg text-slate-700 flex items-center gap-2"
              >
                <User className="w-5 h-5" />
                Đăng nhập / Đăng ký
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};