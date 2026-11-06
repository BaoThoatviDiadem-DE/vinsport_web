import React from "react";
import { Link } from "react-router";
import { Package, Facebook, Instagram, Twitter } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 py-12">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <Link to="/" className="flex items-center gap-2 text-2xl font-black text-white mb-4 italic">
            <Package className="w-8 h-8 text-orange-500" />
            VinSport
          </Link>
          <p className="text-slate-400 text-sm mb-6">
            VinSport là hệ thống cửa hàng bán lẻ đồ thể thao uy tín hàng đầu, cung cấp các sản phẩm chính hãng từ Nike, Adidas, Puma...
          </p>
          <div className="flex gap-4">
            <a href="https://www.facebook.com/cun0108" target="_blank" rel="noopener noreferrer"><Facebook className="w-5 h-5" /></a>
            <a href="https://www.instagram.com/ngdng_1402/" target="_blank" rel="noopener noreferrer"><Instagram className="w-5 h-5" /></a>
          </div>
        </div>

        <div>
          <h3 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Sản phẩm</h3>
          <ul className="space-y-2 text-sm">
            <li><Link to="/products?category=Giày" className="hover:text-white transition-colors">Giày thể thao</Link></li>
            <li><Link to="/products?category=Áo" className="hover:text-white transition-colors">Áo thể thao</Link></li>
            <li><Link to="/products?category=Quần" className="hover:text-white transition-colors">Quần thể thao</Link></li>
          </ul>
        </div>


        <div>
          <h3 className="text-white font-bold mb-4 uppercase text-sm tracking-wider">Liên hệ</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>35B Đội Cấn, Hà Nội</li>
            <li>Hotline: 033-321-8909</li>
            <li>Email: support@vinsport.vn</li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800 text-sm text-center text-slate-500">
        &copy; {new Date().getFullYear()} VinSport.
      </div>
    </footer>
  );
};