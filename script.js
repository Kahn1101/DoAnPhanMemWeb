/* =========================================================
   GUNDAM ARSENAL — script.js
   - Kết nối trực tiếp với Backend Node.js + SQL Server (GundamArsenalDB)
   - Lưu trữ & đồng bộ dữ liệu người dùng vào CSDL:
     + Đăng ký / Đăng nhập / Cập nhật Hồ sơ & Địa chỉ mặc định
     + Đồng bộ Giỏ hàng theo Tài khoản vào bảng CustomerCartItems
     + Lịch sử Đơn hàng & Quản lý Danh sách Người dùng trong Admin
========================================================= */

const API_BASE = 'http://localhost:4000/api';

let products = [];          // Danh sách sản phẩm hiện tại
let cart = [];              // Giỏ hàng: [{ productId, qty }]
let currentCategory = 'ALL';
let currentFilter = 'ALL';
let currentSearch = '';
let currentSort = 'default';
let isOfflineDemo = false;  // Tự động bật nếu chưa chạy server localhost:4000

/* checkoutContext: 'cart' = thanh toán giỏ hàng | 'buynow' = mua ngay 1 sản phẩm */
let checkoutContext = 'cart';
let buyNowItem = null;

/* editingProductId: null = chế độ THÊM | số ID = chế độ SỬA */
let editingProductId = null;

/* =========================================================
   DỮ LIỆU MẪU DỰ PHÒNG (KHI CHƯA BẬT BACKEND SQL SERVER)
========================================================= */
const FALLBACK_PRODUCTS = [
  {
    ProductId: 1,
    Category: 'model',
    Name: 'PG Unleashed RX-78-2 Gundam',
    SeriesName: 'Mobile Suit Gundam (UC 0079)',
    Grade: 'PG',
    Scale: '1/60',
    AccessoryType: null,
    Price: 6850000,
    Stock: 4,
    ImageUrl: 'https://images.unsplash.com/photo-1608889175123-8ee362201f81?auto=format&fit=crop&w=900&q=80',
    Description: 'Tuyệt tác kỷ niệm 40 năm Gunpla với cấu trúc khung xương đa lớp Multi-layered Truss Frame, chi tiết kim loại Etching, đề can kim loại và hệ thống LED buồng lái.'
  },
  {
    ProductId: 2,
    Category: 'model',
    Name: 'MGEX Strike Freedom Gundam',
    SeriesName: 'Mobile Suit Gundam SEED Destiny',
    Grade: 'MG',
    Scale: '1/100',
    AccessoryType: null,
    Price: 4150000,
    Stock: 6,
    ImageUrl: 'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=900&q=80',
    Description: 'Phiên bản Master Grade Extreme với khung xương mạ vàng đa sắc độ cực kỳ sang trọng, biên độ mở giáp toàn thân và bộ cánh DRAGOON hoành tráng.'
  },
  {
    ProductId: 3,
    Category: 'model',
    Name: 'RG RX-93-v2 Hi-Nu Gundam',
    SeriesName: "Mobile Suit Gundam: Char's Counterattack",
    Grade: 'RG',
    Scale: '1/144',
    AccessoryType: null,
    Price: 1250000,
    Stock: 12,
    ImageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=900&q=80',
    Description: 'Một trong những mẫu Real Grade xuất sắc nhất lịch sử Bandai với độ tách màu hoàn hảo, khớp Multi-link chuyển động mượt mà cùng hệ thống Fin Funnel uy lực.'
  },
  {
    ProductId: 4,
    Category: 'model',
    Name: 'HG XVX-016RN Gundam Aerial Rebuild',
    SeriesName: 'The Witch from Mercury',
    Grade: 'HG',
    Scale: '1/144',
    AccessoryType: null,
    Price: 480000,
    Stock: 18,
    ImageUrl: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?auto=format&fit=crop&w=900&q=80',
    Description: 'Phiên bản nâng cấp của Gundam Aerial với chi tiết Shell Unit phát sáng ấn tượng, khiên Gund-Bit có thể tách rời thành 11 mảnh vũ khí độc lập.'
  },
  {
    ProductId: 5,
    Category: 'model',
    Name: 'MG RX-0 Unicorn Gundam Ver.Ka',
    SeriesName: 'Mobile Suit Gundam Unicorn',
    Grade: 'MG',
    Scale: '1/100',
    AccessoryType: null,
    Price: 1450000,
    Stock: 3,
    ImageUrl: 'https://images.unsplash.com/photo-1635863138275-d9b33299680b?auto=format&fit=crop&w=900&q=80',
    Description: 'Thiết kế bởi Hajime Katoki, có khả năng biến hình hoàn chỉnh từ Unicorn Mode sang Destroy Mode để lộ khung Psycho-Frame đỏ rực.'
  },
  {
    ProductId: 6,
    Category: 'model',
    Name: 'SDEX Gundam Barbatos Lupus Rex',
    SeriesName: 'Iron-Blooded Orphans',
    Grade: 'SD',
    Scale: 'Non-scale',
    AccessoryType: null,
    Price: 210000,
    Stock: 25,
    ImageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=80',
    Description: 'Mô hình tỷ lệ Chibi dễ thương, lắp ráp nhanh không cần keo, đi kèm chùy siêu lớn Ultra Large Mace đặc trưng của Barbatos.'
  },
  {
    ProductId: 7,
    Category: 'accessory',
    Name: 'Kìm cắt 1 lưỡi GodHand SPN-120 Ultimate',
    SeriesName: 'GodHand Precision Tools',
    Grade: null,
    Scale: '-',
    AccessoryType: 'Dụng cụ lắp ráp',
    Price: 1390000,
    Stock: 5,
    ImageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80',
    Description: 'Kìm cắt mô hình cao cấp chế tác thủ công tại Nhật Bản. Lưỡi cắt siêu mỏng giúp vết cắt ngọt, hạn chế tối đa vết trắng trên nhựa.'
  },
  {
    ProductId: 8,
    Category: 'accessory',
    Name: 'Đế trưng bày Bandai Action Base 5 (Clear)',
    SeriesName: 'Bandai Spirits Hobby',
    Grade: null,
    Scale: '-',
    AccessoryType: 'Đế trưng bày',
    Price: 195000,
    Stock: 30,
    ImageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80',
    Description: 'Chân đế trong suốt chịu lực tốt, đa khớp khóa chắc chắn để tạo dáng bay trên không cho các dòng HG, RG và MG 1/100.'
  }
];

/* =========================================================
   LƯU TRỮ TOKEN & GIỎ HÀNG
========================================================= */
const STORAGE_KEYS = {
  CUSTOMER_TOKEN: 'gunpla_customer_token',
  CUSTOMER_INFO: 'gunpla_customer_info',
  ADMIN_TOKEN: 'gunpla_admin_token',
  CART: 'gunpla_cart_items',
  DEMO_PRODUCTS: 'gunpla_demo_products',
  DEMO_ORDERS: 'gunpla_demo_orders',
  DEMO_CUSTOMERS: 'gunpla_demo_customers'
};

function getCustomerToken() { return localStorage.getItem(STORAGE_KEYS.CUSTOMER_TOKEN); }
function setCustomerSession(token, customer) {
  if (token) localStorage.setItem(STORAGE_KEYS.CUSTOMER_TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.CUSTOMER_INFO, JSON.stringify(customer));
}
function clearCustomerSession() {
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.CUSTOMER_INFO);
}
function getCurrentCustomer() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMER_INFO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getAdminToken() { return sessionStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN); }
function setAdminSession(token) { sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token); }
function clearAdminSession() { sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN); }
function isAdminLoggedIn() { return !!getAdminToken(); }

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CART);
    const parsed = raw ? JSON.parse(raw) : [];
    cart = Array.isArray(parsed)
      ? parsed.filter(c => c && Number.isInteger(Number(c.productId)) && Number(c.qty) > 0)
              .map(c => ({ productId: Number(c.productId), qty: Number(c.qty) }))
      : [];
  } catch {
    cart = [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  } catch {}
  syncCartToDatabase();
}

