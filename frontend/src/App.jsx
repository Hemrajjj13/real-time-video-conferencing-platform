import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Authentication from "./pages/Authentication";
import HistoryPage from "./pages/History";
import HomePage from "./pages/Home";
import LandingPage from "./pages/Landing";
import MeetingRoom from "./pages/VideoMeet";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate replace to="/auth" />;
  }

  return children;
};

const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate replace to="/home" />;
  }

  return children;
};

const AppRoutes = () => (
  <Routes>
    <Route element={<LandingPage />} path="/" />
    <Route
      element={
        <PublicOnlyRoute>
          <Authentication />
        </PublicOnlyRoute>
      }
      path="/auth"
    />
    <Route
      element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      }
      path="/home"
    />
    <Route
      element={
        <ProtectedRoute>
          <HistoryPage />
        </ProtectedRoute>
      }
      path="/history"
    />
    <Route
      element={
        <ProtectedRoute>
          <MeetingRoom />
        </ProtectedRoute>
      }
      path="/meeting/:meetingId"
    />
    <Route element={<Navigate replace to="/" />} path="*" />
  </Routes>
);

const App = () => (
  <AuthProvider>
    <AppRoutes />
  </AuthProvider>
);

export default App;
