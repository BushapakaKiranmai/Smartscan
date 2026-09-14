# SmartScan & Pay

## Software Requirements Specification

**Project Name:** SmartScan & Pay
**Project Type:** Production-Oriented Full-Stack Web Application
**Version:** 1.0
**Status:** MVP Planning

---

# 1. Project Overview

SmartScan & Pay is a full-stack supermarket self-checkout application that allows customers to scan product barcodes using their smartphone, retrieve product information and current pricing from the supermarket backend, add products to a digital cart, make online payments, and receive a digital receipt and exit verification token.

The system is designed to reduce checkout queue waiting time while maintaining accurate pricing, inventory consistency, secure payment verification, and fraud prevention.

The application supports multiple supermarkets and multiple branches.

---

# 2. Problem Statement

Traditional supermarket checkout requires customers to wait in queues while each product is scanned and payment is processed by a cashier.

This can result in:

* Long checkout queues
* Increased waiting time
* High cashier workload
* Poor checkout experience during peak hours
* Limited self-service options

SmartScan & Pay addresses this problem by allowing customers to scan and pay for products using their smartphones.

---

# 3. Objectives

The primary objectives are:

1. Reduce supermarket checkout waiting time.
2. Allow customers to scan products using their smartphones.
3. Retrieve product information from the supermarket backend.
4. Ensure customers cannot manipulate product prices.
5. Validate product availability before checkout.
6. Provide secure digital payment.
7. Verify payments server-side.
8. Maintain accurate inventory.
9. Prevent duplicate or invalid orders.
10. Provide digital receipts.
11. Provide secure exit verification.
12. Support multiple supermarkets and branches.
13. Provide administrators with inventory, product, order, and sales management.
14. Detect potentially suspicious transactions.

---

# 4. Scope

## 4.1 In Scope

The MVP includes:

* Customer registration and login
* Admin authentication
* Supermarket management
* Branch management
* Product management
* Barcode management
* Branch-specific inventory
* Branch-specific pricing
* Barcode scanning
* Cart management
* Coupon validation
* Order creation
* Razorpay payment
* Server-side payment verification
* Digital receipt
* Exit QR/token
* Order history
* Admin order management
* Basic sales dashboard
* Cancellation and refund handling
* Suspicious transaction identification
* Role-based access control

---

## 4.2 Out of Scope for MVP

The following features may be implemented in future versions:

* AI shopping assistant
* AI fraud detection
* Personalized product recommendations
* Loyalty program
* Supplier management
* Advanced analytics
* Store navigation
* Voice-based shopping
* Automated checkout gates
* IoT shelf integration
* Computer vision product verification

---

# 5. User Roles

The system shall support the following roles.

## 5.1 Customer

Customers can:

* Register
* Login
* Select a supermarket
* Select a branch
* Scan products
* View product information
* Add products to cart
* Change quantities
* Remove products
* Apply coupons
* Checkout
* Make payments
* View receipts
* View order history
* Use exit verification tokens

Customers cannot:

* Modify product prices
* Modify inventory
* Modify product information
* Access admin APIs
* Mark orders as paid
* Generate valid payment confirmations manually

---

## 5.2 Branch Staff

Branch staff can:

* Login
* View branch orders
* Verify customer exit tokens
* View branch inventory
* Assist with customer issues

Branch staff cannot:

* Modify system-wide configuration
* Access other branches without authorization
* Modify payment records

---

## 5.3 Branch Manager

Branch managers can:

* Manage branch inventory
* View branch orders
* View branch sales
* Manage branch products
* Manage branch pricing where authorized
* Handle operational issues

Branch managers should only have access to their assigned branches.

---

## 5.4 Super Admin

Super Admin can:

* Manage supermarkets
* Manage branches
* Manage products
* Manage barcodes
* Manage pricing
* Manage inventory
* Manage users
* Manage administrators
* View all orders
* View sales
* Handle refunds
* View suspicious transactions
* Configure system-wide settings

---

# 6. Functional Requirements

## FR-01: Customer Registration

The system shall allow customers to create an account using valid registration information.

The system shall:

* Validate registration data.
* Prevent duplicate accounts.
* Hash passwords before storing them.
* Reject invalid input.

---

