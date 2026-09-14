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
                        {/* Scan-Focused Customer Home */}
                        <Route path="/" element={<HomePage />} />
                        <Route path="/stores" element={<StoreSelectPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/scan" element={<ScannerPage />} />
                        {/* Branch-Aware Customer Catalog & Product Search */}
                        <Route path="/catalog" element={<CatalogPage />} />
                        <Route path="/search" element={<CatalogPage />} />
                        <Route path="/cart" element={<CartPage />} />

                        {/* Customer Protected Routes */}
                        <Route
                          path="/checkout"
                          element={
                            <ProtectedRoute>
                              <CheckoutPage />
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
                        <Route
                          path="/orders"
                          element={
                            <ProtectedRoute>
                              <OrdersHistoryPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Admin / Manager Product Database Management */}
                        <Route
                          path="/admin/products"
                          element={
                            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SUPER_ADMIN']}>
                              <AdminProductsPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Staff / Manager Security Gate Terminal */}
                        <Route
                          path="/terminal"
                          element={
                            <ProtectedRoute allowedRoles={['BRANCH_STAFF', 'BRANCH_MANAGER', 'SUPER_ADMIN']}>
                              <GateTerminalPage />
                            </ProtectedRoute>
                          }
                        />

                        {/* Authentication */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        {/* Fallback */}
                        <Route path="*" element={<Navigate to="/" replace />} />
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

