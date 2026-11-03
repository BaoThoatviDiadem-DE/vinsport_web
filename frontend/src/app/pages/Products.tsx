import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router";
import { Filter, SlidersHorizontal, X, Loader2, RotateCcw } from "lucide-react";
import api from "../api/api";
import { MOCK_PRODUCTS } from "../data/mockData";
import { ProductCard } from "../components/ProductCard";
import toast from "react-hot-toast";

const normalizeCategory = (value?: string) => {
  const text = String(value || "").trim().toLowerCase();

  if (text.includes("giày") || text.includes("shoe")) return "Giày";
  if (text.includes("quần")) return "Quần";
  if (text.includes("áo") || text.includes("ao")) return "Áo";

  return "";
};

export const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const searchQuery = searchParams.get("search") || "";
  const selectedCategory = searchParams.get("category") || "";
  const selectedBrand = searchParams.get("brand") || "";
  const selectedColor = searchParams.get("color") || "";
  const sortOrder = searchParams.get("sort") || "";

  const minPriceParam = searchParams.get("minPrice");
  const maxPriceParam = searchParams.get("maxPrice");
  const minPrice = minPriceParam ? parseInt(minPriceParam, 10) : 0;
  const maxPrice = maxPriceParam ? parseInt(maxPriceParam, 10) : 4000000;

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);

        const data: any = await api.get("/products", {
          params: { search: searchQuery },
        });

        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Lỗi lấy sản phẩm:", error);

        if (import.meta.env.VITE_USE_MOCK === "true") {
          setProducts(MOCK_PRODUCTS);
        } else {
          setProducts([]);
          toast.error("Không thể tải danh sách sản phẩm từ máy chủ!");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [searchQuery]);

  const displayCategories = ["Quần", "Áo", "Giày"];

  const brands = useMemo(() => {
    const values = products
      .map((product) => product.brand)
      .filter(Boolean)
      .map((value) => String(value).trim());

    return [...new Set(values)];
  }, [products]);

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(key, value);
    else newParams.delete(key);
    setSearchParams(newParams);
  };

  const updatePriceRange = (newMin: number, newMax: number) => {
    const newParams = new URLSearchParams(searchParams);

    if (newMin > 0) newParams.set("minPrice", newMin.toString());
    else newParams.delete("minPrice");

    if (newMax < 4000000) newParams.set("maxPrice", newMax.toString());
    else newParams.delete("maxPrice");

    setSearchParams(newParams);
  };

  const handleResetPrice = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("minPrice");
    newParams.delete("maxPrice");
    setSearchParams(newParams);
  };

  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    let result = products.filter((product) => {
      const matchCategory = selectedCategory
        ? normalizeCategory(product.category) === selectedCategory
        : true;

      const matchBrand = selectedBrand
        ? String(product.brand || "").toLowerCase() === selectedBrand.toLowerCase()
        : true;

      const productPrice =
        typeof product.price === "number" ? product.price : Number(product.price || 0);
      const matchPrice = productPrice >= minPrice && productPrice <= maxPrice;

      return matchCategory && matchBrand && matchPrice;
    });

    if (sortOrder === "asc") {
      result = [...result].sort((a, b) => (Number(a.price || 0) - Number(b.price || 0)));
    } else if (sortOrder === "desc") {
      result = [...result].sort((a, b) => (Number(b.price || 0) - Number(a.price || 0)));
    }

    return result;
  }, [products, selectedCategory, selectedBrand, selectedColor, minPrice, maxPrice, sortOrder]);

  const FilterSidebar = () => (
    <div className="space-y-8">
      <div>
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 border-b pb-2">
          <Filter className="w-5 h-5" /> Bộ Lọc
        </h3>

        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-slate-800">Danh mục</h4>
          <div className="space-y-2">
            <button
              onClick={() => updateFilter("category", "")}
              className={`block w-full text-left text-sm ${
                !selectedCategory
                  ? "text-orange-600 font-medium"
                  : "text-slate-600 hover:text-orange-600"
              }`}
            >
              Tất cả danh mục
            </button>

            {displayCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => updateFilter("category", cat)}
                className={`block w-full text-left text-sm ${
                  selectedCategory === cat
                    ? "text-orange-600 font-medium"
                    : "text-slate-600 hover:text-orange-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-slate-800">Thương hiệu</h4>
          <div className="space-y-2">
            <button
              onClick={() => updateFilter("brand", "")}
              className={`block w-full text-left text-sm ${
                !selectedBrand
                  ? "text-orange-600 font-medium"
                  : "text-slate-600 hover:text-orange-600"
              }`}
            >
              Tất cả thương hiệu
            </button>

            {brands.map((brand) => (
              <button
                key={brand}
                onClick={() => updateFilter("brand", brand)}
                className={`block w-full text-left text-sm ${
                  selectedBrand === brand
                    ? "text-orange-600 font-medium"
                    : "text-slate-600 hover:text-orange-600"
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-semibold text-slate-800 text-base">Mức giá</h4>
            {(minPrice > 0 || maxPrice < 4000000) && (
              <button
                onClick={handleResetPrice}
                className="text-xs flex items-center gap-1 text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Đặt lại
              </button>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between text-sm font-medium text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-100">
            <span>{new Intl.NumberFormat("vi-VN").format(minPrice)}đ</span>
            <span>-</span>
            <span>{new Intl.NumberFormat("vi-VN").format(maxPrice)}đ</span>
          </div>

          <div className="relative w-full h-5 mt-6 mb-2">
            <div className="absolute top-1.5 left-0 w-full h-2 bg-slate-200 rounded-lg pointer-events-none"></div>

            <div
              className="absolute top-1.5 h-2 bg-orange-500 rounded-lg pointer-events-none"
              style={{
                left: `${(minPrice / 4000000) * 100}%`,
                right: `${100 - (maxPrice / 4000000) * 100}%`,
              }}
            ></div>

            <input
              type="range"
              min="0"
              max="4000000"
              step="500000"
              value={minPrice}
              onChange={(e) => {
                const val = Math.min(Number(e.target.value), maxPrice - 500000);
                updatePriceRange(val, maxPrice);
              }}
              className="absolute top-0 left-0 w-full h-5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-600 [&::-webkit-slider-thumb]:rounded-full cursor-pointer z-10"
            />

            <input
              type="range"
              min="0"
              max="4000000"
              step="500000"
              value={maxPrice}
              onChange={(e) => {
                const val = Math.max(Number(e.target.value), minPrice + 500000);
                updatePriceRange(minPrice, val);
              }}
              className="absolute top-0 left-0 w-full h-5 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-orange-600 [&::-webkit-slider-thumb]:rounded-full cursor-pointer z-20"
            />
          </div>

          <div className="flex justify-between text-xs text-slate-400 font-medium mt-2">
            <span>0đ</span>
            <span>4Tr</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {searchQuery && (
        <h1 className="text-2xl font-bold mb-8">
          Kết quả tìm kiếm cho: "<span className="text-orange-600">{searchQuery}</span>"
        </h1>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
            <FilterSidebar />
          </div>
        </aside>

        <div className="md:hidden flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 mb-4">
          <span className="font-medium text-slate-700">{filteredProducts.length} Sản phẩm</span>
          <button
            onClick={() => setIsMobileFilterOpen(true)}
            className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg font-medium text-sm"
          >
            <SlidersHorizontal className="w-4 h-4" /> Lọc & Sắp xếp
          </button>
        </div>

        <div className="flex-grow">
          <div className="mb-6 hidden md:flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedCategory ? `Sản phẩm ${selectedCategory}` : "Tất cả sản phẩm"}
              </h2>
              <span className="text-slate-500 text-sm">
                Hiển thị {filteredProducts.length} sản phẩm
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Sắp xếp:</span>
              <select
                className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2 outline-none cursor-pointer"
                value={sortOrder}
                onChange={(e) => updateFilter("sort", e.target.value)}
              >
                <option value="">Mới nhất</option>
                <option value="asc">Giá: Thấp đến Cao</option>
                <option value="desc">Giá: Cao xuống Thấp</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
              <Loader2 className="w-12 h-12 text-orange-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">
                Đang kết nối hệ thống VinSport...
              </p>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
              <div className="text-slate-400 mb-4 flex justify-center">
                <Filter className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                Không tìm thấy sản phẩm nào
              </h3>
              <p className="text-slate-500 mb-6">
                Bạn hãy thử mở rộng mức giá hoặc bỏ bớt bộ lọc nhé.
              </p>
              <button
                onClick={() => setSearchParams(new URLSearchParams())}
                className="bg-orange-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-orange-700"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>

      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileFilterOpen(false)}
          ></div>
          <div className="relative w-4/5 max-w-sm bg-white h-full shadow-2xl overflow-y-auto z-10 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold">Lọc Sản Phẩm</h2>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-6">
              <h4 className="font-semibold mb-3 text-slate-800">Sắp xếp theo</h4>
              <select
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg block p-2.5 outline-none"
                value={sortOrder}
                onChange={(e) => updateFilter("sort", e.target.value)}
              >
                <option value="">Mới nhất (Mặc định)</option>
                <option value="asc">Giá: Thấp đến Cao</option>
                <option value="desc">Giá: Cao xuống Thấp</option>
              </select>
            </div>

            <div className="flex-grow">
              <FilterSidebar />
            </div>

            <div className="mt-8 pt-4 border-t flex gap-4">
              <button
                onClick={() => {
                  setSearchParams(new URLSearchParams());
                  setIsMobileFilterOpen(false);
                }}
                className="flex-1 py-3 border border-slate-300 rounded-lg font-medium"
              >
                Xóa lọc
              </button>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};