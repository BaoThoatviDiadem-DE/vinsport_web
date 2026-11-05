import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import toast from "react-hot-toast";
import {
  Check,
  Truck,
  Shield,
  RotateCcw,
  ChevronLeft,
  Minus,
  Plus,
  Loader2,
  X,
} from "lucide-react";
import api from "../api/api";
import { MOCK_PRODUCTS, formatPrice } from "../data/mockData";
import { useCart } from "../contexts/CartContext";
import { useAuth } from "../contexts/AuthContext";

type GuideUnit = "cm" | "inch";
type GuideLabel = "Ngực" | "Eo" | "Hông";
type ShoeGuideLabel = "CM" | "US Nam" | "US Nữ" | "UK";

type ProductColor = {
  name: string;
  hex?: string;
};

type ProductVariant = {
  size?: string;
  color?: string;
  hex?: string;
  price?: number;
  stock?: number;
  variantId?: number;
  id?: number;
};

type Product = {
  id?: number | string;
  name?: string;
  brand?: string;
  description?: string;
  price?: number;
  stock?: number | null;
  image?: string;
  images?: string[];
  sizes?: string[] | string | null;
  colors?: ProductColor[];
  variants?: ProductVariant[];
  category?: string;
};

type SizeGuideRow = Record<string, string>;
type SizeGuideTable = Record<GuideLabel, SizeGuideRow>;
type SizeGuideData = Record<GuideUnit, SizeGuideTable>;

const sizeGuideData: SizeGuideData = {
  cm: {
    Ngực: {
      XS: "83 - 86",
      S: "87 - 92",
      M: "93 - 100",
      L: "101 - 108",
      XL: "109 - 118",
      "2XL": "119 - 130",
      "3XL": "131 - 142",
    },
    Eo: {
      XS: "71 - 74",
      S: "75 - 80",
      M: "81 - 88",
      L: "89 - 96",
      XL: "97 - 106",
      "2XL": "107 - 119",
      "3XL": "120 - 132",
    },
    Hông: {
      XS: "82 - 85",
      S: "86 - 91",
      M: "92 - 99",
      L: "100 - 107",
      XL: "108 - 116",
      "2XL": "117 - 125",
      "3XL": "126 - 134",
    },
  },
  inch: {
    Ngực: {
      XS: "32.7 - 33.9",
      S: "34.3 - 36.2",
      M: "36.6 - 39.4",
      L: "39.8 - 42.5",
      XL: "42.9 - 46.5",
      "2XL": "46.9 - 51.2",
      "3XL": "51.6 - 55.9",
    },
    Eo: {
      XS: "28.0 - 29.1",
      S: "29.5 - 31.5",
      M: "31.9 - 34.6",
      L: "35.0 - 37.8",
      XL: "38.2 - 41.7",
      "2XL": "42.1 - 46.9",
      "3XL": "47.2 - 52.0",
    },
    Hông: {
      XS: "32.3 - 33.5",
      S: "33.9 - 35.8",
      M: "36.2 - 39.0",
      L: "39.4 - 42.1",
      XL: "42.5 - 45.7",
      "2XL": "46.1 - 49.2",
      "3XL": "49.6 - 52.8",
    },
  },
};

const shoeGuideData: Record<ShoeGuideLabel, Record<string, string>> = {
  CM: {
    "38": "24.0",
    "39": "24.5",
    "40": "25.0",
    "41": "25.5",
    "42": "26.5",
    "43": "27.0",
    "44": "27.5",
  },
  "US Nam": {
    "38": "6",
    "39": "6.5",
    "40": "7",
    "41": "8",
    "42": "8.5",
    "43": "9.5",
    "44": "10",
  },
  "US Nữ": {
    "38": "7.5",
    "39": "8",
    "40": "8.5",
    "41": "9.5",
    "42": "10",
    "43": "11",
    "44": "11.5",
  },
  UK: {
    "38": "5.5",
    "39": "6",
    "40": "6.5",
    "41": "7.5",
    "42": "8",
    "43": "9",
    "44": "9.5",
  },
};

const defaultGuideSizes = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];
const defaultShoeGuideSizes = ["38", "39", "40", "41", "42", "43", "44"];

