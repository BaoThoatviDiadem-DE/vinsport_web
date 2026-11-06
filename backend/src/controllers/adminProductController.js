const { sql, poolPromise } = require("../db");
const { uploadProductToS3, deleteFromS3, syncSingleProductImage } = require("../utils/s3Service");

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


const DEFAULT_HEX = {
  "đen": "#000000",
  "black": "#000000",
  "trắng": "#FFFFFF",
  "white": "#FFFFFF",
  "đỏ": "#FF0000",
  "red": "#FF0000",
  "xanh": "#0000FF",
  "xanh dương": "#0000FF",
  "blue": "#0000FF",
  "xanh lá": "#00FF00",
  "green": "#00FF00",
  "vàng": "#FFFF00",
  "yellow": "#FFFF00",
  "xám": "#808080",
  "gray": "#808080",
  "grey": "#808080",
  "cam": "#FFA500",
  "orange": "#FFA500",
  "hồng": "#FFC0CB",
  "pink": "#FFC0CB",
  "tím": "#800080",
  "purple": "#800080",
};

function normalizeColors(colors) {
  if (Array.isArray(colors)) {
    const cleaned = colors.map((c) => String(c).trim()).filter(Boolean);
    return cleaned.length ? [...new Set(cleaned)] : ["Default"];
  }

  if (typeof colors === "string") {
    const cleaned = colors
      .split(/[,;]/)
      .map((c) => c.trim())
      .filter(Boolean);
    return cleaned.length ? [...new Set(cleaned)] : ["Default"];
  }

  return ["Default"];
}

