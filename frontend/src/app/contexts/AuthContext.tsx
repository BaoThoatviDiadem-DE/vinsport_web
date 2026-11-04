import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import api from "../api/api";
import { useAuth as useCognitoAuth } from "react-oidc-context";
import toast from "react-hot-toast";

export type User = {
  id?: string | number;
  user_id?: string | number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: string;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: User | null;
  login: (email?: string, password?: string) => Promise<any>;
  register: (
    name?: string,
    email?: string,
    password?: string,
    phone?: string,
    address?: string
  ) => Promise<any>;
  loginDirect: (email: string, password: string) => Promise<any>;
  registerDirect: (data: { name: string; email: string; password: string; phone?: string }) => Promise<any>;
  confirmDirect: (data: { email: string; code: string; name?: string; phone?: string; password?: string }) => Promise<any>;
  resendCodeDirect: (email: string) => Promise<any>;
  loginWithCognitoUI: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUser(rawUser: any): User {
  return {
    id: rawUser?.id ?? rawUser?.user_id,
    user_id: rawUser?.user_id ?? rawUser?.id,
    name: rawUser?.name || "Người dùng",
    email: rawUser?.email || "",
    phone: rawUser?.phone || "",
    address: rawUser?.address || "",
    role: rawUser?.role || "user",
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const cognito = useCognitoAuth();

  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("vinsport_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const isSyncingRef = useRef(false);

  // Xử lý lỗi từ OIDC Cognito
  useEffect(() => {
    if (cognito.error) {
      console.error("Cognito OIDC Error:", cognito.error);
      toast.error(`Lỗi xác thực Cognito: ${cognito.error.message || cognito.error}`);
      setIsAuthLoading(false);
    }
  }, [cognito.error]);

  // Đồng bộ phiên đăng nhập Cognito (Hosted UI callback) với SQL Server
  useEffect(() => {
    let cancelled = false;

    const syncUser = async () => {
      if (cognito.isLoading) {
        setIsAuthLoading(true);
        return;
      }

      // Nếu đã có user lưu từ trước hoặc đang sync thì không clear
      if (!cognito.isAuthenticated || !cognito.user) {
        if (!cancelled && !isSyncingRef.current) {
          const storedToken = localStorage.getItem("vinsport_token");
          if (!storedToken) {
            setUser(null);
          }
          setIsAuthLoading(false);
        }
        return;
      }

      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsAuthLoading(true);

      try {
        const idToken = cognito.user.id_token;
        const accessToken = cognito.user.access_token;

        if (!idToken || !accessToken) {
          throw new Error("Cognito không trả về đầy đủ token xác thực");
        }

        console.log("[AUTH] Bắt đầu đồng bộ tài khoản Cognito với SQL Server...");

        const response: any = await api.post("/auth/link", {
          idToken,
        });

        if (!response?.user) {
          throw new Error("Backend không trả về thông tin người dùng hợp lệ");
        }

        const normalizedUser = normalizeUser(response.user);

        if (cancelled) return;

        localStorage.setItem("vinsport_token", accessToken);
        localStorage.setItem("vinsport_user", JSON.stringify(normalizedUser));

        setUser(normalizedUser);
        toast.success(`Đăng nhập thành công! Xin chào ${normalizedUser.name}`);
        console.log("[AUTH] Đồng bộ thành công người dùng:", normalizedUser);
      } catch (error: any) {
        const errMsg =
          error?.response?.data?.message ||
          error?.message ||
          "Không thể đồng bộ với cơ sở dữ liệu";

        console.error("Lỗi đồng bộ tài khoản Cognito:", errMsg, error);
        toast.error(`Đăng nhập thất bại: ${errMsg}`);

        localStorage.removeItem("vinsport_token");
        localStorage.removeItem("vinsport_user");

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        isSyncingRef.current = false;
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    syncUser();

    return () => {
      cancelled = true;
    };
  }, [
    cognito.isLoading,
    cognito.isAuthenticated,
    cognito.user,
  ]);

  // 1. Đăng ký trực tiếp trên web VinSport (ngầm gửi mã OTP qua Cognito)
  const registerDirect = async ({ name, email, password, phone }: { name: string; email: string; password: string; phone?: string }) => {
    try {
      const res: any = await api.post("/auth/cognito-direct/register", {
        name,
        email,
        password,
        phone,
      });
      return res;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Đăng ký thất bại";
      toast.error(msg);
      throw new Error(msg);
    }
  };

  // 2. Xác nhận mã OTP do Cognito gửi về Email
  const confirmDirect = async (data: { email: string; code: string; name?: string; phone?: string; password?: string }) => {
    try {
      const res: any = await api.post("/auth/cognito-direct/confirm", data);

      if (res?.user && res?.token) {
        const normalized = normalizeUser(res.user);
        localStorage.setItem("vinsport_token", res.token);
        localStorage.setItem("vinsport_user", JSON.stringify(normalized));
        setUser(normalized);
        toast.success(`Đăng ký và xác thực thành công! Chào ${normalized.name}`);
      }

      return res;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Xác thực mã OTP thất bại";
      toast.error(msg);
      throw new Error(msg);
    }
  };

  // 3. Gửi lại mã OTP
  const resendCodeDirect = async (email: string) => {
    try {
      const res: any = await api.post("/auth/cognito-direct/resend-code", { email });
      toast.success(res?.message || "Đã gửi lại mã OTP về Gmail!");
      return res;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || "Không thể gửi lại mã";
      toast.error(msg);
      throw new Error(msg);
    }
  };

  // 4. Đăng nhập trực tiếp bằng Email & Password trên web VinSport
  const loginDirect = async (email: string, password: string) => {
    try {
      const res: any = await api.post("/auth/cognito-direct/login", { email, password });

      if (res?.user && res?.token) {
        const normalized = normalizeUser(res.user);
        localStorage.setItem("vinsport_token", res.token);
        localStorage.setItem("vinsport_user", JSON.stringify(normalized));
        setUser(normalized);
        toast.success(`Đăng nhập thành công! Chào mừng ${normalized.name}`);
        return res;
      }
    } catch (err: any) {
      // Nếu tài khoản chưa xác nhận OTP
      if (err?.response?.data?.requireConfirm) {
        throw { requireConfirm: true, email, message: err.response.data.message };
      }

      const msg = err?.response?.data?.message || err.message || "Đăng nhập thất bại";
      toast.error(msg);
      throw new Error(msg);
    }
  };

  // 5. Đăng nhập qua Cognito Hosted UI (redirect ra trang AWS Cognito)
  const loginWithCognitoUI = async () => {
    try {
      await cognito.signinRedirect({
        extraQueryParams: { prompt: "login" },
      });
    } catch (error: any) {
      console.error("VINSPORT: Lỗi signinRedirect:", error);
      toast.error(`Lỗi chuyển hướng đăng nhập: ${error.message}`);
      throw error;
    }
  };

  // Tương thích ngược: mặc định gọi loginDirect nếu có mật khẩu, hoặc Hosted UI nếu không có
  const login = async (email?: string, password?: string) => {
    if (email && password) {
      return await loginDirect(email, password);
    }
    return await loginWithCognitoUI();
  };

  const register = async (name?: string, email?: string, password?: string, phone?: string) => {
    if (name && email && password) {
      return await registerDirect({ name, email, password, phone });
    }
    return await loginWithCognitoUI();
  };

  // 6. Đăng xuất an toàn: Xóa session cục bộ, KHÔNG gọi signoutRedirect để tránh lỗi HTTP 400
  const logout = async () => {
    setUser(null);
    localStorage.removeItem("vinsport_token");
    localStorage.removeItem("vinsport_user");

    try {
      await cognito.removeUser();
    } catch (e) {
      console.warn("Lỗi removeUser:", e);
    }

    toast.success("Đã đăng xuất thành công!");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isAuthLoading,
        user,
        login,
        register,
        loginDirect,
        registerDirect,
        confirmDirect,
        resendCodeDirect,
        loginWithCognitoUI,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