const parseSizes = (sizes: unknown): string[] => {
  if (Array.isArray(sizes)) {
    return sizes.map((s) => String(s).trim()).filter(Boolean);
  }

  if (typeof sizes === "string") {
    return sizes
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  return [];
};

const sortSizes = (sizes: string[]): string[] => {
  const clothingOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

  return [...new Set(sizes)]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .sort((a, b) => {
      const aUpper = a.toUpperCase();
      const bUpper = b.toUpperCase();

      const aIndex = clothingOrder.indexOf(aUpper);
      const bIndex = clothingOrder.indexOf(bUpper);

      const aIsClothing = aIndex !== -1;
      const bIsClothing = bIndex !== -1;

      if (aIsClothing && bIsClothing) {
        return aIndex - bIndex;
      }

      const aNum = Number(a);
      const bNum = Number(b);
      const aIsNumber = !Number.isNaN(aNum);
      const bIsNumber = !Number.isNaN(bNum);

      if (aIsNumber && bIsNumber) {
        return aNum - bNum;
      }

      if (aIsClothing && !bIsClothing) return -1;
      if (!aIsClothing && bIsClothing) return 1;
      if (aIsNumber && !bIsNumber) return -1;
      if (!aIsNumber && bIsNumber) return 1;

      return a.localeCompare(b);
    });
};

export const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mainImage, setMainImage] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [guideUnit, setGuideUnit] = useState<GuideUnit>("cm");

  useEffect(() => {
    const fetchProductDetail = async () => {
      try {
        setIsLoading(true);

        const data: Product = await api.get(`/products/${id}`);
        setProduct(data);
        setMainImage(data.images?.[0] || data.image || "");

        const normalized = parseSizes(data.sizes);

        if (data.variants && data.variants.length > 0) {
          const firstInStock = data.variants.find((v: ProductVariant) => Number(v.stock || 0) > 0) || data.variants[0];
          setSelectedSize(firstInStock.size || normalized[0] || "");
          setSelectedColor(firstInStock.color || data.colors?.[0]?.name || "");
        } else {
          setSelectedSize(normalized[0] || "");
          setSelectedColor(data.colors?.[0]?.name || "");
        }

        // Tự động ghi nhận lượt xem và lấy danh sách vừa xem từ Amazon DynamoDB (NoSQL)
        const safeUserId = user?.id ? `user_${user.id}` : "guest_visitor";
        api.post("/recently-viewed", {
          userId: safeUserId,
          product: {
            id: data.id,
            name: data.name,
            price: data.price,
            image: data.image || data.images?.[0] || "",
            category: data.category,
            brand: data.brand,
          },
        }).catch(() => {});

        api.get("/recently-viewed", {
          params: { userId: safeUserId },
        }).then((res: any) => {
          if (res?.products && Array.isArray(res.products)) {
            setRecentlyViewed(res.products.filter((p: any) => String(p.id) !== String(id)));
          }
        }).catch(() => {});
      } catch (error) {
        console.error("Không tải được chi tiết sản phẩm:", error);

        if (import.meta.env.VITE_USE_MOCK === "true") {
          const fallback = MOCK_PRODUCTS.find(
            (p: any) => String(p.id) === String(id)
          ) as Product | undefined;

          if (fallback) {
            setProduct(fallback);
            setMainImage(fallback.images?.[0] || fallback.image || "");

            const fallbackSizes = parseSizes(fallback.sizes);
            setSelectedSize(fallbackSizes[0] || "");
            setSelectedColor(fallback.colors?.[0]?.name || "");
          } else {
            setProduct(null);
          }
        } else {
          setProduct(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductDetail();
  }, [id]);

  useEffect(() => {
    document.body.style.overflow = isSizeGuideOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSizeGuideOpen]);

  const allImages = useMemo<string[]>(() => {
    if (!product) return [];
    return product.images && product.images.length > 0
      ? product.images
      : ([product.image].filter(Boolean) as string[]);
  }, [product]);

  const normalizedSizes = useMemo<string[]>(() => {
    if (!product) return [];
    return parseSizes(product.sizes);
  }, [product]);

  // TẤT CẢ các màu sắc có trong sản phẩm (không bị ẩn khi chọn size)
  const allColors = useMemo<ProductColor[]>(() => {
    if (!product) return [];

    if (product.variants && product.variants.length > 0) {
      const unique = new Map<string, ProductColor>();

      product.variants.forEach((variant: ProductVariant) => {
        if (variant.color && !unique.has(variant.color)) {
          unique.set(variant.color, {
            name: variant.color,
            hex: variant.hex || "#000000",
          });
        }
      });

      return Array.from(unique.values());
    }

    return product.colors || [];
  }, [product]);

  // TẤT CẢ các kích cỡ có trong sản phẩm
  const allSizes = useMemo<string[]>(() => {
    if (!product) return [];

    const fromProductSizes = normalizedSizes;

    const fromVariants =
      product.variants && product.variants.length > 0
        ? product.variants
            .map((variant: ProductVariant) => variant.size)
            .filter((size): size is string => Boolean(size))
        : [];

    return sortSizes([...fromProductSizes, ...fromVariants]);
  }, [product, normalizedSizes]);

  // Các size khả dụng cho màu đang chọn
  const currentColorAvailableSizes = useMemo<string[]>(() => {
    if (!product?.variants || product.variants.length === 0) return allSizes;

    const available = product.variants
      .filter((variant: ProductVariant) => variant.color === selectedColor && Number(variant.stock || 0) > 0)
      .map((variant: ProductVariant) => variant.size)
      .filter((size): size is string => Boolean(size));

    return sortSizes(available);
  }, [product, selectedColor, allSizes]);

  // Hàm chọn màu sắc thông minh: tự động chọn size khả dụng tương ứng nếu size cũ không có màu này
  const handleSelectColor = (colorName: string) => {
    setSelectedColor(colorName);

    if (!product?.variants || product.variants.length === 0) return;

    const hasCurrentSize = product.variants.some(
      (v: ProductVariant) => v.color === colorName && v.size === selectedSize && Number(v.stock || 0) > 0
    );

    if (!hasCurrentSize) {
      const anyInStock = product.variants.find(
        (v: ProductVariant) => v.color === colorName && Number(v.stock || 0) > 0
      );
      if (anyInStock?.size) {
        setSelectedSize(anyInStock.size);
      } else {
        const anyVariant = product.variants.find((v: ProductVariant) => v.color === colorName);
        if (anyVariant?.size) {
          setSelectedSize(anyVariant.size);
        }
      }
    }
  };

  // Hàm chọn size thông minh: tự động chọn màu khả dụng tương ứng nếu màu cũ không có size này
  const handleSelectSize = (sizeName: string) => {
    setSelectedSize(sizeName);

    if (!product?.variants || product.variants.length === 0) return;

    const hasCurrentColor = product.variants.some(
      (v: ProductVariant) => v.size === sizeName && v.color === selectedColor && Number(v.stock || 0) > 0
    );

    if (!hasCurrentColor) {
      const anyInStock = product.variants.find(
        (v: ProductVariant) => v.size === sizeName && Number(v.stock || 0) > 0
      );
      if (anyInStock?.color) {
        setSelectedColor(anyInStock.color);
      } else {
        const anyVariant = product.variants.find((v: ProductVariant) => v.size === sizeName);
        if (anyVariant?.color) {
          setSelectedColor(anyVariant.color);
        }
      }
    }
  };

  // Biến thể hiện tại đang khớp chính xác
  const currentVariant = useMemo<ProductVariant | null>(() => {
    if (!product?.variants || product.variants.length === 0) return null;

    // Khớp cả size và màu
    const exact = product.variants.find(
      (variant: ProductVariant) =>
        variant.size === selectedSize && variant.color === selectedColor
    );
    if (exact) return exact;

    // Khớp màu
    const matchColor = product.variants.find(
      (variant: ProductVariant) => variant.color === selectedColor
    );
    if (matchColor) return matchColor;

    return product.variants[0] || null;
  }, [product, selectedSize, selectedColor]);

  const displayPrice = currentVariant?.price ?? product?.price ?? 0;
  const stock = currentVariant?.stock ?? product?.stock ?? null;

  const isShoeProduct = useMemo(() => {
    const text =
      `${product?.category ?? ""} ${product?.name ?? ""} ${product?.brand ?? ""}`.toLowerCase();
    return text.includes("giày") || text.includes("shoe");
  }, [product]);

  const guideSizes = useMemo<string[]>(() => {
    if (allSizes.length > 0) return allSizes;
    return isShoeProduct ? defaultShoeGuideSizes : defaultGuideSizes;
  }, [allSizes, isShoeProduct]);

  useEffect(() => {
    if (stock !== null && quantity > stock && stock > 0) {
      setQuantity(stock);
    }

    if (stock === 0) {
      setQuantity(1);
    }
  }, [stock, quantity]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-orange-600 w-12 h-12 mb-4" />
        <p className="text-slate-500 font-medium">Đang tải chi tiết sản phẩm...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Không tìm thấy sản phẩm</h2>
        <button
          onClick={() => navigate("/products")}
          className="text-orange-600 hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      toast.error("Vui lòng đăng nhập trước khi thêm sản phẩm vào giỏ hàng!");
      navigate("/login");
      return;
    }

    if (allSizes.length > 0 && !selectedSize) {
      toast.error("Vui lòng chọn kích cỡ!");
      return;
    }

    if (allColors.length > 0 && !selectedColor) {
      toast.error("Vui lòng chọn màu sắc!");
      return;
    }

    if (product.variants?.length && !currentVariant) {
      toast.error("Biến thể sản phẩm này hiện không khả dụng!");
      return;
    }

    if (stock !== null && stock <= 0) {
      toast.error("Sản phẩm hiện đã hết hàng!");
      return;
    }

    if (stock !== null && quantity > stock) {
      toast.error(`Chỉ còn ${stock} sản phẩm trong kho!`);
      return;
    }

    addToCart(
      {
        id: String(product.id ?? ""),
        name: product.name ?? "",
        price: displayPrice,
        brand: product.brand ?? "",
        description: product.description ?? "",
        image: product.image ?? mainImage ?? "",
        images: allImages,
        sizes: normalizedSizes,
        colors: product.colors ?? [],
        variants: (product.variants ?? []).map((variant) => ({
          variantId: Number((variant as any).variantId ?? (variant as any).id ?? 0),
          size: String(variant.size ?? ""),
          color: String(variant.color ?? ""),
          hex: variant.hex ?? undefined,
          price: Number(variant.price ?? displayPrice ?? 0),
          stock: Number(variant.stock ?? 0),
        })),
      },
      selectedSize,
      selectedColor,
      quantity
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-orange-600 mb-6 font-medium"
        >
          <ChevronLeft className="w-5 h-5" /> Quay lại
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="p-6 md:p-8 flex flex-col gap-4">
              <div className="aspect-square bg-slate-50 rounded-2xl relative overflow-hidden flex-grow">
                <img
                  src={mainImage || product.image}
                  alt={product.name || "product"}
                  className="w-full h-full object-contain mix-blend-multiply"
                />
              </div>

              {allImages.length > 1 && (
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {allImages.map((img: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setMainImage(img)}
                      className={`w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all ${
                        mainImage === img
                          ? "border-orange-600 opacity-100"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="mb-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
                {product.brand}
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                {product.name}
              </h1>

              <div className="flex items-end gap-4 mb-3">
                <span className="text-3xl font-bold text-orange-600">
                  {formatPrice(displayPrice)}
                </span>
              </div>

              {currentVariant ? (
                <div className="mb-6">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      (currentVariant.stock ?? 0) > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      (currentVariant.stock ?? 0) > 0 ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                    {(currentVariant.stock ?? 0) > 0
                      ? `Còn ${currentVariant.stock} sản phẩm trong kho (Màu: ${selectedColor}, Size: ${selectedSize})`
                      : `Hết hàng (Màu: ${selectedColor}, Size: ${selectedSize})`}
                  </span>
                </div>
              ) : stock !== null ? (
                <div className="mb-6">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                      stock > 0
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-600 border border-red-200"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      stock > 0 ? "bg-emerald-500" : "bg-red-500"
                    }`} />
                    {stock > 0 ? `Còn ${stock} sản phẩm` : "Hết hàng"}
                  </span>
                </div>
              ) : null}

              {product.description && (
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Chọn màu sắc - Hiển thị TẤT CẢ các màu của sản phẩm */}
              {allColors.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Màu sắc: <span className="text-orange-600 font-bold">{selectedColor || "Chưa chọn"}</span>
                    </h3>
                    <span className="text-xs text-slate-400 font-medium">
                      ({allColors.length} màu sắc khả dụng)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {allColors.map((color: ProductColor, index: number) => {
                      const isSelected = selectedColor === color.name;
                      
                      // Tính tổng tồn kho của màu này trên tất cả các size
                      const totalColorStock = product.variants
                        ? product.variants
                            .filter((v: ProductVariant) => v.color === color.name)
                            .reduce((sum: number, v: ProductVariant) => sum + Number(v.stock || 0), 0)
                        : null;
                      const isColorOutOfStock = totalColorStock !== null && totalColorStock <= 0;

                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectColor(color.name)}
                          className={`group relative flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-orange-600 bg-orange-50/50 shadow-xs ring-1 ring-orange-200"
                              : isColorOutOfStock
                              ? "border-slate-200 opacity-50 bg-slate-50 cursor-not-allowed"
                              : "border-slate-200 hover:border-slate-400 bg-white"
                          }`}
                          title={`${color.name}${isColorOutOfStock ? " (Hết hàng)" : totalColorStock !== null ? ` (Còn ${totalColorStock} sp)` : ""}`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: color.hex || "#000000" }}
                          >
                            {isSelected && (
                              <Check
                                className={`w-3 h-3 ${
                                  color.hex?.toLowerCase() === "#ffffff" || color.name.toLowerCase() === "trắng"
                                    ? "text-slate-900"
                                    : "text-white"
                                }`}
                              />
                            )}
                          </span>
                          <span
                            className={`text-sm ${
                              isSelected
                                ? "font-bold text-orange-600"
                                : "font-medium text-slate-700"
                            }`}
                          >
                            {color.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chọn kích cỡ */}
              {allSizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Kích cỡ: <span className="text-slate-900 font-bold">{selectedSize || "Chưa chọn"}</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {allSizes.map((size: string, index: number) => {
                      const isAvailableForColor = currentColorAvailableSizes.includes(size);
                      const isSelected = selectedSize === size;

                      return (
                        <button
                          key={index}
                          onClick={() => handleSelectSize(size)}
                          className={`px-4 py-3 min-w-[3rem] text-sm font-medium border rounded-xl transition-all cursor-pointer ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                              : isAvailableForColor
                              ? "bg-white text-slate-700 border-slate-200 hover:border-orange-600 hover:text-orange-600"
                              : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                          }`}
                          title={
                            isAvailableForColor
                              ? `Size ${size} (Màu ${selectedColor})`
                              : `Size ${size} (Nhấp để chuyển sang màu có size này)`
                          }
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSizeGuideOpen(true)}
                    className="mt-4 text-sm font-semibold underline underline-offset-2 text-slate-800 hover:text-orange-600"
                  >
                    Hướng dẫn chọn kích cỡ
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 items-center mt-4 mb-8">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 w-full sm:w-auto justify-between">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-orange-600 transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <span className="w-12 text-center font-bold text-slate-900">
                    {quantity}
                  </span>

                  <button
                    onClick={() =>
                      setQuantity((prev) => {
                        if (stock !== null) return Math.min(stock || 1, prev + 1);
                        return prev + 1;
                      })
                    }
                    className="w-12 h-12 flex items-center justify-center text-slate-500 hover:text-orange-600 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={stock !== null && stock <= 0}
                  className={`flex-grow w-full flex items-center justify-center gap-2 py-3 px-8 rounded-lg font-bold text-lg transition-all ${
                    added
                      ? "bg-green-500 text-white"
                      : stock !== null && stock <= 0
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                      : "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200"
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-6 h-6" /> Đã thêm vào giỏ
                    </>
                  ) : stock !== null && stock <= 0 ? (
                    "Hết hàng"
                  ) : (
                    "Thêm vào giỏ hàng"
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Truck className="w-5 h-5 text-orange-500" />
                  Giao hàng miễn phí
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <Shield className="w-5 h-5 text-orange-500" />
                  Bảo hành chính hãng 1 năm
                </div>
                <div className="flex items-center gap-3 text-slate-600 text-sm">
                  <RotateCcw className="w-5 h-5 text-orange-500" />
                  Đổi trả trong vòng 30 ngày
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SẢN PHẨM VỪA XEM GẦN ĐÂY - LƯU TRÊN AMAZON DYNAMODB (NOSQL) */}
        {/* ========================================================= */}
        {recentlyViewed.length > 0 && (
          <div className="mt-16 pt-10 border-t border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                Sản phẩm bạn vừa xem
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recentlyViewed.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate(`/products/${item.id}`);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-orange-500 transition-all cursor-pointer flex flex-col"
                >
                  <div className="aspect-square bg-slate-50 overflow-hidden relative">
                    <img
                      src={item.image || "https://placehold.co/400x400?text=VinSport"}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-1 group-hover:text-orange-600 transition-colors">
                      {item.name}
                    </p>
                    <p className="text-xs font-bold text-orange-600 mt-1">
                      {formatPrice(item.price || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        className={`fixed inset-0 z-50 transition-all ${
          isSizeGuideOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsSizeGuideOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            isSizeGuideOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`absolute top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl transition-transform duration-300 overflow-y-auto ${
            isSizeGuideOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="sticky top-0 z-10 bg-white border-b px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-900">
                Hướng dẫn chọn kích cỡ
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {isShoeProduct
                  ? "Đối chiếu size giày theo chiều dài bàn chân và hệ quy đổi quốc tế."
                  : "Chọn đơn vị và đối chiếu theo số đo cơ thể để chọn size phù hợp."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSizeGuideOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            {isShoeProduct ? (
              <>
                <h3 className="text-xl font-bold uppercase tracking-[0.15em] mb-6">
                  Kích cỡ giày
                </h3>

                <div className="overflow-x-auto border">
                  <table className="min-w-[760px] w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="px-6 py-4 text-left text-sm font-bold border-r border-slate-700">
                          Hệ size
                        </th>
                        {guideSizes.map((size: string) => (
                          <th
                            key={size}
                            className="px-6 py-4 text-center text-sm font-bold whitespace-nowrap"
                          >
                            {size}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(["CM", "US Nam", "US Nữ", "UK"] as ShoeGuideLabel[]).map(
                        (label: ShoeGuideLabel) => (
                          <tr key={label} className="border-t">
                            <td className="px-6 py-6 font-semibold text-slate-900 border-r bg-white whitespace-nowrap">
                              {label}
                            </td>
                            {guideSizes.map((size: string) => (
                              <td
                                key={`${label}-${size}`}
                                className="px-6 py-6 text-center text-slate-700 whitespace-nowrap"
                              >
                                {shoeGuideData[label][size]
                                  ? label === "CM"
                                    ? `${shoeGuideData[label][size]} cm`
                                    : shoeGuideData[label][size]
                                  : "-"}
                              </td>
                            ))}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-slate-500 mt-4">
                  Cuộn ngang để xem đầy đủ nếu màn hình nhỏ.
                </p>

                <div className="mt-8 bg-slate-50 rounded-xl p-5">
                  <h4 className="font-bold text-slate-900 mb-3">Mẹo chọn size giày</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
                    <li>Đo chiều dài bàn chân từ gót đến đầu ngón dài nhất.</li>
                    <li>Nên đo vào cuối ngày để có kích thước sát thực tế hơn.</li>
                    <li>Nếu nằm giữa 2 size, ưu tiên size lớn hơn để đi thoải mái.</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold uppercase tracking-[0.15em] mb-6">
                  Kích cỡ áo / quần
                </h3>

                <div className="inline-flex border border-slate-200 mb-6">
                  <button
                    type="button"
                    onClick={() => setGuideUnit("inch")}
                    className={`px-5 py-3 font-medium ${
                      guideUnit === "inch"
                        ? "bg-white text-slate-900 border-b-2 border-slate-900"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    Inch
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuideUnit("cm")}
                    className={`px-5 py-3 font-medium ${
                      guideUnit === "cm"
                        ? "bg-white text-slate-900 border-b-2 border-slate-900"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    cm
                  </button>
                </div>

                <div className="overflow-x-auto border">
                  <table className="min-w-[900px] w-full border-collapse">
                    <thead>
                      <tr className="bg-black text-white">
                        <th className="px-6 py-4 text-left text-sm font-bold border-r border-slate-700">
                          Nhãn sản phẩm
                        </th>
                        {guideSizes.map((size: string) => (
                          <th
                            key={size}
                            className="px-6 py-4 text-center text-sm font-bold whitespace-nowrap"
                          >
                            {size}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(["Ngực", "Eo", "Hông"] as GuideLabel[]).map(
                        (label: GuideLabel) => (
                          <tr key={label} className="border-t">
                            <td className="px-6 py-6 font-semibold text-slate-900 border-r bg-white whitespace-nowrap">
                              {label}
                            </td>
                            {guideSizes.map((size: string) => (
                              <td
                                key={`${label}-${size}`}
                                className="px-6 py-6 text-center text-slate-700 whitespace-nowrap"
                              >
                                {sizeGuideData[guideUnit][label][size]
                                  ? `${sizeGuideData[guideUnit][label][size]} ${guideUnit}`
                                  : "-"}
                              </td>
                            ))}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="text-sm text-slate-500 mt-4">
                  Cuộn ngang để xem đầy đủ nếu màn hình nhỏ.
                </p>

                <div className="mt-8 bg-slate-50 rounded-xl p-5">
                  <h4 className="font-bold text-slate-900 mb-3">Mẹo chọn size</h4>
                  <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600">
                    <li>Đo ngực, eo, hông sát cơ thể nhưng không siết quá chặt.</li>
                    <li>Nếu số đo nằm giữa 2 size, ưu tiên size lớn hơn để mặc thoải mái.</li>
                    <li>
                      Với đồ thể thao form ôm, chọn đúng size; với form rộng, có thể tăng
                      1 size.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};