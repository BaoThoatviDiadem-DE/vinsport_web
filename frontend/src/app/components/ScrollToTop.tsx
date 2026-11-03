import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Tự động cuộn lên đầu trang (Scroll to Top) mỗi khi chuyển sang route khác
 */
export const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // 1. Cuộn window về vị trí (0, 0)
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });

    // 2. Dự phòng thêm cho các trình duyệt hoặc element html/body
    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }
  }, [pathname]);

  return null;
};

