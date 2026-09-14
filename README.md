# SmartScan & Pay

> SmartScan & Pay — a supermarket Scan & Go platform that lets customers scan products, build a cart, pay digitally, and receive a one-time digital Exit Pass.

---

## 1. Project Overview

**SmartScan & Pay** is a full-stack, enterprise-grade supermarket self-checkout ("Scan & Go") solution. It empowers shoppers to use their personal smartphone camera as a barcode scanner while navigating store aisles, add verified products directly to a cloud-synced digital basket, complete instant contactless payments via Razorpay UPI and Cards, and obtain a cryptographically signed, single-use digital **Exit Pass**. 

Upon exiting, store gate staff or automated optical terminals scan the customer's QR code to verify the transaction in real-time, preventing shoplifting and double-exit attempts while completely bypassing long, traditional cashier queues.

---

## 2. Problem Statement

Traditional supermarket checkouts create substantial friction for both retail operations and consumers:
* **Prolonged Queue Times**: Shoppers frequently spend 15–30 minutes waiting in queue during peak hours, often exceeding the time spent selecting products.
* **Cashier Bottlenecks**: Double handling of goods—unloading items onto conveyor belts, scanning one-by-one, and reloading back into bags—is labor-intensive, slow, and error-prone.
* **Customer Frustration**: Long waiting lines remain the primary cause of supermarket basket abandonment and degraded customer satisfaction.
* **Operational Overhead**: Supermarkets face escalating staffing expenses and hardware maintenance costs for dozens of stationary point-of-sale (POS) registers.

---

## 3. Solution

SmartScan & Pay decentralizes the checkout process by turning every customer's smartphone into a secure, personal Point-of-Sale terminal:
* **Self-Scanning on the Move**: Customers scan product barcodes directly from supermarket shelves using their phone camera.
* **Real-Time Price & Inventory Transparency**: Authoritative product pricing and branch-specific stock availability are validated against MongoDB in real time.
* **Instant Digital Checkout**: Shoppers review itemized totals and pay securely using integrated Razorpay UPI, Cards, or Netbanking.
* **Atomic Single-Use Gate Authorization**: Once paid, customers receive a one-time dynamic Exit Pass QR code verified at store gates with atomic double-scan protection.
* **Dramatically Reduced Wait Times**: Shoppers bypass POS lanes entirely, reducing checkout exit time to less than 15 seconds.

---

## 4. Main Features

* **Authentication & Role-Based Access Control**:
  * Secure customer registration and login with bcrypt password hashing and JWT token issuance.
  * Role differentiation (`customer`, `admin`, `staff`) with RBAC middleware protecting sensitive endpoints.
* **Supermarket & Branch Selection**:
  * Multi-branch architecture with location proximity calculation (e.g., D Mart Kukatpally, Miyapur, Madhapur).
  * Branch header binding (`x-branch-id`) ensuring isolated pricing and stock validation.
* **Product Search & Branch Availability**:
  * Search by product name, category, or barcode.
  * Branch-level stock queries preventing out-of-stock items from being added to baskets.
* **Live Continuous Barcode Scanner**:
  * Browser-based optical scanning supporting EAN-13, EAN-8, UPC-A, and Code-128.
  * Automatic sound feedback and duplicate scan throttling (2.5s lock window).
  * Continuous camera session that stays active across multiple item scans.
* **User-Specific Cart Management**:
  * Server-authoritative shopping cart tied strictly to authenticated user identity (`req.user._id`).
  * Real-time paise precision calculation eliminating floating-point currency discrepancies.
* **Cart Review & Exact Bill Calculation**:
  * Itemized breakdown including units, MRP, discounts, taxes, and final payable amount.
* **Razorpay Payment Integration**:
  * Native Razorpay checkout modal with UPI QR code and card payment options.
* **Zero-Trust Backend Payment Verification**:
  * Cryptographic HMAC SHA-256 signature verification performed on the backend.
  * Order ownership, exact payable amount match, and duplicate payment prevention.
* **Digital Receipt Generation**:
  * Itemized tax invoice displaying payment timestamp, transaction reference, and store branch metadata.
* **One-Time Digital Exit Pass**:
  * Generates a unique, tamper-resistant digital pass (`passId`, QR code, and 6-character short code).
  * Strictly single-use: transitions atomically from `ACTIVE` to `USED` on the first scan.