/* Tự động đồng bộ giỏ hàng lên CSDL SQL Server nếu người dùng đang đăng nhập */
async function syncCartToDatabase() {
  const token = getCustomerToken();
  if (!token || isOfflineDemo) return;
  try {
    await apiFetch('/auth/cart', {
      method: 'PUT',
      headers: authHeader(token),
      body: JSON.stringify({ items: cart })
    });
  } catch {
    // Bỏ qua lỗi mạng ngầm khi đồng bộ giỏ
  }
}

/* Hợp nhất giỏ hàng từ CSDL khi người dùng vừa đăng nhập */
function mergeServerCart(serverCart) {
  if (!Array.isArray(serverCart) || serverCart.length === 0) {
    if (cart.length > 0) syncCartToDatabase();
    return;
  }
  const map = new Map();
  for (const item of serverCart) {
    map.set(Number(item.productId), Number(item.qty));
  }
  for (const localItem of cart) {
    const prev = map.get(localItem.productId) || 0;
    map.set(localItem.productId, Math.max(prev, localItem.qty));
  }
  cart = Array.from(map.entries()).map(([productId, qty]) => ({ productId, qty }));
  reconcileCartWithProducts();
  saveCartToStorage();
  renderCart();
}

/* Đối chiếu giỏ hàng với tồn kho thực tế sau khi tải sản phẩm */
function reconcileCartWithProducts() {
  if (!products || products.length === 0) return;
  let changed = false;
  const nextCart = [];

  for (const item of cart) {
    const p = products.find(x => x.ProductId === item.productId);
    if (!p || p.Stock <= 0) {
      changed = true;
      continue;
    }
    const clampedQty = Math.min(item.qty, p.Stock);
    if (clampedQty !== item.qty) changed = true;
    nextCart.push({ productId: p.ProductId, qty: clampedQty });
  }

  cart = nextCart;
  if (changed) {
    try { localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart)); } catch {}
  }
}

/* =========================================================
   TIỆN ÍCH GỌI API & FALLBACK OFFLINE
========================================================= */
async function apiFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (networkErr) {
    throw new Error('NETWORK_OFFLINE');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/admin')) {
      clearAdminSession();
    }
    throw new Error(data.error || `Lỗi máy chủ (mã ${res.status})`);
  }
  return data;
}

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function updateApiBadge() {
  const badge = document.getElementById('apiStatusBadge');
  if (!badge) return;
  if (isOfflineDemo) {
    badge.style.display = 'inline-flex';
    badge.textContent = '⚡ CHẾ ĐỘ DEMO OFFLINE (Chưa bật server.js)';
  } else {
    badge.style.display = 'inline-flex';
    badge.textContent = '🟢 ĐÃ KẾT NỐI CSDL SQL SERVER (GundamArsenalDB)';
  }
}

/* Quản lý dữ liệu Demo cục bộ khi chưa bật Backend */
function getDemoProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEMO_PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(FALLBACK_PRODUCTS));
  return [...FALLBACK_PRODUCTS];
}
function saveDemoProducts(list) { localStorage.setItem(STORAGE_KEYS.DEMO_PRODUCTS, JSON.stringify(list)); }

function getDemoOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEMO_ORDERS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveDemoOrders(list) { localStorage.setItem(STORAGE_KEYS.DEMO_ORDERS, JSON.stringify(list)); }

function getDemoCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEMO_CUSTOMERS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveDemoCustomers(list) { localStorage.setItem(STORAGE_KEYS.DEMO_CUSTOMERS, JSON.stringify(list)); }

