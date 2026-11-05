import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import api from "../api/api";
import { useAuth } from "./AuthContext";

export type Product = {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  category?: string;
  brand?: string;
  images?: string[];
  sizes?: string[];
  colors?: { name: string; hex?: string }[];
  variants?: {
    variantId: number;
    size: string;
    color: string;
    hex?: string;
    price: number;
    stock: number;
  }[];
  isNew?: boolean;
};

export type CartItem = {
  product: Product;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
};

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, size: string, color: string, quantity?: number) => void;
  removeFromCart: (productId: string, size: string, color: string) => void;
  updateQuantity: (productId: string, size: string, color: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper hàm xác định key lưu trữ localStorage theo tài khoản
const getCartStorageKey = (uid: string | null) => (uid ? `vinsport_cart_${uid}` : "vinsport_cart_guest");

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const rawId = user?.id ?? user?.user_id;
  const currentUserId = isAuthenticated && rawId != null 
    ? (String(rawId).startsWith("user_") ? String(rawId) : `user_${rawId}`) 
    : null;

  const prevUserIdRef = useRef<string | null>(currentUserId);
  const isInitialSyncDone = useRef(false);

  // 1. Khởi tạo state giỏ hàng riêng biệt theo từng user (nếu chưa đăng nhập thì luôn trống)
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      localStorage.removeItem("vinsport_cart");
      localStorage.removeItem("vinsport_cart_guest");

      if (!currentUserId) return [];

      const storageKey = getCartStorageKey(currentUserId);
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 2. Tự động xử lý khi tài khoản thay đổi (Đăng nhập, Đăng xuất, Đổi nick)
  useEffect(() => {
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUserId;

    // Tạm khóa đồng bộ lên cloud trong lúc đang chuyển đổi tài khoản
    isInitialSyncDone.current = false;

    // TRƯỜNG HỢP 1: Chưa đăng nhập hoặc vừa Đăng xuất -> Làm trống giỏ ngay
    if (!currentUserId) {
      setItems([]);
      localStorage.removeItem("vinsport_cart_guest");
      isInitialSyncDone.current = true;
      return;
    }

    // TRƯỜNG HỢP 2: Đã đăng nhập một tài khoản cụ thể
    let isCancelled = false;

    const loadUserCart = async () => {
      // Đọc cache riêng của user này nếu có
      try {
        const cached = localStorage.getItem(`vinsport_cart_${currentUserId}`);
        if (cached) {
          setItems(JSON.parse(cached));
        } else if (prevUserId !== currentUserId) {
          setItems([]);
        }
      } catch {
        setItems([]);
      }

      try {
        // Tải giỏ hàng từ Amazon DynamoDB theo đúng userId của nick này
        const res: any = await api.get(`/cart?userId=${currentUserId}`);
        if (isCancelled) return;

        const cloudItems: CartItem[] = res?.items && Array.isArray(res.items) ? res.items : [];
        setItems(cloudItems);
        localStorage.setItem(`vinsport_cart_${currentUserId}`, JSON.stringify(cloudItems));
      } catch (err) {
        console.warn("[DynamoDB Cart] Không thể tải giỏ hàng từ cloud:", err);
      } finally {
        if (!isCancelled) {
          isInitialSyncDone.current = true;
        }
      }
    };

    loadUserCart();

    return () => {
      isCancelled = true;
    };
  }, [currentUserId]);

  // 3. Tự động lưu vào localStorage riêng và đồng bộ lên DynamoDB khi người dùng thao tác
  useEffect(() => {
    if (!isInitialSyncDone.current || !currentUserId) return;

    const storageKey = getCartStorageKey(currentUserId);
    localStorage.setItem(storageKey, JSON.stringify(items));

    const timer = setTimeout(() => {
      api.put("/cart", { userId: currentUserId, items }).catch((err) => {
        console.warn("[DynamoDB Cart] Lỗi đồng bộ lên cloud:", err);
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [items, currentUserId]);

  // 4. Bắt buộc đăng nhập khi thêm sản phẩm vào giỏ
  const addToCart = (product: Product, size: string, color: string, quantity = 1) => {
    if (!isAuthenticated || !currentUserId) {
      toast.error("Vui lòng đăng nhập trước khi thêm sản phẩm vào giỏ hàng!");
      navigate("/login");
      return;
    }

    setItems((prev) => {
      const existingItem = prev.find(
        (item) =>
          item.product.id === product.id &&
          item.selectedSize === size &&
          item.selectedColor === color
      );

      if (existingItem) {
        return prev.map((item) =>
          item.product.id === product.id &&
          item.selectedSize === size &&
          item.selectedColor === color
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        {
          product,
          quantity,
          selectedSize: size,
          selectedColor: color,
        },
      ];
    });
  };

  const removeFromCart = (productId: string, size: string, color: string) => {
    if (!isAuthenticated || !currentUserId) return;
    setItems((prev) =>
      prev.filter(
        (item) =>
          !(
            item.product.id === productId &&
            item.selectedSize === size &&
            item.selectedColor === color
          )
      )
    );
  };

  const updateQuantity = (productId: string, size: string, color: string, quantity: number) => {
    if (!isAuthenticated || !currentUserId) return;
    if (quantity <= 0) {
      removeFromCart(productId, size, color);
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId &&
        item.selectedSize === size &&
        item.selectedColor === color
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    if (currentUserId) {
      const storageKey = getCartStorageKey(currentUserId);
      localStorage.removeItem(storageKey);
      api.delete(`/cart?userId=${currentUserId}`).catch(() => {});
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};