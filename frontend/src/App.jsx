import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, homeFor, useAuth } from "./auth.jsx";
import { I18nProvider } from "./i18n.jsx";
import { AppShell, BootScreen, PublicLayout } from "./layout.jsx";
import { Loading, ToastProvider } from "./ui.jsx";
import Landing from "./pages/public/Landing.jsx";
import JobPage from "./pages/public/JobPage.jsx";
import Login from "./pages/public/Login.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import Employees from "./pages/hr/Employees.jsx";
import EmployeeDetail from "./pages/hr/EmployeeDetail.jsx";
import Services from "./pages/hr/Services.jsx";
import Contracts from "./pages/hr/Contracts.jsx";
import Leaves from "./pages/hr/Leaves.jsx";
import Attendance from "./pages/hr/Attendance.jsx";
import Payroll from "./pages/hr/Payroll.jsx";
import Recruitment from "./pages/hr/Recruitment.jsx";
import MyHome from "./pages/me/MyHome.jsx";
import MyLeaves from "./pages/me/MyLeaves.jsx";
import MyAttendance from "./pages/me/MyAttendance.jsx";
import MyPayslips from "./pages/me/MyPayslips.jsx";

// the dashboard brings Chart.js: loaded only when an HR user opens it
const Dashboard = lazy(() => import("./pages/hr/Dashboard.jsx"));

function RequireAuth() {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.must_change_password && loc.pathname !== "/password") return <Navigate to="/password" replace />;
  return <AppShell />;
}

function RequireHR() {
  const { isHR } = useAuth();
  return isHR ? <Outlet /> : <Navigate to="/me" replace />;
}

function RequireEmployee() {
  const { user } = useAuth();
  return user.employee ? <Outlet /> : <Navigate to={homeFor(user)} replace />;
}

function Root() {
  const { user } = useAuth();
  if (user === undefined) return __DEMO__ ? <BootScreen /> : <Loading />;
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/jobs/:id" element={<JobPage />} />
        <Route path="/login" element={<Login />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/password" element={<ChangePassword />} />
        <Route path="/hr" element={<RequireHR />}>
          <Route index element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
          <Route path="employees" element={<Employees />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="leaves" element={<Leaves />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="recruitment" element={<Recruitment />} />
        </Route>
        <Route path="/me" element={<RequireEmployee />}>
          <Route index element={<MyHome />} />
          <Route path="leaves" element={<MyLeaves />} />
          <Route path="attendance" element={<MyAttendance />} />
          <Route path="payslips" element={<MyPayslips />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ToastProvider>
          <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Root />
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
