import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("vinsport_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorDetails = error?.response?.data?.message || error.message;
    console.error("Lá»—i káº¿t ná»‘i há»‡ thá»‘ng VinSport:", errorDetails);

    if (error?.response?.status === 401 && !error.config?.url?.includes("/auth/link")) {
      localStorage.removeItem("vinsport_token");
      localStorage.removeItem("vinsport_user");
    }

    return Promise.reject(error);
  }
);

export default api;