## FR-02: Customer Login

The system shall authenticate registered customers.

The system shall:

* Validate credentials.
* Generate an authenticated session/token.
* Reject invalid credentials.
* Prevent unauthorized access.

---

## FR-03: Admin Authentication

The system shall provide a separate authenticated experience for administrative users.

Administrative access shall require:

* Valid credentials
* Valid authentication token
* Appropriate role/permissions

---

## FR-04: Supermarket Selection

Customers shall be able to view available supermarkets.

---

## FR-05: Branch Selection

Customers shall be able to select a branch belonging to the selected supermarket.

The shopping session shall be associated with the selected branch.

---

## FR-06: Barcode Scanning

Customers shall be able to scan product barcodes using their device camera.

The system shall:

1. Capture the barcode.
2. Send the barcode to the backend.
3. Identify the corresponding product.
4. Identify the selected branch.
5. Validate product availability.
6. Retrieve the current applicable price.
7. Return product information.

---

## FR-07: Product Lookup

The backend shall identify products using their barcode.

A barcode shall uniquely identify a product within the system.

If the barcode is invalid or unknown, the system shall return an appropriate error.

---

## FR-08: Product Information

The system shall display:

* Product name
* Product image
* Brand
* Category
* Unit/weight
* Current price
* Availability
* Applicable offers

---

## FR-09: Cart Management

Customers shall be able to:

* Add products
* Increase quantity
* Decrease quantity
* Remove products
* View cart contents
* View subtotal
* View discounts
* View final payable amount

---

## FR-10: Server-Authoritative Pricing

The customer shall never be able to manually specify or modify the authoritative product price.

The backend shall retrieve the applicable price from the database.

Client-provided prices shall not be trusted.

---

## FR-11: Inventory Validation

The system shall validate product availability before adding products to the cart and before completing checkout.

The backend shall prevent orders from exceeding available inventory.

---

## FR-12: Coupon Management

Customers shall be able to apply eligible coupons.

The backend shall validate:

* Coupon existence
* Coupon status
* Expiration date
* Minimum order amount
* Customer eligibility
* Usage limits
* Branch restrictions
* Product/category restrictions

---

## FR-13: Checkout

The system shall allow customers to proceed to checkout.

Before creating an order, the backend shall:

1. Validate the customer session.
2. Validate the selected branch.
3. Validate products.
4. Validate prices.
5. Validate inventory.
6. Validate coupons.
7. Recalculate the order total.
8. Create a pending order.

---

## FR-14: Duplicate Unpaid Order Prevention

The system shall prevent creation of unnecessary duplicate unpaid orders for the same active cart/session.

The system should either:

* Reuse the existing pending order, or
* Expire/cancel the previous pending order before creating another.

---

## FR-15: Payment

The system shall integrate with Razorpay for digital payments.

The payment amount shall be based on the server-calculated order total.

---

## FR-16: Server-Side Payment Verification

The backend shall verify payment information before marking an order as paid.

The system shall validate:

* Payment ID
* Razorpay order ID
* Signature
* Payment amount
* Currency
* Internal order association
* Customer/order relationship

Frontend payment success shall not be considered sufficient proof of payment.

---

## FR-17: Order Status Management

Orders shall support appropriate lifecycle states, including:

* `PENDING_PAYMENT`
* `PAYMENT_PROCESSING`
* `PAID`
* `PAYMENT_FAILED`
* `CANCELLED`
* `REFUND_PENDING`
* `REFUNDED`
* `COMPLETED`

---

## FR-18: Inventory Update

Inventory shall be updated only after the appropriate order/payment state has been confirmed.

Inventory updates shall protect against concurrent purchases and incorrect stock values.

---

## FR-19: Digital Receipt

After successful payment verification, the system shall generate a digital receipt containing:

* Order ID
* Supermarket
* Branch
* Order date/time
* Products
* Quantities
* Product prices
* Discounts
* Taxes where applicable
* Final amount
* Payment status
* Payment reference

---

## FR-20: Exit Verification Token

After successful payment verification, the system shall generate a unique exit verification token.

The token shall be associated with the order and branch.

---

## FR-21: Exit QR Verification

Authorized branch staff shall be able to scan and verify the customer's exit QR/token.