* **Exit Verification Terminal**:
  * Dedicated gate scanner interface for store security personnel.
  * Double-scan detection returning immediate rejection (`ALREADY_USED`) for duplicate attempts.
* **Branch Inventory Management**:
  * Post-purchase atomic stock decrements on the selected branch without deleting the master product catalog.
* **Admin Management Dashboard**:
  * Admin-only operations for creating, updating, or deleting product catalog items and tracking store inventory levels.

---

## 5. Application Flow

```
     [ Enter Store ]
            ↓
    [ Select Branch ]
            ↓
[ Search / Check Availability ]
            ↓
     [ Scan Products ] ──(Continuous Camera Loop)
            ↓
         [ Cart ]
            ↓
        [ Review ]
            ↓
     [ Exact Payment ]
            ↓
[ Payment Verification ] ──(HMAC SHA-256 Backend Check)
            ↓
    [ Digital Receipt ]
            ↓
  [ One-Time Exit Pass ] ──(ACTIVE Status)
            ↓
   [ Exit Verification ] ──(Gate Scan → Becomes USED)
```

---

## 6. Technology Stack

### Frontend
* **Core Framework**: React 18 with Vite
* **Routing**: React Router DOM (v6)
* **HTTP Client**: Axios with JWT Bearer interceptors & branch context headers
* **Barcode & QR Engines**:
  * `@zxing/browser` & `@zxing/library`
  * `@ericblade/quagga2`
  * `html5-qrcode`
  * `qrcode`
* **Styling**: Modern Vanilla CSS Design System (Glassmorphism, responsive grid, dark/light theme support)

### Backend
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MongoDB with Mongoose ODM
* **Security & Auth**:
  * JSON Web Tokens (`jsonwebtoken`)
  * `bcryptjs` password hashing
  * `helmet` HTTP headers security
  * `express-rate-limit` DDoS and brute-force mitigation
  * `cors` origin whitelisting

### Payments
* **Payment Gateway**: Razorpay Node SDK & Razorpay Checkout Modal
* **Verification**: Cryptographic HMAC-SHA256 signature verification

---

## 7. Project Structure

