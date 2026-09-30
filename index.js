/* ==========================================
   إلكترو يوسف - index.js
   منطق الصفحة الرئيسية للمتجر (يعتمد على script.js)
   ========================================== */

const SHOP_CACHE_KEY = "electro_shop_products";
const SKELETON_COUNT = 6;
const PAGE_SIZE = 12; // عدد المنتجات في كل دفعة (أخف وأسلس على الهاتف)

// ---------- دوال مساعدة ----------

// توحيد النص العربي للبحث (إزالة التشكيل وتوحيد الهمزات)
function normalizeText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

// الكاش الدائم في المتصفح: تظهر المنتجات فورًا في الزيارة التالية
function loadShopCache() {
  try {
    const list = JSON.parse(localStorage.getItem(SHOP_CACHE_KEY));
    return Array.isArray(list) ? list : null;
  } catch (e) { return null; }
}

function saveShopCache(list) {
  try { localStorage.setItem(SHOP_CACHE_KEY, JSON.stringify(list)); } catch (e) { /* تجاهل */ }
}

function skeletonHtml() {
  const card = '<div class="shop-card skeleton" aria-hidden="true"><div class="shop-img"></div>' +
    '<div class="shop-body"><span class="skel-line"></span><span class="skel-line short"></span></div></div>';
  return new Array(SKELETON_COUNT + 1).join(card);
}

// ---------- منطق الصفحة ----------

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  const grid = $("shopGrid");
  if (!grid) return;

  let products = []; // كل المنتجات
  let list = [];     // نتيجة البحث الحالية
  let shown = 0;     // عدد البطاقات المعروضة
  let query = "";

  // ----- الحالات (فارغ / خطأ / لا نتائج) -----
  function showState(html) {
    const st = $("shopState");
    st.innerHTML = html;
    st.hidden = !html;
  }

  function updateMore() {
    $("shopMore").hidden = shown >= list.length;
  }

  // ----- العرض: أول دفعة ثم المزيد عند التمرير -----
  function render() {
    const q = normalizeText(query);
    list = q ? products.filter(p => normalizeText(p.name).indexOf(q) >= 0) : products;
    shown = Math.min(PAGE_SIZE, list.length);

    $("shopCount").textContent = products.length ? list.length + " منتج" : "";
    grid.innerHTML = list.slice(0, shown).map(productCardHtml).join("");
    updateMore();

    if (!products.length) {
      showState("لا توجد منتجات حاليًا، عُد قريبًا.");
    } else if (!list.length) {
      showState('لا توجد نتائج مطابقة لبحثك.<br><button type="button" class="btn btn-dark btn-sm" id="clearSearch">عرض كل المنتجات</button>');
    } else {
      showState("");
    }
  }

  function showMore() {
    if (shown >= list.length) return;
    const next = Math.min(shown + PAGE_SIZE, list.length);
    const start = shown;
    grid.insertAdjacentHTML("beforeend",
      list.slice(start, next).map((p, i) => productCardHtml(p, start + i)).join(""));
    shown = next;
    updateMore();
  }

  $("moreBtn").addEventListener("click", showMore);

  // تحميل الدفعة التالية تلقائيًا قبل الوصول لنهاية القائمة
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) showMore();
    }, { rootMargin: "600px" }).observe($("shopMore"));
  }

  // إذا فشل تحميل صورة نعرض نص "لا توجد صورة" (مستمع واحد لكل البطاقات)
  grid.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") {
      e.target.parentElement.classList.add("no-img");
      e.target.remove();
    }
  }, true);

  // أزرار داخل رسائل الحالة
  $("shopState").addEventListener("click", (e) => {
    if (e.target.id === "retryBtn") loadProducts();
    if (e.target.id === "clearSearch") {
      $("searchInput").value = "";
      query = "";
      render();
    }
  });

  // ----- التحميل: يعرض النسخة المحفوظة فورًا ثم يحدّثها -----
  async function loadProducts() {
    const cached = loadShopCache();
    if (cached) {
      products = cached;
      render();
    } else {
      showState("");
      grid.innerHTML = skeletonHtml();
    }

    try {
      // قائمة خفيفة بدون الوصف الطويل، والخادم يعيد المنتجات النشطة فقط
      const fresh = (await apiGet({ action: "products", light: "1" }))
        .filter(p => p.status === "active");
      if (!cached || JSON.stringify(fresh) !== JSON.stringify(cached)) {
        products = fresh;
        render();
      }
      saveShopCache(fresh);
    } catch (err) {
      if (!cached) {
        grid.innerHTML = "";
        $("shopCount").textContent = "";
        $("shopMore").hidden = true;
        showState('حدث خطأ أثناء تحميل المنتجات<br><button type="button" class="btn btn-dark btn-sm" id="retryBtn">إعادة المحاولة</button>');
      }
    }
  }

  // ----- القائمة والبحث (منسدلان على الهاتف) -----
  const nav = $("mainNav");
  const panel = $("searchPanel");
  const menuBtn = $("menuToggle");
  const searchBtn = $("searchToggle");
  const input = $("searchInput");

  function applyNav(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.textContent = open ? "✕" : "☰";
  }

  function applySearch(open) {
    panel.classList.toggle("open", open);
    searchBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function closePanels() { applyNav(false); applySearch(false); }

  menuBtn.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    applyNav(open);
    if (open) applySearch(false);
  });

  searchBtn.addEventListener("click", () => {
    const open = !panel.classList.contains("open");
    applySearch(open);
    if (open) { applyNav(false); setTimeout(() => input.focus(), 60); }
  });

  nav.addEventListener("click", (e) => { if (e.target.closest("a")) closePanels(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanels(); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".site-header")) closePanels();
  });

  // البحث المباشر أثناء الكتابة
  let searchTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query = e.target.value; render(); }, 150);
  });

  $("searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    query = input.value;
    render();
    input.blur();
    closePanels();
    $("products").scrollIntoView({ behavior: "smooth" });
  });

  // ----- زر العودة للأعلى -----
  const toTop = $("toTop");
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      toTop.classList.toggle("show", window.scrollY > 700);
      ticking = false;
    });
  }, { passive: true });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  $("year").textContent = new Date().getFullYear();
  loadProducts();
});