async function getOrCreateColor(transaction, colorName) {
  const value = String(colorName || "Default").trim();
  const existing = await new sql.Request(transaction)
    .input("name", sql.NVarChar, value)
    .query("SELECT TOP 1 color_id AS id FROM Colors WHERE name = @name");

  if (existing.recordset.length > 0) {
    return existing.recordset[0].id;
  }

  const hexCode = DEFAULT_HEX[value.toLowerCase()] || "#000000";
  const inserted = await new sql.Request(transaction)
    .input("name", sql.NVarChar, value)
    .input("hex_code", sql.NVarChar, hexCode)
    .query(`
      INSERT INTO Colors (name, hex_code)
      OUTPUT INSERTED.color_id AS id
      VALUES (@name, @hex_code)
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
      colors,
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

    let insertedImgId = null;
    const rawImage = image ? String(image).trim() : "";
    if (rawImage) {
      const imgRes = await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("image_url", sql.NVarChar, rawImage)
        .query(`
          INSERT INTO ProductImages (product_id, image_url)
          OUTPUT INSERTED.image_id AS image_id
          VALUES (@product_id, @image_url)
        `);
      insertedImgId = imgRes.recordset?.[0]?.image_id;
    }

    const sizeNames = normalizeSizes(sizes);
    const colorNames = normalizeColors(colors);
    const numericPrice = Number(price);
    const numericStock = Number(stock || 0);

    const totalVariants = Math.max(1, sizeNames.length * colorNames.length);
    const baseStockPerVariant = Math.floor(numericStock / totalVariants);
    let remainingStock = numericStock % totalVariants;

    for (let c = 0; c < colorNames.length; c++) {
      const colorId = await getOrCreateColor(transaction, colorNames[c]);
      for (let s = 0; s < sizeNames.length; s++) {
        const sizeId = await getOrCreateByName(transaction, "Sizes", "size_id", sizeNames[s]);
        const allocStock = baseStockPerVariant + (remainingStock > 0 ? 1 : 0);
        if (remainingStock > 0) remainingStock--;

        await new sql.Request(transaction)
          .input("product_id", sql.Int, productId)
          .input("size_id", sql.Int, sizeId)
          .input("color_id", sql.Int, colorId)
          .input("price", sql.Decimal(10, 2), numericPrice)
          .input("stock", sql.Int, allocStock)
          .query(`
            INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
            VALUES (@product_id, @size_id, @color_id, @price, @stock)
          `);
      }
    }

    await transaction.commit();

    uploadProductToS3(productId).catch(console.error);
    if (insertedImgId && rawImage) {
      syncSingleProductImage(productId, insertedImgId, rawImage).catch(console.error);
    }

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
      colors,
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

    let updatedImgId = null;
    const rawImage = image ? String(image).trim() : "";
    if (rawImage) {
      const imgRes = await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("image_url", sql.NVarChar, rawImage)
        .query(`
          INSERT INTO ProductImages (product_id, image_url)
          OUTPUT INSERTED.image_id AS image_id
          VALUES (@product_id, @image_url)
        `);
      updatedImgId = imgRes.recordset?.[0]?.image_id;
    }

    await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .query(`DELETE FROM ProductVariants WHERE product_id = @product_id`);

    const sizeNames = normalizeSizes(sizes);
    const colorNames = normalizeColors(colors);
    const numericPrice = Number(price);
    const numericStock = Number(stock || 0);

    const totalVariants = Math.max(1, sizeNames.length * colorNames.length);
    const baseStockPerVariant = Math.floor(numericStock / totalVariants);
    let remainingStock = numericStock % totalVariants;

    for (let c = 0; c < colorNames.length; c++) {
      const colorId = await getOrCreateColor(transaction, colorNames[c]);
      for (let s = 0; s < sizeNames.length; s++) {
        const sizeId = await getOrCreateByName(transaction, "Sizes", "size_id", sizeNames[s]);
        const allocStock = baseStockPerVariant + (remainingStock > 0 ? 1 : 0);
        if (remainingStock > 0) remainingStock--;

        await new sql.Request(transaction)
          .input("product_id", sql.Int, productId)
          .input("size_id", sql.Int, sizeId)
          .input("color_id", sql.Int, colorId)
          .input("price", sql.Decimal(10, 2), numericPrice)
          .input("stock", sql.Int, allocStock)
          .query(`
            INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
            VALUES (@product_id, @size_id, @color_id, @price, @stock)
          `);
      }
    }

    await transaction.commit();

    uploadProductToS3(productId).catch(console.error);
    if (updatedImgId && rawImage) {
      syncSingleProductImage(productId, updatedImgId, rawImage).catch(console.error);
    }

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

    await pool
      .request()
      .input("product_id", sql.Int, productId)
      .query(`
        DELETE FROM CartItems WHERE variant_id IN (SELECT variant_id FROM ProductVariants WHERE product_id = @product_id);
        DELETE FROM OrderDetails WHERE variant_id IN (SELECT variant_id FROM ProductVariants WHERE product_id = @product_id);
        DELETE FROM ProductVariants WHERE product_id = @product_id;
        DELETE FROM ProductImages WHERE product_id = @product_id;
        DELETE FROM Products WHERE product_id = @product_id;
      `);

    deleteFromS3("product", productId).catch(console.error);

    return res.json({ message: "Xóa sản phẩm thành công" });
  } catch (error) {
    console.error("DELETE ADMIN PRODUCT ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

const deleteAdminProductsBatch = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Danh sách sản phẩm cần xóa không hợp lệ" });
    }

    const pool = await poolPromise;
    const cleanIds = ids.map(Number).filter((id) => !isNaN(id) && id > 0);

    for (const pid of cleanIds) {
      await pool.request().input("pid", sql.Int, pid).query(`
        DELETE FROM CartItems WHERE variant_id IN (SELECT variant_id FROM ProductVariants WHERE product_id = @pid);
        DELETE FROM OrderDetails WHERE variant_id IN (SELECT variant_id FROM ProductVariants WHERE product_id = @pid);
        DELETE FROM ProductVariants WHERE product_id = @pid;
        DELETE FROM ProductImages WHERE product_id = @pid;
        DELETE FROM Products WHERE product_id = @pid;
      `);
      deleteFromS3("product", pid).catch(console.error);
    }

    return res.json({ success: true, message: `Đã xóa thành công ${cleanIds.length} sản phẩm!` });
  } catch (error) {
    console.error("BATCH DELETE PRODUCTS ERROR:", error);
    return res.status(500).json({ message: error.message });
  }
};

async function insertOrUpdateProductData(transaction, item) {
  const name = String(item.name || "").trim();
  if (!name) throw new Error("Tên sản phẩm không được để trống");

  const price = Number(item.price);
  if (isNaN(price) || price < 0) throw new Error(`Giá sản phẩm "${name}" không hợp lệ`);

  const brandName = item.brand && String(item.brand).trim() ? String(item.brand).trim() : "VinSport";
  const categoryName = item.category && String(item.category).trim() ? String(item.category).trim() : "Khác";

  const brandId = await getOrCreateByName(transaction, "Brands", "brand_id", brandName);
  const categoryId = await getOrCreateByName(transaction, "Categories", "category_id", categoryName);

  const insertProduct = await new sql.Request(transaction)
    .input("name", sql.NVarChar, name)
    .input("description", sql.NVarChar, item.description ? String(item.description).trim() : null)
    .input("brand_id", sql.Int, brandId)
    .input("category_id", sql.Int, categoryId)
    .query(`
      INSERT INTO Products (name, description, brand_id, category_id)
      OUTPUT INSERTED.product_id AS product_id
      VALUES (@name, @description, @brand_id, @category_id)
    `);

  const productId = insertProduct.recordset[0].product_id;

  let insertedImageId = null;
  const rawImage = item.image ? String(item.image).trim() : "";
  if (rawImage) {
    const imgResult = await new sql.Request(transaction)
      .input("product_id", sql.Int, productId)
      .input("image_url", sql.NVarChar, rawImage)
      .query(`
        INSERT INTO ProductImages (product_id, image_url)
        OUTPUT INSERTED.image_id AS image_id
        VALUES (@product_id, @image_url)
      `);
    insertedImageId = imgResult.recordset?.[0]?.image_id;
  }

  const sizeNames = normalizeSizes(item.sizes);
  const colorNames = normalizeColors(item.colors);
  const numericStock = Number(item.stock || 0);

  const totalVariants = sizeNames.length * colorNames.length;
  const stockPerVariant = Math.max(0, Math.floor(numericStock / totalVariants));
  let remainingStock = numericStock;

  for (let c = 0; c < colorNames.length; c++) {
    const colorId = await getOrCreateColor(transaction, colorNames[c]);

    for (let s = 0; s < sizeNames.length; s++) {
      const sizeId = await getOrCreateByName(transaction, "Sizes", "size_id", sizeNames[s]);
      
      const isLast = (c === colorNames.length - 1 && s === sizeNames.length - 1);
      const variantStock = isLast ? Math.max(0, remainingStock) : Math.min(stockPerVariant, remainingStock);
      remainingStock -= variantStock;

      await new sql.Request(transaction)
        .input("product_id", sql.Int, productId)
        .input("size_id", sql.Int, sizeId)
        .input("color_id", sql.Int, colorId)
        .input("price", sql.Decimal(10, 2), price)
        .input("stock", sql.Int, variantStock)
        .query(`
          INSERT INTO ProductVariants (product_id, size_id, color_id, price, stock)
          VALUES (@product_id, @size_id, @color_id, @price, @stock)
        `);
    }
  }

  return { productId, imageId: insertedImageId, rawImage };
}

const importAdminProducts = async (req, res) => {
  const pool = await poolPromise;
  const { products } = req.body || {};

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Danh sách sản phẩm từ file Excel rỗng hoặc không đúng định dạng." });
  }

  let importedCount = 0;
  const errors = [];
  const createdIds = [];

  for (let i = 0; i < products.length; i++) {
    const item = products[i];
    const rowNumber = i + 1;
    const transaction = new sql.Transaction(pool);
    let started = false;

    try {
      await transaction.begin();
      started = true;

      const { productId, imageId, rawImage } = await insertOrUpdateProductData(transaction, item);
      await transaction.commit();
      started = false;

      createdIds.push(productId);
      importedCount++;
      uploadProductToS3(productId).catch(console.error);
      if (imageId && rawImage) {
        syncSingleProductImage(productId, imageId, rawImage).catch(console.error);
      }
    } catch (err) {
      if (started) {
        try { await transaction.rollback(); } catch {}
      }
      errors.push({
        row: rowNumber,
        productName: item.name || `Dòng ${rowNumber}`,
        error: err.message,
      });
    }
  }

  return res.json({
    message: `Đã nhập thành công ${importedCount}/${products.length} sản phẩm từ file Excel.`,
    importedCount,
    total: products.length,
    errors,
  });
};


module.exports = {
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  deleteAdminProductsBatch,
  importAdminProducts,
};