```
SmartScanPay/
├── .env.example                       # Root environment variable template
├── .gitignore                         # Comprehensive Git ignore rules
├── package.json                       # Monorepo runner scripts (concurrently)
├── package-lock.json
├── PROJECT_REQUIREMENTS.md            # Technical specifications
├── docs/                              # Architecture documentation
│   ├── DATABASE_DESIGN.md
│   └── PROJECT_REQUIREMENTS.md
├── client/                            # Frontend Single Page Application
│   ├── .env.example                   # Client environment template
│   ├── index.html                     # HTML5 entry point
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js                 # Vite configuration with /api proxy
│   ├── public/
│   │   └── images/                    # Local product assets & store banners
│   └── src/
│       ├── App.jsx                    # Route switch & context providers
│       ├── main.jsx                   # React DOM root
│       ├── index.css                  # Global tokens & CSS design system
│       ├── api/
│       │   └── client.js              # Axios instance with auth interceptors
│       ├── components/
│       │   ├── BarcodeScanner.jsx     # Live video scanner viewfinder
│       │   ├── BottomNav.jsx          # Mobile navigation bar
│       │   ├── CartDrawer.jsx         # Slide-over cart preview
│       │   ├── ErrorBoundary.jsx      # React error boundary
│       │   ├── Icons.jsx              # SVG icons library
│       │   ├── Navbar.jsx             # Top app bar
│       │   ├── ProductCard.jsx        # Product catalog card
│       │   ├── ProtectedRoute.jsx     # Auth/Admin route guard
│       │   ├── QRCodeDisplay.jsx      # Exit Pass QR renderer & polling
│       │   ├── RazorpayModal.jsx      # Native payment modal & UPI bench
│       │   ├── Scanner.jsx            # Fallback scanner component
│       │   └── ScanSuccessHUD.jsx     # Haptic HUD notification on scan
│       ├── context/
│       │   ├── AuthContext.jsx        # Authentication state
│       │   ├── CartContext.jsx        # Cart state & paise math
│       │   ├── StoreContext.jsx       # Selected supermarket & branch state
│       │   ├── ThemeContext.jsx       # Dark / light theme toggle
│       │   └── ToastContext.jsx       # Toast notification manager
│       ├── pages/
│       │   ├── AdminProductsPage.jsx  # Admin catalog & inventory manager
│       │   ├── CartPage.jsx           # Full cart review & quantity controls
│       │   ├── CatalogPage.jsx        # Browse products with branch stock
│       │   ├── CheckoutPage.jsx       # Order summary & payment trigger
│       │   ├── GateTerminalPage.jsx   # Staff exit gate scanner terminal
│       │   ├── HomePage.jsx           # Landing page & quick actions
│       │   ├── LoginPage.jsx          # Customer & staff login
│       │   ├── OrdersHistoryPage.jsx  # Customer past orders & receipts
│       │   ├── OrderSuccessPage.jsx   # Digital receipt & live Exit Pass
│       │   ├── ProfilePage.jsx        # User profile & preferences
│       │   ├── RegisterPage.jsx       # New account registration
│       │   ├── ScannerPage.jsx        # Continuous barcode scanner view
│       │   └── StoreSelectPage.jsx    # Supermarket & branch picker
│       ├── services/
│       │   ├── barcodeScannerEngine.js# Multi-engine camera processor
│       │   └── exitService.js         # Exit pass verification API calls
│       └── utils/
│           ├── barcodeNormalizer.js   # Barcode padding & check digit utils
│           └── scanFeedback.js        # Audio beep synthesizer
└── server/                            # Backend REST API Services
    ├── .env.example                   # Server environment template
    ├── app.js                         # Express application setup & middleware
    ├── server.js                      # Server startup & DB connection listener
    ├── package.json
    ├── package-lock.json
    ├── config/
    │   ├── db.js                      # MongoDB connection with graceful exit
    │   └── razorpay.js                # Razorpay instance factory
    ├── constants/
    │   ├── orderStatus.js             # Order lifecycle states
    │   ├── paymentStatus.js           # Payment transaction states
    │   └── roles.js                   # RBAC role constants
    ├── controllers/
    │   ├── authController.js          # Authentication handlers
    │   ├── branchInventoryController.js # Branch stock CRUD
    │   ├── cartController.js          # User-isolated cart operations
    │   ├── exitController.js          # Atomic single-use exit verification
    │   ├── productController.js       # Product lookup & admin CRUD
    │   └── transactionController.js   # Checkout, payment verify & pass init
    ├── middleware/
    │   ├── authMiddleware.js          # JWT token verification
    │   ├── branchAccessMiddleware.js  # Branch header validation
    │   ├── errorMiddleware.js         # Centralized error handler
    │   ├── rateLimitMiddleware.js     # IP rate limit protection
    │   ├── roleMiddleware.js          # RBAC authorization middleware
    │   └── validationMiddleware.js    # Express-validator input sanitize
    ├── models/
    │   ├── BranchAvailability.js      # Availability matrix schema
    │   ├── BranchInventory.js         # Per-branch stock schema
    │   ├── Cart.js                    # User shopping cart schema
    │   ├── ExitPass.js                # Single-use exit pass schema
    │   ├── Product.js                 # Master product catalog schema
    │   ├── Transaction.js             # Order & transaction records
    │   └── User.js                    # User account schema
    ├── routes/
    │   ├── authRoutes.js              # /api/v1/auth
    │   ├── branchRoutes.js            # /api/v1/branches
    │   ├── cartRoutes.js              # /api/v1/cart
    │   ├── exitRoutes.js              # /api/v1/exit
    │   ├── healthRoutes.js            # /api/v1/health
    │   ├── index.js                   # Central route aggregator
    │   ├── productRoutes.js           # /api/v1/products
    │   ├── supermarketRoutes.js       # /api/v1/supermarkets
    │   └── transactionRoutes.js       # /api/v1/transactions
    ├── scripts/
    │   ├── add_marie_gold.js          # Product helper script
    │   ├── seed.js                    # Complete database seeder
    │   ├── test_3_collection_flow.js  # End-to-end integration test runner
    │   └── test_scan_app_flow.js      # Flow verification script
    ├── services/
    │   ├── authService.js             # Authentication business logic
    │   ├── branchAvailabilityService.js # Branch inventory synchronization
    │   └── physicalVerificationService.js # Basket comparison logic
    ├── tests/                         # Comprehensive Jest test suite
    │   ├── auth.test.js
    │   ├── branch_availability.test.js
    │   ├── branch_inventory.test.js
    │   ├── cart_isolation.test.js
    │   ├── flow.test.js
    │   ├── health.test.js
    │   ├── inventory.test.js
    │   ├── inventory_purchase_flow.test.js
    │   ├── payment_security.test.js
    │   ├── product.test.js
    │   ├── strict_one_time_exit_pass.test.js
    │   └── two_layer_exit_verification.test.js
    └── utils/
        ├── apiResponse.js             # Standardized JSON response helper
        └── cryptoUtils.js             # Security and hashing helpers
```