The backend shall verify:

* Token validity
* Order existence
* Payment status
* Correct branch
* Token expiration if applicable
* Whether the order has already been verified/exited

A successfully verified order shall be marked as exited/completed.

---

## FR-22: Order History

Customers shall be able to view previous orders.

Order history shall include:

* Order ID
* Date
* Branch
* Products
* Total
* Payment status
* Order status
* Receipt
* Refund status where applicable

---

# 7. Admin Functional Requirements

## FR-A01: Branch Management

Administrators shall be able to:

* Create branches
* Update branches
* Activate/deactivate branches
* View branches
* Associate branches with supermarkets

---

## FR-A02: Product Management

Administrators shall be able to:

* Add products
* Update products
* Delete/deactivate products
* Upload product images
* Manage categories
* Manage product metadata

---

## FR-A03: Barcode Management

Administrators shall be able to:

* Assign barcodes
* Update barcodes
* Validate barcode uniqueness
* Deactivate invalid barcodes

A barcode shall not be assigned to multiple active products incorrectly.

---

## FR-A04: Price Management

Authorized administrators shall be able to:

* Set product prices
* Update prices
* Configure branch-specific prices where applicable
* Configure offers/discounts

Price changes should be auditable.

---

## FR-A05: Inventory Management

Administrators shall be able to:

* View stock
* Add stock
* Adjust stock
* View low-stock products
* View out-of-stock products

Inventory modifications should be recorded for auditing.

---

## FR-A06: Order Management

Administrators shall be able to:

* View orders
* Search orders
* Filter orders
* View order details
* View payment status
* Cancel eligible orders
* Initiate refunds where authorized

---

## FR-A07: Sales Dashboard

The admin dashboard shall provide basic sales information such as:

* Total sales
* Total orders
* Daily sales
* Branch sales
* Product sales
* Category sales

---

## FR-A08: Suspicious Transaction Management

The system shall identify potentially suspicious transactions and provide administrators with a view for investigation.

Potential indicators include:

* Repeated payment failures
* Unusual quantities
* Repeated barcode scanning patterns
* Payment/order amount mismatch
* Multiple suspicious checkout attempts
* Invalid exit verification attempts

---

# 8. Non-Functional Requirements

## NFR-01: Performance

The application should provide fast product lookup and cart operations under normal operating conditions.

Barcode lookup should ideally respond within approximately 500 ms under normal network/server conditions.

---

## NFR-02: Scalability

The architecture shall support:

* Multiple supermarkets
* Multiple branches
* Large product catalogs
* Large order volumes
* Concurrent customers

---

## NFR-03: Availability

The production system should be highly available and minimize service downtime.

---

## NFR-04: Reliability

The system shall maintain consistent order, payment, and inventory states.

---

## NFR-05: Security

The system shall protect:

* Customer accounts
* Passwords
* Authentication tokens
* Payment information
* Order information
* Administrative operations
* Inventory data

---

## NFR-06: Maintainability

The backend shall use modular architecture separating:

* Controllers
* Services
* Models
* Routes
* Middleware
* Configuration
* Utilities

---

## NFR-07: Observability

The application should provide:

* Request logging
* Error logging
* Payment logs
* Security event logs
* Important inventory operation logs
* Administrative audit logs

---

## NFR-08: Data Integrity

The system shall prevent:

* Negative inventory
* Invalid prices
* Duplicate barcodes
* Unauthorized order modifications
* Invalid payment states
* Duplicate successful payment processing

---

## NFR-09: Usability

The customer application shall:

* Be mobile-friendly
* Provide a simple scanning experience
* Clearly display prices
* Clearly display errors
* Provide clear checkout status
* Work well on modern mobile browsers

---

# 9. Security Requirements

## Authentication

The system shall use secure authentication mechanisms.

Passwords shall never be stored in plaintext.

Passwords shall be securely hashed.

---

## Authorization

Every protected administrative operation shall verify the user's role and permissions.

Users shall only access resources they are authorized to access.

---

## API Security

The backend should implement:

* Input validation
* Rate limiting
* CORS configuration
* Secure HTTP headers
* Request size limits
* Proper error handling
* Authentication middleware
* Authorization middleware

---

## Price Security

