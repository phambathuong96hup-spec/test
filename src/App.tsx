import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AuthProvider from './AuthProvider';
import { useAuth } from './authContext';
import ErrorBoundary from './components/ErrorBoundary';
import MasterLayout from './components/layout/MasterLayout';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Devices = lazy(() => import('./pages/DeviceList'));
const DeviceDetails = lazy(() => import('./pages/DeviceProfile'));
const Requests = lazy(() => import('./pages/Requests'));
const AdminRepairs = lazy(() => import('./pages/AdminRepairs'));
const Reports = lazy(() => import('./pages/Reports'));
const GspLog = lazy(() => import('./pages/GspLog'));

const PageLoader = () => (
  <div style={{ padding: '32px', color: 'var(--text-secondary)' }}>Đang tải...</div>
);

// ========== ROUTE GUARDS ==========

const PrivateRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (roles && !roles.map(item => item.toLowerCase()).includes(role.toLowerCase())) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

function LoginRedirect() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

// ========== APP ==========

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginRedirect />} />

              <Route path="/" element={<MasterLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                {/* ✅ PUBLIC */}
                <Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="devices" element={<Devices />} />
                <Route path="devices/:id" element={<DeviceDetails />} />

                {/* 🔒 PRIVATE */}
                <Route path="requests" element={<PrivateRoute><Requests /></PrivateRoute>} />
                <Route path="repairs" element={<Navigate to="/requests?type=repair" replace />} />
                <Route path="admin-repairs" element={<PrivateRoute roles={['admin']}><AdminRepairs /></PrivateRoute>} />
                <Route path="transfers" element={<Navigate to="/requests?type=transfer" replace />} />
                <Route path="reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
                <Route path="gsp" element={<PrivateRoute><GspLog /></PrivateRoute>} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
