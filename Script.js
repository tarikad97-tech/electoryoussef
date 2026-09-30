/* ==========================================
   إلكترو يوسف - Script.js
   الإعدادات + الاتصال بالـ API + الجلسة + لوحة التحكم + المنتجات + رفع الصور
   ========================================== */

// ---------- الإعدادات (غيّر الرابط من هنا فقط) ----------
const API_URL = "https://script.google.com/macros/s/AKfycbyESdtw_rV1z2n-ZB2wQztbkrKX_llKpg-SV4uSO8reGr1SfBfJurXjWLl_YBgzVwGckQ/exec";
const SESSION_KEY = "electro_admin_session";
const SESSION_HOURS = 6; // يجب ألا تزيد عن مدة الجلسة في Apps Script
/* =========================================================
   
/* =========================================================
   إلكترو يوسف - Script.js
   لوحة التحكم + API + الجلسة + المنتجات + الطلبات
   + رفع الصور من الهاتف والكمبيوتر
   ========================================================= */


/* =========================================================
   الإعدادات
   ========================================================= */




// ضغط الصور قبل الرفع
const IMAGE_MAX_SIDE = 1000;
const IMAGE_QUALITY = 0.82;

const IMAGE_KEYS = [
  "image1",
  "image2",
  "image3",
  "image4"
];


// GIF
const MAX_GIFS = 8;
const GIF_MAX_BYTES = 5 * 1024 * 1024;


// حالات الطلبات
const ORDER_STATUS_LABELS = {
  new: "جديد",
  confirmed: "مؤكد",
  shipped: "تم الإرسال",
  delivered: "تم التوصيل",
  cancelled: "ملغى"
};


// حالات المنتجات
const PRODUCT_STATUS_LABELS = {
  active: "نشط",
  inactive: "غير نشط"
};


// حقول المنتج
const PRODUCT_FIELDS = [
  "name",
  "price",
  "oldPrice",
  "image1",
  "image2",
  "image3",
  "image4",
  "description",
  "stock",
  "status"
];


/* =========================================================
   أدوات عامة
   ========================================================= */

function esc(v) {
  return String(v == null ? "" : v).replace(
    /[&<>"']/g,
    function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[c];
    }
  );
}


function formatMoney(n) {
  return (
    (Number(n) || 0).toLocaleString("en-US") +
    " د.م"
  );
}


function imgUrl(url, width) {
  url = String(url || "");

  if (
    url.indexOf("lh3.googleusercontent.com/d/") > -1 &&
    !/=[whs]\d/i.test(url)
  ) {
    return url + "=w" + width;
  }

  return url;
}


/* =========================================================
   الوصف + GIF
   ========================================================= */

function splitDescription(desc) {
  const gifs = [];

  const text = String(desc || "")
    .replace(
      /\[\[gif:(https?:\/\/[^\]\s]+)\]\]/g,
      function (m, url) {
        gifs.push(url);
        return "";
      }
    )
    .trim();

  return {
    text: text,
    gifs: gifs
  };
}


function joinDescription(text, gifs) {
  return [String(text || "").trim()]
    .concat(
      (gifs || []).map(function (u) {
        return "[[gif:" + u + "]]";
      })
    )
    .filter(Boolean)
    .join("\n\n");
}


/* =========================================================
   File -> Base64
   ========================================================= */

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      const result = String(reader.result || "");

      const parts = result.split(",");

      if (parts.length < 2) {
        reject(new Error("تعذر قراءة الملف"));
        return;
      }

      resolve(parts[1]);
    };

    reader.onerror = function () {
      reject(new Error("تعذر قراءة الملف"));
    };

    reader.readAsDataURL(file);
  });
}


/* =========================================================
   نسبة التخفيض
   ========================================================= */

function discountPercent(p) {
  const price = Number(p.price);
  const old = Number(p.oldPrice);

  if (!(old > price) || !(price > 0)) {
    return 0;
  }

  return Math.round((1 - price / old) * 100);
}


/* =========================================================
   بطاقة المنتج في المتجر
   ========================================================= */

function productCardHtml(p, index) {
  const href =
    "Product.html?id=" +
    encodeURIComponent(p.id);

  const hasImg =
    /^https?:\/\//i.test(p.image1 || "");

  const off = discountPercent(p);

  const out =
    !(Number(p.stock) > 0);

  const wasPrice =
    off
      ? '<span class="shop-was">' +
        formatMoney(p.oldPrice) +
        "</span>"
      : "";

  const loading =
    index < 4
      ? ""
      : ' loading="lazy"';

  return (
    '<article class="shop-card' +
    (out ? " is-out" : "") +
    '">' +

      '<a class="shop-img' +
      (hasImg ? "" : " no-img") +
      '" href="' +
      href +
      '" tabindex="-1" aria-hidden="true">' +

        (
          hasImg
            ? '<img src="' +
              esc(imgUrl(p.image1, 400)) +
              '" alt="' +
              esc(p.name) +
              '" width="400" height="400"' +
              loading +
              ' decoding="async">'
            : ""
        ) +

        (
          off
            ? '<span class="shop-off">خصم ' +
              off +
              "%</span>"
            : ""
        ) +

      "</a>" +

      '<div class="shop-body">' +

        '<h3 class="shop-name">' +
          '<a href="' +
          href +
          '">' +
          esc(p.name) +
          "</a>" +
        "</h3>" +

        '<div class="shop-price">' +
          '<span class="shop-now">' +
            formatMoney(p.price) +
          "</span>" +
          wasPrice +
        "</div>" +

        '<div class="shop-stock ' +
        (out ? "is-out" : "is-in") +
        '">' +
        (out ? "نفد المخزون" : "متوفر") +
        "</div>" +

        '<a class="btn btn-gold shop-btn" href="' +
        href +
        '">' +
        "عرض المنتج" +
        "</a>" +

      "</div>" +

    "</article>"
  );
}


/* =========================================================
   Cache
   ========================================================= */

function cacheSave(key, value) {
  try {
    sessionStorage.setItem(
      "electro_" + key,
      JSON.stringify(value)
    );
  } catch (e) {}
}


function cacheLoad(key) {
  try {
    return JSON.parse(
      sessionStorage.getItem("electro_" + key)
    );
  } catch (e) {
    return null;
  }
}


function cacheClearAll() {
  try {
    Object.keys(sessionStorage)
      .filter(function (k) {
        return k.indexOf("electro_") === 0;
      })
      .forEach(function (k) {
        sessionStorage.removeItem(k);
      });
  } catch (e) {}
}