/* =========================================================
   TIỆN ÍCH GIAO DIỆN CHUNG
========================================================= */
function formatVND(n) {
  return Number(n || 0).toLocaleString('vi-VN') + '₫';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function syncBodyScrollLock() {
  const anyOpen = document.querySelector(
    '.modal.show, .drawer.show, .admin-panel.show'
  );
  document.body.classList.toggle('modal-open', !!anyOpen);
}

function renderMediaContent(p) {
  const code = p.Category === 'model' ? escapeHtml(p.Grade || 'RX') : 'TOOL';
  const fallbackMarkup = `<div class="media-placeholder"><span class="placeholder-code">${code}</span><span>NO VISUAL ARCHIVE</span></div>`;
  if (!p.ImageUrl || !p.ImageUrl.trim()) {
    return fallbackMarkup;
  }
  return `<img src="${escapeHtml(p.ImageUrl)}" alt="${escapeHtml(p.Name)}" loading="lazy" onerror="this.outerHTML='<div class=\\'media-placeholder\\'><span class=\\'placeholder-code\\'>${code}</span><span>IMAGE OFFLINE</span></div>'">`;
}

/* =========================================================
   SẢN PHẨM — TẢI, LỌC, SẮP XẾP & HIỂN THỊ
========================================================= */
async function loadProducts() {
  try {
    products = await apiFetch('/products');
    isOfflineDemo = false;
  } catch (err) {
    if (err.message === 'NETWORK_OFFLINE') {
      isOfflineDemo = true;
      products = getDemoProducts();
    } else {
      products = [];
      showToast(err.message);
    }
  }
  updateApiBadge();
  reconcileCartWithProducts();
  renderProductGrid();
  renderCart();
}

function getFilteredAndSortedProducts() {
  let filtered = Array.isArray(products) ? [...products] : [];

  if (currentCategory !== 'ALL') {
    filtered = filtered.filter(p => p.Category === currentCategory);
  }
  if (currentFilter !== 'ALL') {
    filtered = filtered.filter(p => (p.Grade || '').toUpperCase() === currentFilter);
  }
  if (currentSearch.trim() !== '') {
    const q = currentSearch.trim().toLowerCase();
    filtered = filtered.filter(p =>
      (p.Name || '').toLowerCase().includes(q) ||
      (p.SeriesName || '').toLowerCase().includes(q) ||
      (p.Description || '').toLowerCase().includes(q)
    );
  }

  if (currentSort === 'price-asc') {
    filtered.sort((a, b) => Number(a.Price || 0) - Number(b.Price || 0));
  } else if (currentSort === 'price-desc') {
    filtered.sort((a, b) => Number(b.Price || 0) - Number(a.Price || 0));
  } else if (currentSort === 'name-asc') {
    filtered.sort((a, b) => (a.Name || '').localeCompare(b.Name || '', 'vi'));
  } else if (currentSort === 'stock-desc') {
    filtered.sort((a, b) => Number(b.Stock || 0) - Number(a.Stock || 0));
  }

  return filtered;
}

function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  const filterBar = document.getElementById('filterBar');
  const resultCountText = document.getElementById('resultCountText');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  if (filterBar) {
    filterBar.style.display = currentCategory === 'accessory' ? 'none' : 'flex';
  }
  if (clearSearchBtn) {
    clearSearchBtn.style.display = currentSearch.trim() !== '' ? 'inline-block' : 'none';
  }

  const hasActiveFilter =
    currentCategory !== 'ALL' ||
    currentFilter !== 'ALL' ||
    currentSearch.trim() !== '' ||
    currentSort !== 'default';

  if (resetFiltersBtn) {
    resetFiltersBtn.style.display = hasActiveFilter ? 'inline-block' : 'none';
  }

  const filtered = getFilteredAndSortedProducts();

  if (resultCountText) {
    resultCountText.textContent = `Hiển thị ${filtered.length} / ${products.length} sản phẩm trong kho`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-msg">// KHÔNG TÌM THẤY SẢN PHẨM PHÙ HỢP VỚI BỘ LỌC //</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const safeGrade = (p.Grade || 'HG').toUpperCase();
    const stockNum = Number(p.Stock || 0);
    const stockClass = stockNum <= 0 ? 'out' : (stockNum <= 5 ? 'low' : '');
    const stockLabel = stockNum <= 0 ? 'HẾT HÀNG' : (stockNum <= 5 ? `SẮP HẾT (${stockNum})` : `SẴN HÀNG (${stockNum})`);

    return `
      <article class="product-card" data-id="${p.ProductId}">
        <div class="card-media" data-quickview="${p.ProductId}" title="Xem chi tiết ${escapeHtml(p.Name)}">
          ${p.Category === 'model'
            ? `<span class="grade-badge tag-${escapeHtml(safeGrade.toLowerCase())}">${escapeHtml(safeGrade)}</span>`
            : `<span class="grade-badge accessory-badge">PHỤ KIỆN</span>`}
          ${renderMediaContent(p)}
          <span class="quick-view-hint">🔍 CHI TIẾT</span>
        </div>
        <div class="card-body">
          <div class="card-series">${escapeHtml(p.SeriesName || 'GUNPLA ARCHIVE')}</div>
          <h3 class="card-name" data-quickview="${p.ProductId}">${escapeHtml(p.Name)}</h3>
          <div class="card-scale">
            ${p.Category === 'model'
              ? 'TỶ LỆ ' + escapeHtml(p.Scale || '1/144')
              : escapeHtml(p.AccessoryType || 'Dụng cụ Hobby')}
          </div>
          ${p.Description ? `<p class="card-desc-preview">${escapeHtml(p.Description)}</p>` : ''}
          <div class="card-bottom">
            <span class="card-price">${formatVND(p.Price)}</span>
            <span class="card-stock ${stockClass}">${stockLabel}</span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="add-cart-btn" data-id="${p.ProductId}" title="Thêm vào giỏ hàng" ${stockNum <= 0 ? 'disabled' : ''}>🛒</button>
          <button type="button" class="buy-now-btn" data-id="${p.ProductId}" ${stockNum <= 0 ? 'disabled' : ''}>
            ${stockNum <= 0 ? 'TẠM HẾT HÀNG' : 'MUA NGAY'}
          </button>
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('.add-cart-btn').forEach(btn => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)));
  });
  grid.querySelectorAll('.buy-now-btn').forEach(btn => {
    btn.addEventListener('click', () => buyNow(Number(btn.dataset.id)));
  });
  grid.querySelectorAll('[data-quickview]').forEach(el => {
    el.addEventListener('click', () => openProductDetail(Number(el.dataset.quickview)));
  });
}

/* =========================================================
   MODAL XEM NHANH CHI TIẾT SẢN PHẨM (QUICK VIEW)
========================================================= */
function openProductDetail(productId) {
  const p = products.find(x => x.ProductId === productId);
  if (!p) return;

  const safeGrade = (p.Grade || 'HG').toUpperCase();
  const stockNum = Number(p.Stock || 0);
  const headerCode = document.getElementById('detailHeaderCode');
  const content = document.getElementById('detailContent');

  headerCode.textContent = `HỒ SƠ SẢN PHẨM // #${p.ProductId}`;

  content.innerHTML = `
    <div class="detail-media">
      ${renderMediaContent(p)}
    </div>
    <div class="detail-info">
      <div class="detail-series">${escapeHtml(p.SeriesName || 'BANDAI NAMCO')}</div>
      <h2 id="detailName" class="detail-title">${escapeHtml(p.Name)}</h2>
      <div class="detail-price">${formatVND(p.Price)}</div>

      <div class="detail-specs-grid">
        <div>
          <span>PHÂN LOẠI</span>
          <strong>${p.Category === 'model' ? 'Mô hình Gunpla' : 'Dụng cụ & Phụ kiện'}</strong>
        </div>
        <div>
          <span>${p.Category === 'model' ? 'CẤP ĐỘ GRADE' : 'NHÓM PHỤ KIỆN'}</span>
          <strong>${p.Category === 'model' ? escapeHtml(safeGrade) : escapeHtml(p.AccessoryType || 'Tiêu chuẩn')}</strong>
        </div>
        <div>
          <span>TỶ LỆ / QUY CÁCH</span>
          <strong>${escapeHtml(p.Scale || 'Tiêu chuẩn')}</strong>
        </div>
        <div>
          <span>TÌNH TRẠNG KHO</span>
          <strong style="color:${stockNum > 0 ? 'var(--green)' : 'var(--red)'}">
            ${stockNum > 0 ? `Còn ${stockNum} sản phẩm` : 'Tạm hết hàng'}
          </strong>
        </div>
      </div>

      <p class="detail-desc">
        ${escapeHtml(p.Description || 'Sản phẩm chính hãng Bandai Namco Nhật Bản, đầy đủ runner và sách hướng dẫn lắp ráp minh hoạ trực quan.')}
      </p>

      <div class="detail-actions">
        <button type="button" id="detailAddCartBtn" class="btn btn-outline" style="flex:1" ${stockNum <= 0 ? 'disabled' : ''}>
          🛒 THÊM VÀO GIỎ
        </button>
        <button type="button" id="detailBuyNowBtn" class="btn btn-primary" style="flex:1" ${stockNum <= 0 ? 'disabled' : ''}>
          ${stockNum <= 0 ? 'HẾT HÀNG' : 'MUA NGAY'}
        </button>
      </div>
    </div>
  `;

  content.querySelector('#detailAddCartBtn')?.addEventListener('click', () => {
    addToCart(p.ProductId);
    closeProductDetail();
  });

  content.querySelector('#detailBuyNowBtn')?.addEventListener('click', () => {
    closeProductDetail();
    buyNow(p.ProductId);
  });

  document.getElementById('detailModal').classList.add('show');
  document.getElementById('detailOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeProductDetail() {
  document.getElementById('detailModal').classList.remove('show');
  document.getElementById('detailOverlay').classList.remove('show');
  syncBodyScrollLock();
}

/* =========================================================
   GIỎ HÀNG (LƯU TRỮ BỀN VỮNG + ĐỒNG BỘ CSDL)
========================================================= */
function addToCart(productId) {
  const product = products.find(p => p.ProductId === productId);
  if (!product || product.Stock <= 0) return;

  const existing = cart.find(c => c.productId === productId);
  const currentQty = existing ? existing.qty : 0;
  if (currentQty + 1 > product.Stock) {
    showToast('Số lượng trong giỏ đã đạt mức tối đa tồn kho!');
    return;
  }
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ productId, qty: 1 });
  }

  saveCartToStorage();
  showToast(`Đã thêm "${product.Name}" vào giỏ hàng`);
  renderCart();
  openCart();
}

function changeQty(productId, delta) {
  const item = cart.find(c => c.productId === productId);
  if (!item) return;
  const product = products.find(p => p.ProductId === productId);
  const newQty = item.qty + delta;

  if (newQty <= 0) {
    cart = cart.filter(c => c.productId !== productId);
  } else if (product && newQty > product.Stock) {
    showToast(`Chỉ còn ${product.Stock} sản phẩm trong kho!`);
    return;
  } else {
    item.qty = newQty;
  }
  saveCartToStorage();
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter(c => c.productId !== productId);
  saveCartToStorage();
  renderCart();
}