The frontend shall never be treated as the source of truth for product prices.

The backend shall retrieve prices from the database.

---

## Payment Security

Payment status shall only be updated after successful server-side verification.

The system shall protect against:

* Signature manipulation
* Amount manipulation
* Payment replay
* Duplicate payment processing
* Incorrect order/payment association

---

## Inventory Security

Inventory changes shall be performed server-side.

The system shall prevent clients from directly modifying stock values.

---

## QR Security

Exit QR codes shall contain a secure, server-verifiable token.

The system shall not trust client-provided fields such as:

```text
paid = true
verified = true
```

---

## Audit Security

Important administrative operations should be recorded, including:

* Price changes
* Inventory changes
* Product changes
* Refunds
* Order cancellations
* Exit verification

---

# 10. Important Business Rules

## BR-01: Price Authority

Product prices are controlled by the supermarket backend.

Customers cannot manually change prices.

---

## BR-02: Barcode Authority

Barcodes identify products.

Customers cannot manually map a barcode to a different product.

---

## BR-03: Branch Isolation

Inventory and branch-specific information must belong to the selected branch.

Customers must not access another branch's inventory or pricing through API manipulation.

---

## BR-04: Inventory Validation

The backend must validate stock before adding/confirming products.

---

## BR-05: Checkout Revalidation

The backend must recalculate the order total during checkout.

The frontend total must not be trusted.

---

## BR-06: Payment Verification

An order must not become `PAID` solely because the frontend reports payment success.

---

## BR-07: Inventory Consistency

Inventory must be updated using a concurrency-safe approach.

---

## BR-08: Duplicate Payment Protection

The same successful payment must not be processed multiple times.

---

## BR-09: Duplicate Order Protection

The system should prevent unnecessary duplicate unpaid orders for the same shopping session.

---

## BR-10: Exit Verification

Only successfully paid and valid orders may receive a valid exit token.

---

## BR-11: Exit Token Reuse

A successfully used exit token must not be reusable.

---

## BR-12: Authorization

Customers must not access administrative functionality.

Branch staff/managers must only access resources belonging to their authorized branch.

---

# 11. Edge Cases

The system shall handle the following cases.

### Authentication

* Duplicate registration
* Invalid password
* Expired JWT
* Invalid JWT
* Unauthorized API request
* Account deactivated

### Barcode

* Invalid barcode
* Unknown barcode
* Duplicate barcode
* Product inactive
* Product unavailable
* Barcode from another branch
* Barcode scanned repeatedly

### Inventory

* Product out of stock
* Insufficient stock
* Concurrent purchases
* Negative inventory attempt
* Inventory changed during checkout

### Pricing

* Price changed during shopping
* Product removed before checkout
* Offer expired
* Coupon expired
* Coupon usage limit reached

### Payment

* Payment cancelled
* Payment failed
* Payment timeout
* Network failure after successful payment
* Duplicate payment callback
* Invalid signature
* Amount mismatch
* Payment for another order
* Duplicate payment attempt

### Orders

* Duplicate unpaid order
* Order cancellation
* Refund
* Partial refund
* Failed refund
* Already completed order

### Exit Verification

* Invalid QR
* Expired token
* Unpaid order
* Already-used token
* Token from another branch
* Network failure during verification

---

# 12. MVP Requirements

The first production-ready MVP should include:

## Customer

* Registration
* Login
* Supermarket selection
* Branch selection
* Barcode scanning
* Product lookup
* Cart
* Quantity management
* Coupon validation
* Checkout
* Razorpay payment
* Server-side payment verification
* Digital receipt
* Exit QR
* Order history

## Admin

* Admin login
* Branch management
* Product management
* Barcode management
* Price management
* Inventory management
* Order management
* Basic sales dashboard
* Refund/cancellation management

## Security

* JWT authentication
* Password hashing
* RBAC
* Input validation
* Rate limiting
* Server-side price validation
* Server-side payment verification
* Inventory protection
* Secure exit token

---

# 13. Future Features

Future versions may include:

## AI

* AI-powered fraud detection
* AI shopping assistant
* Personalized recommendations
* Smart shopping lists
* Demand prediction

## Customer Features