---

## 8. Installation & Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: A running local MongoDB instance (e.g. `mongodb://localhost:27017`) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster.

### 1. Clone the Repository
```bash
git clone https://github.com/BushapakaKiranmai/Smartscan.git
cd Smartscan
```

### 2. Install Dependencies
You can install all root, backend, and frontend dependencies in a single step:
```bash
npm run install:all
```
Or install them individually:
```bash
# Root dependencies
npm install

# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
cd ..
```

### 3. Environment Configuration
Create the environment files from their respective examples:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```
*(On Windows PowerShell, use `copy server\.env.example server\.env` and `copy client\.env.example client\.env`)*

Configure your `server/.env` with your MongoDB connection string and Razorpay credentials.

### 4. Seed the Database
Populate the database with default supermarket branches, master products (including Britannia Marie Gold and Britannia Jim Jam), and test accounts:
```bash
npm run seed
```

### 5. Running the Application

#### Option A: Run Both Concurrently (Recommended)
From the project root:
```bash
npm run dev
```

#### Option B: Run Individually
In separate terminal windows:
```bash
# Terminal 1: Backend Server (Port 5000)
cd server
npm run dev

# Terminal 2: Frontend Client (Port 5173)
cd client
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 9. Environment Variables

All environment variables must be populated in individual local `.env` files. **Never commit actual `.env` files to source control.**

### Backend (`server/.env`)
| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | Server HTTP port | `5000` |
| `NODE_ENV` | Application environment | `development` |
| `CLIENT_URL` | Allowed CORS frontend origin | `http://localhost:5173` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://localhost:27017/smartscan_pay` |
| `JWT_SECRET` | Secret key for signing JWT tokens | *`<your_jwt_secret_key>`* |
| `JWT_EXPIRES_IN` | Token validity duration | `7d` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | *`<your_razorpay_key_id>`* |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | *`<your_razorpay_key_secret>`* |
| `RATE_LIMIT_WINDOW_MS` | Rate limit evaluation window (ms) | `900000` (15 mins) |
| `RATE_LIMIT_MAX_REQUESTS`| Max requests per IP per window | `100` |

### Frontend (`client/.env`)
| Variable | Description | Example / Default |
|---|---|---|
| `VITE_API_URL` | Production backend API endpoint | `http://localhost:5000/api/v1` |
| `VITE_API_BASE_URL` | Fallback backend endpoint | `http://localhost:5000/api/v1` |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Public Key ID (Client-side) | *`<your_razorpay_key_id>`* |

---

## 10. Barcode Scanning Architecture

The SmartScan & Pay scanning interface is engineered for continuous store aisle navigation:
1. **Continuous Video Loop**: The customer initiates the camera once. Upon successfully identifying a product barcode, the item is added to the cart, audio confirmation sounds, and the camera immediately stays open for the next item.
2. **Duplicate Protection**: A throttling mechanism prevents duplicate reads of the same barcode within a 2.5-second interval while allowing immediate scanning of distinct barcodes.
3. **Branch-Aware Verification**: Every detected barcode is checked against the selected supermarket branch. If the item is marked as out-of-stock at that specific branch, the customer is notified with a clear alert, preventing invalid items from entering the checkout flow.
4. **Intentional Scanner Exit**: The scanning flow concludes exclusively when the customer clicks the **"Finish & View Cart"** action button. There are no sudden redirects or automatic checkout triggers after a single scan.

---

## 11. Payment Security

Payment security is strictly server-authoritative to prevent client-side manipulation:
* **Zero Trust Amount**: The client does not dictate prices. Cart line items and total amounts are recalculated from master database records at checkout time.
* **Cryptographic Verification**: Once the customer finishes payment, Razorpay returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. The backend computes:
  ```
  expectedSignature = HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
  ```
* **Strict Secret Isolation**: `RAZORPAY_KEY_SECRET` resides strictly within the backend runtime and is **never** sent or accessible to frontend bundles.
* **Idempotent Settlement**: Payment verification calls are idempotent; multiple verification requests for an already-paid order return the existing transaction record without charging twice or duplicating stock deductions.

