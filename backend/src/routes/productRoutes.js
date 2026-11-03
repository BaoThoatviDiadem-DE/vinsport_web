const express = require("express");
const router = express.Router();
const { poolPromise, sql } = require("../db");

// GET /api/products?search=
router.get("/", async (req, res) => {
  try {
    const { search = "" } = req.query;
    const keyword = String(search).trim();

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("keyword", sql.NVarChar, `%${keyword}%`)
      .query(`
        SELECT 
          p.product_id,
          p.name,
          p.description,
          b.name AS brand_name,
          c.name AS category_name,
          ISNULL(MIN(pv.price), 0) AS price,
          ISNULL(SUM(pv.stock), 0) AS total_stock,
          (
            SELECT TOP 1 pi.image_url
            FROM ProductImages pi
            WHERE pi.product_id = p.product_id
            ORDER BY pi.image_id
          ) AS image_url
        FROM Products p
        LEFT JOIN Brands b ON p.brand_id = b.brand_id
        LEFT JOIN Categories c ON p.category_id = c.category_id
        LEFT JOIN ProductVariants pv ON p.product_id = pv.product_id
        WHERE
          @keyword = '%%'
          OR p.name LIKE @keyword
          OR ISNULL(p.description, '') LIKE @keyword
          OR ISNULL(b.name, '') LIKE @keyword
          OR ISNULL(c.name, '') LIKE @keyword
        GROUP BY
          p.product_id,
          p.name,
          p.description,
          b.name,
          c.name
        ORDER BY p.product_id DESC
      `);

    // Lấy thông tin tất cả màu sắc cho từng sản phẩm
    const colorsResult = await pool.request().query(`
      SELECT DISTINCT 
        pv.product_id,
        c.name AS color_name,
        c.hex_code
      FROM ProductVariants pv
      INNER JOIN Colors c ON pv.color_id = c.color_id
      ORDER BY pv.product_id, c.name
    `);

    const colorsByProduct = {};
    for (const c of colorsResult.recordset) {
      if (!colorsByProduct[c.product_id]) {
        colorsByProduct[c.product_id] = [];
      }
      colorsByProduct[c.product_id].push({
        name: c.color_name,
        hex: c.hex_code || "#000000",
      });
    }

    // Lấy thông tin tất cả kích cỡ cho từng sản phẩm
    const sizesResult = await pool.request().query(`
      SELECT DISTINCT 
        pv.product_id,
        s.name AS size_name
      FROM ProductVariants pv
      INNER JOIN Sizes s ON pv.size_id = s.size_id
      ORDER BY pv.product_id, s.name
    `);

    const sizesByProduct = {};
    for (const s of sizesResult.recordset) {
      if (!sizesByProduct[s.product_id]) {
        sizesByProduct[s.product_id] = [];
      }
      sizesByProduct[s.product_id].push(s.size_name);
    }

    // Lấy chi tiết từng biến thể (color, size, price, stock)
    const variantsResult = await pool.request().query(`
      SELECT
        pv.variant_id,
        pv.product_id,
        s.name AS size,
        c.name AS color,
        c.hex_code,
        pv.price,
        pv.stock
      FROM ProductVariants pv
      INNER JOIN Sizes s ON pv.size_id = s.size_id
      INNER JOIN Colors c ON pv.color_id = c.color_id
      ORDER BY pv.variant_id
    `);

    const variantsByProduct = {};
    for (const v of variantsResult.recordset) {
      if (!variantsByProduct[v.product_id]) {
        variantsByProduct[v.product_id] = [];
      }
      variantsByProduct[v.product_id].push({
        variantId: v.variant_id,
        size: v.size,
        color: v.color,
        hex: v.hex_code || "#000000",
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
      });
    }

    const products = result.recordset.map((row) => ({
      id: String(row.product_id),
      name: row.name || "",
      description: row.description || "",
      category: row.category_name || "",
      brand: row.brand_name || "",
      price: Number(row.price) || 0,
      stock: Number(row.total_stock) || 0,
      image: row.image_url || "",
      colors: colorsByProduct[row.product_id] || [],
      sizes: sizesByProduct[row.product_id] || [],
      variants: variantsByProduct[row.product_id] || [],
      isNew: false,
    }));

    res.json(products);
  } catch (error) {
    console.error("GET /api/products error:", error);
    res.status(500).json({
      message: "Lỗi lấy danh sách sản phẩm",
    });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      return res.status(400).json({
        message: "ID sản phẩm không hợp lệ",
      });
    }

    const pool = await poolPromise;

    const productResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(`
        SELECT 
          p.product_id,
          p.name,
          p.description,
          b.name AS brand_name,
          c.name AS category_name,
          ISNULL(MIN(pv.price), 0) AS price,
          ISNULL(SUM(pv.stock), 0) AS total_stock
        FROM Products p
        LEFT JOIN Brands b ON p.brand_id = b.brand_id
        LEFT JOIN Categories c ON p.category_id = c.category_id
        LEFT JOIN ProductVariants pv ON p.product_id = pv.product_id
        WHERE p.product_id = @productId
        GROUP BY
          p.product_id,
          p.name,
          p.description,
          b.name,
          c.name
      `);

    if (productResult.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy sản phẩm",
      });
    }

    const row = productResult.recordset[0];

    const imagesResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(`
        SELECT image_url
        FROM ProductImages
        WHERE product_id = @productId
        ORDER BY image_id
      `);

    const sizesResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(`
        SELECT DISTINCT s.name
        FROM ProductVariants pv
        INNER JOIN Sizes s ON pv.size_id = s.size_id
        WHERE pv.product_id = @productId
        ORDER BY s.name
      `);

    const colorsResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(`
        SELECT DISTINCT c.name, c.hex_code
        FROM ProductVariants pv
        INNER JOIN Colors c ON pv.color_id = c.color_id
        WHERE pv.product_id = @productId
        ORDER BY c.name
      `);

    const variantsResult = await pool
      .request()
      .input("productId", sql.Int, productId)
      .query(`
        SELECT
          pv.variant_id,
          s.name AS size,
          c.name AS color,
          c.hex_code,
          pv.price,
          pv.stock
        FROM ProductVariants pv
        INNER JOIN Sizes s ON pv.size_id = s.size_id
        INNER JOIN Colors c ON pv.color_id = c.color_id
        WHERE pv.product_id = @productId
        ORDER BY pv.variant_id
      `);

    const images = imagesResult.recordset.map((item) => item.image_url).filter(Boolean);
    const sizes = sizesResult.recordset.map((item) => item.name).filter(Boolean);
    const colors = colorsResult.recordset.map((item) => ({
      name: item.name,
      hex: item.hex_code || "#000000",
    }));
    const variants = variantsResult.recordset.map((item) => ({
      variantId: item.variant_id,
      size: item.size,
      color: item.color,
      hex: item.hex_code || "#000000",
      price: Number(item.price) || 0,
      stock: Number(item.stock) || 0,
    }));

    const product = {
      id: String(row.product_id),
      name: row.name || "",
      description: row.description || "",
      category: row.category_name || "",
      brand: row.brand_name || "",
      price: Number(row.price) || 0,
      stock: Number(row.total_stock) || 0,
      image: images[0] || "",
      images,
      sizes,
      colors,
      variants,
      isNew: false,
    };

    res.json(product);
  } catch (error) {
    console.error("GET /api/products/:id error:", error);
    res.status(500).json({
      message: "Lỗi lấy chi tiết sản phẩm",
    });
  }
});

module.exports = router;