function clearCart() {
  if (cart.length === 0) return;
  cart = [];
  saveCartToStorage();
  renderCart();
  showToast('Đã làm trống giỏ hàng');
}

function cartTotal() {
  return cart.reduce((sum, c) => {
    const p = products.find(x => x.ProductId === c.productId);
    return sum + (p ? Number(p.Price) * c.qty : 0);
  }, 0);
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  const subEl = document.getElementById('cartDrawerSub');
  const clearBtn = document.getElementById('clearCartBtn');

  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  if (countEl) countEl.textContent = totalQty;
  if (subEl) subEl.textContent = `${totalQty} sản phẩm đã chọn`;
  if (clearBtn) clearBtn.style.display = cart.length > 0 ? 'inline-flex' : 'none';

  if (cart.length === 0) {
    container.innerHTML = `<div class="empty-cart">// GIỎ HÀNG CỦA BẠN ĐANG TRỐNG //</div>`;
  } else {
    container.innerHTML = cart.map(c => {
      const p = products.find(x => x.ProductId === c.productId);
      if (!p) return '';
      const metaLabel = p.Category === 'model'
        ? `${escapeHtml(p.Grade || 'HG')} · ${escapeHtml(p.Scale || '')}`
        : escapeHtml(p.AccessoryType || 'Phụ kiện');

      return `
        <div class="cart-item">
          ${p.ImageUrl
            ? `<img src="${escapeHtml(p.ImageUrl)}" alt="${escapeHtml(p.Name)}" onerror="this.style.opacity=0.15">`
            : `<div style="width:66px;height:66px;background:var(--bg);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:10px;color:var(--gold)">RX</div>`}
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(p.Name)}</div>
            <div class="cart-item-meta">${metaLabel} · ${formatVND(p.Price)}</div>
            <div class="qty-row">
              <button type="button" class="qty-btn" data-action="minus" data-id="${p.ProductId}" aria-label="Giảm số lượng">−</button>
              <span>${c.qty}</span>
              <button type="button" class="qty-btn" data-action="plus" data-id="${p.ProductId}" aria-label="Tăng số lượng">+</button>
              <button type="button" class="remove-btn" data-id="${p.ProductId}">XOÁ</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  totalEl.textContent = formatVND(cartTotal());

  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      changeQty(id, btn.dataset.action === 'plus' ? 1 : -1);
    });
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(Number(btn.dataset.id)));
  });
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('show');
  document.getElementById('cartOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('show');
  document.getElementById('cartOverlay').classList.remove('show');
  syncBodyScrollLock();
}

/* =========================================================
   ĐẶT HÀNG (CHECKOUT) & TÓM TẮT ĐƠN HÀNG
========================================================= */
function getCheckoutItems() {
  return checkoutContext === 'buynow' && buyNowItem ? [buyNowItem] : cart;
}

function getCheckoutTotal() {
  const items = getCheckoutItems();
  return items.reduce((sum, c) => {
    const p = products.find(x => x.ProductId === c.productId);
    return sum + (p ? Number(p.Price) * c.qty : 0);
  }, 0);
}

function renderCheckoutSummary() {
  const itemsContainer = document.getElementById('checkoutSummaryItems');
  const totalAmountEl = document.getElementById('checkoutTotalAmount');
  const modeBadge = document.getElementById('checkoutModeBadge');

  const items = getCheckoutItems();
  if (modeBadge) {
    modeBadge.textContent = checkoutContext === 'buynow' ? 'MUA NGAY' : `GIỎ HÀNG (${items.reduce((s, i) => s + i.qty, 0)})`;
  }

  if (itemsContainer) {
    itemsContainer.innerHTML = items.map(c => {
      const p = products.find(x => x.ProductId === c.productId);
      if (!p) return '';
      return `
        <div class="summary-item-row">
          <span>${escapeHtml(p.Name)} <b>×${c.qty}</b></span>
          <span>${formatVND(Number(p.Price) * c.qty)}</span>
        </div>
      `;
    }).join('');
  }

  if (totalAmountEl) {
    totalAmountEl.textContent = formatVND(getCheckoutTotal());
  }
}

function buyNow(productId) {
  const product = products.find(p => p.ProductId === productId);
  if (!product || product.Stock <= 0) return;
  checkoutContext = 'buynow';
  buyNowItem = { productId, qty: 1 };
  openCheckout();
}

function openCheckoutFromCart() {
  checkoutContext = 'cart';
  buyNowItem = null;
  openCheckout();
}

function openCheckout() {
  if (checkoutContext === 'cart' && cart.length === 0) {
    showToast('Giỏ hàng đang trống!');
    return;
  }
  prefillCheckoutForm();
  renderCheckoutSummary();
  document.getElementById('checkoutModal').classList.add('show');
  document.getElementById('checkoutOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('show');
  document.getElementById('checkoutOverlay').classList.remove('show');
  checkoutContext = 'cart';
  buyNowItem = null;
  syncBodyScrollLock();
}

function prefillCheckoutForm() {
  const customer = getCurrentCustomer();
  if (customer) {
    const nameInput = document.getElementById('custName');
    const phoneInput = document.getElementById('custPhone');
    const addrInput = document.getElementById('custAddress');
    if (nameInput) nameInput.value = customer.name || '';
    if (phoneInput) phoneInput.value = customer.phone || '';
    if (addrInput && customer.address) addrInput.value = customer.address;
  }
}

async function submitOrder(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const note = document.getElementById('custNote').value.trim();

  const rawItems = getCheckoutItems();
  if (rawItems.length === 0) {
    showToast('Không có sản phẩm nào để đặt hàng!');
    return;
  }

  const checkoutItems = rawItems.map(c => ({ productId: c.productId, quantity: c.qty }));

  submitBtn.disabled = true;
  submitBtn.textContent = 'ĐANG XỬ LÝ ĐƠN HÀNG...';

  try {
    let orderId;
    if (isOfflineDemo) {
      const demoProducts = getDemoProducts();
      let totalAmount = 0;
      const orderDetailItems = [];

      for (const item of checkoutItems) {
        const prod = demoProducts.find(x => x.ProductId === item.productId);
        if (!prod || prod.Stock < item.quantity) {
          throw new Error(`Sản phẩm "${prod ? prod.Name : '#' + item.productId}" không đủ tồn kho!`);
        }
        prod.Stock -= item.quantity;
        totalAmount += Number(prod.Price) * item.quantity;
        orderDetailItems.push({
          ProductId: prod.ProductId,
          ProductName: prod.Name,
          Quantity: item.quantity,
          UnitPrice: prod.Price
        });
      }
      saveDemoProducts(demoProducts);

      const demoOrders = getDemoOrders();
      orderId = demoOrders.length > 0 ? Math.max(...demoOrders.map(o => o.OrderId)) + 1 : 1001;
      const customer = getCurrentCustomer();
      demoOrders.unshift({
        OrderId: orderId,
        CustomerId: customer ? customer.id : null,
        CustomerEmail: customer ? customer.email : null,
        CustomerName: name,
        Phone: phone,
        Address: address,
        Note: note,
        Status: 'Chờ xác nhận',
        TotalAmount: totalAmount,
        CreatedAt: new Date().toISOString(),
        items: orderDetailItems
      });
      saveDemoOrders(demoOrders);
    } else {
      const token = getCustomerToken();
      const data = await apiFetch('/orders', {
        method: 'POST',
        headers: authHeader(token),
        body: JSON.stringify({ customerName: name, phone, address, note, items: checkoutItems })
      });
      orderId = data.orderId;
    }

    // Lưu lại địa chỉ mặc định mới cho khách hàng đang đăng nhập
    const customer = getCurrentCustomer();
    if (customer) {
      customer.address = address;
      customer.phone = phone;
      setCustomerSession(getCustomerToken(), customer);
    }

    if (checkoutContext === 'cart') {
      cart = [];
      saveCartToStorage();
      renderCart();
    }

    await loadProducts();
    closeCheckout();
    closeCart();
    document.getElementById('checkoutForm').reset();
    showToast(`Đặt hàng thành công! Mã đơn #${orderId} 🚀`);
  } catch (err) {
    showToast(err.message === 'NETWORK_OFFLINE'
      ? 'Không kết nối được máy chủ API!'
      : err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'HOÀN TẤT ĐẶT HÀNG';
  }
}

/* =========================================================
   KHÁCH HÀNG — ĐĂNG NHẬP / ĐĂNG KÝ / HỒ SƠ CÁ NHÂN / ĐƠN HÀNG
========================================================= */
async function syncLoggedInUserSession() {
  const token = getCustomerToken();
  if (!token || isOfflineDemo) return;
  try {
    const data = await apiFetch('/auth/me', { headers: authHeader(token) });
    if (data.customer) {
      setCustomerSession(token, data.customer);
      updateAccountUI();
    }
    if (Array.isArray(data.cart)) {
      mergeServerCart(data.cart);
    }
  } catch {
    // Nếu token hết hạn thì xoá phiên cũ
    clearCustomerSession();
    updateAccountUI();
  }
}

function openAuth() {
  document.getElementById('authModal').classList.add('show');
  document.getElementById('authOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeAuth() {
  document.getElementById('authModal').classList.remove('show');
  document.getElementById('authOverlay').classList.remove('show');
  syncBodyScrollLock();
}

function switchAuthMode(mode) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.getElementById('loginForm').style.display = mode === 'login' ? 'flex' : 'none';
  document.getElementById('registerForm').style.display = mode === 'register' ? 'flex' : 'none';
  document.getElementById('authTitle').textContent = mode === 'login' ? 'ĐĂNG NHẬP TÀI KHOẢN' : 'ĐĂNG KÝ TÀI KHOẢN MỚI';
}

async function submitRegister(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const fullName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const address = (document.getElementById('regAddress')?.value || '').trim();
  const password = document.getElementById('regPassword').value;

  submitBtn.disabled = true;
  try {
    let sessionData;
    if (isOfflineDemo) {
      const customers = getDemoCustomers();
      if (customers.some(c => c.Email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Email này đã được đăng ký!');
      }
      const newId = customers.length > 0 ? Math.max(...customers.map(c => c.CustomerId)) + 1 : 1;
      const newCust = {
        CustomerId: newId,
        FullName: fullName,
        Email: email,
        Phone: phone,
        DefaultAddress: address,
        Password: password,
        CreatedAt: new Date().toISOString(),
        LastLoginAt: new Date().toISOString()
      };
      customers.unshift(newCust);
      saveDemoCustomers(customers);
      sessionData = {
        token: 'demo-customer-token-' + newId,
        customer: { id: newId, name: fullName, email, phone, address }
      };
    } else {
      sessionData = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone, address, password })
      });
    }
    setCustomerSession(sessionData.token, sessionData.customer);
    syncCartToDatabase();
    document.getElementById('registerForm').reset();
    closeAuth();
    updateAccountUI();
    showToast(`Chào mừng ${sessionData.customer.name}! Dữ liệu tài khoản đã được lưu vào CSDL.`);
  } catch (err) {
    showToast(err.message === 'NETWORK_OFFLINE' ? 'Máy chủ API chưa phản hồi' : err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  submitBtn.disabled = true;
  try {
    let sessionData;
    if (isOfflineDemo) {
      const customers = getDemoCustomers();
      const found = customers.find(c => c.Email.toLowerCase() === email.toLowerCase() && c.Password === password);
      if (!found) throw new Error('Email hoặc mật khẩu không chính xác!');
      found.LastLoginAt = new Date().toISOString();
      saveDemoCustomers(customers);
      sessionData = {
        token: 'demo-customer-token-' + found.CustomerId,
        customer: {
          id: found.CustomerId,
          name: found.FullName,
          email: found.Email,
          phone: found.Phone,
          address: found.DefaultAddress || ''
        },
        cart: []
      };
    } else {
      sessionData = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
    }
    setCustomerSession(sessionData.token, sessionData.customer);
    mergeServerCart(sessionData.cart || []);
    document.getElementById('loginForm').reset();
    closeAuth();
    updateAccountUI();
    showToast(`Chào mừng trở lại, ${sessionData.customer.name}!`);
  } catch (err) {
    showToast(err.message === 'NETWORK_OFFLINE' ? 'Máy chủ API chưa phản hồi' : err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

function openProfileModal() {
  document.getElementById('accountMenu').classList.remove('show');
  const customer = getCurrentCustomer();
  if (!customer) {
    openAuth();
    return;
  }
  document.getElementById('profEmail').value = customer.email || '';
  document.getElementById('profName').value = customer.name || '';
  document.getElementById('profPhone').value = customer.phone || '';
  document.getElementById('profAddress').value = customer.address || '';
  document.getElementById('profNewPassword').value = '';

  document.getElementById('profileModal').classList.add('show');
  document.getElementById('profileOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.remove('show');
  document.getElementById('profileOverlay').classList.remove('show');
  syncBodyScrollLock();
}

async function submitProfileUpdate(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const fullName = document.getElementById('profName').value.trim();
  const phone = document.getElementById('profPhone').value.trim();
  const address = document.getElementById('profAddress').value.trim();
  const newPassword = document.getElementById('profNewPassword').value;

  submitBtn.disabled = true;
  try {
    const token = getCustomerToken();
    const current = getCurrentCustomer();

    if (isOfflineDemo) {
      const customers = getDemoCustomers();
      const idx = customers.findIndex(c => c.CustomerId === current?.id);
      if (idx !== -1) {
        customers[idx].FullName = fullName;
        customers[idx].Phone = phone;
        customers[idx].DefaultAddress = address;
        if (newPassword) customers[idx].Password = newPassword;
        saveDemoCustomers(customers);
      }
      setCustomerSession(token, { ...current, name: fullName, phone, address });
    } else {
      const data = await apiFetch('/auth/profile', {
        method: 'PUT',
        headers: authHeader(token),
        body: JSON.stringify({ fullName, phone, address, newPassword })
      });
      setCustomerSession(token, data.customer);
    }

    updateAccountUI();
    closeProfileModal();
    showToast('Đã lưu thông tin hồ sơ & địa chỉ vào CSDL!');
  } catch (err) {
    showToast(err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

function customerLogout() {
  clearCustomerSession();
  updateAccountUI();
  document.getElementById('accountMenu').classList.remove('show');
  showToast('Đã đăng xuất tài khoản khách hàng');
}

function updateAccountUI() {
  const customer = getCurrentCustomer();
  const label = document.getElementById('accountLabel');
  const userHeader = document.getElementById('accountUserHeader');

  if (customer && customer.name) {
    const shortName = customer.name.trim().split(/\s+/).pop().toUpperCase();
    label.textContent = shortName;
    if (userHeader) {
      userHeader.innerHTML = `
        <strong>${escapeHtml(customer.name)}</strong>
        <div>${escapeHtml(customer.email || '')} · ${escapeHtml(customer.phone || '')}</div>
        ${customer.address ? `<div style="margin-top:3px;font-size:11px;color:var(--text-muted)">📍 ${escapeHtml(customer.address)}</div>` : ''}
      `;
    }
  } else {
    label.textContent = 'ĐĂNG NHẬP';
    if (userHeader) userHeader.innerHTML = '';
  }
}

function toggleAccountMenu() {
  const customer = getCurrentCustomer();
  if (!customer) {
    openAuth();
    return;
  }
  document.getElementById('accountMenu').classList.toggle('show');
}

async function openMyOrders() {
  document.getElementById('accountMenu').classList.remove('show');
  const list = document.getElementById('myOrdersList');
  list.innerHTML = `<div class="empty-admin">// ĐANG TẢI LỊCH SỬ ĐƠN HÀNG... //</div>`;

  document.getElementById('myOrdersModal').classList.add('show');
  document.getElementById('myOrdersOverlay').classList.add('show');
  syncBodyScrollLock();

  try {
    let orders = [];
    if (isOfflineDemo) {
      const cust = getCurrentCustomer();
      orders = getDemoOrders().filter(o => !cust || o.CustomerEmail === cust.email || o.CustomerId === cust.id);
    } else {
      const token = getCustomerToken();
      orders = await apiFetch('/orders/mine', { headers: authHeader(token) });
    }

    if (!orders || orders.length === 0) {
      list.innerHTML = `<div class="empty-admin">// BẠN CHƯA CÓ ĐƠN HÀNG NÀO //</div>`;
      return;
    }

    list.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-id">MÃ ĐƠN #${o.OrderId}</span>
          <span class="order-date">${new Date(o.CreatedAt).toLocaleString('vi-VN')}</span>
        </div>
        <div class="order-cust">
          Trạng thái: <b style="color:var(--gold)">${escapeHtml(o.Status || 'Chờ xác nhận')}</b><br>
          Giao tới: ${escapeHtml(o.Address || '')}
        </div>
        <div class="order-items">
          ${(o.items || []).map(it => `
            <div>
              <span>${escapeHtml(it.ProductName)} ×${it.Quantity}</span>
              <span>${formatVND(Number(it.UnitPrice) * Number(it.Quantity))}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-total">TỔNG THANH TOÁN: ${formatVND(o.TotalAmount)}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-admin">// ${escapeHtml(err.message)} //</div>`;
  }
}

function closeMyOrders() {
  document.getElementById('myOrdersModal').classList.remove('show');
  document.getElementById('myOrdersOverlay').classList.remove('show');
  syncBodyScrollLock();
}

/* =========================================================
   ADMIN — XÁC THỰC, QUẢN LÝ KHO, ĐƠN HÀNG & DỮ LIỆU NGƯỜI DÙNG
========================================================= */
function openAdminLogin() {
  if (isAdminLoggedIn()) {
    openAdminPanel();
    return;
  }
  document.getElementById('adminLoginModal').classList.add('show');
  document.getElementById('adminLoginOverlay').classList.add('show');
  syncBodyScrollLock();
}

function closeAdminLogin() {
  document.getElementById('adminLoginModal').classList.remove('show');
  document.getElementById('adminLoginOverlay').classList.remove('show');
  syncBodyScrollLock();
}

async function submitAdminLogin(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value;

  submitBtn.disabled = true;
  try {
    if (isOfflineDemo) {
      if (username === 'admin' && password === 'gundam123') {
        setAdminSession('demo-admin-token');
      } else {
        throw new Error('Sai tài khoản hoặc mật khẩu Admin (Demo: admin / gundam123)');
      }
    } else {
      const data = await apiFetch('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      setAdminSession(data.token);
    }
    closeAdminLogin();
    document.getElementById('adminLoginForm').reset();
    openAdminPanel();
    showToast('Đã đăng nhập quyền Quản trị viên');
  } catch (err) {
    showToast(err.message === 'NETWORK_OFFLINE' ? 'Không kết nối được máy chủ API' : err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

function adminLogout() {
  clearAdminSession();
  closeAdminPanel();
  showToast('Đã đăng xuất khỏi bảng điều khiển Admin');
}

function openAdminPanel() {
  document.getElementById('adminPanel').classList.add('show');
  document.getElementById('adminOverlay').classList.add('show');
  resetProductForm();
  renderAdminProducts();
  loadAdminOrders();
  loadAdminCustomers();
  syncBodyScrollLock();
}

function closeAdminPanel() {
  document.getElementById('adminPanel').classList.remove('show');
  document.getElementById('adminOverlay').classList.remove('show');
  syncBodyScrollLock();
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.querySelectorAll('.admin-tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tabName}`);
  });
  if (tabName === 'customers') loadAdminCustomers();
  if (tabName === 'orders') loadAdminOrders();
}

function renderAdminProducts() {
  document.getElementById('adminProductCount').textContent = products.length;
  const list = document.getElementById('adminProductList');

  if (products.length === 0) {
    list.innerHTML = `<div class="empty-admin">// CHƯA CÓ SẢN PHẨM TRONG KHO //</div>`;
    return;
  }

  list.innerHTML = products.map(p => {
    const safeGrade = (p.Grade || 'HG').toUpperCase();
    const badge = p.Category === 'model'
      ? `<span class="grade-badge tag-${escapeHtml(safeGrade.toLowerCase())}" style="position:static;display:inline-block;margin-left:6px;">${escapeHtml(safeGrade)}</span>`
      : `<span class="grade-badge accessory-badge" style="position:static;display:inline-block;margin-left:6px;">PHỤ KIỆN</span>`;
    const metaExtra = p.Category === 'model'
      ? escapeHtml(p.Scale || '1/144') + ' · '
      : (p.AccessoryType ? escapeHtml(p.AccessoryType) + ' · ' : '');

    return `
      <div class="admin-product-row" data-id="${p.ProductId}">
        ${p.ImageUrl
          ? `<img src="${escapeHtml(p.ImageUrl)}" alt="" onerror="this.style.opacity=0.15">`
          : `<div style="width:50px;height:50px;background:var(--bg-alt);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:11px;color:var(--gold)">RX</div>`}
        <div class="info">
          <div class="name">${escapeHtml(p.Name)} ${badge}</div>
          <div class="meta">${metaExtra}${formatVND(p.Price)} · Tồn kho: <b>${p.Stock}</b></div>
        </div>
        <button type="button" class="edit-btn" data-id="${p.ProductId}">SỬA</button>
        <button type="button" class="del-btn" data-id="${p.ProductId}">XOÁ</button>
      </div>`;
  }).join('');

  list.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => startEditProduct(Number(btn.dataset.id)));
  });

  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteProduct(Number(btn.dataset.id)));
  });
}

function toggleProductCategoryFields() {
  const category = document.getElementById('pCategory').value;
  document.getElementById('gradeFieldRow').style.display = category === 'model' ? 'grid' : 'none';
  document.getElementById('accessoryFieldRow').style.display = category === 'accessory' ? 'grid' : 'none';
}

function startEditProduct(productId) {
  const p = products.find(x => x.ProductId === productId);
  if (!p) return;

  editingProductId = productId;
  document.getElementById('pEditId').value = productId;
  document.getElementById('pCategory').value = p.Category || 'model';
  document.getElementById('pName').value = p.Name || '';
  document.getElementById('pSeries').value = p.SeriesName || '';
  document.getElementById('pPrice').value = p.Price ?? 0;
  document.getElementById('pStock').value = p.Stock ?? 0;
  document.getElementById('pImage').value = p.ImageUrl || '';
  document.getElementById('pDesc').value = p.Description || '';

  if (p.Category === 'model') {
    document.getElementById('pGrade').value = p.Grade || 'HG';
    document.getElementById('pScale').value = p.Scale || '1/144';
  } else {
    document.getElementById('pAccessoryType').value = p.AccessoryType || 'Phụ kiện khác';
  }
  toggleProductCategoryFields();

  document.getElementById('productFormTitle').textContent = `CHỈNH SỬA SẢN PHẨM #${productId}`;
  document.getElementById('productSubmitBtn').textContent = 'LƯU CẬP NHẬT';
  document.getElementById('cancelEditBtn').style.display = 'inline-flex';

  document.getElementById('productForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetProductForm() {
  editingProductId = null;
  const form = document.getElementById('productForm');
  if (form) form.reset();
  document.getElementById('pEditId').value = '';
  toggleProductCategoryFields();
  document.getElementById('productFormTitle').textContent = 'THÊM SẢN PHẨM MỚI';
  document.getElementById('productSubmitBtn').textContent = 'THÊM SẢN PHẨM';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

async function saveProduct(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('productSubmitBtn');
  const category = document.getElementById('pCategory').value;
  const isEditing = !!editingProductId;

  const payload = {
    category,
    name: document.getElementById('pName').value.trim(),
    seriesName: document.getElementById('pSeries').value.trim(),
    price: Number(document.getElementById('pPrice').value),
    stock: Number(document.getElementById('pStock').value),
    imageUrl: document.getElementById('pImage').value.trim(),
    description: document.getElementById('pDesc').value.trim(),
    grade: category === 'model' ? document.getElementById('pGrade').value : null,
    scale: category === 'model' ? (document.getElementById('pScale').value.trim() || '1/144') : '-',
    accessoryType: category === 'accessory' ? document.getElementById('pAccessoryType').value : null
  };

  submitBtn.disabled = true;
  try {
    if (isOfflineDemo) {
      const demoProducts = getDemoProducts();
      if (isEditing) {
        const idx = demoProducts.findIndex(x => x.ProductId === editingProductId);
        if (idx !== -1) {
          demoProducts[idx] = {
            ...demoProducts[idx],
            Category: payload.category,
            Name: payload.name,
            SeriesName: payload.seriesName,
            Grade: payload.grade,
            Scale: payload.scale,
            AccessoryType: payload.accessoryType,
            Price: payload.price,
            Stock: payload.stock,
            ImageUrl: payload.imageUrl,
            Description: payload.description
          };
        }
      } else {
        const nextId = demoProducts.length > 0 ? Math.max(...demoProducts.map(x => x.ProductId)) + 1 : 1;
        demoProducts.unshift({
          ProductId: nextId,
          Category: payload.category,
          Name: payload.name,
          SeriesName: payload.seriesName,
          Grade: payload.grade,
          Scale: payload.scale,
          AccessoryType: payload.accessoryType,
          Price: payload.price,
          Stock: payload.stock,
          ImageUrl: payload.imageUrl,
          Description: payload.description
        });
      }
      saveDemoProducts(demoProducts);
      showToast(isEditing ? `Đã cập nhật "${payload.name}"` : `Đã thêm "${payload.name}"`);
    } else {
      const token = getAdminToken();
      if (isEditing) {
        await apiFetch(`/products/${editingProductId}`, {
          method: 'PUT',
          headers: authHeader(token),
          body: JSON.stringify(payload)
        });
        showToast(`Đã cập nhật sản phẩm "${payload.name}"`);
      } else {
        await apiFetch('/products', {
          method: 'POST',
          headers: authHeader(token),
          body: JSON.stringify(payload)
        });
        showToast(`Đã thêm sản phẩm "${payload.name}"`);
      }
    }

    resetProductForm();
    await loadProducts();
    renderAdminProducts();
  } catch (err) {
    showToast(err.message);
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!confirm('Bạn có chắc chắn muốn xoá sản phẩm này khỏi kho hàng?')) return;
  try {
    if (isOfflineDemo) {
      const demoProducts = getDemoProducts().filter(x => x.ProductId !== id);
      saveDemoProducts(demoProducts);
    } else {
      const token = getAdminToken();
      await apiFetch(`/products/${id}`, { method: 'DELETE', headers: authHeader(token) });
    }
    if (editingProductId === id) {
      resetProductForm();
    }
    await loadProducts();
    renderAdminProducts();
    showToast('Đã xoá sản phẩm khỏi kho');
  } catch (err) {
    showToast(err.message);
  }
}

async function loadAdminOrders() {
  const list = document.getElementById('adminOrderList');
  list.innerHTML = `<div class="empty-admin">// ĐANG TẢI DANH SÁCH ĐƠN HÀNG... //</div>`;

  try {
    let orders = [];
    if (isOfflineDemo) {
      orders = getDemoOrders();
    } else {
      const token = getAdminToken();
      orders = await apiFetch('/orders', { headers: authHeader(token) });
    }

    document.getElementById('adminOrderCount').textContent = orders.length;

    if (orders.length === 0) {
      list.innerHTML = `<div class="empty-admin">// CHƯA CÓ ĐƠN ĐẶT HÀNG NÀO //</div>`;
      return;
    }

    const statuses = ['Chờ xác nhận', 'Đang chuẩn bị hàng', 'Đang giao hàng', 'Hoàn thành', 'Đã huỷ'];

    list.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-id">MÃ ĐƠN #${o.OrderId} ${o.CustomerId ? `<span style="color:var(--text-dim);font-size:11px">(KH #${o.CustomerId})</span>` : '<span style="color:var(--text-muted);font-size:11px">(Khách vãng lai)</span>'}</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <select class="order-status-select sort-select" data-order-id="${o.OrderId}" style="padding:5px 10px;font-size:12.5px;">
              ${statuses.map(st => `<option value="${escapeHtml(st)}" ${o.Status === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
            <span class="order-date">${new Date(o.CreatedAt).toLocaleString('vi-VN')}</span>
          </div>
        </div>
        <div class="order-cust">
          Người nhận: <b>${escapeHtml(o.CustomerName)}</b> · SĐT: <b>${escapeHtml(o.Phone)}</b><br>
          Địa chỉ: ${escapeHtml(o.Address)}
          ${o.Note ? `<br><i>Ghi chú: ${escapeHtml(o.Note)}</i>` : ''}
        </div>
        <div class="order-items">
          ${(o.items || []).map(it => `
            <div>
              <span>${escapeHtml(it.ProductName)} ×${it.Quantity}</span>
              <span>${formatVND(Number(it.UnitPrice) * Number(it.Quantity))}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-total">TỔNG CỘNG: ${formatVND(o.TotalAmount)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.order-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const orderId = Number(sel.dataset.orderId);
        const newStatus = sel.value;
        try {
          if (isOfflineDemo) {
            const demoOrders = getDemoOrders();
            const found = demoOrders.find(x => x.OrderId === orderId);
            if (found) found.Status = newStatus;
            saveDemoOrders(demoOrders);
          } else {
            const token = getAdminToken();
            await apiFetch(`/orders/${orderId}/status`, {
              method: 'PUT',
              headers: authHeader(token),
              body: JSON.stringify({ status: newStatus })
            });
          }
          showToast(`Đã cập nhật trạng thái đơn #${orderId}: ${newStatus}`);
        } catch (err) {
          showToast(err.message);
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-admin">// ${escapeHtml(err.message)} //</div>`;
  }
}

async function loadAdminCustomers() {
  const list = document.getElementById('adminCustomerList');
  const countEl = document.getElementById('adminCustomerCount');
  if (!list) return;

  list.innerHTML = `<div class="empty-admin">// ĐANG TẢI DỮ LIỆU NGƯỜI DÙNG TỪ CSDL... //</div>`;

  try {
    let customers = [];
    if (isOfflineDemo) {
      const orders = getDemoOrders();
      customers = getDemoCustomers().map(c => {
        const userOrders = orders.filter(o => o.CustomerId === c.CustomerId || o.CustomerEmail === c.Email);
        return {
          CustomerId: c.CustomerId,
          FullName: c.FullName,
          Email: c.Email,
          Phone: c.Phone,
          DefaultAddress: c.DefaultAddress,
          CreatedAt: c.CreatedAt,
          LastLoginAt: c.LastLoginAt,
          TotalOrders: userOrders.length,
          TotalSpent: userOrders.reduce((s, o) => s + Number(o.TotalAmount || 0), 0),
          CartItemCount: 0
        };
      });
    } else {
      const token = getAdminToken();
      customers = await apiFetch('/admin/customers', { headers: authHeader(token) });
    }

    if (countEl) countEl.textContent = customers.length;

    if (!customers || customers.length === 0) {
      list.innerHTML = `<div class="empty-admin">// CHƯA CÓ NGƯỜI DÙNG ĐĂNG KÝ TRONG CSDL //</div>`;
      return;
    }

    list.innerHTML = customers.map(c => `
      <div class="order-card">
        <div class="order-card-head">
          <span class="order-id">KHÁCH HÀNG #${c.CustomerId} — ${escapeHtml(c.FullName)}</span>
          <span class="order-date">Đăng ký: ${new Date(c.CreatedAt).toLocaleString('vi-VN')}</span>
        </div>
        <div class="order-cust">
          📧 Email: <b>${escapeHtml(c.Email)}</b> · 📞 SĐT: <b>${escapeHtml(c.Phone)}</b><br>
          📍 Địa chỉ mặc định: ${c.DefaultAddress ? escapeHtml(c.DefaultAddress) : '<i>Chưa cập nhật</i>'}<br>
          🕒 Đăng nhập gần nhất: ${c.LastLoginAt ? new Date(c.LastLoginAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}
        </div>
        <div class="order-items">
          <div>
            <span>Số đơn hàng đã đặt: <b>${c.TotalOrders || 0} đơn</b></span>
            <span>Sản phẩm đang lưu trong giỏ CSDL: <b>${c.CartItemCount || 0}</b></span>
          </div>
        </div>
        <div class="order-total">TỔNG CHI TIÊU: ${formatVND(c.TotalSpent || 0)}</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-admin">// ${escapeHtml(err.message)} //</div>`;
  }
}

/* =========================================================
   BỘ LỌC, TÌM KIẾM & SẮP XẾP
========================================================= */
function resetAllFilters() {
  currentCategory = 'ALL';
  currentFilter = 'ALL';
  currentSearch = '';
  currentSort = 'default';

  document.getElementById('searchInput').value = '';
  document.getElementById('sortSelect').value = 'default';

  document.querySelectorAll('#categoryBar .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.category === 'ALL');
  });
  document.querySelectorAll('#filterBar .chip').forEach(c => {
    c.classList.toggle('active', c.dataset.grade === 'ALL');
  });

  renderProductGrid();
}

function setupFilterBar() {
  const bar = document.getElementById('filterBar');
  bar.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      bar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.grade;
      renderProductGrid();
    });
  });

  const catBar = document.getElementById('categoryBar');
  catBar.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      catBar.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      if (currentCategory === 'accessory') {
        currentFilter = 'ALL';
        bar.querySelectorAll('.chip').forEach(c => {
          c.classList.toggle('active', c.dataset.grade === 'ALL');
        });
      }
      renderProductGrid();
    });
  });

  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', () => {
    currentSearch = searchInput.value;
    renderProductGrid();
  });

  document.getElementById('clearSearchBtn')?.addEventListener('click', () => {
    currentSearch = '';
    searchInput.value = '';
    searchInput.focus();
    renderProductGrid();
  });

  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProductGrid();
  });

  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetAllFilters);
}

