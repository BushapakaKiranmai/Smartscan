import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { CartProvider } from './context/CartContext';

import Navbar from './components/Navbar';
import BottomNav from './components/BottomNav';
import CartDrawer from './components/CartDrawer';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import HomePage from './pages/HomePage';
import StoreSelectPage from './pages/StoreSelectPage';
import ScannerPage from './pages/ScannerPage';
import AdminProductsPage from './pages/AdminProductsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import OrdersHistoryPage from './pages/OrdersHistoryPage';
import ProfilePage from './pages/ProfilePage';
import GateTerminalPage from './pages/GateTerminalPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CatalogPage from './pages/CatalogPage';
import ProductDetailPage from './pages/ProductDetailPage';
import WishlistPage from './pages/WishlistPage';
import NotFoundPage from './pages/NotFoundPage';

export const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <StoreProvider>
              <CartProvider>
                <div className="app-layout">
                  <Navbar />
                  <CartDrawer />

                  <main style={{ flex: 1 }}>
                    <ErrorBoundary>
                      <Routes>
                        {/* 1. Clean Home routes */}
                        <Route path="/" element={<HomePage />} />
                        <Route path="/home" element={<HomePage />} />

                        {/* 2. Store Selection & Scan & Go */}
                        <Route path="/stores" element={<StoreSelectPage />} />
                        <Route path="/scan" element={<ScannerPage />} />

                        {/* 3. Products, Categories & Details */}
                        <Route path="/products" element={<CatalogPage />} />
                        <Route path="/products/:productId" element={<ProductDetailPage />} />
                        <Route path="/catalog" element={<CatalogPage />} />
                        <Route path="/search" element={<CatalogPage />} />
                        <Route path="/men" element={<CatalogPage category="Men" />} />
                        <Route path="/women" element={<CatalogPage category="Women" />} />

                        {/* 4. Customer Cart & Wishlist */}
                        <Route
                          path="/cart"
                          element={
                            <ProtectedRoute>
                              <CartPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/wishlist" element={<WishlistPage />} />

                        {/* 5. Protected Customer Account & History */}
                        <Route
                          path="/profile"
                          element={
                            <ProtectedRoute>
                              <ProfilePage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders"
                          element={
                            <ProtectedRoute>
                              <OrdersHistoryPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* 6. Payment & Checkout (both clean /payment and /checkout alias) */}
                        <Route
                          path="/payment"
                          element={
                            <ProtectedRoute>
                              <CheckoutPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/checkout"
                          element={
                            <ProtectedRoute>
                              <CheckoutPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* 7. Exit Pass & Order Success */}
                        <Route
                          path="/exit-pass"
                          element={
                            <ProtectedRoute>
                              <OrderSuccessPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/exit-pass/:orderId"
                          element={
                            <ProtectedRoute>
                              <OrderSuccessPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/order-success/:orderId"
                          element={
                            <ProtectedRoute>
                              <OrderSuccessPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* 8. Admin / Manager Product Database */}
                        <Route
                          path="/admin"
                          element={
                            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SUPER_ADMIN']}>
                              <AdminProductsPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/admin/products"
                          element={
                            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SUPER_ADMIN']}>
                              <AdminProductsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* 9. Staff Security Gate Terminal */}
                        <Route
                          path="/terminal"
                          element={
                            <ProtectedRoute allowedRoles={['BRANCH_STAFF', 'BRANCH_MANAGER', 'SUPER_ADMIN']}>
                              <GateTerminalPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* 10. Authentication */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        {/* 11. Application-level custom 404 for genuinely unknown routes */}
                        <Route path="*" element={<NotFoundPage />} />
                      </Routes>
                    </ErrorBoundary>
                  </main>

                  <BottomNav />
                </div>
              </CartProvider>
            </StoreProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
