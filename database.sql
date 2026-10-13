
IF DB_ID(N'GundamArsenalDB') IS NULL
BEGIN
    CREATE DATABASE GundamArsenalDB;
END
GO

USE GundamArsenalDB;
GO

/* =========================================================================
   1. BẢNG ADMINS (QUẢN TRỊ VIÊN)
========================================================================= */
IF OBJECT_ID(N'dbo.Admins', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Admins (
        AdminId      INT IDENTITY(1,1) PRIMARY KEY,
        Username     NVARCHAR(50)  NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        FullName     NVARCHAR(100) NULL,
        CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

/* =========================================================================
   2. BẢNG PRODUCTS (SẢN PHẨM MÔ HÌNH & PHỤ KIỆN)
========================================================================= */
IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Products (
        ProductId     INT IDENTITY(1,1) PRIMARY KEY,
        Category      NVARCHAR(20)   NOT NULL DEFAULT N'model',
        Name          NVARCHAR(200)  NOT NULL,
        SeriesName    NVARCHAR(150)  NOT NULL,
        Grade         NVARCHAR(10)   NULL,
        AccessoryType NVARCHAR(50)   NULL,
        Scale         NVARCHAR(20)   NULL,
        Price         DECIMAL(12,0)  NOT NULL CHECK (Price >= 0),
        Stock         INT            NOT NULL DEFAULT 0 CHECK (Stock >= 0),
        ImageUrl      NVARCHAR(500)  NULL,
        Description   NVARCHAR(1000) NULL,
        CreatedAt     DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt     DATETIME2      NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

/* =========================================================================
   3. BẢNG CUSTOMERS (DỮ LIỆU NGƯỜI DÙNG / KHÁCH HÀNG)
========================================================================= */
IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Customers (
        CustomerId     INT IDENTITY(1,1) PRIMARY KEY,
        FullName       NVARCHAR(150) NOT NULL,
        Email          NVARCHAR(150) NOT NULL UNIQUE,
        Phone          NVARCHAR(20)  NOT NULL,
        PasswordHash   NVARCHAR(255) NOT NULL,
        DefaultAddress NVARCHAR(500) NULL,
        LastLoginAt    DATETIME2     NULL,
        UpdatedAt      DATETIME2     NULL,
        CreatedAt      DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
END
ELSE
BEGIN
    -- Bổ sung các cột mở rộng cho bảng Customers nếu đã tồn tại từ bản cũ
    IF COL_LENGTH('dbo.Customers', 'DefaultAddress') IS NULL
        ALTER TABLE dbo.Customers ADD DefaultAddress NVARCHAR(500) NULL;

    IF COL_LENGTH('dbo.Customers', 'LastLoginAt') IS NULL
        ALTER TABLE dbo.Customers ADD LastLoginAt DATETIME2 NULL;

    IF COL_LENGTH('dbo.Customers', 'UpdatedAt') IS NULL
        ALTER TABLE dbo.Customers ADD UpdatedAt DATETIME2 NULL;
END
GO

/* =========================================================================
   4. BẢNG CUSTOMER CART ITEMS (LƯU GIỎ HÀNG CỦA NGƯỜI DÙNG TRONG CSDL)
========================================================================= */
IF OBJECT_ID(N'dbo.CustomerCartItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerCartItems (
        CartItemId INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId INT       NOT NULL,
        ProductId  INT       NOT NULL,
        Quantity   INT       NOT NULL CHECK (Quantity > 0),
        UpdatedAt  DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Cart_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_Cart_Product  FOREIGN KEY (ProductId)  REFERENCES dbo.Products(ProductId)  ON DELETE CASCADE,
        CONSTRAINT UQ_Customer_Product UNIQUE (CustomerId, ProductId)
    );
END
GO

/* =========================================================================
   5. BẢNG CUSTOMER ACTIVITY LOGS (NHẬT KÝ HOẠT ĐỘNG NGƯỜI DÙNG)
========================================================================= */
IF OBJECT_ID(N'dbo.CustomerActivityLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerActivityLogs (
        LogId        INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId   INT           NOT NULL,
        ActionType   NVARCHAR(50)  NOT NULL, -- REGISTER, LOGIN, UPDATE_PROFILE, CREATE_ORDER
        ActionDetail NVARCHAR(500) NULL,
        CreatedAt    DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Log_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE
    );
END
GO

/* =========================================================================
   6. BẢNG ORDERS & ORDER ITEMS (ĐƠN HÀNG CỦA NGƯỜI DÙNG)
========================================================================= */
IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Orders (
        OrderId      INT IDENTITY(1,1) PRIMARY KEY,
        CustomerId   INT            NULL,
        CustomerName NVARCHAR(150)  NOT NULL,
        Phone        NVARCHAR(20)   NOT NULL,
        Address      NVARCHAR(500)  NOT NULL,
        Note         NVARCHAR(500)  NULL,
        TotalAmount  DECIMAL(14,0)  NOT NULL DEFAULT 0,
        Status       NVARCHAR(30)   NOT NULL DEFAULT N'Chờ xác nhận',
        CreatedAt    DATETIME2      NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_Orders_Customer FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE SET NULL
    );
END
GO

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.OrderItems (
        OrderItemId INT IDENTITY(1,1) PRIMARY KEY,
        OrderId     INT           NOT NULL,
        ProductId   INT           NOT NULL,
        ProductName NVARCHAR(200) NOT NULL,
        UnitPrice   DECIMAL(12,0) NOT NULL,
        Quantity    INT           NOT NULL CHECK (Quantity > 0),
        CONSTRAINT FK_OrderItems_Order   FOREIGN KEY (OrderId)   REFERENCES dbo.Orders(OrderId) ON DELETE CASCADE,
        CONSTRAINT FK_OrderItems_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(ProductId)
    );
END
GO

/* =========================================================================
   7. VIEW THỐNG KÊ NGƯỜI DÙNG (vw_CustomerStats)
========================================================================= */
CREATE OR ALTER VIEW dbo.vw_CustomerStats AS
SELECT
    c.CustomerId,
    c.FullName,
    c.Email,
    c.Phone,
    c.DefaultAddress,
    c.LastLoginAt,
    c.CreatedAt,
    COUNT(DISTINCT o.OrderId)         AS TotalOrders,
    ISNULL(SUM(o.TotalAmount), 0)     AS TotalSpent,
    ISNULL((SELECT SUM(ci.Quantity) FROM dbo.CustomerCartItems ci WHERE ci.CustomerId = c.CustomerId), 0) AS CartItemCount
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON o.CustomerId = c.CustomerId
GROUP BY
    c.CustomerId,
    c.FullName,
    c.Email,
    c.Phone,
    c.DefaultAddress,
    c.LastLoginAt,
    c.CreatedAt;
GO

-- Cập nhật ảnh minh hoạ chất lượng cao cho các sản phẩm chưa có link ảnh
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1608889175123-8ee362201f81?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Grade = N'PG';
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Grade = N'MG';
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Grade = N'RG';
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Grade = N'HG';
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Grade = N'SD';
UPDATE dbo.Products SET ImageUrl = N'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80' WHERE (ImageUrl IS NULL OR ImageUrl = N'') AND Category = N'accessory';
GO

/* =========================================================================
   8. STORED PROCEDURES QUẢN LÝ NGƯỜI DÙNG & ĐƠN HÀNG
========================================================================= */

-- 8.1 Đăng ký người dùng mới
CREATE OR ALTER PROCEDURE dbo.sp_RegisterCustomer
    @FullName       NVARCHAR(150),
    @Email          NVARCHAR(150),
    @Phone          NVARCHAR(20),
    @PasswordHash   NVARCHAR(255),
    @DefaultAddress NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Customers WHERE Email = @Email)
    BEGIN
        RAISERROR(N'Email này đã được đăng ký tài khoản.', 16, 1);
        RETURN;
    END

    INSERT INTO dbo.Customers (FullName, Email, Phone, PasswordHash, DefaultAddress, LastLoginAt)
    VALUES (@FullName, @Email, @Phone, @PasswordHash, @DefaultAddress, SYSDATETIME());

    DECLARE @NewId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.CustomerActivityLogs (CustomerId, ActionType, ActionDetail)
    VALUES (@NewId, N'REGISTER', N'Đăng ký tài khoản khách hàng mới');

    SELECT @NewId AS NewCustomerId;
END
GO

-- 8.2 Cập nhật hồ sơ người dùng
CREATE OR ALTER PROCEDURE dbo.sp_UpdateCustomerProfile
    @CustomerId     INT,
    @FullName       NVARCHAR(150),
    @Phone          NVARCHAR(20),
    @DefaultAddress NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Customers
    SET FullName       = @FullName,
        Phone          = @Phone,
        DefaultAddress = @DefaultAddress,
        UpdatedAt      = SYSDATETIME()
    WHERE CustomerId = @CustomerId;

    INSERT INTO dbo.CustomerActivityLogs (CustomerId, ActionType, ActionDetail)
    VALUES (@CustomerId, N'UPDATE_PROFILE', N'Cập nhật thông tin hồ sơ & địa chỉ nhận hàng');

    SELECT CustomerId, FullName, Email, Phone, DefaultAddress, CreatedAt, LastLoginAt
    FROM dbo.Customers
    WHERE CustomerId = @CustomerId;
END
GO

-- 8.3 Đồng bộ giỏ hàng của người dùng vào CSDL
CREATE OR ALTER PROCEDURE dbo.sp_SyncCustomerCart
    @CustomerId INT,
    @ItemsJson  NVARCHAR(MAX) -- VD: [{"productId":1,"qty":2}]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.CustomerCartItems WHERE CustomerId = @CustomerId;

        IF @ItemsJson IS NOT NULL AND LEN(@ItemsJson) > 2
        BEGIN
            INSERT INTO dbo.CustomerCartItems (CustomerId, ProductId, Quantity)
            SELECT
                @CustomerId,
                j.productId,
                CASE WHEN j.qty > p.Stock THEN p.Stock ELSE j.qty END
            FROM OPENJSON(@ItemsJson)
            WITH (
                productId INT '$.productId',
                qty       INT '$.qty'
            ) j
            INNER JOIN dbo.Products p ON p.ProductId = j.productId
            WHERE j.qty > 0 AND p.Stock > 0;
        END

        COMMIT TRANSACTION;

        SELECT c.ProductId AS productId, c.Quantity AS qty
        FROM dbo.CustomerCartItems c
        WHERE c.CustomerId = @CustomerId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- 8.4 Tạo đơn hàng (Tự động lưu địa chỉ mặc định cho người dùng nếu chưa có)
CREATE OR ALTER PROCEDURE dbo.sp_CreateOrder
    @CustomerId   INT = NULL,
    @CustomerName NVARCHAR(150),
    @Phone        NVARCHAR(20),
    @Address      NVARCHAR(500),
    @Note         NVARCHAR(500) = NULL,
    @ItemsJson    NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @OrderId INT;
        DECLARE @Total DECIMAL(14,0) = 0;

        DECLARE @Items TABLE (ProductId INT, Quantity INT);
        INSERT INTO @Items (ProductId, Quantity)
        SELECT ProductId, Quantity
        FROM OPENJSON(@ItemsJson)
        WITH (ProductId INT '$.productId', Quantity INT '$.quantity')
        WHERE Quantity > 0;

        IF NOT EXISTS (SELECT 1 FROM @Items)
        BEGIN
            RAISERROR(N'Đơn hàng không có sản phẩm hợp lệ.', 16, 1);
        END

        -- Kiểm tra tồn kho
        IF EXISTS (
            SELECT 1
            FROM @Items i
            LEFT JOIN dbo.Products p ON p.ProductId = i.ProductId
            WHERE p.ProductId IS NULL OR p.Stock < i.Quantity
        )
        BEGIN
            RAISERROR(N'Một hoặc nhiều sản phẩm trong đơn không đủ tồn kho.', 16, 1);
        END

        INSERT INTO dbo.Orders (CustomerId, CustomerName, Phone, Address, Note, TotalAmount, Status)
        VALUES (@CustomerId, @CustomerName, @Phone, @Address, @Note, 0, N'Chờ xác nhận');

        SET @OrderId = SCOPE_IDENTITY();

        INSERT INTO dbo.OrderItems (OrderId, ProductId, ProductName, UnitPrice, Quantity)
        SELECT @OrderId, p.ProductId, p.Name, p.Price, i.Quantity
        FROM @Items i
        JOIN dbo.Products p ON p.ProductId = i.ProductId;

        UPDATE p
        SET p.Stock = p.Stock - i.Quantity,
            p.UpdatedAt = SYSDATETIME()
        FROM dbo.Products p
        JOIN @Items i ON i.ProductId = p.ProductId;

        SELECT @Total = SUM(UnitPrice * Quantity) FROM dbo.OrderItems WHERE OrderId = @OrderId;
        UPDATE dbo.Orders SET TotalAmount = @Total WHERE OrderId = @OrderId;

        -- Nếu người dùng đã đăng nhập, cập nhật địa chỉ mặc định và ghi log
        IF @CustomerId IS NOT NULL
        BEGIN
            UPDATE dbo.Customers
            SET DefaultAddress = COALESCE(NULLIF(@Address, N''), DefaultAddress),
                Phone          = COALESCE(NULLIF(@Phone, N''), Phone),
                UpdatedAt      = SYSDATETIME()
            WHERE CustomerId = @CustomerId;

            INSERT INTO dbo.CustomerActivityLogs (CustomerId, ActionType, ActionDetail)
            VALUES (@CustomerId, N'CREATE_ORDER', CONCAT(N'Đặt đơn hàng #', @OrderId, N' - Tổng: ', @Total, N'₫'));
        END

        COMMIT TRANSACTION;
        SELECT @OrderId AS NewOrderId, @Total AS TotalAmount;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO
