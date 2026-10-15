const { sql, poolPromise } = require("../db");
const { uploadProductToS3, deleteFromS3 } = require("../utils/s3Service");

function normalizeSizes(sizes) {
  if (Array.isArray(sizes)) {
    const cleaned = sizes.map((s) => String(s).trim()).filter(Boolean);
    return cleaned.length ? [...new Set(cleaned)] : ["Default"];
  }

  if (typeof sizes === "string") {
    const cleaned = sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return cleaned.length ? [...new Set(cleaned)] : ["Default"];
  }

  return ["Default"];
}

async function getOrCreateByName(transaction, tableName, idColumn, nameValue) {
  const value = String(nameValue || "").trim();
  if (!value) return null;

  const existing = await new sql.Request(transaction)
    .input("name", sql.NVarChar, value)
    .query(`SELECT TOP 1 ${idColumn} AS id FROM ${tableName} WHERE name = @name`);

  if (existing.recordset.length > 0) {
    return existing.recordset[0].id;
  }

  const inserted = await new sql.Request(transaction)
    .input("name", sql.NVarChar, value)
    .query(`
      INSERT INTO ${tableName} (name)
      OUTPUT INSERTED.${idColumn} AS id
      VALUES (@name)
    `);

  return inserted.recordset[0].id;
}

async function getOrCreateDefaultColor(transaction) {
  return getOrCreateByName(transaction, "Colors", "color_id", "Default");
}