/* =========================================================
   KHỞI TẠO SỰ KIỆN & PHÍM TẮT ESC
========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
  loadCartFromStorage();
  setupFilterBar();
  updateAccountUI();
  await loadProducts();
  await syncLoggedInUserSession();

  // Menu Tài khoản & Hồ sơ
  document.getElementById('accountBtn').addEventListener('click', toggleAccountMenu);
  document.getElementById('profileBtn')?.addEventListener('click', openProfileModal);
  document.getElementById('closeProfile')?.addEventListener('click', closeProfileModal);
  document.getElementById('profileOverlay')?.addEventListener('click', closeProfileModal);
  document.getElementById('profileForm')?.addEventListener('submit', submitProfileUpdate);

  document.getElementById('myOrdersBtn').addEventListener('click', openMyOrders);
  document.getElementById('customerLogoutBtn').addEventListener('click', customerLogout);
  document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.account-wrap');
    if (wrap && !wrap.contains(e.target)) {
      document.getElementById('accountMenu').classList.remove('show');
    }
  });

  // Đăng nhập / Đăng ký khách hàng
  document.getElementById('closeAuth').addEventListener('click', closeAuth);
  document.getElementById('authOverlay').addEventListener('click', closeAuth);
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthMode(tab.dataset.mode));
  });
  document.getElementById('loginForm').addEventListener('submit', submitLogin);
  document.getElementById('registerForm').addEventListener('submit', submitRegister);

  // Đơn hàng của tôi
  document.getElementById('closeMyOrders').addEventListener('click', closeMyOrders);
  document.getElementById('myOrdersOverlay').addEventListener('click', closeMyOrders);

  // Xem chi tiết sản phẩm
  document.getElementById('closeDetail').addEventListener('click', closeProductDetail);
  document.getElementById('detailOverlay').addEventListener('click', closeProductDetail);

  // Giỏ hàng
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
  document.getElementById('clearCartBtn').addEventListener('click', clearCart);
  document.getElementById('checkoutBtn').addEventListener('click', openCheckoutFromCart);

  // Đặt hàng
  document.getElementById('closeCheckout').addEventListener('click', closeCheckout);
  document.getElementById('checkoutOverlay').addEventListener('click', closeCheckout);
  document.getElementById('checkoutForm').addEventListener('submit', submitOrder);

  // Admin
  document.getElementById('adminBtn').addEventListener('click', openAdminLogin);
  document.getElementById('closeAdminLogin').addEventListener('click', closeAdminLogin);
  document.getElementById('adminLoginOverlay').addEventListener('click', closeAdminLogin);
  document.getElementById('adminLoginForm').addEventListener('submit', submitAdminLogin);

  document.getElementById('closeAdmin').addEventListener('click', closeAdminPanel);
  document.getElementById('adminOverlay').addEventListener('click', closeAdminPanel);
  document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
  });

  document.getElementById('productForm').addEventListener('submit', saveProduct);
  document.getElementById('cancelEditBtn').addEventListener('click', resetProductForm);
  document.getElementById('pCategory').addEventListener('change', toggleProductCategoryFields);

  // Đóng Modal / Drawer nhanh bằng phím Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('checkoutModal').classList.contains('show')) {
      closeCheckout();
    } else if (document.getElementById('profileModal')?.classList.contains('show')) {
      closeProfileModal();
    } else if (document.getElementById('detailModal').classList.contains('show')) {
      closeProductDetail();
    } else if (document.getElementById('authModal').classList.contains('show')) {
      closeAuth();
    } else if (document.getElementById('myOrdersModal').classList.contains('show')) {
      closeMyOrders();
    } else if (document.getElementById('adminLoginModal').classList.contains('show')) {
      closeAdminLogin();
    } else if (document.getElementById('cartDrawer').classList.contains('show')) {
      closeCart();
    } else if (document.getElementById('adminPanel').classList.contains('show')) {
      closeAdminPanel();
    }
  });
});