---

## 12. Exit Pass Security (Atomic Single-Use)

The digital **Exit Pass** serves as the store's electronic receipt and departure authorization:
* **Authoritative Generation**: An Exit Pass is generated **only** after the backend has verified full payment for an order belonging to the authenticated user.
* **Database as Source of Truth**: The status of the pass (`ACTIVE`, `USED`, `EXPIRED`, `CANCELLED`) is stored in MongoDB. Browser page refreshes or device switching query the database state directly.
* **Atomic Double-Scan Protection**: When a security staff terminal or gate scanner reads the pass, the backend executes an atomic database operation:
  ```javascript
  const updatedPass = await ExitPass.findOneAndUpdate(
    { _id: passId, status: 'ACTIVE' },
    { status: 'USED', usedAt: new Date() },
    { new: true }
  );
  ```
  If a customer or bad actor attempts to scan the exact same pass a second time, the query finds no record with `status: 'ACTIVE'`, immediately rejecting the request with `ALREADY_USED`.
* **Short-Lived Expiration**: Every pass has a fixed time-to-live (`expiresAt`), after which it automatically expires.

---

## 13. Inventory Management

* **Master Product Catalog Preservation**: A completed purchase **never** deletes the master `Product` document. Products remain in the catalog for ongoing branch restocking and administrative cataloging.
* **Branch-Specific Stock**: Stock quantities are tracked per supermarket location in `BranchInventory`. A sale at D Mart Kukatpally decrements stock only at Kukatpally, leaving Miyapur and Madhapur unaffected.
* **Availability Thresholds**: When branch inventory reaches `0`, the branch record is automatically updated to `available: false`, instantly disabling cart additions at that branch.
* **Negative Stock Prevention**: Stock subtraction operations use MongoDB atomic conditions (`stockQuantity: { $gte: quantity }`), preventing overselling or negative inventory counts under concurrent checkout traffic.

---

## 14. Future Improvements

* **RFID-Based Physical Basket Verification**: Future integration of high-frequency RFID reader gates to perform contactless, instant basket weight and tag audits against digital receipts as shoppers step through exit portals. *(Note: RFID represents a future roadmap integration and is not currently physical hardware deployed in this software repository).*
* **AI Shopping Assistant (Powered by Gemini)**: Conversational in-app assistant to guide customers to aisle coordinates, suggest nutritional recipe pairings, and alert shoppers to branch-specific discounts.
* **Computer Vision Item Confirmation**: Shelf and cart-mounted camera vision for automated un-scanned item detection.
* **Automated NFC / Turnstile Exit Gates**: Hardware relay integration with motorized turnstiles triggering gate unlock signals upon valid Exit Pass consumption.
* **Predictive Stock Replenishment**: Machine learning analytics forecasting inventory turnover by branch and seasonality.

---

## 15. Screenshots

> *Add application screenshots and demo media below:*

| Store & Branch Selection | Live Barcode Scanning View |
|:---:|:---:|
| ![Store Select](https://placehold.co/600x400/10b981/ffffff?text=Supermarket+%26+Branch+Select) | ![Scanner HUD](https://placehold.co/600x400/0ea5e9/ffffff?text=Live+Continuous+Scanner) |

| Smart Cart & Review | Digital Receipt & Single-Use Exit Pass |
|:---:|:---:|
| ![Cart Review](https://placehold.co/600x400/6366f1/ffffff?text=Itemized+Cart+Review) | ![Exit Pass](https://placehold.co/600x400/10b981/ffffff?text=Digital+Exit+Pass+QR) |

---

## 16. Security Notes

* **Never Commit Environment Files**: `.env` and `.env.*` files are explicitly included in `.gitignore` and must never be committed to Git.
* **Keep Secrets Server-Side**: Never expose `RAZORPAY_KEY_SECRET`, `MONGO_URI`, or `JWT_SECRET` in frontend source code, client builds, or public repositories.
* **Use Least-Privilege Database Users**: In production, configure MongoDB Atlas database users with granular read/write privileges restricted to the specific application database.
* **Always Rotate Keys**: If any credentials or test keys are inadvertently exposed, immediately regenerate them in your respective provider dashboards.

---

## License

This project is proprietary and maintained for educational, commercial, and enterprise demonstration purposes. All rights reserved.