async function buildAdminProductList() {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT
      p.product_id,
      p.name,
      p.description,
      b.name AS brand,
      c.name AS category,
      img.image_url AS image,
      pv.price,
      pv.stock,
      s.name AS size_name
    FROM Products p
    LEFT JOIN Brands b ON p.brand_id = b.brand_id
    LEFT JOIN Categories c ON p.category_id = c.category_id
    OUTER APPLY (
      SELECT TOP 1 image_url
      FROM ProductImages pi
      WHERE pi.product_id = p.product_id
      ORDER BY pi.image_id
    ) img
    LEFT JOIN ProductVariants pv ON pv.product_id = p.product_id
    LEFT JOIN Sizes s ON s.size_id = pv.size_id
    ORDER BY p.product_id DESC
  `);

  const map = new Map();

  for (const row of result.recordset) {
    const id = row.product_id;

    if (!map.has(id)) {
      map.set(id, {
        id,
        name: row.name || "",
        description: row.description || "",
        price: row.price != null ? Number(row.price) : 0,
        category: row.category || "",
        brand: row.brand || "",
        image: row.image || "",
        stock: 0,
        sizes: [],
      });
    }

    const product = map.get(id);

    if ((product.price === 0 || product.price === null) && row.price != null) {
      product.price = Number(row.price);
    }

    product.stock += Number(row.stock || 0);

    if (row.size_name && !product.sizes.includes(row.size_name)) {
      product.sizes.push(row.size_name);
    }
  }

  return Array.from(map.values());
}

const getAdminProducts = async (req, res) => {
  try {
    const products = await buildAdminProductList();
    return res.json(products);
  } catch (error) {
    console.error("GET ADMIN PRODUCTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

const createAdminProduct = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  let started = false;

  try {
    const {
      name,
      description,
      price,
      category,
      brand,
      image,
      stock,
      sizes,
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên sản phẩm là bắt buộc" });
    }

    if (price === undefined || price === null || Number(price) < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ" });
    }

    await transaction.begin();
    started = true;

    const brandId = await getOrCreateByName(transaction, "Brands", "brand_id", brand);
    const categoryId = await getOrCreateByName(transaction, "Categories", "category_id", category);

    const insertProduct = await new sql.Request(transaction)
      .input("name", sql.NVarChar, String(name).trim())
      .input("description", sql.NVarChar, description ? String(description).trim() : null)
      .input("brand_id", sql.Int, brandId)
      .input("category_id", sql.Int, categoryId)
      .query(`
        INSERT INTO Products (name, description, brand_id, category_id)
        OUTPUT INSERTED.product_id AS product_id
        VALUES (@name, @description, @brand_id, @category_id)
      `);

    const productId = insertProduct.recordset[0].product_id;

    if (image && String(image).trim()) {
      await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("image_url", sql.NVarChar, String(image).trim())
        .query(`
          INSERT INTO ProductImages (product_id, image_url)
          VALUES (@product_id, @image_url)
        `);
    }

    const colorId = await getOrCreateDefaultColor(transaction);
    const sizeNames = normalizeSizes(sizes);
    const numericPrice = Number(price);
    const numericStock = Number(stock || 0);

    for (let i = 0; i < sizeNames.length; i++) {
      const sizeId = await getOrCreateByName(transaction, "Sizes", "size_id", sizeNames[i]);

      await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("size_id", sql.Int, sizeId)
        .input("color_id", sql.Int, colorId)
        .input("price", sql.Decimal(10, 2), numericPrice)
        .input("stock", sql.Int, i === 0 ? numericStock : 0)
        .query(`
          INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
          VALUES (@product_id, @size_id, @color_id, @price, @stock)
        `);
    }

    await transaction.commit();

    uploadProductToS3(productId).catch(console.error);

    return res.status(201).json({
      message: "Thêm sản phẩm thành công",
      id: productId,
    });
  } catch (error) {
    if (started) {
      try {
        await transaction.rollback();
      } catch {}
    }

    console.error("CREATE ADMIN PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

const updateAdminProduct = async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  let started = false;

  try {
    const productId = Number(req.params.id);
    const {
      name,
      description,
      price,
      category,
      brand,
      image,
      stock,
      sizes,
    } = req.body || {};

    if (!productId) {
      return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Tên sản phẩm là bắt buộc" });
    }

    if (price === undefined || price === null || Number(price) < 0) {
      return res.status(400).json({ message: "Giá sản phẩm không hợp lệ" });
    }

    await transaction.begin();
    started = true;

    const checkProduct = await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .query(`
        SELECT TOP 1 product_id
        FROM Products
        WHERE product_id = @product_id
      `);

    if (checkProduct.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    const brandId = await getOrCreateByName(transaction, "Brands", "brand_id", brand);
    const categoryId = await getOrCreateByName(transaction, "Categories", "category_id", category);

    await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .input("name", sql.NVarChar, String(name).trim())
      .input("description", sql.NVarChar, description ? String(description).trim() : null)
      .input("brand_id", sql.Int, brandId)
      .input("category_id", sql.Int, categoryId)
      .query(`
        UPDATE Products
        SET
          name = @name,
          description = @description,
          brand_id = @brand_id,
          category_id = @category_id
        WHERE product_id = @product_id
      `);

    await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .query(`DELETE FROM ProductImages WHERE product_id = @product_id`);

    if (image && String(image).trim()) {
      await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("image_url", sql.NVarChar, String(image).trim())
        .query(`
          INSERT INTO ProductImages (product_id, image_url)
          VALUES (@product_id, @image_url)
        `);
    }

    await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .query(`DELETE FROM ProductVariants WHERE product_id = @product_id`);

    const colorId = await getOrCreateDefaultColor(transaction);
    const sizeNames = normalizeSizes(sizes);
    const numericPrice = Number(price);
    const numericStock = Number(stock || 0);

    for (let i = 0; i < sizeNames.length; i++) {
      const sizeId = await getOrCreateByName(transaction, "Sizes", "size_id", sizeNames[i]);

      await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("size_id", sql.Int, sizeId)
        .input("color_id", sql.Int, colorId)
        .input("price", sql.Decimal(10, 2), numericPrice)
        .input("stock", sql.Int, i === 0 ? numericStock : 0)
        .query(`
          INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
          VALUES (@product_id, @size_id, @color_id, @price, @stock)
        `);
    }

    await transaction.commit();

    uploadProductToS3(productId).catch(console.error);

    return res.json({ message: "Cập nhật sản phẩm thành công" });
  } catch (error) {
    if (started) {
      try {
        await transaction.rollback();
      } catch {}
    }

    console.error("UPDATE ADMIN PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteAdminProduct = async (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!productId) {
      return res.status(400).json({ message: "ID sản phẩm không hợp lệ" });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("product_id", sql.Int, productId)
      .query(`
        DELETE FROM Products
        WHERE product_id = @product_id
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
    }

    deleteFromS3("product", productId).catch(console.error);

    return res.json({ message: "Xóa sản phẩm thành công" });
  } catch (error) {
    console.error("DELETE ADMIN PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
};