* Loyalty points
* Membership
* Personalized offers
* Wallet
* Store navigation
* Wishlist
* Shopping history analytics

## Supermarket Features

* Supplier management
* Purchase orders
* Advanced inventory forecasting
* Expiry management
* Automated replenishment
* Advanced analytics
* Multi-level employee management

## Advanced Security

* Device fingerprinting
* Risk scoring
* Anomaly detection
* Computer vision at exit
* Product verification using cameras

---

# 14. Recommended Technology Stack

## Frontend

* React
* Vite
* JavaScript/TypeScript
* React Router
* Responsive CSS
* Barcode scanning library/API

## Backend

* Node.js
* Express.js
* REST API
* JWT
* bcrypt/bcryptjs
* Express middleware

## Database

* MongoDB
* Mongoose

## Payment

* Razorpay

## File/Image Storage

* Cloudinary or equivalent object storage

## Testing

* Postman
* Jest/Vitest
* Supertest
* End-to-end testing framework

## Version Control

* Git
* GitHub

## Deployment

Frontend:

* Vercel or equivalent

Backend:

* Render/Railway/Fly.io or equivalent production platform

Database:

* MongoDB Atlas

---

# 15. Recommended Development Phases

## Phase 1 — Requirements & Architecture

* Finalize requirements
* Define user roles
* Design database
* Define API contracts
* Define order lifecycle
* Define payment lifecycle
* Define inventory strategy

---

## Phase 2 — Project Setup

* Initialize frontend
* Initialize backend
* Configure MongoDB
* Configure environment variables
* Configure Git/GitHub
* Establish project structure

---

## Phase 3 — Authentication

* Registration
* Login
* JWT
* Password hashing
* Protected routes
* RBAC

---

## Phase 4 — Supermarket & Branch

* Supermarket model
* Branch model
* Branch management
* Customer branch selection

---

## Phase 5 — Products & Inventory

* Product management
* Barcode management
* Branch inventory
* Pricing
* Stock validation

---

## Phase 6 — Customer Shopping

* Barcode scanner
* Product lookup
* Cart
* Quantity management
* Remove items
* Price display

---

## Phase 7 — Coupons & Checkout

* Coupon validation
* Checkout validation
* Server-side price calculation
* Inventory validation
* Duplicate unpaid order prevention

---

## Phase 8 — Orders & Payments

* Order lifecycle
* Razorpay integration
* Payment verification
* Payment failure handling
* Duplicate payment protection

---

## Phase 9 — Receipt & Exit Verification

* Digital receipt
* Secure exit token
* QR generation
* QR verification
* Exit completion

---

## Phase 10 — Admin Dashboard

* Product management
* Branch management
* Inventory management
* Orders
* Sales
* Refunds
* Suspicious transactions

---

## Phase 11 — Security & Reliability

* Rate limiting
* Input validation
* Security headers
* Authorization checks
* Audit logging
* Error handling
* Concurrency protection

---

## Phase 12 — Testing

* Unit testing
* API testing
* Integration testing
* Payment testing
* Inventory concurrency testing
* End-to-end testing

---

## Phase 13 — Production Deployment

* Deploy frontend
* Deploy backend
* Configure MongoDB Atlas
* Configure environment variables
* Configure HTTPS
* Configure production CORS
* Configure logging
* Configure CI/CD

---

# 16. Definition of Done for MVP

The MVP will be considered complete when a customer can successfully perform the following journey:

```text
Register
   ↓
Login
   ↓
Select supermarket
   ↓
Select branch
   ↓
Scan product
   ↓
Retrieve backend price
   ↓
Add to cart
   ↓
Modify quantity
   ↓
Apply coupon
   ↓
Checkout
   ↓
Server validates cart
   ↓
Server calculates final amount
   ↓
Create pending order
   ↓
Pay using Razorpay
   ↓
Server verifies payment
   ↓
Mark order as PAID
   ↓
Update inventory safely
   ↓
Generate receipt
   ↓
Generate exit QR
   ↓
Staff scans QR
   ↓
Backend verifies QR
   ↓
Exit approved
   ↓
Order marked COMPLETED
```

The application must also demonstrate that unauthorized users **cannot manipulate prices, inventory, payment status, order status, or exit verification through frontend/API requests**.
