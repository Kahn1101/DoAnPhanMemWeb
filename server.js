/* =========================================================================
   GUNDAM ARSENAL — BACKEND API SERVER (server.js)
   - Kết nối trực tiếp tới SQL Server (GundamArsenalDB)
   - Không cần cài đặt thư viện ngoài (Sử dụng 100% Built-in Node.js Modules)
   - Lưu trữ đầy đủ dữ liệu Người dùng: Tài khoản, Hồ sơ, Địa chỉ, Giỏ hàng,
     Lịch sử Đơn hàng & Nhật ký Hoạt động trong SQL Server.
========================================================================= */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PORT = process.env.PORT || 4000;
const SQL_SERVER = process.env.SQL_SERVER || 'localhost';
const SQL_DB = process.env.SQL_DB || 'GundamArsenalDB';
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'gundam-arsenal-secret-key-0079';

/* =========================================================================
   1. TIỆN ÍCH TRUY VẤN SQL SERVER AN TOÀN (CHỐNG SQL INJECTION 100%)
========================================================================= */

/**
 * Mã hoá chuỗi sang dạng Hex UTF-16LE (CAST(0x... AS NVARCHAR(MAX)))
 * Tuyệt đối an toàn trước SQL Injection và giữ nguyên 100% tiếng Việt có dấu.
 */
function sqlStr(val, maxLen = 'MAX') {
  if (val === null || val === undefined) return 'NULL';
  const str = String(val);
  const hex = Buffer.from(str, 'utf16le').toString('hex');
  return `__SQLSTR_${maxLen}_${hex}__`;
}

function prepareSqlBatch(tsqlBody) {
  const decls = [];
  let idx = 0;
  const replaced = tsqlBody.replace(/__SQLSTR_([A-Za-z0-9]+)_([0-9a-fA-F]*)__/g, (_, maxLen, hex) => {
    const varName = `@_p${idx++}`;
    const expr = hex ? `CAST(0x${hex} AS NVARCHAR(${maxLen}))` : `N''`;
    decls.push(`DECLARE ${varName} NVARCHAR(${maxLen}) = ${expr};`);
    return varName;
  });
  return `SET NOCOUNT ON;\n${decls.join('\n')}\n${replaced}`;
}

function sqlInt(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) throw new Error('Giá trị số nguyên không hợp lệ');
  return String(n);
}

function sqlDec(val) {
  if (val === null || val === undefined || val === '') return 'NULL';
  const n = Number(val);
  if (!Number.isFinite(n)) throw new Error('Giá trị số thực không hợp lệ');
  return String(Math.round(n));
}

/**
 * Thực thi câu lệnh T-SQL và trả về kết quả JSON từ SQL Server
 */
function queryJson(tsqlBody) {
  const fullSql = prepareSqlBatch(tsqlBody);
  try {
    const out = execFileSync(
      'sqlcmd',
      ['-S', SQL_SERVER, '-E', '-d', SQL_DB, '-f', '65001', '-y', '0', '-b', '-Q', fullSql],
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    );
    const joined = (out || '').replace(/\r?\n/g, '').trim();
    if (!joined) return [];
    return JSON.parse(joined);
  } catch (err) {
    const stderr = (err.stderr || err.stdout || err.message || '').toString();
    const lines = stderr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const customMsg = lines.find(l => !l.startsWith('Msg ') && !l.startsWith('Sqlcmd:'));
    throw new Error(customMsg || lines[0] || 'Lỗi truy vấn cơ sở dữ liệu SQL Server');
  }
}

function execSql(tsqlBody) {
  const fullSql = prepareSqlBatch(tsqlBody);
  try {
    execFileSync(
      'sqlcmd',
      ['-S', SQL_SERVER, '-E', '-d', SQL_DB, '-f', '65001', '-b', '-Q', fullSql],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (err) {
    const stderr = (err.stderr || err.stdout || err.message || '').toString();
    const lines = stderr.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const customMsg = lines.find(l => !l.startsWith('Msg ') && !l.startsWith('Sqlcmd:'));
    throw new Error(customMsg || lines[0] || 'Lỗi thực thi câu lệnh SQL Server');
  }
}

/* =========================================================================
   2. MÃ HOÁ MẬT KHẨU & TOKEN XÁC THỰC (HMAC-SHA256 + SCRYPT)
========================================================================= */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const [, salt, originalHash] = storedHash.split('$');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
  }
  return password === storedHash;
}

