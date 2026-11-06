const { poolPromise } = require("../db");

/**
 * Controller cung cấp dữ liệu phân tích kinh doanh (Business Intelligence / Analytics)
 * Hỗ trợ tham số lọc thời gian: range = "7days" | "30days" | "all" | "custom" (& startDate, endDate)
 */
async function getAnalyticsData(req, res) {
  try {
    const pool = await poolPromise;
    const range = String(req.query.range || "all").toLowerCase();
    const startDate = req.query.startDate ? String(req.query.startDate).trim() : null;
    const endDate = req.query.endDate ? String(req.query.endDate).trim() : null;

    // 1. Xây dựng điều kiện lọc thời gian cho kỳ hiện tại & kỳ trước để tính tăng trưởng (%)
    let dateFilter = "";
    let prevDateFilter = "";

    if (range === "7days") {
      dateFilter = "AND o.order_date >= DATEADD(day, -7, GETDATE())";
      prevDateFilter = "AND o.order_date >= DATEADD(day, -14, GETDATE()) AND o.order_date < DATEADD(day, -7, GETDATE())";
    } else if (range === "30days") {
      dateFilter = "AND o.order_date >= DATEADD(day, -30, GETDATE())";
      prevDateFilter = "AND o.order_date >= DATEADD(day, -60, GETDATE()) AND o.order_date < DATEADD(day, -30, GETDATE())";
    } else if (range === "custom" && startDate) {
      const end = endDate || startDate;
      // Sanitize simple YYYY-MM-DD
      const safeStart = startDate.replace(/[^0-9-]/g, "");
      const safeEnd = end.replace(/[^0-9-]/g, "");
      dateFilter = `AND o.order_date >= '${safeStart}' AND o.order_date <= '${safeEnd} 23:59:59'`;

      const s = new Date(safeStart);
      const e = new Date(safeEnd);
      const diffDays = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1);
      prevDateFilter = `AND o.order_date >= DATEADD(day, -${diffDays}, '${safeStart}') AND o.order_date < '${safeStart}'`;
    } else {
      // "all" - toàn bộ
      dateFilter = "";
      prevDateFilter = "AND o.order_date >= DATEADD(day, -30, GETDATE()) AND o.order_date < DATEADD(day, -15, GETDATE())";
    }

    // 2. Truy vấn KPI kỳ hiện tại
    const kpiQuery = `
      SELECT
        COUNT(*) AS total_orders,
        ISNULL(SUM(total_amount), 0) AS total_revenue,
        ISNULL(AVG(total_amount), 0) AS avg_order_value,
        ISNULL(SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END), 0) AS completed_orders,
        ISNULL(SUM(CASE WHEN LOWER(status) = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_orders,
        COUNT(DISTINCT user_id) AS total_customers
      FROM Orders o
      WHERE 1=1 ${dateFilter}
    `;
    const kpiResult = await pool.request().query(kpiQuery);
    const kpi = kpiResult.recordset[0] || {
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      total_customers: 0,
    };

    // 2.1. Truy vấn KPI kỳ trước để so sánh tăng trưởng (%)
    const prevKpiQuery = `
      SELECT
        COUNT(*) AS total_orders,
        ISNULL(SUM(total_amount), 0) AS total_revenue,
        ISNULL(AVG(total_amount), 0) AS avg_order_value,
        ISNULL(SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END), 0) AS completed_orders
      FROM Orders o
      WHERE 1=1 ${prevDateFilter}
    `;
    const prevKpiResult = await pool.request().query(prevKpiQuery);
    const prevKpi = prevKpiResult.recordset[0] || {
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0,
      completed_orders: 0,
    };

    const calcGrowth = (curr, prev) => {
      if (!prev || prev === 0) {
        return curr > 0 ? 100 : 0;
      }
      return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
    };

    const totalOrdersCount = Number(kpi.total_orders || 0);
    const completedCount = Number(kpi.completed_orders || 0);
    const completionRate =
      totalOrdersCount > 0
        ? Math.round((completedCount / totalOrdersCount) * 100)
        : 0;

    const prevOrdersCount = Number(prevKpi.total_orders || 0);
    const prevCompletedCount = Number(prevKpi.completed_orders || 0);
    const prevCompletionRate =
      prevOrdersCount > 0
        ? Math.round((prevCompletedCount / prevOrdersCount) * 100)
        : 0;

    // 3. Chuỗi thời gian doanh thu & số đơn (Time-series)
    const timeSeriesQuery = `
      SELECT
        CONVERT(VARCHAR(10), o.order_date, 120) AS date,
        ISNULL(SUM(o.total_amount), 0) AS revenue,
        COUNT(*) AS order_count
      FROM Orders o
      WHERE 1=1 ${dateFilter}
      GROUP BY CONVERT(VARCHAR(10), o.order_date, 120)
      ORDER BY date ASC
    `;
    const timeSeriesResult = await pool.request().query(timeSeriesQuery);

    // 4. Cơ cấu phương thức thanh toán
    const paymentQuery = `
      SELECT
        ISNULL(p.method, 'COD') AS raw_method,
        COUNT(o.order_id) AS count,
        ISNULL(SUM(o.total_amount), 0) AS revenue
      FROM Orders o
      LEFT JOIN Payments p ON o.order_id = p.order_id
      WHERE 1=1 ${dateFilter}
      GROUP BY ISNULL(p.method, 'COD')
    `;
    const paymentResult = await pool.request().query(paymentQuery);
    const paymentMethods = paymentResult.recordset.map((item) => {
      let name = item.raw_method;
      const lower = String(item.raw_method || "").toLowerCase();
      if (lower === "bank" || lower === "banking") name = "Chuyển khoản (Bank)";
      else if (lower === "cod") name = "Thanh toán khi nhận (COD)";
      else if (lower === "momo") name = "Ví MoMo";
      return {
        name,
        count: Number(item.count || 0),
        revenue: Number(item.revenue || 0),
      };
    });

    // 5. Phân loại quy mô đơn hàng
    const sizeQuery = `
      SELECT
        CASE
          WHEN total_amount < 500000 THEN N'Nhỏ (< 500k)'
          WHEN total_amount <= 2000000 THEN N'Trung bình (500k - 2tr)'
          ELSE N'Lớn (> 2tr)'
        END AS size_category,
        COUNT(*) AS count,
        ISNULL(SUM(total_amount), 0) AS revenue
      FROM Orders o
      WHERE 1=1 ${dateFilter}
      GROUP BY
        CASE
          WHEN total_amount < 500000 THEN N'Nhỏ (< 500k)'
          WHEN total_amount <= 2000000 THEN N'Trung bình (500k - 2tr)'
          ELSE N'Lớn (> 2tr)'
        END
    `;
    const sizeResult = await pool.request().query(sizeQuery);

    // 6. Phân bổ trạng thái đơn hàng
    const statusQuery = `
      SELECT
        status,
        COUNT(*) AS count
      FROM Orders o
      WHERE 1=1 ${dateFilter}
      GROUP BY status
    `;
    const statusResult = await pool.request().query(statusQuery);

    // 7. Top 5 sản phẩm bán chạy nhất
    const topProductsQuery = `
      SELECT TOP 5
        p.product_id,
        p.name AS product_name,
        ISNULL(b.name, N'Khác') AS brand_name,
        ISNULL(c.name, N'Khác') AS category_name,
        img.image_url AS image,
        ISNULL(SUM(od.quantity), 0) AS total_sold,
        ISNULL(SUM(od.quantity * od.price), 0) AS total_revenue
      FROM OrderDetails od
      JOIN Orders o ON od.order_id = o.order_id
      JOIN ProductVariants pv ON od.variant_id = pv.variant_id
      JOIN Products p ON pv.product_id = p.product_id
      LEFT JOIN Brands b ON p.brand_id = b.brand_id
      LEFT JOIN Categories c ON p.category_id = c.category_id
      OUTER APPLY (
        SELECT TOP 1 image_url
        FROM ProductImages pi
        WHERE pi.product_id = p.product_id
        ORDER BY pi.image_id
      ) img
      WHERE 1=1 ${dateFilter}
      GROUP BY p.product_id, p.name, b.name, c.name, img.image_url
      ORDER BY total_sold DESC
    `;
    const topProductsResult = await pool.request().query(topProductsQuery);

    // 8. Báo cáo Doanh thu & Sản lượng theo Danh mục (Categories Breakdown)
    const categoriesQuery = `
      SELECT
        c.category_id,
        ISNULL(c.name, N'Khác') AS category_name,
        COUNT(DISTINCT p.product_id) AS product_count,
        ISNULL(SUM(od.quantity), 0) AS total_sold,
        ISNULL(SUM(od.quantity * od.price), 0) AS total_revenue
      FROM Categories c
      LEFT JOIN Products p ON c.category_id = p.category_id
      LEFT JOIN ProductVariants pv ON p.product_id = pv.product_id
      LEFT JOIN OrderDetails od ON pv.variant_id = od.variant_id
      LEFT JOIN Orders o ON od.order_id = o.order_id ${dateFilter}
      GROUP BY c.category_id, c.name
      ORDER BY total_revenue DESC
    `;
    const categoriesResult = await pool.request().query(categoriesQuery);

    // 9. Cảnh báo tồn kho thấp & sắp hết hàng (Low Stock Alerts)
    const lowStockQuery = `
      SELECT TOP 5
        s.product_id,
        s.product_name,
        s.brand_name,
        s.category_name,
        s.total_stock,
        s.stock_status,
        img.image_url AS image
      FROM vw_ProductStockStatus s
      OUTER APPLY (
        SELECT TOP 1 image_url
        FROM ProductImages pi
        WHERE pi.product_id = s.product_id
        ORDER BY pi.image_id
      ) img
      ORDER BY s.total_stock ASC
    `;
    const lowStockResult = await pool.request().query(lowStockQuery);

    // 10. Top 5 đơn hàng mới nhất
    const recentOrdersQuery = `
      SELECT TOP 5
        o.order_id,
        o.order_date,
        o.total_amount,
        o.status AS order_status,
        u.name AS customer_name,
        ISNULL(p.method, 'COD') AS payment_method,
        ISNULL(p.status, 'Pending') AS payment_status
      FROM Orders o
      JOIN Users u ON o.user_id = u.user_id
      LEFT JOIN (
        SELECT order_id, method, status,
               ROW_NUMBER() OVER(PARTITION BY order_id ORDER BY payment_id DESC) as rn
        FROM Payments
      ) p ON o.order_id = p.order_id AND p.rn = 1
      ORDER BY o.order_date DESC
    `;
    const recentOrdersResult = await pool.request().query(recentOrdersQuery);

    res.json({
      success: true,
      data: {
        filterRange: range,
        startDate: startDate || null,
        endDate: endDate || null,
        kpi: {
          totalRevenue: Number(kpi.total_revenue || 0),
          totalOrders: totalOrdersCount,
          avgOrderValue: Math.round(Number(kpi.avg_order_value || 0)),
          completedOrders: completedCount,
          cancelledOrders: Number(kpi.cancelled_orders || 0),
          totalCustomers: Number(kpi.total_customers || 0),
          completionRate,
          // Tăng trưởng so với kỳ trước
          revenueGrowth: calcGrowth(Number(kpi.total_revenue || 0), Number(prevKpi.total_revenue || 0)),
          ordersGrowth: calcGrowth(totalOrdersCount, Number(prevKpi.total_orders || 0)),
          aovGrowth: calcGrowth(Number(kpi.avg_order_value || 0), Number(prevKpi.avg_order_value || 0)),
          completionRateGrowth: Math.round((completionRate - prevCompletionRate) * 10) / 10,
        },
        timeSeries: timeSeriesResult.recordset.map((r) => ({
          date: r.date,
          revenue: Number(r.revenue || 0),
          orderCount: Number(r.order_count || 0),
        })),
        paymentMethods,
        orderSizes: sizeResult.recordset.map((r) => ({
          name: r.size_category,
          count: Number(r.count || 0),
          revenue: Number(r.revenue || 0),
        })),
        orderStatuses: statusResult.recordset.map((r) => ({
          name: r.status,
          count: Number(r.count || 0),
        })),
        topProducts: topProductsResult.recordset.map((r) => ({
          productId: r.product_id,
          name: r.product_name,
          brand: r.brand_name,
          category: r.category_name,
          image: r.image || "",
          totalSold: Number(r.total_sold || 0),
          totalRevenue: Number(r.total_revenue || 0),
        })),
        categories: categoriesResult.recordset.map((c) => ({
          id: c.category_id,
          name: c.category_name,
          productCount: Number(c.product_count || 0),
          totalSold: Number(c.total_sold || 0),
          totalRevenue: Number(c.total_revenue || 0),
        })),
        lowStockAlerts: lowStockResult.recordset.map((item) => ({
          productId: item.product_id,
          name: item.product_name,
          brand: item.brand_name,
          category: item.category_name,
          image: item.image || "",
          totalStock: Number(item.total_stock || 0),
          status: item.stock_status,
          isLow: Number(item.total_stock || 0) <= 25,
        })),
        recentOrders: recentOrdersResult.recordset.map((r) => ({
          orderId: r.order_id,
          orderDate: r.order_date,
          totalAmount: Number(r.total_amount || 0),
          orderStatus: r.order_status,
          customerName: r.customer_name,
          paymentMethod: r.payment_method,
          paymentStatus: r.payment_status,
        })),
        lakehouseInfo: {
          storage: "Amazon S3 (Data Lakehouse)",
          bucketName: process.env.AWS_BUCKET_NAME || "lakehouse-vinsport-1",
          format: "Apache Parquet (Columnar)",
          interval: "5 phút / lần (Airflow DAG)",
        },
      },
    });
  } catch (error) {
    console.error("Lỗi getAnalyticsData:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi truy vấn dữ liệu phân tích kinh doanh",
      error: error.message,
    });
  }
}

module.exports = {
  getAnalyticsData,
};
