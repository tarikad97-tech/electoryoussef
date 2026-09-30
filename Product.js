/* ==========================================
   إلكترو يوسف - Product.js
   صفحة تفاصيل المنتج + نموذج الطلب (يعتمد على Script.js)
   ========================================== */

const PRODUCT_CACHE_PREFIX = "electro_product_";
const SHOP_LIST_KEY = "electro_shop_products";  // نفس مفتاح Index.js
const LAST_ORDER_KEY = "electro_last_order";    // تقرأه صفحة Thanks.html لاحقًا
const MAX_QTY = 100;
const RELATED_MAX = 6;

// ---------- دوال مساعدة ----------

function readJson(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
}

// نسبة التخفيض إن وُجد سعر قديم أعلى من الحالي
function calcDiscount(p) {
  const price = Number(p.price);
  const old = Number(p.oldPrice);
  if (!(old > price) || !(price > 0)) return 0;
  return Math.round((1 - price / old) * 100);
}

// أرقام المغرب: 05/06/07 + 8 أرقام، أو بالصيغة الدولية +212 (يعيد "" إن لم يصلح)
function normalizeMoroccanPhone(raw) {
  const v = String(raw || "").replace(/[\s\-\.\(\)]/g, "").replace(/^(\+212|00212)/, "0");
  return /^0[5-7]\d{8}$/.test(v) ? v : "";
}

// نص الوصف (فقرات) ثم صور GIF
function descriptionHtml(desc) {
  const d = splitDescription(desc);
  const text = d.text
    ? d.text.split(/\n{2,}/).map(t => t.trim()).filter(Boolean)
        .map(t => "<p>" + esc(t).replace(/\n/g, "<br>") + "</p>").join("")
    : "";
  const gifs = d.gifs.length
    ? '<div class="desc-gifs">' + d.gifs.map(u =>
        '<img class="desc-gif" data-src="' + esc(u) + '" alt="" decoding="async">').join("") + "</div>"
    : "";
  return text + gifs;
}

// بطاقة منتج مقترح
function relatedCardHtml(p) {
  const href = "Product.html?id=" + encodeURIComponent(p.id);
  const hasImg = /^https?:\/\//i.test(p.image1 || "");
  return '<a class="rcard" href="' + href + '">' +
    '<span class="rimg' + (hasImg ? "" : " no-img") + '">' +
      (hasImg ? '<img src="' + esc(imgUrl(p.image1, 300)) + '" alt="" width="300" height="300" loading="lazy" decoding="async">' : "") +
    "</span>" +
    '<span class="rname">' + esc(p.name) + "</span>" +
    '<span class="rprice">' + formatMoney(p.price) + "</span>" +
  "</a>";
}

// ---------- منطق الصفحة ----------

