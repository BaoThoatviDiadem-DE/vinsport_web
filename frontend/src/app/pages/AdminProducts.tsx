import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/api";

type Product = {
  id?: number | string;
  name: string;
  description?: string;
  price: number | string;
  category?: string;
  brand?: string;
  image?: string;
  stock?: number | string;
  sizes?: string[] | string;
  colors?: string[] | string;
};

type ExcelImportItem = {
  rowIdx: number;
  name: string;
  price: number;
  rawPrice: any;
  category: string;
  brand: string;
  stock: number;
  rawStock: any;
  sizes: string;
  colors: string;
  image: string;
  description: string;
  isValid: boolean;
  errors: string[];
  missingFields: string[];
};

type CategoryFilter = "all" | "Áo" | "Quần" | "Giày";

const emptyForm: Product = {
  name: "",
  description: "",
  price: "",
  category: "",
  brand: "",
  image: "",
  stock: "",
  sizes: [],
  colors: [],
};

function toArray(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (
    typeof data === "object" &&
    data !== null &&
    "products" in data &&
    Array.isArray((data as any).products)
  ) {
    return (data as any).products;
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "data" in data &&
    Array.isArray((data as any).data)
  ) {
    return (data as any).data;
  }
  return [];
}

function normalizeProduct(item: any): Product {
  return {
    id: item?.id,
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price ?? "",
    category: item?.category || "",
    brand: item?.brand || "",
    image: item?.image || item?.images?.[0] || "",
    stock: item?.stock ?? "",
    sizes: Array.isArray(item?.sizes)
      ? item.sizes
      : typeof item?.sizes === "string" && item.sizes.trim() !== ""
        ? item.sizes.split(",").map((s: string) => s.trim())
        : [],
    colors: Array.isArray(item?.colors)
      ? item.colors.map((c: any) => (typeof c === "object" ? c.name : c))
      : typeof item?.colors === "string" && item.colors.trim() !== ""
        ? item.colors.split(",").map((c: string) => c.trim())
        : [],
  };
}

function inferCategoryGroup(product: Product): "Áo" | "Quần" | "Giày" | "Khác" {
  const text = `${product.category || ""} ${product.name || ""}`.toLowerCase();

  if (text.includes("giày") || text.includes("shoe")) return "Giày";
  if (text.includes("quần")) return "Quần";
  if (text.includes("áo") || text.includes("ao")) return "Áo";

  return "Khác";
}

async function getProducts(): Promise<Product[]> {
  try {
    const data = await api.get("/admin/products");
    return toArray(data).map(normalizeProduct);
  } catch {
    const data = await api.get("/products");
    return toArray(data).map(normalizeProduct);
  }
}

async function createProduct(payload: Product) {
  try {
    return await api.post("/admin/products", payload);
  } catch {
    return await api.post("/products", payload);
  }
}

async function updateProduct(id: number | string, payload: Product) {
  try {
    return await api.put(`/admin/products/${id}`, payload);
  } catch {
    return await api.put(`/products/${id}`, payload);
  }
}