function createToken(payload) {
  const data = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 7 * 24 * 3600 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return null;
}

function requireCustomer(req) {
  const payload = verifyToken(getBearerToken(req));
  if (!payload || payload.role !== 'customer') {
    const err = new Error('Vui lòng đăng nhập tài khoản khách hàng');
    err.status = 401;
    throw err;
  }
  return payload;
}

function requireAdmin(req) {
  const payload = verifyToken(getBearerToken(req));
  if (!payload || payload.role !== 'admin') {
    const err = new Error('Yêu cầu quyền Quản trị viên (Admin)');
    err.status = 401;
    throw err;
  }
  return payload;
}

/* =========================================================================
   3. TIỆN ÍCH HTTP REQUEST / RESPONSE
========================================================================= */
function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Dữ liệu gửi lên quá lớn'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Dữ liệu JSON không hợp lệ'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

/* =========================================================================
   4. ĐỊNH TUYẾN API (PRODUCTS, AUTH, USER PROFILE, CART, ORDERS, ADMIN)
========================================================================= */
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    /* ---------------------------------------------------------------------
       A. SẢN PHẨM (PRODUCTS)
    --------------------------------------------------------------------- */
    if (pathname === '/api/products' && req.method === 'GET') {
      const rows = queryJson(`
        SELECT ProductId, Category, Name, SeriesName, Grade, AccessoryType, Scale, Price, Stock, ImageUrl, Description
        FROM dbo.Products
        ORDER BY ProductId DESC
        FOR JSON PATH;
      `);
      return sendJson(res, 200, rows);
    }

    if (pathname === '/api/products' && req.method === 'POST') {
      requireAdmin(req);
      const body = await readJsonBody(req);
      const rows = queryJson(`
        DECLARE @Out TABLE (NewProductId INT);
        INSERT INTO @Out
        EXEC dbo.sp_AddProduct
          @Category = ${sqlStr(body.category || 'model', 20)},
          @Name = ${sqlStr(body.name, 200)},
          @SeriesName = ${sqlStr(body.seriesName, 150)},
          @Grade = ${sqlStr(body.grade, 10)},
          @AccessoryType = ${sqlStr(body.accessoryType, 50)},
          @Scale = ${sqlStr(body.scale, 20)},
          @Price = ${sqlDec(body.price)},
          @Stock = ${sqlInt(body.stock)},
          @ImageUrl = ${sqlStr(body.imageUrl || '', 500)},
          @Description = ${sqlStr(body.description || '', 1000)};
        SELECT NewProductId FROM @Out FOR JSON PATH;
      `);
      return sendJson(res, 201, { ok: true, productId: rows[0]?.NewProductId });
    }

    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && req.method === 'PUT') {
      requireAdmin(req);
      const productId = Number(productMatch[1]);
      const body = await readJsonBody(req);
      execSql(`
        EXEC dbo.sp_UpdateProduct
          @ProductId = ${sqlInt(productId)},
          @Category = ${sqlStr(body.category || 'model', 20)},
          @Name = ${sqlStr(body.name, 200)},
          @SeriesName = ${sqlStr(body.seriesName, 150)},
          @Grade = ${sqlStr(body.grade, 10)},
          @AccessoryType = ${sqlStr(body.accessoryType, 50)},
          @Scale = ${sqlStr(body.scale, 20)},
          @Price = ${sqlDec(body.price)},
          @Stock = ${sqlInt(body.stock)},
          @ImageUrl = ${sqlStr(body.imageUrl || '', 500)},
          @Description = ${sqlStr(body.description || '', 1000)};
      `);
      return sendJson(res, 200, { ok: true });
    }

    if (productMatch && req.method === 'DELETE') {
      requireAdmin(req);
      const productId = Number(productMatch[1]);
      execSql(`EXEC dbo.sp_DeleteProduct @ProductId = ${sqlInt(productId)};`);
      return sendJson(res, 200, { ok: true });
    }

    /* ---------------------------------------------------------------------
       B. XÁC THỰC & LƯU DỮ LIỆU NGƯỜI DÙNG (CUSTOMER AUTH, PROFILE, CART)
    --------------------------------------------------------------------- */
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const fullName = (body.fullName || '').trim();
      const email = (body.email || '').trim().toLowerCase();
      const phone = (body.phone || '').trim();
      const password = body.password || '';
      const defaultAddress = (body.address || body.defaultAddress || '').trim();

      if (!fullName || !email || !phone || password.length < 4) {
        return sendJson(res, 400, { error: 'Vui lòng điền đầy đủ họ tên, email, SĐT và mật khẩu (tối thiểu 4 ký tự).' });
      }

      const passHash = hashPassword(password);
      const regResult = queryJson(`
        DECLARE @Out TABLE (NewCustomerId INT);
        INSERT INTO @Out
        EXEC dbo.sp_RegisterCustomer
          @FullName = ${sqlStr(fullName, 150)},
          @Email = ${sqlStr(email, 150)},
          @Phone = ${sqlStr(phone, 20)},
          @PasswordHash = ${sqlStr(passHash, 255)},
          @DefaultAddress = ${sqlStr(defaultAddress || null, 500)};
        SELECT NewCustomerId FROM @Out FOR JSON PATH;
      `);

      const customerId = regResult[0]?.NewCustomerId;
      const customer = {
        id: customerId,
        name: fullName,
        email,
        phone,
        address: defaultAddress
      };
      const token = createToken({ role: 'customer', customerId, email, name: fullName });
      return sendJson(res, 201, { token, customer, cart: [] });
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      const users = queryJson(`
        SELECT CustomerId, FullName, Email, Phone, PasswordHash, DefaultAddress, CreatedAt
        FROM dbo.Customers
        WHERE Email = ${sqlStr(email, 150)}
        FOR JSON PATH;
      `);

      const user = users[0];
      if (!user || !verifyPassword(password, user.PasswordHash)) {
        return sendJson(res, 401, { error: 'Email hoặc mật khẩu không chính xác!' });
      }

      // Cập nhật thời điểm đăng nhập & ghi nhật ký hoạt động
      execSql(`
        UPDATE dbo.Customers SET LastLoginAt = SYSDATETIME() WHERE CustomerId = ${sqlInt(user.CustomerId)};
        INSERT INTO dbo.CustomerActivityLogs (CustomerId, ActionType, ActionDetail)
        VALUES (${sqlInt(user.CustomerId)}, N'LOGIN', N'Đăng nhập hệ thống');
      `);

      // Lấy giỏ hàng đã lưu trong CSDL của người dùng
      const savedCart = queryJson(`
        SELECT ProductId AS productId, Quantity AS qty
        FROM dbo.CustomerCartItems
        WHERE CustomerId = ${sqlInt(user.CustomerId)}
        FOR JSON PATH;
      `);

      const customer = {
        id: user.CustomerId,
        name: user.FullName,
        email: user.Email,
        phone: user.Phone,
        address: user.DefaultAddress || ''
      };
      const token = createToken({ role: 'customer', customerId: user.CustomerId, email: user.Email, name: user.FullName });
      return sendJson(res, 200, { token, customer, cart: savedCart || [] });
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const auth = requireCustomer(req);
      const users = queryJson(`
        SELECT CustomerId, FullName, Email, Phone, DefaultAddress, CreatedAt, LastLoginAt
        FROM dbo.Customers
        WHERE CustomerId = ${sqlInt(auth.customerId)}
        FOR JSON PATH;
      `);
      if (!users[0]) return sendJson(res, 404, { error: 'Không tìm thấy tài khoản người dùng' });

      const u = users[0];
      const savedCart = queryJson(`
        SELECT ProductId AS productId, Quantity AS qty
        FROM dbo.CustomerCartItems
        WHERE CustomerId = ${sqlInt(u.CustomerId)}
        FOR JSON PATH;
      `);

      return sendJson(res, 200, {
        customer: {
          id: u.CustomerId,
          name: u.FullName,
          email: u.Email,
          phone: u.Phone,
          address: u.DefaultAddress || '',
          createdAt: u.CreatedAt,
          lastLoginAt: u.LastLoginAt
        },
        cart: savedCart || []
      });
    }

    if (pathname === '/api/auth/profile' && req.method === 'PUT') {
      const auth = requireCustomer(req);
      const body = await readJsonBody(req);
      const fullName = (body.fullName || '').trim();
      const phone = (body.phone || '').trim();
      const address = (body.address || '').trim();
      const newPassword = body.newPassword || '';

      if (!fullName || !phone) {
        return sendJson(res, 400, { error: 'Họ tên và Số điện thoại không được để trống.' });
      }

      if (newPassword && newPassword.length >= 4) {
        const newHash = hashPassword(newPassword);
        execSql(`
          UPDATE dbo.Customers
          SET PasswordHash = ${sqlStr(newHash, 255)}, UpdatedAt = SYSDATETIME()
          WHERE CustomerId = ${sqlInt(auth.customerId)};
        `);
      }

      const updated = queryJson(`
        DECLARE @Out TABLE (
          CustomerId INT,
          FullName NVARCHAR(150),
          Email NVARCHAR(150),
          Phone NVARCHAR(20),
          DefaultAddress NVARCHAR(500),
          CreatedAt DATETIME2,
          LastLoginAt DATETIME2
        );
        INSERT INTO @Out
        EXEC dbo.sp_UpdateCustomerProfile
          @CustomerId = ${sqlInt(auth.customerId)},
          @FullName = ${sqlStr(fullName, 150)},
          @Phone = ${sqlStr(phone, 20)},
          @DefaultAddress = ${sqlStr(address || null, 500)};
        SELECT * FROM @Out FOR JSON PATH;
      `);

      const u = updated[0];
      return sendJson(res, 200, {
        customer: {
          id: u.CustomerId,
          name: u.FullName,
          email: u.Email,
          phone: u.Phone,
          address: u.DefaultAddress || ''
        }
      });
    }

    if (pathname === '/api/auth/cart' && req.method === 'PUT') {
      const auth = requireCustomer(req);
      const body = await readJsonBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const itemsJson = JSON.stringify(items);

      const synced = queryJson(`
        DECLARE @Out TABLE (productId INT, qty INT);
        INSERT INTO @Out
        EXEC dbo.sp_SyncCustomerCart
          @CustomerId = ${sqlInt(auth.customerId)},
          @ItemsJson = ${sqlStr(itemsJson, 'MAX')};
        SELECT productId, qty FROM @Out FOR JSON PATH;
      `);
      return sendJson(res, 200, { cart: synced || [] });
    }

    /* ---------------------------------------------------------------------
       C. ĐƠN HÀNG (ORDERS)
    --------------------------------------------------------------------- */
    if (pathname === '/api/orders' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const tokenPayload = verifyToken(getBearerToken(req));
      const customerId = tokenPayload?.role === 'customer' ? tokenPayload.customerId : null;

      const customerName = (body.customerName || '').trim();
      const phone = (body.phone || '').trim();
      const address = (body.address || '').trim();
      const note = (body.note || '').trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!customerName || !phone || !address || items.length === 0) {
        return sendJson(res, 400, { error: 'Vui lòng nhập đầy đủ thông tin nhận hàng và sản phẩm.' });
      }

      const itemsJson = JSON.stringify(items);
      const result = queryJson(`
        DECLARE @Out TABLE (NewOrderId INT, TotalAmount DECIMAL(14,0));
        INSERT INTO @Out
        EXEC dbo.sp_CreateOrder
          @CustomerId = ${sqlInt(customerId)},
          @CustomerName = ${sqlStr(customerName, 150)},
          @Phone = ${sqlStr(phone, 20)},
          @Address = ${sqlStr(address, 500)},
          @Note = ${sqlStr(note || null, 500)},
          @ItemsJson = ${sqlStr(itemsJson, 'MAX')};
        SELECT NewOrderId, TotalAmount FROM @Out FOR JSON PATH;
      `);

      return sendJson(res, 201, {
        orderId: result[0]?.NewOrderId,
        totalAmount: result[0]?.TotalAmount
      });
    }

    if (pathname === '/api/orders/mine' && req.method === 'GET') {
      const auth = requireCustomer(req);
      const orders = queryJson(`
        SELECT
          o.OrderId,
          o.CustomerName,
          o.Phone,
          o.Address,
          o.Note,
          o.TotalAmount,
          o.Status,
          o.CreatedAt,
          (
            SELECT oi.ProductId, oi.ProductName, oi.UnitPrice, oi.Quantity
            FROM dbo.OrderItems oi
            WHERE oi.OrderId = o.OrderId
            FOR JSON PATH
          ) AS items
        FROM dbo.Orders o
        WHERE o.CustomerId = ${sqlInt(auth.customerId)}
        ORDER BY o.CreatedAt DESC
        FOR JSON PATH;
      `);
      return sendJson(res, 200, orders.map(o => ({ ...o, items: o.items || [] })));
    }

    if (pathname === '/api/orders' && req.method === 'GET') {
      requireAdmin(req);
      const orders = queryJson(`
        SELECT
          o.OrderId,
          o.CustomerId,
          o.CustomerName,
          o.Phone,
          o.Address,
          o.Note,
          o.TotalAmount,
          o.Status,
          o.CreatedAt,
          (
            SELECT oi.ProductId, oi.ProductName, oi.UnitPrice, oi.Quantity
            FROM dbo.OrderItems oi
            WHERE oi.OrderId = o.OrderId
            FOR JSON PATH
          ) AS items
        FROM dbo.Orders o
        ORDER BY o.CreatedAt DESC
        FOR JSON PATH;
      `);
      return sendJson(res, 200, orders.map(o => ({ ...o, items: o.items || [] })));
    }

    const orderStatusMatch = pathname.match(/^\/api\/orders\/(\d+)\/status$/);
    if (orderStatusMatch && req.method === 'PUT') {
      requireAdmin(req);
      const orderId = Number(orderStatusMatch[1]);
      const body = await readJsonBody(req);
      execSql(`
        EXEC dbo.sp_UpdateOrderStatus
          @OrderId = ${sqlInt(orderId)},
          @Status = ${sqlStr(body.status || 'Đã xác nhận', 30)};
      `);
      return sendJson(res, 200, { ok: true });
    }

    /* ---------------------------------------------------------------------
       D. ADMIN LOGIN & QUẢN LÝ NGƯỜI DÙNG (CUSTOMERS)
    --------------------------------------------------------------------- */
    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const username = (body.username || '').trim();
      const password = body.password || '';

      if (username === 'admin' && password === 'gundam123') {
        const token = createToken({ role: 'admin', username: 'admin' });
        return sendJson(res, 200, { token, username: 'admin' });
      }
      return sendJson(res, 401, { error: 'Tài khoản hoặc mật khẩu Admin không đúng!' });
    }

    if (pathname === '/api/admin/customers' && req.method === 'GET') {
      requireAdmin(req);
      const customers = queryJson(`
        SELECT
          CustomerId,
          FullName,
          Email,
          Phone,
          DefaultAddress,
          LastLoginAt,
          CreatedAt,
          TotalOrders,
          TotalSpent,
          CartItemCount
        FROM dbo.vw_CustomerStats
        ORDER BY CreatedAt DESC
        FOR JSON PATH;
      `);
      return sendJson(res, 200, customers);
    }

    /* ---------------------------------------------------------------------
       E. PHỤC VỤ FILE TĨNH FRONTEND (INDEX.HTML, STYLE.CSS, SCRIPT.JS)
    --------------------------------------------------------------------- */
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const safePath = path.normalize(path.join(__dirname, relPath));
      if (safePath.startsWith(__dirname) && fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
        const ext = path.extname(safePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        return fs.createReadStream(safePath).pipe(res);
      }
    }

    return sendJson(res, 404, { error: `Không tìm thấy đường dẫn API: ${pathname}` });
  } catch (err) {
    const status = err.status || 400;
    return sendJson(res, status, { error: err.message || 'Lỗi xử lý trên máy chủ' });
  }
});

server.listen(PORT, () => {
  console.log(`=========================================================`);
  console.log(`🚀 GUNDAM ARSENAL SERVER ĐANG CHẠY TẠI: http://localhost:${PORT}`);
  console.log(`📦 Đã kết nối CSDL SQL Server: ${SQL_SERVER} -> ${SQL_DB}`);
  console.log(`=========================================================`);
});
