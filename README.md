# إلكترو يوسف — متجر إلكتروني عربي

متجر للمنتجات الإلكترونية مبني بـ **HTML + CSS + JavaScript** فقط، ويستخدم **Google Sheets** كقاعدة بيانات و**Google Apps Script** كواجهة API. لا يحتاج PHP ولا MySQL ولا أي خدمة مدفوعة.

## هيكل المشروع

```
electro-youssef/
├── site/                  ← ملفات الموقع (هذا المجلد هو الذي يُنشر على الاستضافة)
│   ├── index.html         الصفحة الرئيسية للمتجر
│   ├── product.html       صفحة المنتج ونموذج الطلب
│   ├── thanks.html        صفحة شكر بعد الطلب
│   ├── admin.html         لوحة التحكم (تسجيل الدخول، المنتجات، الطلبات)
│   ├── style.css          التنسيق الوحيد لكل الصفحات
│   ├── script.js          الإعدادات والاتصال بالـ API (ومنطق لوحة التحكم)
│   ├── index.js           منطق الصفحة الرئيسية
│   └── product.js         منطق صفحة المنتج
├── apps-script/
│   └── Code.gs            كود الـ API (يُلصق في Google Apps Script وليس في الاستضافة)
├── .gitignore
└── README.md
```

> أسماء الملفات بحروف صغيرة عمدًا: الاستضافات حساسة لحالة الأحرف، ويجب أن يكون الملف الرئيسي `index.html`.

## الإعداد خطوة بخطوة

### 1) Google Sheets
أنشئ ملفًا باسم `Ecommerce DB` فيه ثلاث أوراق بهذه الأسماء بالضبط، وعناوين الصف الأول:

| الورقة | الأعمدة (الصف الأول) |
|---|---|
| `Admin` | `id` `username` `password` `status` |
| `Products` | `id` `name` `price` `oldPrice` `image1` `image2` `image3` `image4` `description` `stock` `status` `createdAt` |
| `Orders` | `id` `date` `productId` `productName` `customerName` `phone` `city` `address` `quantity` `price` `total` `status` |

في ورقة `Admin` أضف الصف: `1 | admin | (كلمة مرور) | active`. واجعل الملف **Restricted** (لا تشاركه بالرابط) لأنه يحوي بيانات الزبائن.

### 2) Google Apps Script
1. من ملف Sheets: **Extensions ← Apps Script**، واحذف الكود الموجود.
2. الصق محتوى `apps-script/Code.gs`، واحفظ.
3. غيّر `PASSWORD_SALT` في أعلى الملف إلى نص عشوائي طويل خاص بك (**لا ترفع القيمة الحقيقية إلى GitHub**، وأبقِ النص الافتراضي في المستودع).
4. شغّل الدالة `authorizeDrive` مرة واحدة ووافق على الصلاحيات (لرفع الصور إلى Drive).
5. **Deploy ← New deployment ← Web app**: Execute as = **Me**، Who has access = **Anyone**. انسخ الرابط المنتهي بـ `/exec`.
6. اكتب كلمة مرور قوية في ورقة `Admin` ثم شغّل الدالة `hashPasswords` لتشفيرها. لا تغيّر `PASSWORD_SALT` بعد ذلك.

### 3) ربط الموقع بالـ API
في `site/script.js` غيّر السطر:

```js
const API_URL = "رابط_الـ_Web_app_المنتهي_بـ_/exec";
```

### 4) النشر على استضافة مجانية
اربط مستودع GitHub بإحدى الاستضافات الثابتة (مثل **Cloudflare Pages** أو **Netlify**) واضبط:

- **Build command:** اتركه فارغًا
- **Build output / Publish directory:** `site`

أو ارفع محتويات مجلد `site` مباشرة (سحب وإفلات) دون ربط GitHub.

> **GitHub Pages:** مجاني للمستودعات العامة فقط، وشروطه لا تناسب تشغيل متجر تجاري. فضّل Cloudflare Pages أو Netlify، وهما يعملان مع مستودع **خاص**.

## رفع المشروع إلى GitHub

```bash
git init
git add .
git commit -m "إلكترو يوسف: النسخة الأولى"
git branch -M main
git remote add origin https://github.com/USERNAME/electro-youssef.git
git push -u origin main
```

أنشئ المستودع على GitHub أولًا (يُفضَّل **Private**) بلا README، ثم استبدل `USERNAME` باسم حسابك.

## التحديث لاحقًا

- **تعديل الموقع:** عدّل ملفات `site/` وادفعها (`git add . && git commit -m "..." && git push`)، وستعيد الاستضافة النشر تلقائيًا.
- **تعديل `Code.gs`:** الصقه في Apps Script ثم **Deploy ← Manage deployments ← ✏️ ← Version: New version ← Deploy**. **لا تستعمل New deployment**، فهو يُنشئ رابطًا جديدًا في كل مرة ويجبرك على تغيير `API_URL`.

## الأمان

- لا ترفع إلى GitHub: قيمة `PASSWORD_SALT` الحقيقية، ولا كلمات المرور، ولا رابط ورقة Sheets.
- رابط `API_URL` ظاهر في كود الواجهة بطبيعته، والحماية في الخادم: كل عمليات الإدارة تتطلب جلسة مدير، ويوجد قفل مؤقت بعد المحاولات الفاشلة، وحدود لإرسال الطلبات.
- صفحة `admin.html` محمية بتسجيل الدخول، ولا يوجد رابط لها في المتجر.

## أدوات صيانة (تُشغَّل من محرر Apps Script)

| الدالة | وظيفتها |
|---|---|
| `hashPasswords` | تشفير كلمات المرور النصية في ورقة `Admin` |
| `authorizeDrive` | منح صلاحية Google Drive لرفع الصور |
| `clearCache` | إظهار تعديلات الورقة اليدوية فورًا (الكاش 5 دقائق) |
| `clearLoginLocks` | فتح قفل تسجيل الدخول بعد محاولات فاشلة |
