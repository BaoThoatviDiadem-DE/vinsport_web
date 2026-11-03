export type Product = {
  id: string;
  name: string;
  category: "Giày" | "Áo" | "Bóng" | "Phụ kiện";
  brand: "Nike" | "Adidas" | "Puma";
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  sizes: string[];
  colors?: {
    name: string;
    hex: string;
    image: string;
  }[];
  description: string;
  isNew?: boolean;
  stock?: number;
  variants?: {
    variantId: number;
    size: string;
    color: string;
    hex?: string;
    price: number;
    stock: number;
  }[];
};

export const MOCK_PRODUCTS: Product[] = [
  // ==========================================
  // DANH MỤC GIÀY: NIKE (2 ĐÔI) - CÓ MÀU SẮC
  // ==========================================
  {
    id: "g-n1",
    name: "Giày chạy bộ Nike Pegasus 42",
    category: "Giày",
    brand: "Nike",
    price: 2950000,
    originalPrice: 3829000,
    image:
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/6edeec71-1b18-4990-9742-7068166eb34e/AIR+ZOOM+PEGASUS+42+RR.png",
    images: [
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/50e94abf-c2be-470d-8302-5faf6429375a/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/9497c6ad-681f-4a98-802f-83af5542e0e8/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/bed51cbf-f45e-4a20-afea-2d3aa3807f96/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/5b4a0075-d94d-44f8-98b1-81e00d0146f7/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/979464ec-bee6-42e7-8736-1f5ccb880b0f/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/a8827fe6-65c0-4b4f-8172-b72ed5a73055/AIR+ZOOM+PEGASUS+42+RR.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/e0ed82c3-5dfc-492c-98e3-265bd846ace4/AIR+ZOOM+PEGASUS+42+RR.png",
    ],
    sizes: ["39", "40", "41", "42", "43"],
    colors: [
      {
        name: "Cam/Trắng",
        hex: "#f97316",
        image:
          "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/cd18da5d-8d0a-4c28-a503-6403b404714c/AIR+ZOOM+PEGASUS+42.png",
      },
      {
        name: "Trắng Xám",
        hex: "#e2e8f0",
        image:
          "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/6edeec71-1b18-4990-9742-7068166eb34e/AIR+ZOOM+PEGASUS+42+RR.png",
      },
    ],
    description:
      "Nike Air Zoom Pegasus 42 mang lại sự thoải mái, đệm êm nhẹ và độ bám tuyệt vời.",
    isNew: true,
  },
  {
    id: "g-n2",
    name: "Giày thời trang Nike Air Force 1 '07",
    category: "Giày",
    brand: "Nike",
    price: 2650000,
    image:
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png",
    images: [
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/33533fe2-1157-4001-896e-1803b30659c8/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/3cc96f43-47b6-43cb-951d-d8f73bb2f912/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/a0a300da-2e16-4483-ba64-9815cf0598ac/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/82aa97ed-98bf-4b6f-9d0b-31a9f907077b/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/ef92df87-6098-4fa5-bc88-7107492febcf/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/120a31b0-efa7-41c7-9a84-87b1e56ab9c3/AIR+FORCE+1+%2707.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/1c1e5f55-99c2-4522-b398-2352e01ba566/AIR+FORCE+1+%2707.png",
    ],
    sizes: ["39", "40", "41", "42"],
    colors: [
      {
        name: "Trắng Full",
        hex: "#ffffff",
        image:
          "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png",
      },
      {
        name: "Đen",
        hex: "#000000",
        image:
          "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/fc4622c4-2769-4665-aa6e-42c974a7705e/AIR+FORCE+1+%2707.png",
      },
    ],
    description:
      "Huyền thoại Air Force 1 với thiết kế cổ điển không bao giờ lỗi mốt.",
  },

  // ==========================================
  // DANH MỤC GIÀY: ADIDAS (2 ĐÔI) - CÓ MÀU SẮC
  // ==========================================
  {
    id: "g-a1",
    name: "Giày đá banh Adidas Predator Club",
    category: "Giày",
    brand: "Adidas",
    price: 1800000,
    image:
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/644a820a87764aa6a4cb0757f5b8a7ef_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_22_model.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/966087d117b5459c8e8a53edab2017e7_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_01_00_standard_hover.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/5c47206c86304d95a8a2fef916ef1e15_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_02_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/00cfbd2b8dda49c4a68781fc955f7ff1_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_03_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/9a8f3b1388454098bdb6fe3d16dd0779_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_04_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/4150809616114e03800c9e95443f7d9c_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_05_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/7ec19cd116fe418d820d18c53fab9613_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_06_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/09f0c1cec75c4e60a612dc16d7cd7d97_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_09_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/a8aff02efeb64066839b6b3c5687040b_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_41_detail.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/92074afb40a7421fa569b4755df646c7_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_42_detail.jpg",
    ],
    sizes: ["38", "39", "40", "41", "42"],
    colors: [
      {
        name: "Xanh dương",
        hex: "#B3EBF2",
        image:
          "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/644a820a87764aa6a4cb0757f5b8a7ef_9366/Giay_Bong_DJa_San_Co_Nhan_Tao_Predator_Club_Mau_xanh_da_troi_JS0355_22_model.jpg",
      },
      {
        name: "Đỏ",
        hex: "#FA5053",
        image:
          "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/6013e3988a1f44028b1373bbb7640c5a_9366/Giay_DJa_Bong_San_Co_Nhan_Tao_Predator_Club_DJo_JS0356_22_model.jpg",
      },
    ],
    description:
      "Tăng độ bám dính bóng tuyệt vời nhờ công nghệ Control Zone của Adidas Predator Accuracy.",
    isNew: true,
  },
  {
    id: "g-a2",
    name: "Giày thời trang Samba OG",
    category: "Giày",
    brand: "Adidas",
    price: 2700000,
    originalPrice: 3200000,
    image:
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Giay_Samba_OG_trang_B75806_01_00_standard.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/ec595635a2994adea094a8bf0117ef1a_9366/Giay_Samba_OG_trang_B75806_02_standard_hover.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/97cd0902ae2e402b895aa8bf0117f98f_9366/Giay_Samba_OG_trang_B75806_03_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/b067d21288bc43ec8298a8bf01180400_9366/Giay_Samba_OG_trang_B75806_04_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3a8d5f9cb7444bd195f1a8bf01180e68_9366/Giay_Samba_OG_trang_B75806_05_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/07567ea7d2bb425b8651a8bf0117e4f1_9366/Giay_Samba_OG_trang_B75806_06_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/b19389122c51434eb5bea8bf0117da35_9366/Giay_Samba_OG_trang_B75806_07_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/f9ce5733049f4ca8a93aa8bf011858bd_9366/Giay_Samba_OG_trang_B75806_09_standard.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/671c62b81c3448e980aca8bf01181a93_9366/Giay_Samba_OG_trang_B75806_41_detail.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/6cea1ecd4fee4337ab5da8bf011823ca_9366/Giay_Samba_OG_trang_B75806_42_detail.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/0c94e4fecb7a4088b15fa8bf01183214_9366/Giay_Samba_OG_trang_B75806_43_detail.jpg",
    ],
    sizes: ["39", "40", "41", "42", "43"],
    colors: [
      {
        name: "Trắng",
        hex: "#ffffff",
        image:
          "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Giay_Samba_OG_trang_B75806_01_00_standard.jpg",
      },
      {
        name: "Đen",
        hex: "#111827",
        image:
          "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/f9ce5733049f4ca8a93aa8bf011858bd_9366/Giay_Samba_OG_trang_B75806_09_standard.jpg",
      },
    ],
    description:
      "Đôi giày mang tính biểu tượng của đường phố với vẻ đẹp không bao giờ lỗi thời.",
  },

  // ==========================================
  // DANH MỤC GIÀY: PUMA (3 ĐÔI) - CÓ MÀU SẮC
  // ==========================================
  {
    id: "g-p1",
    name: "Giày bóng đá Futsal Puma Future 8 Match ",
    category: "Giày",
    brand: "Puma",
    price: 2100000,
    image:
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
    images: [
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/bv/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/sv02/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/sv03/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/sv04/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
    ],
    sizes: ["39", "40", "41", "42"],
    colors: [
      {
        name: "Trắng",
        hex: "#ffffff",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/01/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      },
      {
        name: "Cam",
        hex: "#FF7518",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/108598/03/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Futsal-FUTURE-8-MATCH-Unisex",
      },
    ],
    description:
      "Cấu trúc đàn hồi siêu nhẹ, hỗ trợ bức tốc trên sân.",
    isNew: true,
  },
  {
    id: "g-p2",
    name: "Giày Sneaker Puma unisex Court Classic Vulc",
    category: "Giày",
    brand: "Puma",
    price: 1360000,
    image:
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
    images: [
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/bv/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/sv02/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/sv03/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/sv04/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
    ],
    sizes: ["39", "40", "41", "42", "43"],
    colors: [
      {
        name: "Đen",
        hex: "#292524",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/03/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      },
      {
        name: "Trắng",
        hex: "#FFFFFF",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/395020/02/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-th%E1%BB%83-thao-unisex-Court-Classic-Vulc",
      },
    ],
    description:
      "Lấy cảm hứng từ tennis nhưng được thiết kế cho đường phố, Court Classic Vulc kết hợp thể thao và phong cách. Đón nhận phong cách nhẹ nhàng, thoải mái và biến thành phong cách của riêng bạn.",
  },
  {
    id: "g-p3",
    name: "Giày Chạy Bộ Deviate NITRO™ 4",
    category: "Giày",
    brand: "Puma",
    price: 4200000,
    image:
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
    images: [
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/bv/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/sv02/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/sv03/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/sv04/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
    ],
    sizes: ["40", "41", "42", "43"],
    colors: [
      {
        name: "Xanh neon",
        hex: "#d9f99d",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/04/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      },
      {
        name: "Trắng",
        hex: "#FFFFFF",
        image:
          "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312123/02/sv01/fnd/VNM/fmt/png/Gi%C3%A0y-Ch%E1%BA%A1y-B%E1%BB%99-Deviate-NITRO%E2%84%A2-4-Nam",
      },
    ],
    description:
      "Deviate 4 không chỉ nhanh – mà là quá nhanh. Nhẹ hơn 15g so với phiên bản trước, đôi giày hiệu suất cao này được tạo ra cho những runner không chấp nhận chậm lại.",
  },

  // ==========================================
  // DANH MỤC ÁO: NIKE (2 BỘ) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "a-n1",
    name: "Áo khoác thể thao Nike Sportswear Club",
    category: "Áo",
    brand: "Nike",
    price: 2299000,
    image:
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/2d0826c6-34e2-4fd8-829a-61d017dbc883/AS+M+NK+CLUB+PK+TRK+SUIT.png",
    images: [
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/2d0826c6-34e2-4fd8-829a-61d017dbc883/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/4e73540e-fd41-45ec-b5d8-9d28282655a3/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/93711a08-2619-4ca1-ac43-cb8b1106d585/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/aa104509-51a6-483d-b728-93571474f40c/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/43e71292-1199-4f98-b6bf-4c2cdc5b81e8/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/e8b8867e-820a-40b7-a6fa-5f15dd3d4630/AS+M+NK+CLUB+PK+TRK+SUIT.png",
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto/aeac3c81-fadc-4ad0-befa-d95467ccb055/AS+M+NK+CLUB+PK+TRK+SUIT.png"
    ],
    sizes: ["M", "L", "XL", "XXL"],
    description:
      "",
  },
  {
    id: "a-n2",
    name: "Áo thun tập gym Nike Dri-FIT",
    category: "Áo",
    brand: "Nike",
    price: 650000,
    originalPrice: 800000,
    image:
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    images: [
      "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=1080",
    ],
    sizes: ["S", "M", "L", "XL"],
    description:
      "Công nghệ Dri-FIT thấm hút mồ hôi, giúp bạn luôn khô ráo.",
    isNew: true,
  },

  // ==========================================
  // DANH MỤC ÁO: ADIDAS (1 BỘ) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "a-a1",
    name: "Áo Đấu Sân Nhà Argentina 26",
    category: "Áo",
    brand: "Adidas",
    price: 2200000,
    image:
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/841749a208934f2ab4a0cfa1a8ae237d_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_21_model.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3c16ce3f59834e0cbe052a59f63e27c5_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_23_hover_model.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/6e10e88e911b47a6ad914e3626ea6b67_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_25_model.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/20f23eb7f4df4dd4958601c064ffa0d8_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_01_laydown.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/ddd9144641ae4dc2b51e1837432c6e81_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_02_laydown_hover.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/bc612598c7b64bbfb32b0fbacd1cd718_9366/Ao_DJau_San_Nha_Argentina_26_trang_JM8396_41_detail.jpg"

    ],
    sizes: ["S", "M", "L", "XL"],
    description:
      "Trang bị cho FIFA World Cup 26™ với Áo đấu Sân nhà Argentina. Thiết kế cho La Albiceleste. Lấy cảm hứng từ ba chiến thắng World Cup của đội.",
  },
    {
    id: "a-a2",
    name: "Áo Thun Đội Tuyển Tây Ban Nha Originals",
    category: "Áo",
    brand: "Adidas",
    price: 1100000,
    image: "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/f654b8f15e054ff3a403e3441ce1319d_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM1.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/f654b8f15e054ff3a403e3441ce1319d_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM1.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/473ae2eab256447a8779cc459aacc1c3_faec/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM3_hover.tiff.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/54eeb0cc66604c5ca312fa55d5c8f67a_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM4.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/33b8c87540354bae90a508b3137db55c_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM5.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/c72c1b5d002f4d8abe0c51cc89497547_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM6.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/ed786aaa4bb647929eb98927a7219da1_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM7.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/4183fa2eac7242548c41ecd8d313072f_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM8.jpg",
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/7de1a46514114f2aa3c057eb5561ee5c_9366/Ao_Thun_DJoi_Tuyen_Tay_Ban_Nha_Originals_trang_JZ2256_HM9.jpg" 
    ],
    sizes: ["S", "M", "L", "XL"],
    description: "Trang bị cho FIFA World Cup 26™ với Áo thun Originals Tây Ban Nha. Thiết kế hoài cổ đầy phong cách.",
  },

  // ==========================================
  // DANH MỤC ÁO: PUMA (2 BỘ) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "a-p1",
    name: "Áo khoác chạy bộ họa tiết Lightspeed ULTRAWEAVE",
    category: "Áo",
    brand: "Puma",
    price: 3000000,
    image:
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod01/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
    images: [
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod01/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod02/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod03/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod04/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/mod05/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528779/48/bv/fnd/VNM/fmt/png/%C3%81o-kho%C3%A1c-ch%E1%BA%A1y-b%E1%BB%99-h%E1%BB%8Da-ti%E1%BA%BFt-Lightspeed-ULTRAWEAVE-cho-nam",
    ],
    sizes: ["M", "L", "XL"],
    description:
      "Áo khoác chạy bộ Lightspeed ULTRAWEAVE siêu nhẹ, được thiết kế khí động học để tạo sự tự do. Sự thoải mái không bị phân tâm giúp bạn tập trung, với công nghệ dryCELL quản lý độ ẩm và túi khóa kéo an toàn để đựng những vật dụng cần thiết. Chỉ có bạn và đích đến.",
  },
  {
    id: "a-p2",
    name: "Áo gió nam PUMATECH",
    category: "Áo",
    brand: "Puma",
    price: 2200000,
    image:
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/mod01/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
    images: [
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/mod01/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/mod02/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/mod03/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
      "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/692157/01/bv/fnd/VNM/fmt/png/%C3%81o-gi%C3%B3-nam-PUMATECH",
    ],
    sizes: ["S", "M", "L", "XL"],
    description:
      "Dòng thời trang đường phố kỹ thuật PUMATECH đã quay trở lại một lần nữa. Thiết kế khám phá chức năng và tính thẩm mỹ công nghệ cho ra đời chiếc áo vừa tiện dụng vừa có thể diện trên phố.",
    isNew: true,
  },

  // ==========================================
  // DANH MỤC PHỤ KIỆN: BALO (2 CÁI) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "pk-1",
    name: "Balo thể thao Adidas Classic",
    category: "Phụ kiện",
    brand: "Adidas",
    price: 550000,
    image:
      "https://images.unsplash.com/photo-1593460831901-90f761c2d28b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZGlkYXMlMjBiYWNrcGFja3xlbnwxfHx8fDE3NzYyNjk4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1593460831901-90f761c2d28b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZGlkYXMlMjBiYWNrcGFja3xlbnwxfHx8fDE3NzYyNjk4NzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1553632168-eb4237620881?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcGVuJTIwYmFja3BhY2t8ZW58MXx8fHwxNzc2MjcwNDY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1660296638798-cf81263b31e7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZGlkYXMlMjBiYWNrcGFjayUyMHBlcnNvbnxlbnwxfHx8fDE3NzYyNzA0NjN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    sizes: ["One Size"],
    description:
      "Balo rộng rãi đựng vừa laptop và đồ tập, chất liệu chống thấm nước cơ bản.",
  },
  {
    id: "pk-2",
    name: "Balo thể thao Nike Brasilia",
    category: "Phụ kiện",
    brand: "Nike",
    price: 650000,
    image:
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/e920d32f-48d0-424a-b501-419b48b1d91e/BRASILIA+9.5+BKPK.png",
    images: [
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/e920d32f-48d0-424a-b501-419b48b1d91e/BRASILIA+9.5+BKPK.png",
    ],
    sizes: ["One Size"],
    description:
      "Ngăn chứa rộng rãi, có ngăn đựng laptop riêng biệt.",
  },

  // ==========================================
  // DANH MỤC BÓNG: BÓNG RỔ (2 QUẢ) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "b-1",
    name: "Quả bóng rổ Nike Elite Championship",
    category: "Bóng",
    brand: "Nike",
    price: 1150000,
    image:
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/a78b5ce0-3ec5-40b9-aa32-231a31b4ab4b/NIKE+CHAMPIONSHIP+8P.png",
    images: [
      "https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,q_auto:eco/a78b5ce0-3ec5-40b9-aa32-231a31b4ab4b/NIKE+CHAMPIONSHIP+8P.png",
    ],
    sizes: ["7"],
    description:
      "Bóng rổ tiêu chuẩn thi đấu, bề mặt da tổng hợp bám dính cực tốt.",
    isNew: true,
  },
  {
    id: "b-2",
    name: "Quả bóng rổ Adidas All Court",
    category: "Bóng",
    brand: "Adidas",
    price: 750000,
    image:
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/20ec871c8289456cad58ae9000fd3c70_9366/Bong_All-Court_3.0_Dien_HM4970_01_standard.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/20ec871c8289456cad58ae9000fd3c70_9366/Bong_All-Court_3.0_Dien_HM4970_01_standard.jpg",
    ],
    sizes: ["7"],
    description:
      "Thiết kế phù hợp cho cả sân trong nhà lẫn ngoài trời.",
  },

  // ==========================================
  // DANH MỤC BÓNG: BÓNG ĐÁ (2 QUẢ) - KHÔNG MÀU SẮC
  // ==========================================
  {
    id: "b-3",
    name: "Quả bóng đá Puma Orbita Serie A",
    category: "Bóng",
    brand: "Puma",
    price: 650000,
    originalPrice: 800000,
    image:
      "https://images.unsplash.com/photo-1612387605285-7ee92eae6958?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdW1hJTIwZm9vdGJhbGx8ZW58MXx8fHwxNzc2MjY5ODc1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    images: [
      "https://images.unsplash.com/photo-1612387605285-7ee92eae6958?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdW1hJTIwZm9vdGJhbGx8ZW58MXx8fHwxNzc2MjY5ODc1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      "https://images.unsplash.com/photo-1766934824997-f99bbcad64f3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdW1hJTIwZm9vdGJhbGwlMjBmaWVsZHxlbnwxfHx8fDE3NzYyNzA0NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    ],
    sizes: ["5"],
    description:
      "Bóng đá đạt chuẩn thi đấu chuyên nghiệp của Puma, độ nảy và độ bền xuất sắc.",
  },
  {
    id: "b-4",
    name: "Quả bóng đá Adidas Al Rihla Pro",
    category: "Bóng",
    brand: "Adidas",
    price: 3500000,
    image:
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3b128cb504bc493a8d67ae8a0112dd1a_9366/Bong_Pro_Al_Rihla_Trang_H57783_01_standard.jpg",
    images: [
      "https://assets.adidas.com/images/h_2000,f_auto,q_auto,fl_lossy,c_fill,g_auto/3b128cb504bc493a8d67ae8a0112dd1a_9366/Bong_Pro_Al_Rihla_Trang_H57783_01_standard.jpg",
    ],
    sizes: ["5"],
    description:
      "Bóng thi đấu chính thức của giải đấu quốc tế. Công nghệ ghép nối nhiệt hiện đại.",
  },
];

export const formatPrice = (price: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};