/* =========================================================
   API
   ========================================================= */

async function parseResponse(res) {
  const text = await res.text();

  let json;

  try {
    json = JSON.parse(text);
  } catch (e) {
    console.error(
      "رد غير متوقع من الخادم:",
      res.status,
      text.slice(0, 1000)
    );

    throw new Error(
      "حدث خطأ في الاتصال بالخادم"
    );
  }


  if (!json.success) {
    const message =
      json.message ||
      json.error ||
      "حدث خطأ";

    const err = new Error(message);

    err.auth =
      /انتهت الجلسة|الجلسة|token|تسجيل الدخول/i.test(
        message
      );

    throw err;
  }


  return json.data;
}


async function apiGet(params) {
  try {
    const url =
      API_URL +
      "?" +
      new URLSearchParams(params).toString();

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store"
    });

    return await parseResponse(res);

  } catch (e) {
    throw normalizeError(e);
  }
}


async function apiPost(body) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type":
          "text/plain;charset=utf-8"
      },
      body: JSON.stringify(body)
    });

    return await parseResponse(res);

  } catch (e) {
    throw normalizeError(e);
  }
}


function normalizeError(e) {
  if (
    e instanceof TypeError ||
    String(e.message || "").includes(
      "Failed to fetch"
    )
  ) {
    return new Error(
      "تعذر الاتصال بالخادم، تحقق من الإنترنت"
    );
  }

  return e;
}


/* =========================================================
   الجلسة
   ========================================================= */

function saveSession(data) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: data.token,
      username: data.username,
      expires:
        Date.now() +
        SESSION_HOURS * 3600 * 1000
    })
  );
}


function getSession() {
  try {
    const s = JSON.parse(
      localStorage.getItem(SESSION_KEY)
    );

    if (
      s &&
      s.token &&
      s.expires > Date.now()
    ) {
      return s;
    }

  } catch (e) {}

  localStorage.removeItem(
    SESSION_KEY
  );

  return null;
}


function clearSession() {
  localStorage.removeItem(
    SESSION_KEY
  );

  cacheClearAll();
}


function authParams(action) {
  const s = getSession();

  if (!s) {
    const err = new Error(
      "انتهت الجلسة، يرجى تسجيل الدخول من جديد"
    );

    err.auth = true;

    throw err;
  }

  return {
    action: action,
    token: s.token
  };
}


/* =========================================================
   Login / Logout
   ========================================================= */

async function login(username, password) {
  const data = await apiPost({
    action: "login",
    username: username,
    password: password
  });

  saveSession(data);

  return data;
}


function logout() {
  clearSession();
  location.reload();
}


/* =========================================================
   المنتجات والطلبات
   ========================================================= */

function getProducts() {
  return apiGet(
    Object.assign(
      authParams("products"),
      { light: "1" }
    )
  );
}


function getProduct(id) {
  return apiGet(
    Object.assign(
      authParams("product"),
      { id: id }
    )
  );
}


function getOrders() {
  return apiGet(
    authParams("orders")
  );
}


function getDashboard() {
  return apiGet(
    authParams("dashboard")
  );
}


function updateOrder(id, status) {
  return apiPost(
    Object.assign(
      {},
      authParams("updateOrder"),
      {
        id: id,
        status: status
      }
    )
  );
}


function deleteOrder(id) {
  return apiPost(
    Object.assign(
      {},
      authParams("deleteOrder"),
      {
        id: id
      }
    )
  );
}


function addProduct(product) {
  return apiPost(
    Object.assign(
      {},
      authParams("addProduct"),
      product
    )
  );
}


function updateProduct(id, product) {
  return apiPost(
    Object.assign(
      {},
      authParams("updateProduct"),
      {
        id: id
      },
      product
    )
  );
}


function deleteProduct(id) {
  return apiPost(
    Object.assign(
      {},
      authParams("deleteProduct"),
      {
        id: id,
        hard: true
      }
    )
  );
}


function setProductStatus(id, status) {
  return apiPost(
    Object.assign(
      {},
      authParams("setProductStatus"),
      {
        id: id,
        status: status
      }
    )
  );
}


function uploadImage(base64, mime) {
  return apiPost(
    Object.assign(
      {},
      authParams("uploadImage"),
      {
        data: base64,
        mime: mime
      }
    )
  );
}


/* =========================================================
   التحقق من المنتج
   ========================================================= */

function validateProduct(v) {
  if (!v.name || !v.price) {
    return "يرجى ملء جميع الحقول";
  }

  if (!(Number(v.price) > 0)) {
    return "السعر غير صحيح";
  }

  if (
    v.oldPrice !== "" &&
    !(Number(v.oldPrice) >= 0)
  ) {
    return "السعر القديم غير صحيح";
  }

  if (
    v.stock !== "" &&
    !(
      Number.isInteger(Number(v.stock)) &&
      Number(v.stock) >= 0
    )
  ) {
    return "المخزون غير صحيح";
  }

  return "";
}


function normalizeProduct(v) {
  return {
    name: v.name,
    price: Number(v.price),
    oldPrice:
      v.oldPrice === ""
        ? ""
        : Number(v.oldPrice),

    image1: v.image1,
    image2: v.image2,
    image3: v.image3,
    image4: v.image4,

    description: v.description,

    stock:
      v.stock === ""
        ? 0
        : Number(v.stock),

    status:
      v.status || "active"
  };
}


/* =========================================================
   ضغط الصور
   ========================================================= */

function loadImage(file) {
  return new Promise(
    function (resolve, reject) {

      const url =
        URL.createObjectURL(file);

      const img =
        new Image();

      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(
          new Error(
            "تعذر قراءة الصورة"
          )
        );
      };

      img.src = url;
    }
  );
}


async function prepareImage(file) {
  const img =
    await loadImage(file);

  const maxSide =
    Math.max(
      img.naturalWidth,
      img.naturalHeight
    );

  const scale =
    Math.min(
      1,
      IMAGE_MAX_SIDE / maxSide
    );

  const w =
    Math.max(
      1,
      Math.round(
        img.naturalWidth * scale
      )
    );

  const h =
    Math.max(
      1,
      Math.round(
        img.naturalHeight * scale
      )
    );


  const canvas =
    document.createElement(
      "canvas"
    );

  canvas.width = w;
  canvas.height = h;


  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "المتصفح لا يدعم معالجة الصور"
    );
  }


  // خلفية بيضاء
  ctx.fillStyle = "#ffffff";

  ctx.fillRect(
    0,
    0,
    w,
    h
  );


  ctx.drawImage(
    img,
    0,
    0,
    w,
    h
  );


  const dataUrl =
    canvas.toDataURL(
      "image/jpeg",
      IMAGE_QUALITY
    );


  const parts =
    dataUrl.split(",");


  return {
    base64: parts[1],
    mime: "image/jpeg",
    preview: dataUrl
  };
}


