import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { OrderTracking } from "./pages/OrderTracking";
import { Auth } from "./pages/Auth";
import AdminProducts from "./pages/AdminProducts";
import AdminUsers from "./pages/AdminUsers";
import AdminOrders from "./pages/AdminOrders";
import AdminAnalytics from "./pages/AdminAnalytics";
import ProtectedAdminRoute from "./components/ProtectedAdminRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "products", Component: Products },
      { path: "product/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: Checkout },
      { path: "tracking", Component: OrderTracking },
      { path: "login", Component: Auth },
      {
        path: "admin/analytics",
        element: (
          <ProtectedAdminRoute>
            <AdminAnalytics />
          </ProtectedAdminRoute>
        ),
      },
      {
        path: "admin/products",
        element: (
          <ProtectedAdminRoute>
            <AdminProducts />
          </ProtectedAdminRoute>
        ),
      },
      {
        path: "admin/users",
        element: (
          <ProtectedAdminRoute>
            <AdminUsers />
          </ProtectedAdminRoute>
        ),
      },
      {
        path: "admin/orders",
        element: (
          <ProtectedAdminRoute>
            <AdminOrders />
          </ProtectedAdminRoute>
        ),
      },
    ],
  },
]);