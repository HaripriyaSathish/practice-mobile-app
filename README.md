# Vetri Shopping Hall – practice e-commerce app

A Flipkart / Amazon style shopping app with a South Indian touch.

| Part | Tech | Folder |
|------|------|--------|
| Mobile app | React Native + Expo (Expo Go), React Navigation | `frontend/` |
| Backend API + Admin panel | Python Django + Django REST Framework + Jazzmin admin theme | `backend/` |
| Database | MySQL 8 (view it in MySQL Workbench) – database `south_cart_db` | – |
| Images | Django media files in `backend/media/` | – |
| Login | Email OTP (6-digit code, Gmail SMTP) | – |
| Payments | Cash on Delivery + Cashfree **test mode** | – |
| Emails | OTP, coloured invoice on order, status updates, cancellation/refund | – |

---

## 1. One-time setup

### Backend (Django)

Open a terminal in the project folder:

```bash
cd "C:\practice mobile app\backend"
```

```bash
venv\Scripts\activate
```

> The virtual environment and packages are already installed. On a new PC run
> `py -m venv venv`, then `venv\Scripts\activate`, then `pip install -r requirements.txt`.

Check `backend/.env` (MySQL password, Gmail app password, Cashfree test keys are already filled in).
Then create the tables (already done once – safe to run again):

```bash
python manage.py migrate
```

Create your admin login (choose your own username/password):

```bash
python manage.py createsuperuser
```

Load the products (184 branded products with HD studio photos from DummyJSON, categories, home sections and banners):

```bash
python manage.py import_dummyjson
```

> Running it again rebuilds the catalogue (users, addresses and orders are kept). Photos are cached in `media/dummyjson/`.
> Add, edit or delete any product, banner or category in the admin panel afterwards.

### Frontend (Expo)

```bash
cd "C:\practice mobile app\frontend"
```

```bash
npm install
```

Install the **Expo Go** app on your phone (Play Store / App Store).

---

## 2. Run every day (two terminals)

### Terminal 1 – backend

```bash
cd "C:\practice mobile app\backend"
```

```bash
venv\Scripts\activate
```

```bash
python manage.py runserver 0.0.0.0:8001
```

`0.0.0.0` lets your phone (same Wi-Fi) reach the backend.

> Vetri Shopping Hall uses port **8001**, so it can run at the same time as your other projects on 8000
> (e.g. Aarohi Boutique). If you see **"Request failed (404)"** on login, this backend is not running.

### Terminal 2 – frontend

```bash
cd "C:\practice mobile app\frontend"
```

```bash
npx expo start
```

---

## 3. How to view the app

* **On your phone:** open Expo Go and scan the QR code shown in Terminal 2. Phone and PC must be on the same Wi-Fi.
  The app finds your PC's IP automatically. If it can't connect, put your PC's IP in
  `frontend/src/config.js` → `MANUAL_API_URL = 'http://192.168.x.x:8001'` (find the IP with `ipconfig`).
  If Windows asks, allow Python through the firewall (Private network).
* **In a web browser:** press `w` in Terminal 2 (or open http://localhost:8081). On a wide screen the app is shown
  inside a phone frame; on a narrow window / mobile browser it fills the screen.

### Login with email OTP

1. Enter your email → **Send OTP**.
2. Check your inbox for the 6-digit code (sent from the Gmail account in `.env`).
3. Type it → you are logged in. A new account is created automatically the first time.

OTP rules: valid 5 minutes, 5 wrong tries max, resend after 30 seconds.
If Gmail is not set in `.env`, the OTP is printed in Terminal 1 and shown in **Admin → Email OTPs**.

---

## 4. How to view the admin panel (add / remove / modify anything)

Open **http://127.0.0.1:8001/admin/** and log in with the superuser you created.

| Section | What you can do |
|---------|-----------------|
| **Banners** | Home-screen slider: image, tag, title, button text, which category it opens, order, show/hide |
| **Categories** | Add / rename / reorder / hide categories and set their images |
| **Products** | Add / edit / delete products, price & MRP, stock, main image + extra gallery images, "Deals of the Day", show/hide. Low-stock warnings shown in the list |
| **Home sections** | Product rows on the Home screen (e.g. "Top Electronics") – pick products with the selector |
| **Orders** | Change status (Placed → Confirmed → Shipped → Delivered / Cancelled). **Every status change emails the customer.** Cancelling restores stock and refunds paid Cashfree orders. "View invoice" link per order |
| **Users / Profiles / Addresses / Cart / Wishlist** | See and manage customer data |
| **Email OTPs** | Log of OTP codes (handy while testing) |

Tips: tick several rows and use the **Action** dropdown for bulk work (show/hide, add to deals, mark shipped…).
Everything you change appears in the app after a refresh (pull down on the Home screen).

Images you upload are saved in `backend/media/`.

---

## 5. Payments – Cashfree TEST mode

* Choose **Pay Online (Cashfree)** at checkout. A Cashfree test checkout opens; no real money is charged.
* Use the test cards / UPI IDs listed in the Cashfree docs (Cashfree dashboard → Test mode → Developers / test data).
* After paying you return to the app, the backend confirms with Cashfree, the order becomes **Paid + Confirmed**
  and the coloured invoice is emailed.
* If the payment is not finished, open **My Orders → Pay now** to retry.
* Keys live in `backend/.env` (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV=sandbox`).

## 6. Cancelling orders

**My Orders → Cancel order** (allowed while Placed or Confirmed) → pick a reason →
stock goes back, a paid Cashfree order is refunded automatically (test mode), the order card shows
the refund status and the customer gets a cancellation email. Cancelling from the admin panel does the same.

## 7. Invoices & emails

* Coloured invoice (maroon & marigold theme) – **My Orders → Invoice** (printable / Save as PDF).
* Emails sent automatically: OTP, order confirmation with full invoice, payment success, Confirmed / Shipped /
  Delivered / Cancelled updates.
* Set `SITE_URL` in `.env` to `http://<your-PC-IP>:8001/` if you want invoice links inside emails to open on your phone.

## 8. View the data in MySQL Workbench

Connect to `localhost:3306` as `root` → schema **south_cart_db**. Main tables:
`shop_product`, `shop_category`, `shop_banner`, `shop_homesection`, `shop_order`, `shop_orderitem`,
`shop_cartitem`, `accounts_emailotp`, `auth_user`.

## 9. Project structure

```
practice mobile app/
├─ backend/
│  ├─ config/            settings, urls
│  ├─ accounts/          email OTP login, profile
│  ├─ shop/              products, cart, orders, payments, invoices, emails, admin
│  │  ├─ templates/shop/ invoice, emails, Cashfree pages
│  │  └─ management/commands/  import_dummyjson
│  ├─ media/             uploaded & starter images
│  └─ .env               secrets (not shared)
└─ frontend/
   ├─ App.js             navigation (tabs + screens)
   └─ src/
      ├─ screens/        Login, Otp, Home, Categories, ProductList, ProductDetail,
      │                  Cart, Checkout, Orders, Wishlist, Account, Profile
      ├─ components/     PhoneFrame (web), ProductCard, TopBar, buttons
      ├─ context/        login + cart state
      ├─ api.js, config.js, payment.js, theme.js
```

Product data and photos: DummyJSON (https://dummyjson.com) free demo e-commerce data. Banners are generated from those product photos. Replace any image from the admin panel with your own.