/* =========================================================
   Admin
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  function () {

    const form =
      document.getElementById(
        "loginForm"
      );

    if (!form) {
      return;
    }


    const $ =
      function (id) {
        return document.getElementById(id);
      };


    const loginView =
      $("loginView");

    const appView =
      $("appView");

    const msgBox =
      $("loginMessage");

    const btn =
      $("loginBtn");

    const passInput =
      $("password");

    const sidebar =
      $("sidebar");

    const overlay =
      $("overlay");


    let products = [];

    let editingId = null;

    let deletingId = null;

    let deleteKind = "product";

    let dashStale = false;

    let busy = false;

    let pendingUploads = 0;

    let descGifs = [];

    let descLoading = false;


    /* =====================================================
       الرسائل
       ===================================================== */

    function showMessage(text, type) {
      msgBox.textContent = text;
      msgBox.className =
        "message " + type;
      msgBox.hidden = false;
    }


    let toastTimer;

    function showToast(text, type) {
      const t =
        $("toast");

      if (!t) return;

      t.textContent = text;

      t.className =
        "toast show" +
        (
          type === "error"
            ? " error"
            : ""
        );

      clearTimeout(
        toastTimer
      );

      toastTimer =
        setTimeout(
          function () {
            t.className =
              "toast";
          },
          3200
        );
    }


    /* =====================================================
       أخطاء الجلسة
       ===================================================== */

    function handleAuthError(err) {
      if (!err.auth) {
        return false;
      }

      clearSession();

      closeModals();

      render();

      showMessage(
        err.message,
        "error"
      );

      return true;
    }


    /* =====================================================
       عرض الصفحة
       ===================================================== */

    function render() {
      const session =
        getSession();

      loginView.hidden =
        !!session;

      appView.hidden =
        !session;


      if (session) {
        $("adminName").textContent =
          session.username;

        loadDashboard();
      }
    }


    /* =====================================================
       تسجيل الدخول
       ===================================================== */

    $("togglePassword")
      .addEventListener(
        "click",
        function (e) {

          const show =
            passInput.type ===
            "password";

          passInput.type =
            show
              ? "text"
              : "password";

          e.target.textContent =
            show
              ? "إخفاء"
              : "إظهار";
        }
      );


    form.addEventListener(
      "submit",
      async function (e) {

        e.preventDefault();

        msgBox.hidden = true;


        const username =
          $("username")
            .value
            .trim();

        const password =
          passInput.value;


        if (
          !username ||
          !password
        ) {
          showMessage(
            "يرجى ملء جميع الحقول",
            "error"
          );

          return;
        }


        btn.disabled = true;

        btn.textContent =
          "جاري تسجيل الدخول...";


        try {

          await login(
            username,
            password
          );

          showMessage(
            "تم تسجيل الدخول بنجاح",
            "success"
          );


          setTimeout(
            function () {

              passInput.value = "";

              render();

            },
            400
          );


        } catch (err) {

          showMessage(
            err.message,
            "error"
          );

        } finally {

          btn.disabled = false;

          btn.textContent =
            "تسجيل الدخول";
        }
      }
    );


    /* =====================================================
       التنقل
       ===================================================== */

    const TITLES = {
      home: "الرئيسية",
      products: "المنتجات",
      orders: "الطلبات"
    };


    function openMenu(open) {

      sidebar.classList.toggle(
        "open",
        open
      );

      overlay.classList.toggle(
        "show",
        open
      );
    }


    function showSection(name) {

      Object.keys(TITLES)
        .forEach(
          function (key) {

            const section =
              $("sec-" + key);

            if (section) {
              section.hidden =
                key !== name;
            }
          }
        );


      document
        .querySelectorAll(
          ".nav-btn[data-section]"
        )
        .forEach(
          function (b) {

            b.classList.toggle(
              "active",
              b.dataset.section ===
              name
            );
          }
        );


      $("pageTitle").textContent =
        TITLES[name];


      openMenu(false);


      window.scrollTo(
        0,
        0
      );


      if (
        name === "products"
      ) {
        loadProducts();
      }


      if (
        name === "orders"
      ) {
        loadOrders();
      }


      if (
        name === "home" &&
        dashStale
      ) {
        loadDashboard();
      }
    }


    document
      .querySelectorAll(
        ".nav-btn[data-section]"
      )
      .forEach(
        function (b) {

          b.addEventListener(
            "click",
            function () {
              showSection(
                b.dataset.section
              );
            }
          );
        }
      );


    $("menuBtn")
      .addEventListener(
        "click",
        function () {
          openMenu(true);
        }
      );


    overlay
      .addEventListener(
        "click",
        function () {
          openMenu(false);
        }
      );


    $("logoutBtn")
      .addEventListener(
        "click",
        logout
      );


    $("retryBtn")
      .addEventListener(
        "click",
        loadDashboard
      );


    /* =====================================================
       Dashboard
       ===================================================== */

    function setStats(
      p,
      o,
      n,
      s
    ) {

      $("statProducts")
        .textContent = p;

      $("statOrders")
        .textContent = o;

      $("statNew")
        .textContent = n;

      $("statSales")
        .textContent = s;
    }


    function tableMessage(text) {
      $("latestOrders")
        .innerHTML =
        '<tr>' +
          '<td colspan="6" class="state-msg">' +
            esc(text) +
          "</td>" +
        "</tr>";
    }


    function renderLatestOrders(
      latest
    ) {

      if (!latest.length) {
        tableMessage(
          "لا توجد طلبات بعد"
        );

        return;
      }


      $("latestOrders")
        .innerHTML =
        latest.map(
          function (o) {

            return (
              "<tr>" +

                "<td>#" +
                  esc(o.id) +
                "</td>" +

                "<td>" +
                  esc(o.customerName) +
                "</td>" +

                '<td class="cell-name">' +
                  esc(o.productName) +
                "</td>" +

                "<td>" +
                  esc(o.quantity) +
                "</td>" +

                "<td>" +
                  formatMoney(o.total) +
                "</td>" +

                '<td>' +
                  '<span class="badge badge-' +
                    esc(o.status) +
                  '">' +
                    esc(
                      ORDER_STATUS_LABELS[
                        o.status
                      ] ||
                      o.status
                    ) +
                  "</span>" +
                "</td>" +

              "</tr>"
            );
          }
        )
        .join("");
    }


    function renderDashboard(d) {

      setStats(
        d.products,
        d.orders,
        d.newOrders,
        formatMoney(d.sales)
      );

      renderLatestOrders(
        d.latest || []
      );
    }


    async function loadDashboard() {

      $("dashError").hidden =
        true;


      const cached =
        cacheLoad(
          "dashboard"
        );


      if (cached) {

        renderDashboard(
          cached
        );

      } else {

        setStats(
          "-",
          "-",
          "-",
          "-"
        );

        tableMessage(
          "جاري تحميل الطلبات..."
        );
      }


      try {

        const data =
          await getDashboard();

        cacheSave(
          "dashboard",
          data
        );

        renderDashboard(
          data
        );

        dashStale = false;


      } catch (err) {

        if (
          handleAuthError(err)
        ) {
          return;
        }


        if (cached) {

          showToast(
            err.message,
            "error"
          );

        } else {

          $("dashErrorText")
            .textContent =
            err.message;

          $("dashError")
            .hidden = false;

          tableMessage(
            "تعذر تحميل الطلبات"
          );
        }
      }
    }


    /* =====================================================
       المنتجات
       ===================================================== */

    function productCard(p) {

      const off =
        p.status !== "active";

      const hasImg =
        /^https?:\/\//i.test(
          p.image1 || ""
        );


      const old =
        Number(p.oldPrice) >
        Number(p.price)

          ? '<span class="pold">' +
            formatMoney(
              p.oldPrice
            ) +
            "</span>"

          : "";


      const id =
        esc(p.id);


      const editBtn =
        '<button type="button" ' +
        'class="btn btn-outline btn-mini" ' +
        'data-action="edit" ' +
        'data-id="' +
        id +
        '">' +
        "تعديل" +
        "</button>";


      const activateBtn =
        off

          ? '<button type="button" ' +
            'class="btn btn-gold btn-mini" ' +
            'data-action="activate" ' +
            'data-id="' +
            id +
            '">' +
            "تفعيل" +
            "</button>"

          : "";


      const deleteBtn =
        '<button type="button" ' +
        'class="btn btn-outline danger btn-mini" ' +
        'data-action="delete" ' +
        'data-id="' +
        id +
        '">' +
        "حذف" +
        "</button>";


      return (
        '<article class="pcard' +
        (off ? " is-off" : "") +
        '">' +

          '<div class="pimg' +
          (hasImg ? "" : " no-img") +
          '">' +

            (
              hasImg
                ? '<img src="' +
                  esc(
                    imgUrl(
                      p.image1,
                      400
                    )
                  ) +
                  '" alt="' +
                  esc(p.name) +
                  '" loading="lazy" decoding="async">'
                : ""
            ) +

            '<span class="badge badge-' +
              esc(p.status) +
            '">' +
              esc(
                PRODUCT_STATUS_LABELS[
                  p.status
                ] ||
                p.status
              ) +
            "</span>" +

          "</div>" +

          '<div class="pinfo">' +

            '<h3 class="pname">' +
              esc(p.name) +
            "</h3>" +

            '<div class="pprice">' +
              formatMoney(
                p.price
              ) +
              old +
            "</div>" +

            '<div class="pstock">' +
              "المخزون: " +
              esc(p.stock) +
            "</div>" +

          "</div>" +

          '<div class="pactions">' +
            editBtn +
            activateBtn +
            deleteBtn +
          "</div>" +

        "</article>"
      );
    }


    function renderProducts() {

      const grid =
        $("productsGrid");

      const state =
        $("productsState");


      if (!products.length) {

        grid.innerHTML = "";

        state.textContent =
          "لا توجد منتجات بعد. اضغط «+ إضافة منتج» لإضافة أول منتج.";

        state.hidden = false;

        return;
      }


      state.hidden = true;


      grid.innerHTML =
        products
          .map(productCard)
          .join("");


      grid
        .querySelectorAll(
          ".pimg img"
        )
        .forEach(
          function (img) {

            img.addEventListener(
              "error",
              function () {

                img.parentElement
                  .classList
                  .add("no-img");

                img.remove();
              }
            );
          }
        );
    }


    function commitProducts(
      list
    ) {

      products = list;

      cacheSave(
        "products",
        products
      );

      renderProducts();

      dashStale = true;
    }


    async function loadProducts() {

      const state =
        $("productsState");

      const cached =
        cacheLoad(
          "products"
        );


      if (cached) {

        products = cached;

        renderProducts();

      } else {

        $("productsGrid")
          .innerHTML = "";

        state.textContent =
          "جاري تحميل المنتجات...";

        state.hidden = false;
      }


      try {

        products =
          await getProducts();

        cacheSave(
          "products",
          products
        );

        renderProducts();

      } catch (err) {

        if (
          handleAuthError(err)
        ) {
          return;
        }


        if (cached) {

          showToast(
            err.message,
            "error"
          );

        } else {

          state.textContent =
            "حدث خطأ أثناء تحميل المنتجات: " +
            err.message;
        }
      }
    }


    $("refreshProducts")
      .addEventListener(
        "click",
        loadProducts
      );


    /* =====================================================
       الطلبات
       ===================================================== */

    const ORDER_CHOICES = [
      "confirmed",
      "shipped",
      "delivered"
    ];


    let orders = [];


    function statusSelect(o) {

      const isChoice =
        ORDER_CHOICES.indexOf(
          o.status
        ) >= 0;


      const current =
        isChoice
          ? ""
          : '<option value="' +
            esc(o.status) +
            '" selected disabled>' +
            esc(
              ORDER_STATUS_LABELS[
                o.status
              ] ||
              o.status
            ) +
            "</option>";


      const options =
        ORDER_CHOICES
          .map(
            function (s) {

              return (
                '<option value="' +
                s +
                '"' +
                (
                  s === o.status
                    ? " selected"
                    : ""
                ) +
                ">" +
                ORDER_STATUS_LABELS[s] +
                "</option>"
              );
            }
          )
          .join("");


      return (
        '<select class="status-select st-' +
        esc(o.status) +
        '" data-id="' +
        esc(o.id) +
        '" data-prev="' +
        esc(o.status) +
        '" aria-label="حالة الطلب">' +

          current +
          options +

        "</select>"
      );
    }


    function ordersMessage(text) {

      $("ordersBody")
        .innerHTML =
        '<tr>' +
          '<td colspan="12" class="state-msg">' +
            esc(text) +
          "</td>" +
        "</tr>";
    }


    function renderOrders() {

      if (!orders.length) {

        ordersMessage(
          "لا توجد طلبات بعد"
        );

        return;
      }


      $("ordersBody")
        .innerHTML =
        orders
          .map(
            function (o) {

              let phone =
                String(
                  o.phone || ""
                );


              if (
                /^[5-7]\d{8}$/.test(
                  phone
                )
              ) {
                phone =
                  "0" +
                  phone;
              }


              const tel =
                phone.replace(
                  /[^\d+]/g,
                  ""
                );


              return (
                "<tr>" +

                  "<td>#" +
                    esc(o.id) +
                  "</td>" +

                  "<td>" +
                    esc(o.date) +
                  "</td>" +

                  '<td class="cell-name">' +
                    esc(o.productName) +
                  "</td>" +

                  "<td>" +
                    esc(o.customerName) +
                  "</td>" +

                  '<td class="cell-phone">' +
                    '<a href="tel:' +
                    esc(tel) +
                    '">' +
                    esc(phone) +
                    "</a>" +
                  "</td>" +

                  "<td>" +
                    esc(o.city) +
                  "</td>" +

                  '<td class="cell-wrap">' +
                    esc(o.address) +
                  "</td>" +

                  "<td>" +
                    esc(o.quantity) +
                  "</td>" +

                  "<td>" +
                    formatMoney(o.price) +
                  "</td>" +

                  "<td>" +
                    formatMoney(o.total) +
                  "</td>" +

                  "<td>" +
                    statusSelect(o) +
                  "</td>" +

                  '<td>' +
                    '<button type="button" ' +
                    'class="btn btn-outline danger order-del" ' +
                    'data-del="' +
                    esc(o.id) +
                    '">' +
                    "حذف" +
                    "</button>" +
                  "</td>" +

                "</tr>"
              );
            }
          )
          .join("");
    }


    async function loadOrders() {

      const cached =
        cacheLoad(
          "orders"
        );


      if (cached) {

        orders = cached;

        renderOrders();

      } else {

        ordersMessage(
          "جاري تحميل الطلبات..."
        );
      }


      try {

        orders =
          await getOrders();

        cacheSave(
          "orders",
          orders
        );

        renderOrders();

      } catch (err) {

        if (
          handleAuthError(err)
        ) {
          return;
        }


        if (cached) {

          showToast(
            err.message,
            "error"
          );

        } else {

          ordersMessage(
            "حدث خطأ أثناء تحميل الطلبات: " +
            err.message
          );
        }
      }
    }


    $("refreshOrders")
      .addEventListener(
        "click",
        loadOrders
      );


    $("ordersBody")
      .addEventListener(
        "change",
        async function (e) {

          const sel =
            e.target.closest(
              "select.status-select"
            );

          if (!sel) return;


          const id =
            sel.dataset.id;

          const prev =
            sel.dataset.prev;

          const status =
            sel.value;


          if (
            status === prev
          ) {
            return;
          }


          if (busy) {

            sel.value = prev;

            return;
          }


          busy = true;

          sel.disabled = true;


          try {

            await updateOrder(
              id,
              status
            );


            orders =
              orders.map(
                function (o) {

                  return String(o.id) ===
                    String(id)

                    ? Object.assign(
                        {},
                        o,
                        {
                          status:
                            status
                        }
                      )

                    : o;
                }
              );


            cacheSave(
              "orders",
              orders
            );

            dashStale = true;

            renderOrders();

            showToast(
              "تم تحديث حالة الطلب بنجاح"
            );

          } catch (err) {

            if (
              handleAuthError(err)
            ) {
              return;
            }

            sel.value =
              prev;

            sel.disabled =
              false;

            showToast(
              err.message,
              "error"
            );

          } finally {

            busy = false;
          }
        }
      );


    $("ordersBody")
      .addEventListener(
        "click",
        function (e) {

          const b =
            e.target.closest(
              "button[data-del]"
            );

          if (!b || busy) {
            return;
          }


          const o =
            orders.find(
              function (x) {
                return String(x.id) ===
                  b.dataset.del;
              }
            );


          if (!o) return;


          deletingId =
            o.id;

          deleteKind =
            "order";


          $("confirmTitle")
            .textContent =
            "حذف الطلب";


          $("confirmText")
            .textContent =
            "هل أنت متأكد من حذف الطلب #" +
            o.id +
            " الخاص بـ «" +
            o.customerName +
            "» نهائيًا من الجدول؟ لا يمكن التراجع عن هذه العملية.";


          openModal(
            "confirmModal"
          );
        }
      );


    /* =====================================================
       النوافذ
       ===================================================== */

    function openModal(id) {

      $(id).hidden =
        false;

      document.body.classList.add(
        "no-scroll"
      );
    }


    function closeModals() {

      $("productModal").hidden =
        true;

      $("confirmModal").hidden =
        true;

      document.body.classList.remove(
        "no-scroll"
      );

      editingId = null;

      deletingId = null;
    }


    document
      .querySelectorAll(
        ".modal"
      )
      .forEach(
        function (m) {

          m.addEventListener(
            "click",
            function (e) {

              if (
                e.target === m ||
                e.target.closest(
                  "[data-close]"
                )
              ) {
                closeModals();
              }
            }
          );
        }
      );


    document.addEventListener(
      "keydown",
      function (e) {

        if (
          e.key === "Escape"
        ) {
          openMenu(false);
          closeModals();
        }
      }
    );


    /* =====================================================
       رفع الصور
       الإصلاح الرئيسي للهاتف
       ===================================================== */

    const pForm =
      $("productForm");

    const pMsg =
      $("productMessage");

    const uploads =
      $("uploads");

    const saveBtn =
      $("saveProductBtn");


    /*
     * مهم:
     *
     * لا نضع input type=file على hidden.
     *
     * بدلاً من ذلك نضعه فوق زر الصورة،
     * opacity = 0،
     * وبالتالي الهاتف يتعامل معه كحقل ملف حقيقي.
     */

    IMAGE_KEYS.forEach(
      function (key, i) {

        uploads.insertAdjacentHTML(
          "beforeend",

          '<div class="uslot" data-key="' +
          key +
          '">' +

            '<button type="button" ' +
            'class="uframe" ' +
            'aria-label="اختيار صورة">' +

              '<img alt="" hidden>' +

              '<span class="uplus" aria-hidden="true">' +
                "+" +
              "</span>" +

              '<span class="ustatus" hidden></span>' +

              /*
               * حقل حقيقي فوق الزر
               */
              '<input ' +
                'class="mobile-file-input" ' +
                'type="file" ' +
                'accept="image/*" ' +
                'capture="environment" ' +
                'aria-label="اختيار صورة" ' +
              '>' +

            "</button>" +

            '<button type="button" ' +
              'class="uremove" ' +
              'aria-label="حذف الصورة" ' +
              'hidden>' +
              "×" +
            "</button>" +

            '<input type="hidden" name="' +
              key +
            '">' +

            '<span class="ucap">' +
              (
                i === 0
                  ? "الصورة الرئيسية"
                  : "صورة " +
                    (i + 1)
              ) +
            "</span>" +

          "</div>"
        );
      }
    );


    /*
     * نجعل input فوق الزر فعليًا.
     * هذا هو الإصلاح الذي يجعل اختيار الصورة
     * يعمل باللمس في الهاتف.
     */

    uploads
      .querySelectorAll(
        ".mobile-file-input"
      )
      .forEach(
        function (input) {

          input.style.position =
            "absolute";

          input.style.inset =
            "0";

          input.style.width =
            "100%";

          input.style.height =
            "100%";

          input.style.opacity =
            "0";

          input.style.cursor =
            "pointer";

          input.style.zIndex =
            "20";

          input.style.display =
            "block";

          input.style.margin =
            "0";

          input.style.padding =
            "0";

          input.style.border =
            "0";

          input.style.fontSize =
            "0";

          input.style.background =
            "transparent";
        }
      );


    /*
     * اجعل إطار الصورة position:relative
     */

    uploads
      .querySelectorAll(
        ".uframe"
      )
      .forEach(
        function (frame) {

          frame.style.position =
            "relative";

          frame.style.overflow =
            "hidden";

          frame.style.touchAction =
            "manipulation";

          frame.style.webkitTapHighlightColor =
            "transparent";
        }
      );


    function slotEl(key) {

      return uploads.querySelector(
        '[data-key="' +
        key +
        '"]'
      );
    }


    function setSlot(
      key,
      url,
      preview
    ) {

      const slot =
        slotEl(key);

      if (!slot) return;


      const img =
        slot.querySelector(
          "img"
        );


      const hidden =
        slot.querySelector(
          'input[type="hidden"]'
        );


      hidden.value =
        url || "";


      if (url) {

        img.src =
          preview ||
          imgUrl(
            url,
            200
          );

        img.hidden =
          false;

      } else {

        img.removeAttribute(
          "src"
        );

        img.hidden =
          true;
      }


      slot.classList.toggle(
        "has-img",
        !!url
      );


      const remove =
        slot.querySelector(
          ".uremove"
        );

      remove.hidden =
        !url;
    }


    function setSlotStatus(
      key,
      text
    ) {

      const slot =
        slotEl(key);

      if (!slot) return;


      const st =
        slot.querySelector(
          ".ustatus"
        );


      st.textContent =
        text || "";


      st.hidden =
        !text;
    }


    function updateSaveState() {

      saveBtn.disabled =
        busy ||
        pendingUploads > 0 ||
        descLoading;


      if (
        pendingUploads > 0
      ) {

        saveBtn.textContent =
          "جاري رفع الصور...";

      } else if (
        descLoading
      ) {

        saveBtn.textContent =
          "جاري تحميل الوصف...";

      } else {

        saveBtn.textContent =
          "حفظ";
      }
    }


    async function handleFile(
      key,
      file
    ) {

      if (!file) {
        return;
      }


      /*
       * بعض الهواتف قد لا ترسل MIME بشكل واضح.
       * لذلك نتحقق من النوع والامتداد.
       */

      const isImage =
        /^image\//i.test(
          file.type
        ) ||
        /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(
          file.name || ""
        );


      if (!isImage) {

        pMsg.textContent =
          "يرجى اختيار ملف صورة";

        pMsg.hidden =
          false;

        return;
      }


      pMsg.hidden =
        true;


      const slot =
        slotEl(key);


      const previous =
        slot.querySelector(
          'input[type="hidden"]'
        ).value;


      pendingUploads++;

      updateSaveState();

      setSlotStatus(
        key,
        "جاري الرفع..."
      );


      try {

        const img =
          await prepareImage(
            file
          );


        /*
         * عرض المعاينة فورًا
         */
        setSlot(
          key,
          previous || "__preview__",
          img.preview
        );


        const res =
          await uploadImage(
            img.base64,
            img.mime
          );


        if (
          !res ||
          !res.url
        ) {
          throw new Error(
            "لم يرجع الخادم رابط الصورة"
          );
        }


        setSlot(
          key,
          res.url,
          img.preview
        );


      } catch (err) {

        if (
          handleAuthError(err)
        ) {
          return;
        }


        setSlot(
          key,
          previous
        );


        pMsg.textContent =
          err.message ||
          "تعذر رفع الصورة";

        pMsg.hidden =
          false;

      } finally {

        pendingUploads--;

        setSlotStatus(
          key,
          ""
        );

        updateSaveState();
      }
    }


    /*
     * حذف الصورة فقط.
     *
     * ملاحظة:
     * input نفسه أصبح فوق الزر،
     * لذلك الضغط على الزر لا يحتاج
     * إلى input.click().
     */

    uploads.addEventListener(
      "click",
      function (e) {

        const slot =
          e.target.closest(
            ".uslot"
          );

        if (!slot) {
          return;
        }


        const remove =
          e.target.closest(
            ".uremove"
          );


        if (remove) {

          e.preventDefault();

          e.stopPropagation();

          setSlot(
            slot.dataset.key,
            ""
          );

          return;
        }
      }
    );


    uploads.addEventListener(
      "change",
      function (e) {

        const input =
          e.target;


        if (
          !input.matches(
            'input[type="file"]'
          )
        ) {
          return;
        }


        const slot =
          input.closest(
            ".uslot"
          );


        if (!slot) {
          return;
        }


        const file =
          input.files &&
          input.files[0];


        if (file) {

          handleFile(
            slot.dataset.key,
            file
          );
        }


        /*
         * السماح باختيار نفس الصورة
         * مرة أخرى.
         */

        input.value =
          "";
      }
    );


    /* =====================================================
       GIF
       ===================================================== */

    const gifInput =
      $("gifInput");

    const addGifBtn =
      $("addGifBtn");


    /*
     * نفس فكرة الهاتف:
     * لا نعتمد على hidden + click فقط.
     *
     * نضع input فوق زر إضافة GIF.
     */

    if (
      gifInput &&
      addGifBtn
    ) {

      gifInput.style.position =
        "absolute";

      gifInput.style.inset =
        "0";

      gifInput.style.width =
        "100%";

      gifInput.style.height =
        "100%";

      gifInput.style.opacity =
        "0";

      gifInput.style.cursor =
        "pointer";

      gifInput.style.zIndex =
        "20";

      gifInput.style.display =
        "block";

      gifInput.style.margin =
        "0";


      addGifBtn.style.position =
        "relative";

      addGifBtn.style.overflow =
        "hidden";


      /*
       * إزالة hidden حتى يستطيع
       * الهاتف الضغط عليه فعليًا.
       */

      gifInput.hidden =
        false;
    }


    function renderGifs() {

      $("gifList")
        .innerHTML =
        descGifs
          .map(
            function (u, i) {

              return (
                '<div class="gitem">' +

                  '<img src="' +
                    esc(u) +
                    '" alt="" loading="lazy">' +

                  '<button type="button" ' +
                    'class="uremove" ' +
                    'data-i="' +
                    i +
                    '" ' +
                    'aria-label="حذف GIF">' +
                    "×" +
                  "</button>" +

                "</div>"
              );
            }
          )
          .join("");


      addGifBtn.hidden =
        descGifs.length >=
        MAX_GIFS;
    }


    $("gifList")
      .addEventListener(
        "click",
        function (e) {

          const b =
            e.target.closest(
              "button[data-i]"
            );

          if (!b) {
            return;
          }


          descGifs.splice(
            Number(b.dataset.i),
            1
          );


          renderGifs();
        }
      );


    /*
     * لا نستخدم click() هنا.
     * لأن input موجود فوق الزر.
     */


    gifInput.addEventListener(
      "change",
      function (e) {

        handleGifs(
          Array.from(
            e.target.files || []
          )
        );


        e.target.value =
          "";
      }
    );


    async function handleGifs(
      files
    ) {

      for (
        const file of files
      ) {

        if (
          descGifs.length >=
          MAX_GIFS
        ) {

          pMsg.textContent =
            "الحد الأقصى " +
            MAX_GIFS +
            " صور GIF";

          pMsg.hidden =
            false;

          break;
        }


        const isGif =
          file.type ===
          "image/gif" ||
          /\.gif$/i.test(
            file.name || ""
          );


        if (!isGif) {

          pMsg.textContent =
            "يرجى اختيار ملف بصيغة GIF";

          pMsg.hidden =
            false;

          continue;
        }


        if (
          file.size >
          GIF_MAX_BYTES
        ) {

          pMsg.textContent =
            "حجم الـ GIF كبير، الحد الأقصى 5 ميغابايت";

          pMsg.hidden =
            false;

          continue;
        }


        pMsg.hidden =
          true;


        pendingUploads++;

        updateSaveState();


        addGifBtn.textContent =
          "جاري رفع GIF...";


        try {

          const base64 =
            await fileToBase64(
              file
            );


          const res =
            await uploadImage(
              base64,
              "image/gif"
            );


          if (
            !res ||
            !res.url
          ) {
            throw new Error(
              "لم يرجع الخادم رابط GIF"
            );
          }


          descGifs.push(
            res.url
          );


          renderGifs();


        } catch (err) {

          if (
            handleAuthError(err)
          ) {
            return;
          }


          pMsg.textContent =
            err.message ||
            "تعذر رفع الـ GIF";

          pMsg.hidden =
            false;

        } finally {

          pendingUploads--;

          addGifBtn.textContent =
            "+ إضافة GIF";

          updateSaveState();
        }
      }
    }


    /* =====================================================
       الوصف
       ===================================================== */

    const descBox =
      pForm.elements.description;

    const DESC_PLACEHOLDER =
      descBox.placeholder;


    async function loadFullProduct(
      id
    ) {

      descLoading =
        true;

      descBox.disabled =
        true;

      descBox.placeholder =
        "جاري تحميل الوصف...";

      updateSaveState();


      let full;


      try {

        full =
          await getProduct(id);

      } catch (err) {

        if (
          handleAuthError(err)
        ) {
          return;
        }


        if (
          String(editingId) ===
          String(id)
        ) {

          pMsg.textContent =
            "تعذر تحميل وصف المنتج، أغلق النافذة وحاول مرة أخرى";

          pMsg.hidden =
            false;
        }


        descLoading =
          false;

        descBox.disabled =
          false;

        descBox.placeholder =
          DESC_PLACEHOLDER;

        updateSaveState();

        return;
      }


      if (
        String(editingId) !==
        String(id)
      ) {
        return;
      }


      const d =
        splitDescription(
          full.description
        );


      descBox.value =
        d.text;


      descGifs =
        d.gifs;


      renderGifs();


      descLoading =
        false;

      descBox.disabled =
        false;

      descBox.placeholder =
        DESC_PLACEHOLDER;

      updateSaveState();
    }


    /* =====================================================
       فتح نموذج المنتج
       ===================================================== */

    function openProductModal(p) {

      editingId =
        p
          ? p.id
          : null;


      $("modalTitle")
        .textContent =
        p
          ? "تعديل المنتج"
          : "إضافة منتج";


      pMsg.hidden =
        true;


      PRODUCT_FIELDS
        .forEach(
          function (k) {

            if (
              IMAGE_KEYS.indexOf(k) >= 0 ||
              k === "description"
            ) {
              return;
            }


            const val =
              p &&
              p[k] !== undefined &&
              p[k] !== null
                ? p[k]
                : "";


            pForm.elements[k]
              .value =
              (
                k === "status" &&
                val === ""
              )
                ? "active"
                : val;
          }
        );


      IMAGE_KEYS.forEach(
        function (k) {

          setSlot(
            k,
            p && p[k]
              ? p[k]
              : ""
          );
        }
      );


      descBox.value =
        "";

      descBox.disabled =
        false;

      descBox.placeholder =
        DESC_PLACEHOLDER;

      descLoading =
        false;

      descGifs =
        [];

      renderGifs();

      updateSaveState();


      openModal(
        "productModal"
      );


      /*
       * focus فقط على الكمبيوتر.
       * على الهاتف لا نريد فتح لوحة المفاتيح
       * تلقائيًا بعد فتح النافذة.
       */

      if (
        window.innerWidth > 700
      ) {
        setTimeout(
          function () {
            try {
              pForm.elements.name
                .focus();
            } catch (e) {}
          },
          50
        );
      }


      if (p) {
        loadFullProduct(
          p.id
        );
      }
    }


    $("addProductBtn")
      .addEventListener(
        "click",
        function () {
          openProductModal(
            null
          );
        }
      );


    /* =====================================================
       قراءة النموذج
       ===================================================== */

    function readProductForm() {

      const v = {};


      PRODUCT_FIELDS
        .forEach(
          function (k) {

            v[k] =
              pForm.elements[k]
                .value
                .trim();
          }
        );


      v.description =
        joinDescription(
          v.description,
          descGifs
        );


      return v;
    }


    /* =====================================================
       حفظ المنتج
       ===================================================== */

    pForm.addEventListener(
      "submit",
      async function (e) {

        e.preventDefault();


        if (busy) {
          return;
        }


        pMsg.hidden =
          true;


        if (
          pendingUploads > 0
        ) {

          pMsg.textContent =
            "يرجى انتظار اكتمال رفع الصور";

          pMsg.hidden =
            false;

          return;
        }


        const values =
          readProductForm();


        const problem =
          validateProduct(
            values
          );


        if (problem) {

          pMsg.textContent =
            problem;

          pMsg.hidden =
            false;

          return;
        }


        const id =
          editingId;


        const isEdit =
          id !== null;


        busy =
          true;

        saveBtn.disabled =
          true;

        saveBtn.textContent =
          "جاري الحفظ...";


        try {

          const res =
            isEdit

              ? await updateProduct(
                  id,
                  values
                )

              : await addProduct(
                  values
                );


          const local =
            normalizeProduct(
              values
            );


          delete local.description;


          if (isEdit) {

            commitProducts(
              products.map(
                function (p) {

                  return String(p.id) ===
                    String(id)

                    ? Object.assign(
                        {},
                        p,
                        local
                      )

                    : p;
                }
              )
            );

          } else {

            commitProducts(
              [
                Object.assign(
                  {
                    id:
                      res.id ||
                      (
                        res.product &&
                        res.product.id
                      ),
                    createdAt: ""
                  },
                  local
                )
              ].concat(
                products
              )
            );
          }


          closeModals();


          showToast(
            isEdit
              ? "تم تعديل المنتج بنجاح"
              : "تمت إضافة المنتج بنجاح"
          );


        } catch (err) {

          if (
            handleAuthError(err)
          ) {
            return;
          }


          pMsg.textContent =
            err.message;

          pMsg.hidden =
            false;

        } finally {

          busy =
            false;

          updateSaveState();
        }
      }
    );


    /* =====================================================
       أزرار المنتجات
       ===================================================== */

    $("productsGrid")
      .addEventListener(
        "click",
        async function (e) {

          const b =
            e.target.closest(
              "button[data-action]"
            );


          if (
            !b ||
            busy
          ) {
            return;
          }


          const p =
            products.find(
              function (x) {
                return String(x.id) ===
                  b.dataset.id;
              }
            );


          if (!p) {
            return;
          }


          if (
            b.dataset.action ===
            "edit"
          ) {

            openProductModal(
              p
            );

          } else if (
            b.dataset.action ===
            "delete"
          ) {

            deletingId =
              p.id;

            deleteKind =
              "product";


            $("confirmTitle")
              .textContent =
              "حذف المنتج";


            $("confirmText")
              .textContent =
              "هل أنت متأكد من حذف «" +
              p.name +
              "» نهائيًا مع صوره؟ لا يمكن التراجع عن هذه العملية. وإن أردت إخفاءه مؤقتًا فقط فغيّر حالته إلى «غير نشط» من زر التعديل.";


            openModal(
              "confirmModal"
            );

          } else if (
            b.dataset.action ===
            "activate"
          ) {

            busy =
              true;

            b.disabled =
              true;


            try {

              await setProductStatus(
                p.id,
                "active"
              );


              commitProducts(
                products.map(
                  function (x) {

                    return String(x.id) ===
                      String(p.id)

                      ? Object.assign(
                          {},
                          x,
                          {
                            status:
                              "active"
                          }
                        )

                      : x;
                  }
                )
              );


              showToast(
                "تم تفعيل المنتج بنجاح"
              );


            } catch (err) {

              if (
                !handleAuthError(
                  err
                )
              ) {

                showToast(
                  err.message,
                  "error"
                );

                b.disabled =
                  false;
              }

            } finally {

              busy =
                false;
            }
          }
        }
      );


    /* =====================================================
       تأكيد الحذف
       ===================================================== */

    $("confirmYes")
      .addEventListener(
        "click",
        async function () {

          if (
            busy ||
            deletingId === null
          ) {
            return;
          }


          const yes =
            $("confirmYes");


          const id =
            deletingId;


          busy =
            true;

          yes.disabled =
            true;

          yes.textContent =
            "جاري الحذف...";


          try {

            if (
              deleteKind ===
              "order"
            ) {

              await deleteOrder(
                id
              );


              orders =
                orders.filter(
                  function (x) {
                    return String(x.id) !==
                      String(id);
                  }
                );


              cacheSave(
                "orders",
                orders
              );


              dashStale =
                true;


              renderOrders();


              closeModals();


              showToast(
                "تم حذف الطلب بنجاح"
              );


            } else {

              await deleteProduct(
                id
              );


              commitProducts(
                products.filter(
                  function (x) {
                    return String(x.id) !==
                      String(id);
                  }
                )
              );


              closeModals();


              showToast(
                "تم حذف المنتج بنجاح"
              );
            }


          } catch (err) {

            if (
              handleAuthError(err)
            ) {
              return;
            }


            closeModals();


            showToast(
              err.message,
              "error"
            );


          } finally {

            busy =
              false;

            yes.disabled =
              false;

            yes.textContent =
              "نعم، احذف نهائيًا";
          }
        }
      );


    /* =====================================================
       تشغيل لوحة التحكم
       ===================================================== */

    render();

  }
);
