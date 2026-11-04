-- ======================
-- CREATE DATABASE
-- ======================
CREATE DATABASE QLbanhangquanao;
GO

USE QLbanhangquanao;
GO

-- ======================
-- USERS
-- ======================
CREATE TABLE Users (
    user_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) NOT NULL UNIQUE,
    password NVARCHAR(255) NOT NULL,
    phone NVARCHAR(15),
    address NVARCHAR(255),
    role NVARCHAR(20) NOT NULL DEFAULT N'user',
    cognito_sub NVARCHAR(100) NULL,
    created_at DATETIME DEFAULT GETDATE(),

    CHECK (role IN (N'admin', N'user'))
);

-- Index cho tim kiem nhanh theo cognito_sub
CREATE UNIQUE NONCLUSTERED INDEX IX_Users_cognito_sub
ON Users (cognito_sub)
WHERE cognito_sub IS NOT NULL;

-- ======================
-- BRANDS
-- ======================
CREATE TABLE Brands (
    brand_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);

-- ======================
-- CATEGORIES
-- ======================
CREATE TABLE Categories (
    category_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100) NOT NULL UNIQUE
);

-- ======================
-- 🔥 COLORS (NEW)
-- ======================
CREATE TABLE Colors (
    color_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(50) NOT NULL UNIQUE,
    hex_code NVARCHAR(10) -- ví dụ #FFFFFF
);

-- ======================
-- 🔥 SIZES (NEW)
-- ======================
CREATE TABLE Sizes (
    size_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(10) NOT NULL UNIQUE,

    CHECK (name IN (
        N'S', N'M', N'L', N'XL', N'XXL',
        N'40', N'41', N'42', N'43', N'44', N'45'
    ))
);

-- ======================
-- PRODUCTS
-- ======================
CREATE TABLE Products (
    product_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(500),
    brand_id INT,
    category_id INT,
    created_at DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (brand_id) REFERENCES Brands(brand_id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE SET NULL
);

-- ======================
-- 🔥 PRODUCT VARIANTS (UPDATED)
-- ======================
CREATE TABLE ProductVariants (
    variant_id INT IDENTITY PRIMARY KEY,
    product_id INT NOT NULL,
    size_id INT NOT NULL,
    color_id INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL,
    created_at DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (size_id) REFERENCES Sizes(size_id),
    FOREIGN KEY (color_id) REFERENCES Colors(color_id),

    CHECK (price > 0),
    CHECK (stock >= 0),

    UNIQUE (product_id, size_id, color_id)
);

-- ======================
-- 🔥 SALES (KHUYẾN MÃI)
-- ======================
CREATE TABLE Sales (
    sale_id INT IDENTITY PRIMARY KEY,
    name NVARCHAR(100), -- tên chương trình (VD: Black Friday)
    discount_percent INT NOT NULL, -- % giảm giá

    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,

    CHECK (discount_percent BETWEEN 0 AND 100),
    CHECK (start_date <= end_date)
);

-- ======================
-- 🔥 PRODUCT SALES (LIÊN KẾT SẢN PHẨM - SALE)
-- ======================
CREATE TABLE ProductSales (
    product_id INT NOT NULL,
    sale_id INT NOT NULL,

    PRIMARY KEY (product_id, sale_id),

    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES Sales(sale_id) ON DELETE CASCADE
);

-- ======================
-- PRODUCT IMAGES
-- ======================
CREATE TABLE ProductImages (
    image_id INT IDENTITY PRIMARY KEY,
    product_id INT NOT NULL,
    image_url NVARCHAR(500) NOT NULL,

    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE
);

-- ======================
-- CART
-- ======================
CREATE TABLE Cart (
    cart_id INT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- ======================
-- CART ITEMS
-- ======================
CREATE TABLE CartItems (
    cart_item_id INT IDENTITY PRIMARY KEY,
    cart_id INT NOT NULL,
    variant_id INT NOT NULL,
    quantity INT NOT NULL,

    FOREIGN KEY (cart_id) REFERENCES Cart(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ProductVariants(variant_id) ON DELETE CASCADE,

    CHECK (quantity > 0),

    UNIQUE (cart_id, variant_id)
);

-- ======================
-- ORDERS
-- ======================
CREATE TABLE Orders (
    order_id INT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    order_date DATETIME DEFAULT GETDATE(),
    status NVARCHAR(50) DEFAULT N'Pending',
    total_amount DECIMAL(12,2) DEFAULT 0,

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,

    CHECK (status IN (N'Pending', N'Confirmed', N'Shipping', N'Completed', N'Cancelled'))
);

-- ======================
-- ORDER DETAILS
-- ======================
CREATE TABLE OrderDetails (
    order_detail_id INT IDENTITY PRIMARY KEY,
    order_id INT NOT NULL,
    variant_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES ProductVariants(variant_id) ON DELETE CASCADE,

    CHECK (quantity > 0),
    CHECK (price > 0),

    UNIQUE (order_id, variant_id)
);

-- ======================
-- PAYMENTS
-- ======================
CREATE TABLE Payments (
    payment_id INT IDENTITY PRIMARY KEY,
    order_id INT NOT NULL,
    method NVARCHAR(50),
    status NVARCHAR(50),

    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,

    CHECK (method IN (N'COD', N'Bank'))
);

-- ======================
-- SHIPPING
-- ======================
CREATE TABLE Shipping (
    shipping_id INT IDENTITY PRIMARY KEY,
    order_id INT NOT NULL,
    address NVARCHAR(255),
    status NVARCHAR(50),

    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
);

-- ======================
-- REVIEWS
-- ======================
CREATE TABLE Reviews (
    review_id INT IDENTITY PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    rating INT NOT NULL,
    comment NVARCHAR(500),
    review_date DATETIME DEFAULT GETDATE(),

    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE CASCADE,

    CHECK (rating BETWEEN 1 AND 5),
    CHECK (LEN(comment) >= 5),

    UNIQUE (user_id, product_id)
);