document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);
  if (!$("productView")) return;

  const id = new URLSearchParams(location.search).get("id");
  const form = $("orderForm");
  const qtyInput = $("qtyInput");
  const orderBtn = $("oBtn");

  let product = null;   // المنتج المعروض
  let images = [];      // روابط صور المنتج
  let maxQty = 0;       // أقصى كمية مسموحة (حسب المخزون)
  let sending = false;  // منع الإرسال المزدوج
  let galleryKey = "";  // لتجنب إعادة بناء المعرض دون داعٍ
  let galleryObserver = null;
  let lbObserver = null;
  let orderInView = false;
  let relatedDone = false;
  let lastKey = "";     // لتجنب إعادة الرسم (وميض) إذا لم تتغير البيانات
  let gifObserver = null;

  $("year").textContent = new Date().getFullYear();

  // ----- الحالات: خطأ / غير موجود -----
  function showError(msg, withRetry) {
    $("pSkeleton").hidden = true;
    lastKey = "";
    $("productView").hidden = true;
    $("related").hidden = true;
    $("buyBar").classList.remove("show");
    $("pState").innerHTML = esc(msg) + "<br>" +
      (withRetry ? '<button type="button" class="btn btn-dark btn-sm" id="retryBtn">إعادة المحاولة</button> ' : "") +
      '<a class="btn btn-gold btn-sm" href="Index.html#products">العودة إلى المتجر</a>';
    $("pState").hidden = false;
  }

  $("pState").addEventListener("click", (e) => {
    if (e.target.id === "retryBtn") { $("pState").hidden = true; $("pSkeleton").hidden = false; load(); }
  });

  // ----- معرض الصور -----
  function setActive(i) {
    $("gThumbs").querySelectorAll(".gthumb").forEach((b, j) => b.classList.toggle("active", i === j));
    $("gDots").querySelectorAll("i").forEach((d, j) => d.classList.toggle("active", i === j));
    $("gCount").textContent = (i + 1) + " / " + images.length;
  }

  function buildGallery(list, name) {
    const key = list.join("|");
    if (key === galleryKey) return;
    galleryKey = key;
    images = list;

    $("gTrack").innerHTML = images.length
      ? images.map((u, i) =>
          '<div class="gslide"><img src="' + esc(imgUrl(u, 800)) + '" alt="' + esc(name) +
          '" width="800" height="800" ' + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') +
          ' decoding="async"></div>').join("")
      : '<div class="gslide no-img"></div>';

    const many = images.length > 1;
    $("gThumbs").innerHTML = many
      ? images.map((u, i) =>
          '<button type="button" class="gthumb" data-i="' + i + '" aria-label="الصورة ' + (i + 1) +
          '"><img src="' + esc(imgUrl(u, 120)) + '" alt="" width="64" height="64" loading="lazy"></button>').join("")
      : "";
    $("gDots").innerHTML = many ? images.map(() => "<i></i>").join("") : "";
    $("gCount").hidden = !many;
    $("gZoom").hidden = !images.length;
    if (images.length) setActive(0);

    // تحديث المؤشرات عند السحب (لا يتأثر باتجاه RTL)
    if (galleryObserver) galleryObserver.disconnect();
    if ("IntersectionObserver" in window && many) {
      galleryObserver = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) setActive(Array.prototype.indexOf.call($("gTrack").children, en.target));
        });
      }, { root: $("gTrack"), threshold: 0.6 });
      Array.prototype.forEach.call($("gTrack").children, s => galleryObserver.observe(s));
    }
  }

  $("gThumbs").addEventListener("click", (e) => {
    const b = e.target.closest(".gthumb");
    if (!b) return;
    $("gTrack").children[Number(b.dataset.i)]
      .scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  });

  // إذا فشل تحميل صورة نعرض مكانها فارغًا بدل أيقونة مكسورة
  $("gTrack").addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") {
      e.target.parentElement.classList.add("no-img");
      e.target.remove();
    }
  }, true);

  // ----- عرض الصورة بملء الشاشة (تكبير) -----
  const lb = $("lightbox");
  const lbTrack = $("lbTrack");

  function openLightbox(i) {
    lbTrack.innerHTML = images.map(u =>
      '<div class="lb-slide"><img src="' + esc(imgUrl(u, 1400)) + '" alt="" decoding="async"></div>').join("");
    lb.hidden = false;
    document.body.classList.add("no-scroll");
    lbTrack.children[i].scrollIntoView({ inline: "center", block: "nearest" });
    $("lbCount").textContent = images.length > 1 ? (i + 1) + " / " + images.length : "";

    if (lbObserver) lbObserver.disconnect();
    if ("IntersectionObserver" in window && images.length > 1) {
      lbObserver = new IntersectionObserver((entries) => {
        entries.forEach(en => {
          if (en.isIntersecting) {
            const n = Array.prototype.indexOf.call(lbTrack.children, en.target);
            $("lbCount").textContent = (n + 1) + " / " + images.length;
          }
        });
      }, { root: lbTrack, threshold: 0.6 });
      Array.prototype.forEach.call(lbTrack.children, s => lbObserver.observe(s));
    }
    $("lbClose").focus();
  }

  function closeLightbox() {
    if (lb.hidden) return;
    lb.hidden = true;
    lbTrack.innerHTML = "";
    document.body.classList.remove("no-scroll");
    if (lbObserver) lbObserver.disconnect();
  }

  $("gTrack").addEventListener("click", (e) => {
    const slide = e.target.closest(".gslide");
    if (!slide || slide.classList.contains("no-img")) return;
    openLightbox(Array.prototype.indexOf.call($("gTrack").children, slide));
  });
  $("lbClose").addEventListener("click", closeLightbox);
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target === lbTrack || e.target.classList.contains("lb-slide")) closeLightbox();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  // ----- مشاركة المنتج (الهواتف التي تدعمها) -----
  if (navigator.share) {
    $("shareBtn").hidden = false;
    $("shareBtn").addEventListener("click", () => {
      if (!product) return;
      navigator.share({ title: product.name, text: product.name, url: location.href }).catch(() => {});
    });
  }

  // ----- الكمية والمجموع -----
  function currentQty() {
    const n = parseInt(qtyInput.value, 10);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function updateTotal() {
    $("oTotal").textContent = formatMoney(product ? Number(product.price) * currentQty() : 0);
    syncBuyBar();
  }

  function setQty(n) {
    qtyInput.value = String(n);
    updateTotal();
  }

  $("qtyMinus").addEventListener("click", () => setQty(Math.max(1, (currentQty() || 1) - 1)));
  $("qtyPlus").addEventListener("click", () => setQty(Math.min(Math.max(maxQty, 1), (currentQty() || 0) + 1)));
  qtyInput.addEventListener("input", updateTotal);
  qtyInput.addEventListener("blur", () => {
    const n = currentQty();
    setQty(n < 1 ? 1 : Math.min(n, Math.max(maxQty, 1)));
  });

  // GIF تُحمَّل عندما تقترب من الشاشة فقط (ملفاتها ثقيلة)
  function activateGifs() {
    const imgs = $("pDescBody").querySelectorAll("img[data-src]");
    if (!imgs.length) return;
    const load = (img) => {
      img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
      img.addEventListener("error", () => img.remove(), { once: true });
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    };
    if (!("IntersectionObserver" in window)) { imgs.forEach(load); return; }
    if (gifObserver) gifObserver.disconnect();
    gifObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(en => {
        if (en.isIntersecting) { obs.unobserve(en.target); load(en.target); }
      });
    }, { rootMargin: "250px 0px" });
    imgs.forEach(i => gifObserver.observe(i));
  }

  // ----- عرض المنتج -----
  function setFormEnabled(enabled) {
    Array.prototype.forEach.call(form.elements, el => { el.disabled = !enabled; });
  }

  // الشريط الثابت أسفل الشاشة: يظهر دائمًا. خارج النموذج = "اطلب الآن" (ينقلك للنموذج)،
  // وعند ظهور النموذج = "تأكيد الطلب" (يرسل الطلب مباشرة).
  function syncBuyBar() {
    const bar = $("buyBar");
    bar.classList.toggle("show", !!product);
    if (!product) return;
    const out = maxQty <= 0;
    const btn = $("bbBtn");
    btn.disabled = out || sending;
    btn.textContent = out ? "نفد المخزون" : sending ? "جاري الإرسال..." : orderInView ? "تأكيد الطلب" : "اطلب الآن";
    $("bbPrice").textContent = formatMoney(Number(product.price) * (currentQty() || 1));
  }

  function render(p, full) {
    const key = (full ? "1" : "0") + JSON.stringify(p);
    if (key === lastKey) return; // لا تغيير: لا حاجة لإعادة الرسم
    lastKey = key;
    product = p;
    $("pSkeleton").hidden = true;
    $("pState").hidden = true;
    $("productView").hidden = false;

    document.title = p.name + " | إلكترو يوسف";
    $("crumbName").textContent = p.name;
    $("pTitle").textContent = p.name;
    $("pPrice").textContent = formatMoney(p.price);
    $("bbPrice").textContent = formatMoney(p.price);
    $("osName").textContent = p.name;
    $("osPrice").textContent = formatMoney(p.price);

    const off = calcDiscount(p);
    $("pOld").hidden = !off;
    $("pOff").hidden = !off;
    $("pSave").hidden = !off;
    if (off) {
      $("pOld").textContent = formatMoney(p.oldPrice);
      $("pOff").textContent = "خصم " + off + "%";
      $("pSave").textContent = "وفّرت " + formatMoney(Number(p.oldPrice) - Number(p.price));
    }

    // الحالة والمخزون
    const stock = Math.max(0, Math.floor(Number(p.stock) || 0));
    const out = stock <= 0;
    $("pStatus").textContent = out ? "نفد المخزون" : "متوفر";
    $("pStatus").className = "pill " + (out ? "out" : "in");
    $("pStock").textContent = "المخزون: " + stock + " قطعة";

    // الصور
    const imgs = [p.image1, p.image2, p.image3, p.image4].filter(u => /^https?:\/\//i.test(u || ""));
    buildGallery(imgs, p.name);
    const os = $("osImg");
    os.hidden = !imgs.length;
    if (imgs.length) os.src = imgUrl(imgs[0], 120);

    // الوصف (في النسخة الأولية من القائمة لا يوجد وصف بعد)
    if (!full) {
      $("pDesc").hidden = false;
      $("pDescBody").innerHTML = '<div class="dskel"><span class="skel-line"></span><span class="skel-line"></span><span class="skel-line short"></span></div>';
    } else {
      const html = descriptionHtml(p.description);
      $("pDesc").hidden = !html;
      $("pDescBody").innerHTML = html;
      activateGifs();
    }

    // الكمية القصوى وتفعيل/تعطيل النموذج
    maxQty = Math.min(MAX_QTY, stock);
    if (currentQty() > maxQty && maxQty > 0) qtyInput.value = String(maxQty);
    updateTotal();

    if (out) {
      setFormEnabled(false);
      orderBtn.textContent = "نفد المخزون";
      showMsg("هذا المنتج غير متوفر حاليًا.", "info");
    } else if (!sending) {
      setFormEnabled(true);
      orderBtn.textContent = "تأكيد الطلب";
      if ($("oMsg").classList.contains("info")) $("oMsg").hidden = true;
    }
    syncBuyBar();
    loadRelated();
  }

  // ----- منتجات مقترحة (من كاش الصفحة الرئيسية، أو طلب واحد خفيف) -----
  function loadRelated() {
    if (relatedDone) return;
    relatedDone = true;
    const later = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 500));
    later(doLoadRelated);
  }

  async function doLoadRelated() {
    let list = readJson(localStorage, SHOP_LIST_KEY);
    if (!Array.isArray(list)) {
      try {
        list = (await apiGet({ action: "products", light: "1" })).filter(p => p.status === "active");
        try { localStorage.setItem(SHOP_LIST_KEY, JSON.stringify(list)); } catch (e) { /* تجاهل */ }
      } catch (e) { return; }
    }
    const others = list.filter(p => String(p.id) !== String(id));
    const inStock = others.filter(p => Number(p.stock) > 0);
    const pick = (inStock.length ? inStock : others).slice(0, RELATED_MAX);
    if (!pick.length) return;
    $("relatedTrack").innerHTML = pick.map(relatedCardHtml).join("");
    $("related").hidden = false;
  }

  $("relatedTrack").addEventListener("error", (e) => {
    if (e.target.tagName === "IMG") {
      e.target.parentElement.classList.add("no-img");
      e.target.remove();
    }
  }, true);

  // ----- رسائل ونموذج الطلب -----
  function showMsg(text, type) {
    const box = $("oMsg");
    box.textContent = text;
    box.className = "omsg " + type;
    box.hidden = false;
  }

  function setFieldError(name, msg) {
    const err = form.querySelector('.ferr[data-for="' + name + '"]');
    if (err) err.textContent = msg || "";
    form.elements[name].classList.toggle("is-invalid", !!msg);
  }

  function clearErrors() {
    ["customerName", "phone", "city", "address", "quantity"].forEach(n => setFieldError(n, ""));
    if (!$("oMsg").classList.contains("info")) $("oMsg").hidden = true;
  }

  form.addEventListener("input", (e) => {
    if (e.target.name) setFieldError(e.target.name, "");
  });

  function validateOrder(v) {
    const errors = {};
    if (!v.customerName) errors.customerName = "يرجى إدخال الاسم الكامل";
    if (!v.phone) errors.phone = "يرجى إدخال رقم الهاتف";
    else if (!normalizeMoroccanPhone(v.phone)) errors.phone = "رقم الهاتف غير صحيح (مثال: 0612345678)";
    if (!v.city) errors.city = "يرجى إدخال المدينة";
    if (!v.address) errors.address = "يرجى إدخال العنوان";
    if (!(v.quantity > 0)) errors.quantity = "الكمية غير صحيحة";
    else if (v.quantity > maxQty) errors.quantity = "الكمية المطلوبة غير متوفرة";
    return errors;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending || !product) return;
    clearErrors();

    const v = {
      customerName: form.elements.customerName.value.trim(),
      phone: form.elements.phone.value.trim(),
      city: form.elements.city.value.trim(),
      address: form.elements.address.value.trim(),
      quantity: currentQty()
    };

    const errors = validateOrder(v);
    const names = Object.keys(errors);
    if (names.length) {
      names.forEach(n => setFieldError(n, errors[n]));
      showMsg("يرجى ملء جميع الحقول", "error");
      form.elements[names[0]].focus();
      return;
    }

    sending = true;
    setFormEnabled(false);
    orderBtn.textContent = "جاري إرسال الطلب...";
    syncBuyBar();

    try {
      const res = await apiPost({
        action: "addOrder",
        productId: product.id,
        customerName: v.customerName,
        phone: normalizeMoroccanPhone(v.phone),
        city: v.city,
        address: v.address,
        quantity: v.quantity
      });
      // بيانات بسيطة تعرضها صفحة الشكر لاحقًا
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({
          id: res.id,
          product: product.name,
          quantity: v.quantity,
          total: Number(product.price) * v.quantity
        }));
      } catch (err) { /* تجاهل */ }
      showMsg("تم إرسال طلبك بنجاح", "success");
      orderBtn.textContent = "تم إرسال طلبك بنجاح";
      location.href = "Thanks.html"; // يبقى النموذج معطلًا لمنع تكرار الطلب
    } catch (err) {
      sending = false;
      setFormEnabled(maxQty > 0);
      orderBtn.textContent = "تأكيد الطلب";
      showMsg(err.message || "حدث خطأ أثناء إرسال الطلب", "error");
      syncBuyBar();
    }
  });

  // ----- شريط الطلب السريع على الهاتف -----
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      orderInView = entries[0].isIntersecting;
      syncBuyBar();
    }, { threshold: 0.12 }).observe($("orderBox"));
  }
  // الانتقال المباشر (بدون تمرير بطيء) إلى نموذج الطلب
  function jumpToOrder() {
    const headerH = document.querySelector(".site-header").offsetHeight + 8;
    const top = $("orderBox").getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  $("bbBtn").addEventListener("click", () => {
    if (orderInView) {
      if (form.requestSubmit) form.requestSubmit(); else orderBtn.click();
    } else {
      jumpToOrder();
    }
  });

  // ----- التحميل: نسخة محفوظة فورًا ثم تحديث من الخادم -----
  async function load() {
    if (!id) { showError("المنتج غير موجود"); return; }

    const cacheKey = PRODUCT_CACHE_PREFIX + id;
    const full = readJson(localStorage, cacheKey);
    let shown = false;
    if (full && full.id !== undefined) {
      render(full, true);
      shown = true;
    } else {
      // من قائمة الصفحة الرئيسية (بدون الوصف بعد) لعرض فوري
      const list = readJson(localStorage, SHOP_LIST_KEY);
      const partial = Array.isArray(list) ? list.find(p => String(p.id) === String(id)) : null;
      if (partial) { render(partial, false); shown = true; }
    }

    try {
      const fresh = await apiGet({ action: "product", id: id });
      try { localStorage.setItem(cacheKey, JSON.stringify(fresh)); } catch (e) { /* تجاهل */ }
      render(fresh, true);
    } catch (err) {
      if (err.message === "المنتج غير موجود") {
        try { localStorage.removeItem(cacheKey); } catch (e) { /* تجاهل */ }
        showError("المنتج غير موجود");
      } else if (!shown) {
        showError("حدث خطأ أثناء تحميل المنتج", true);
      }
    }
  }

  load();
});