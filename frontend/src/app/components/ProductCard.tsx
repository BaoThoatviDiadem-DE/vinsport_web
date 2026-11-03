import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { X, Check, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { Product, formatPrice } from "../data/mockData";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";

export const ProductCard = ({ product }: { product: Product }) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // State cho Modal chọn nhanh màu & size
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);

  const colors = useMemo(() => product.colors || [], [product.colors]);
  const sizes = useMemo(() => product.sizes || [], [product.sizes]);
  const variants = useMemo(() => product.variants || [], [product.variants]);

  // Biến thể khớp chính xác màu và size đang chọn
  const currentVariant = useMemo(() => {
    if (variants.length === 0) return null;
    return (
      variants.find(
        (v) => v.color === selectedColor && v.size === selectedSize
      ) || null
    );
  }, [variants, selectedColor, selectedSize]);

  // Danh sách size có sẵn của màu đang chọn
  const availableSizesForColor = useMemo(() => {
    if (variants.length === 0) return sizes;
    return variants
      .filter((v) => v.color === selectedColor && Number(v.stock || 0) > 0)
      .map((v) => v.size);
  }, [variants, selectedColor, sizes]);

  // Hàm chọn màu thông minh: tự động chuyển sang size còn hàng nếu size hiện tại hết hàng với màu này
  const handleSelectColor = (colorName: string) => {
    setSelectedColor(colorName);
    if (variants.length === 0) return;

    const hasCurrentSize = variants.some(
      (v) => v.color === colorName && v.size === selectedSize && Number(v.stock || 0) > 0
    );

    if (!hasCurrentSize) {
      const inStock = variants.find(
        (v) => v.color === colorName && Number(v.stock || 0) > 0
      );
      if (inStock?.size) {
        setSelectedSize(inStock.size);
      } else {
        const anyVar = variants.find((v) => v.color === colorName);
        if (anyVar?.size) setSelectedSize(anyVar.size);
      }
    }
  };

  // Hàm chọn size thông minh: tự động chuyển sang màu còn hàng tương ứng
  const handleSelectSize = (sizeName: string) => {
    setSelectedSize(sizeName);
    if (variants.length === 0) return;

    const hasCurrentColor = variants.some(
      (v) => v.size === sizeName && v.color === selectedColor && Number(v.stock || 0) > 0
    );

    if (!hasCurrentColor) {
      const inStock = variants.find(
        (v) => v.size === sizeName && Number(v.stock || 0) > 0
      );
      if (inStock?.color) {
        setSelectedColor(inStock.color);
      } else {
        const anyVar = variants.find((v) => v.size === sizeName);
        if (anyVar?.color) setSelectedColor(anyVar.color);
      }
    }
  };

  const displayPrice = currentVariant?.price ?? product.price;
  const currentStock = currentVariant?.stock ?? product.stock ?? null;
  const isOutOfStock = currentStock !== null && currentStock <= 0;

  // Xử lý khi ấn nút "Thêm nhanh" trên thẻ sản phẩm
  const handleQuickAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập để mua hàng!");
      navigate("/login");
      return;
    }

    // Nếu sản phẩm chỉ có 1 màu và 1 size -> Thêm trực tiếp vào giỏ ngay
    if (colors.length <= 1 && sizes.length <= 1) {
      const defaultSize = sizes[0] || "One Size";
      const defaultColor = colors[0]?.name || "Mặc định";
      addToCart(product, defaultSize, defaultColor, 1);
      toast.success(`Đã thêm "${product.name}" vào giỏ hàng!`);
      return;
    }

    // Nếu sản phẩm có nhiều màu hoặc nhiều size -> Mở Popup chọn màu & size nhanh
    let initialColor = colors[0]?.name || "";
    let initialSize = sizes[0] || "";

    if (variants.length > 0) {
      const firstInStock = variants.find((v) => Number(v.stock || 0) > 0) || variants[0];
      if (firstInStock) {
        initialColor = firstInStock.color || initialColor;
        initialSize = firstInStock.size || initialSize;
      }
    }

    setSelectedColor(initialColor);
    setSelectedSize(initialSize);
    setQuantity(1);
    setAddedSuccess(false);
    setIsModalOpen(true);
  };

  // Xác nhận thêm vào giỏ từ popup
  const handleConfirmAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) {
      toast.error("Màu sắc và kích cỡ này hiện đang hết hàng!");
      return;
    }

    addToCart(product, selectedSize, selectedColor, quantity);
    setAddedSuccess(true);
    toast.success(`Đã thêm vào giỏ: ${product.name} (${selectedColor}, Size ${selectedSize})`);

    setTimeout(() => {
      setIsModalOpen(false);
      setAddedSuccess(false);
    }, 1000);
  };

  return (
    <>
      <Link
        to={`/product/${product.id}`}
        className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl transition-all duration-300 flex flex-col h-full"
      >
        <div className="relative aspect-square overflow-hidden bg-slate-50">
          {product.isNew && (
            <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
              MỚI
            </span>
          )}
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
            <button
              onClick={handleQuickAddClick}
              className="w-full bg-orange-600 text-white py-2.5 rounded-xl font-semibold shadow-lg hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              Thêm nhanh
            </button>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-grow">
          <div className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
            {product.brand}
          </div>
          <h3 className="font-medium text-slate-800 line-clamp-2 mb-1.5 group-hover:text-orange-600 transition-colors">
            {product.name}
          </h3>

          {/* Hiển thị các chấm màu sắc sản phẩm */}
          {colors.length > 0 && (
            <div className="flex items-center gap-1.5 mb-2.5">
              <div className="flex items-center -space-x-1">
                {colors.slice(0, 5).map((c, i) => (
                  <span
                    key={i}
                    className="w-3.5 h-3.5 rounded-full border border-white shadow-2xs shrink-0"
                    style={{ backgroundColor: c.hex || "#000000" }}
                    title={c.name}
                  />
                ))}
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {colors.length} màu
              </span>
            </div>
          )}

          <div className="mt-auto flex items-end gap-2">
            <span className="font-bold text-lg text-orange-600">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-slate-400 line-through mb-1">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* POPUP CHỌN NHANH MÀU SẮC & KÍCH CỠ */}
      {isModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Modal */}
              <div className="p-6 border-b border-slate-100 flex items-start gap-4">
                <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden shrink-0 border border-slate-100">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow min-w-0">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    {product.brand}
                  </span>
                  <h3 className="font-bold text-slate-900 text-lg line-clamp-1 mb-1">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-orange-600">
                      {formatPrice(displayPrice)}
                    </span>
                    {currentStock !== null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                          currentStock > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-600 border border-red-200"
                        }`}
                      >
                        {currentStock > 0 ? `Còn ${currentStock} sp` : "Hết hàng"}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal */}
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* 1. Chọn Màu sắc */}
                {colors.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-semibold text-slate-800">
                        Màu sắc:{" "}
                        <span className="text-orange-600 font-bold">
                          {selectedColor || "Chưa chọn"}
                        </span>
                      </span>
                      <span className="text-xs text-slate-400">
                        {colors.length} lựa chọn
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((color, idx) => {
                        const isSelected = selectedColor === color.name;
                        // Kiểm tra tổng tồn kho màu này trên các size
                        const colorStock = variants.length > 0
                          ? variants
                              .filter((v) => v.color === color.name)
                              .reduce((sum, v) => sum + Number(v.stock || 0), 0)
                          : null;
                        const isColorEmpty = colorStock !== null && colorStock <= 0;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectColor(color.name)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all cursor-pointer text-sm ${
                              isSelected
                                ? "border-orange-600 bg-orange-50/50 shadow-xs ring-1 ring-orange-200"
                                : isColorEmpty
                                ? "border-slate-200 opacity-50 bg-slate-50 cursor-not-allowed"
                                : "border-slate-200 hover:border-slate-400 bg-white"
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-slate-300 shrink-0 flex items-center justify-center"
                              style={{ backgroundColor: color.hex || "#000000" }}
                            >
                              {isSelected && (
                                <Check
                                  className={`w-2.5 h-2.5 ${
                                    color.hex?.toLowerCase() === "#ffffff" ||
                                    color.name.toLowerCase() === "trắng"
                                      ? "text-slate-900"
                                      : "text-white"
                                  }`}
                                />
                              )}
                            </span>
                            <span
                              className={
                                isSelected
                                  ? "font-bold text-orange-600"
                                  : "font-medium text-slate-700"
                              }
                            >
                              {color.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Chọn Kích cỡ */}
                {sizes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-sm font-semibold text-slate-800">
                        Kích cỡ:{" "}
                        <span className="text-slate-900 font-bold">
                          {selectedSize || "Chưa chọn"}
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size, idx) => {
                        const isSelected = selectedSize === size;
                        const isAvailableForColor = availableSizesForColor.includes(size);

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSize(size)}
                            className={`px-3.5 py-2 text-sm font-semibold rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : isAvailableForColor
                                ? "bg-white text-slate-700 border-slate-200 hover:border-orange-600 hover:text-orange-600"
                                : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Chọn Số lượng */}
                <div>
                  <span className="text-sm font-semibold text-slate-800 block mb-2.5">
                    Số lượng:
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center border border-slate-200 rounded-xl p-1 bg-slate-50">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-orange-600 rounded-lg disabled:opacity-30 cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center font-bold text-slate-900 text-sm">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (currentStock !== null) {
                            setQuantity(Math.min(currentStock || 1, quantity + 1));
                          } else {
                            setQuantity(quantity + 1);
                          }
                        }}
                        disabled={currentStock !== null && quantity >= currentStock}
                        className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-orange-600 rounded-lg disabled:opacity-30 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-slate-500">
                      Thành tiền:{" "}
                      <span className="font-bold text-slate-900 text-sm">
                        {formatPrice(displayPrice * quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Link
                  to={`/product/${product.id}`}
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-orange-600 flex items-center gap-1 transition-colors"
                >
                  Xem trang chi tiết <ArrowRight className="w-3.5 h-3.5" />
                </Link>

                <button
                  type="button"
                  onClick={handleConfirmAddToCart}
                  disabled={isOutOfStock}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    addedSuccess
                      ? "bg-emerald-600 text-white"
                      : isOutOfStock
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-200"
                  }`}
                >
                  {addedSuccess ? (
                    <>
                      <Check className="w-4 h-4" /> Đã thêm vào giỏ!
                    </>
                  ) : isOutOfStock ? (
                    "Hết hàng"
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" /> Thêm vào giỏ hàng
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