async function deleteProduct(id: number | string) {
  try {
    return await api.delete(`/admin/products/${id}`);
  } catch {
    return await api.delete(`/products/${id}`);
  }
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [form, setForm] = useState<Product>(emptyForm);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State modal popup thêm / chỉnh sửa sản phẩm
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Kiểm tra tính hợp lệ và phát hiện trường nào bị "Thiếu"
  const fieldErrors = useMemo(() => {
    const errs: Record<string, boolean> = {};

    // 1. Tên sản phẩm
    if (!form.name || !form.name.trim()) errs.name = true;

    // 2. Giá bán (phải có và > 0)
    const numPrice = Number(form.price);
    if (
      form.price === "" ||
      form.price === undefined ||
      form.price === null ||
      isNaN(numPrice) ||
      numPrice <= 0
    ) {
      errs.price = true;
    }

    // 3. Danh mục
    if (!form.category || !form.category.trim()) errs.category = true;

    // 4. Thương hiệu
    if (!form.brand || !form.brand.trim()) errs.brand = true;

    // 5. Ảnh sản phẩm
    if (!form.image || !form.image.trim()) errs.image = true;

    // 6. Tồn kho (phải có và >= 0)
    const numStock = Number(form.stock);
    if (
      form.stock === "" ||
      form.stock === undefined ||
      form.stock === null ||
      isNaN(numStock) ||
      numStock < 0
    ) {
      errs.stock = true;
    }

    // 7. Kích cỡ
    const sizesCount = Array.isArray(form.sizes)
      ? form.sizes.filter(Boolean).length
      : typeof form.sizes === "string"
        ? form.sizes.split(",").map((s) => s.trim()).filter(Boolean).length
        : 0;
    if (sizesCount === 0) errs.sizes = true;

    // 8. Màu sắc
    const colorsCount = Array.isArray(form.colors)
      ? form.colors.filter(Boolean).length
      : typeof form.colors === "string"
        ? form.colors.split(",").map((c) => c.trim()).filter(Boolean).length
        : 0;
    if (colorsCount === 0) errs.colors = true;

    // 9. Mô tả
    if (!form.description || !form.description.trim()) errs.description = true;

    return errs;
  }, [form]);

  // State cho chức năng nhập file Excel
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPreviewList, setImportPreviewList] = useState<ExcelImportItem[]>([]);
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "invalid">("all");
  const [isImporting, setIsImporting] = useState(false);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const list = await getProducts();
      setProducts(list);
    } catch (error) {
      console.error("Lỗi tải sản phẩm:", error);
      toast.error("Không tải được danh sách sản phẩm.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const aoCount = useMemo(() => {
    return products.filter((p) => inferCategoryGroup(p) === "Áo").length;
  }, [products]);

  const quanCount = useMemo(() => {
    return products.filter((p) => inferCategoryGroup(p) === "Quần").length;
  }, [products]);

  const giayCount = useMemo(() => {
    return products.filter((p) => inferCategoryGroup(p) === "Giày").length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    return products.filter((p) => {
      const group = inferCategoryGroup(p);

      const matchKeyword =
        !q ||
        String(p.id ?? "").toLowerCase().includes(q) ||
        String(p.name ?? "").toLowerCase().includes(q) ||
        String(p.brand ?? "").toLowerCase().includes(q) ||
        String(p.category ?? "").toLowerCase().includes(q);

      const matchCategory =
        categoryFilter === "all" ? true : group === categoryFilter;

      return matchKeyword && matchCategory;
    });
  }, [products, keyword, categoryFilter]);

  const resetForm = () => {
    setForm(emptyForm);
    setIsEditing(false);
    setEditingId(null);
    setHasSubmitted(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsProductModalOpen(true);
  };

  const handleCloseProductModal = () => {
    setIsProductModalOpen(false);
    resetForm();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === "sizes") {
      setForm((prev) => ({
        ...prev,
        sizes: value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }));
      return;
    }

    if (name === "colors") {
      setForm((prev) => ({
        ...prev,
        colors: value
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = (product: Product) => {
    setIsEditing(true);
    setEditingId(product.id ?? null);
    setForm({
      ...product,
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      colors: Array.isArray(product.colors) ? product.colors : [],
    });
    setHasSubmitted(false);
    setIsProductModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasSubmitted(true);

    if (Object.keys(fieldErrors).length > 0) {
      toast.error("Vui lòng điền đầy đủ các thông tin còn thiếu!");
      return;
    }

    const payload: Product = {
      ...form,
      name: form.name.trim(),
      price: Number(form.price),
      category: form.category?.trim() || "",
      brand: form.brand?.trim() || "",
      image: form.image?.trim() || "",
      stock: Number(form.stock || 0),
      sizes: Array.isArray(form.sizes)
        ? form.sizes
        : typeof form.sizes === "string"
          ? (form.sizes as string).split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      colors: Array.isArray(form.colors)
        ? form.colors
        : typeof form.colors === "string"
          ? (form.colors as string).split(",").map((c) => c.trim()).filter(Boolean)
          : [],
      description: form.description?.trim() || "",
    };

    try {
      setIsSaving(true);

      if (isEditing && editingId !== null) {
        await updateProduct(editingId, payload);
        toast.success("Cập nhật sản phẩm thành công.");
      } else {
        await createProduct(payload);
        toast.success("Thêm sản phẩm thành công.");
      }

      resetForm();
      setIsProductModalOpen(false);
      await loadProducts();
    } catch (error) {
      console.error("Lỗi lưu sản phẩm:", error);
      toast.error("Không lưu được sản phẩm. Vui lòng kiểm tra lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number | string | undefined) => {
    if (id === undefined || id === null) return;

    const ok = window.confirm("Bạn có chắc muốn xóa sản phẩm này không?");
    if (!ok) return;

    try {
      await deleteProduct(id);
      toast.success("Xóa sản phẩm thành công.");
      await loadProducts();
    } catch (error) {
      console.error("Lỗi xóa sản phẩm:", error);
      toast.error("Không xóa được sản phẩm.");
    }
  };

  // =========================================================================
  // XỬ LÝ EXCEL: TẢI FILE MẪU & ĐỌC DỮ LIỆU TỪ FILE EXCEL
  // =========================================================================

  // Tải file mẫu Excel (.xlsx) chuẩn định dạng
  const handleDownloadExcelTemplate = () => {
    const sampleData = [
      {
        "Tên sản phẩm": "Áo khoác gió Thể thao VinSport Pro",
        "Danh mục": "Áo",
        "Thương hiệu": "Nike",
        "Giá bán": 450000,
        "Tồn kho": 30,
        "Kích cỡ": "S, M, L, XL",
        "Màu sắc": "Đen, Trắng, Xanh dương",
        "Hình ảnh": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800",
        "Mô tả": "Áo khoác gió thể thao cao cấp chống thấm nước, thoáng khí tối đa.",
      },
      {
        "Tên sản phẩm": "Quần short chạy bộ VinSport Ultra",
        "Danh mục": "Quần",
        "Thương hiệu": "Adidas",
        "Giá bán": 280000,
        "Tồn kho": 50,
        "Kích cỡ": "M, L, XL",
        "Màu sắc": "Đen, Xám",
        "Hình ảnh": "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800",
        "Mô tả": "Quần short thể thao co giãn 4 chiều, hỗ trợ vận động linh hoạt.",
      },
      {
        "Tên sản phẩm": "Giày chạy bộ VinSport Speed 2026",
        "Danh mục": "Giày",
        "Thương hiệu": "Puma",
        "Giá bán": 1250000,
        "Tồn kho": 25,
        "Kích cỡ": "40, 41, 42, 43",
        "Màu sắc": "Trắng, Đỏ",
        "Hình ảnh": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800",
        "Mô tả": "Giày chạy bộ đệm khí trợ lực êm ái, bám đường cực tốt.",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachSanPham");

    // Canh chỉnh độ rộng từng cột
    ws["!cols"] = [
      { wch: 36 }, // Tên sản phẩm
      { wch: 14 }, // Danh mục
      { wch: 16 }, // Thương hiệu
      { wch: 14 }, // Giá bán
      { wch: 12 }, // Tồn kho
      { wch: 22 }, // Kích cỡ
      { wch: 26 }, // Màu sắc
      { wch: 42 }, // Hình ảnh
      { wch: 45 }, // Mô tả
    ];

    XLSX.writeFile(wb, "vinsport_mau_nhap_san_pham.xlsx");
    toast.success("Đã tải xuống file mẫu Excel!");
  };

  // Đọc file Excel người dùng tải lên và kiểm tra chuẩn chỉ dữ liệu
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(ws);

        if (!rawRows || rawRows.length === 0) {
          toast.error("File Excel không chứa dòng dữ liệu nào!");
          return;
        }

        // Chuẩn hóa và kiểm tra chuẩn chỉ từng dòng sản phẩm
        const parsedItems: ExcelImportItem[] = rawRows.map((row, index) => {
          const name =
            row["Tên sản phẩm"] ||
            row["Tên"] ||
            row["ten_san_pham"] ||
            row["product_name"] ||
            row["name"] ||
            "";

          const rawPrice =
            row["Giá bán"] ??
            row["Giá"] ??
            row["gia_ban"] ??
            row["price"] ??
            "";

          const category =
            row["Danh mục"] ||
            row["danh_muc"] ||
            row["category"] ||
            "";

          const brand =
            row["Thương hiệu"] ||
            row["thuong_hieu"] ||
            row["brand"] ||
            "";

          const rawStock =
            row["Tồn kho"] ??
            row["Số lượng"] ??
            row["ton_kho"] ??
            row["stock"] ??
            "";

          const sizes =
            row["Kích cỡ"] ||
            row["Size"] ||
            row["kich_co"] ||
            row["sizes"] ||
            "";

          const colors =
            row["Màu sắc"] ||
            row["Màu"] ||
            row["mau_sac"] ||
            row["colors"] ||
            "";

          const image =
            row["Hình ảnh"] ||
            row["Ảnh"] ||
            row["hinh_anh"] ||
            row["image"] ||
            "";

          const description =
            row["Mô tả"] ||
            row["mo_ta"] ||
            row["description"] ||
            "";

          const cleanName = String(name || "").trim();
          const cleanCategory = String(category || "").trim();
          const cleanBrand = String(brand || "").trim();
          const cleanSizes = String(sizes || "").trim();
          const cleanColors = String(colors || "").trim();
          const cleanImage = String(image || "").trim();
          const cleanDesc = String(description || "").trim();

          const numPrice = Number(rawPrice);
          const numStock = Number(rawStock);

          const errors: string[] = [];
          const missingFields: string[] = [];

          // 1. Kiểm tra Tên sản phẩm (Bắt buộc)
          if (!cleanName) {
            errors.push("Thiếu tên sản phẩm");
            missingFields.push("Tên sản phẩm");
          }

          // 2. Kiểm tra Giá bán (Bắt buộc, phải là số > 0)
          if (rawPrice === "" || rawPrice === undefined || rawPrice === null || isNaN(numPrice) || numPrice <= 0) {
            errors.push("Thiếu giá bán");
            missingFields.push("Giá bán");
          }

          // 3. Kiểm tra Danh mục (Bắt buộc)
          if (!cleanCategory) {
            errors.push("Thiếu danh mục");
            missingFields.push("Danh mục");
          }

          // 4. Kiểm tra Thương hiệu (Bắt buộc)
          if (!cleanBrand) {
            errors.push("Thiếu thương hiệu");
            missingFields.push("Thương hiệu");
          }

          // 5. Kiểm tra Tồn kho (Bắt buộc, phải là số >= 0)
          if (rawStock === "" || rawStock === undefined || rawStock === null || isNaN(numStock) || numStock < 0) {
            errors.push("Thiếu tồn kho");
            missingFields.push("Tồn kho");
          }

          // 6. Kiểm tra Kích cỡ (Bắt buộc)
          if (!cleanSizes) {
            errors.push("Thiếu kích cỡ");
            missingFields.push("Kích cỡ");
          }

          // 7. Kiểm tra Màu sắc (Bắt buộc)
          if (!cleanColors) {
            errors.push("Thiếu màu sắc");
            missingFields.push("Màu sắc");
          }

          // Thiếu bất kỳ cột thông tin nào ở trên thì dòng đó sẽ Không hợp lệ
          const isValid = errors.length === 0;

          return {
            rowIdx: index + 2,
            name: cleanName,
            price: isNaN(numPrice) || numPrice <= 0 ? 0 : numPrice,
            rawPrice,
            category: cleanCategory,
            brand: cleanBrand,
            stock: isNaN(numStock) || numStock < 0 ? 0 : numStock,
            rawStock,
            sizes: cleanSizes,
            colors: cleanColors,
            image: cleanImage,
            description: cleanDesc,
            isValid,
            errors,
            missingFields,
          };
        });

        setImportPreviewList(parsedItems);
        setPreviewFilter("all");
        setIsImportModalOpen(true);
      } catch (err: any) {
        console.error("Lỗi phân tích file Excel:", err);
        toast.error(`Không thể đọc file Excel: ${err.message}`);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Xác nhận nhập kho toàn bộ sản phẩm hợp lệ từ Modal
  const handleConfirmImport = async () => {
    const validItems = importPreviewList.filter((item) => item.isValid);
    if (validItems.length === 0) {
      toast.error("Không có sản phẩm nào hợp lệ để nhập kho!");
      return;
    }

    try {
      setIsImporting(true);

      const payload = {
        products: validItems.map((item) => ({
          name: item.name,
          price: item.price,
          category: item.category || "Khác",
          brand: item.brand || "VinSport",
          stock: item.stock,
          sizes: item.sizes,
          colors: item.colors,
          image: item.image,
          description: item.description,
        })),
      };

      const res: any = await api.post("/admin/products/import", payload, {
        timeout: 180000,
      });

      toast.success(
        res?.message || `Đã nhập thành công ${validItems.length} sản phẩm từ file Excel!`
      );

      setIsImportModalOpen(false);
      setImportPreviewList([]);
      await loadProducts();
    } catch (err: any) {
      console.error("Lỗi khi nhập sản phẩm:", err);
      toast.error(
        err?.response?.data?.message || err?.message || "Nhập sản phẩm từ Excel thất bại!"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = useMemo(
    () => importPreviewList.filter((item) => item.isValid).length,
    [importPreviewList]
  );

  const invalidCount = useMemo(
    () => importPreviewList.filter((item) => !item.isValid).length,
    [importPreviewList]
  );

  const displayedPreviewList = useMemo(() => {
    if (previewFilter === "valid") return importPreviewList.filter((i) => i.isValid);
    if (previewFilter === "invalid") return importPreviewList.filter((i) => !i.isValid);
    return importPreviewList;
  }, [importPreviewList, previewFilter]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* HEADER VÀ THANH CÔNG CỤ NHẬP EXCEL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-6 rounded-full bg-orange-500" />
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Quản lý sản phẩm
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-4.5">
            Thêm mới, chỉnh sửa hoặc nhập hàng loạt từ file Excel.
          </p>
        </div>

        {/* Nhóm nút Thao tác: Tải mẫu, Nhập Excel & Thêm sản phẩm mới */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Input file ẩn */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={handleDownloadExcelTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold text-sm transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
            title="Tải file mẫu Excel"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Tải file mẫu Excel</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-200 cursor-pointer"
            title="Nhập sản phẩm từ file Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập từ file Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all shadow-md shadow-orange-200 cursor-pointer"
            title="Thêm sản phẩm mới"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm sản phẩm mới</span>
          </button>
        </div>
      </div>

      {/* DANH SÁCH SẢN PHẨM HIỆN TẠI */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-6 rounded-full bg-orange-500" />
              <h2 className="text-xl font-bold text-slate-900">Danh sách sản phẩm</h2>
            </div>

            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${categoryFilter === "all"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              Tất cả ({products.length})
            </button>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === "Áo" ? "all" : "Áo"))
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${categoryFilter === "Áo"
                ? "bg-orange-600 text-white shadow-xs"
                : "bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200/60"
                }`}
            >
              Áo: {aoCount}
            </button>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === "Quần" ? "all" : "Quần"))
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${categoryFilter === "Quần"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60"
                }`}
            >
              Quần: {quanCount}
            </button>

            <button
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === "Giày" ? "all" : "Giày"))
              }
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${categoryFilter === "Giày"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60"
                }`}
            >
              Giày: {giayCount}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên, hãng, danh mục..."
              className="w-full md:w-80 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm transition-all"
            />
            <button
              type="button"
              onClick={loadProducts}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Làm mới danh sách"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            <p className="text-sm font-medium">Đang tải danh sách sản phẩm...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            Không tìm thấy sản phẩm nào phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="p-4">ID</th>
                  <th className="p-4">Ảnh</th>
                  <th className="p-4">Tên sản phẩm</th>
                  <th className="p-4">Giá bán</th>
                  <th className="p-4">Danh mục</th>
                  <th className="p-4">Hãng</th>
                  <th className="p-4">Tồn kho</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={String(product.id)} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-bold text-slate-400">#{product.id}</td>

                    <td className="p-4">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-14 h-14 object-cover rounded-xl border border-slate-100 bg-white"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center text-xs text-slate-400 font-medium">
                          No img
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-semibold text-slate-800">{product.name}</td>
                    <td className="p-4 font-bold text-orange-600">
                      {Number(product.price || 0).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="p-4 text-slate-600">{product.category || "-"}</td>
                    <td className="p-4 font-medium text-slate-600">{product.brand || "-"}</td>
                    <td className="p-4 font-semibold">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${Number(product.stock || 0) > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-600"
                        }`}>
                        {product.stock ?? 0}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Sửa
                        </button>

                        <button
                          onClick={() => handleDelete(product.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAL POPUP THÊM / CHỈNH SỬA SẢN PHẨM THỦ CÔNG
         ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  {isEditing ? <Edit3 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {isEditing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEditing
                      ? "Cập nhật thông tin chi tiết cho sản phẩm trong hệ thống"
                      : "Điền đầy đủ thông tin để thêm sản phẩm mới vào cửa hàng"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseProductModal}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-grow overflow-hidden">
              <div className="p-6 md:p-8 overflow-y-auto flex-grow grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Nhập tên sản phẩm"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.name
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.name && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Giá bán (VNĐ) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="price"
                    type="number"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="Ví dụ: 350000"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.price
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.price && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Danh mục <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="category"
                    value={form.category || ""}
                    onChange={handleChange}
                    placeholder="Ví dụ: Áo, Quần, Giày, Phụ kiện"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.category
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.category && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Thương hiệu <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="brand"
                    value={form.brand || ""}
                    onChange={handleChange}
                    placeholder="Ví dụ: Nike, Adidas, Puma"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.brand
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.brand && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Ảnh sản phẩm (URL) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="image"
                    value={form.image || ""}
                    onChange={handleChange}
                    placeholder="Dán link ảnh (https://...)"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.image
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.image && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Tồn kho tổng <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="stock"
                    type="number"
                    value={form.stock ?? ""}
                    onChange={handleChange}
                    placeholder="Số lượng tồn kho ban đầu"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.stock
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.stock && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Kích cỡ (Sizes) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="sizes"
                    value={Array.isArray(form.sizes) ? form.sizes.join(", ") : ""}
                    onChange={handleChange}
                    placeholder="Ví dụ: S, M, L, XL hoặc 40, 41, 42"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.sizes
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.sizes && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Màu sắc (Colors) <span className="text-red-500">*</span>
                  </label>
                  <input
                    name="colors"
                    value={Array.isArray(form.colors) ? form.colors.join(", ") : ""}
                    onChange={handleChange}
                    placeholder="Ví dụ: Đen, Trắng, Đỏ, Xanh"
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.colors
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.colors && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Mô tả chi tiết <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={form.description || ""}
                    onChange={handleChange}
                    placeholder="Nhập mô tả sản phẩm..."
                    rows={3}
                    className={`w-full border rounded-xl px-4 py-3 outline-none text-sm transition-all ${hasSubmitted && fieldErrors.description
                      ? "border-red-500 bg-red-50/20 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                      : "border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      }`}
                  />
                  {hasSubmitted && fieldErrors.description && (
                    <p className="text-xs font-bold text-red-500 mt-1">
                      Thiếu
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Modal */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Làm mới form
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseProductModal}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-all cursor-pointer"
                  >
                    Đóng
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-200 disabled:opacity-60 transition-all cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <span>{isEditing ? "Cập nhật sản phẩm" : "Thêm sản phẩm"}</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL XEM TRƯỚC & KIỂM TRA CHUẨN CHỈ DỮ LIỆU NHẬP TỪ FILE EXCEL
         ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    Kiểm tra dữ liệu nhập từ file Excel
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hệ thống đã tự động kiểm tra tính hợp lệ và đánh dấu chi tiết từng cột dữ liệu
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thanh Thống Kê & Bộ Lọc Trạng Thái */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap text-sm">
              {/* Thống kê Hợp lệ & Không hợp lệ hiển thị cạnh nhau */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-medium">Tổng số dòng:</span>
                  <span className="font-bold text-slate-900">{importPreviewList.length}</span>
                </div>

                {/* Phần Hợp lệ */}
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3.5 py-1.5 rounded-xl font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hợp lệ: {validCount}</span>
                </div>

                {/* Phần Không hợp lệ (luôn hiển thị cạnh Hợp lệ) */}
                <div
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold border ${invalidCount > 0
                    ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Không hợp lệ: {invalidCount}</span>
                </div>
              </div>

              {/* Bộ lọc tab xem: Tất cả / Chỉ xem hợp lệ / Chỉ xem không hợp lệ */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPreviewFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${previewFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                >
                  Tất cả ({importPreviewList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter("valid")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${previewFilter === "valid"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-emerald-700 hover:bg-slate-50"
                    }`}
                >
                  Hợp lệ ({validCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFilter("invalid")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${previewFilter === "invalid"
                    ? "bg-red-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-red-700 hover:bg-slate-50"
                    }`}
                >
                  Không hợp lệ ({invalidCount})
                </button>
              </div>
            </div>

            {/* Bảng chi tiết từng dòng với nhãn THIẾU cho từng cột chưa điền */}
            <div className="p-6 overflow-y-auto flex-grow">
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="p-3 w-14">Dòng</th>
                      <th className="p-3 min-w-[140px]">Trạng thái</th>
                      <th className="p-3 min-w-[200px]">Tên sản phẩm</th>
                      <th className="p-3 min-w-[120px]">Giá bán</th>
                      <th className="p-3 min-w-[120px]">Danh mục</th>
                      <th className="p-3 min-w-[120px]">Thương hiệu</th>
                      <th className="p-3 min-w-[100px]">Tồn kho</th>
                      <th className="p-3 min-w-[130px]">Kích cỡ</th>
                      <th className="p-3 min-w-[130px]">Màu sắc</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedPreviewList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                          Không có sản phẩm nào trong mục này.
                        </td>
                      </tr>
                    ) : (
                      displayedPreviewList.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`transition-colors ${item.isValid ? "hover:bg-slate-50" : "bg-red-50/40 hover:bg-red-50/70"
                            }`}
                        >
                          <td className="p-3 font-bold text-slate-400">#{item.rowIdx}</td>

                          {/* Cột Trạng thái */}
                          <td className="p-3 align-top">
                            {item.isValid ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-md"
                                title={item.errors.join(", ")}
                              >
                                <AlertCircle className="w-3.5 h-3.5" /> Không hợp lệ
                              </span>
                            )}
                          </td>

                          {/* Cột Tên sản phẩm */}
                          <td className="p-3 font-bold text-slate-900 align-top">
                            {item.name ? (
                              item.name
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Giá bán */}
                          <td className="p-3 align-top">
                            {item.rawPrice !== "" && item.rawPrice !== undefined && item.rawPrice !== null && !isNaN(Number(item.rawPrice)) && Number(item.rawPrice) > 0 ? (
                              <span className="font-bold text-orange-600">
                                {Number(item.price).toLocaleString("vi-VN")} đ
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Danh mục */}
                          <td className="p-3 align-top">
                            {item.category ? (
                              <span className="text-slate-700 font-medium">{item.category}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Thương hiệu */}
                          <td className="p-3 align-top">
                            {item.brand ? (
                              <span className="text-slate-700 font-medium">{item.brand}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Tồn kho */}
                          <td className="p-3 align-top">
                            {item.rawStock !== "" && item.rawStock !== undefined && item.rawStock !== null && !isNaN(Number(item.rawStock)) && Number(item.rawStock) >= 0 ? (
                              <span className="font-semibold text-slate-800">{item.stock}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Kích cỡ */}
                          <td className="p-3 align-top">
                            {item.sizes ? (
                              <span className="text-slate-700 font-medium">{item.sizes}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>

                          {/* Cột Màu sắc */}
                          <td className="p-3 align-top">
                            {item.colors ? (
                              <span className="text-slate-700 font-medium">{item.colors}</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-600 border border-red-200">
                                Thiếu
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Ghi chú:</span> Tất cả các cột thông tin (Tên sản phẩm, Giá bán, Danh mục, Thương hiệu, Tồn kho, Kích cỡ, Màu sắc) đều phải điền đầy đủ. Thiếu bất kỳ cột nào sẽ bị tính là Không hợp lệ.
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || validCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-200 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang nhập {validCount} sản phẩm...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Xác nhận nhập kho ({validCount} sản phẩm hợp lệ)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
