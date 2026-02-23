import { Routes, Route, Navigate } from "react-router-dom";
import { RegisterPage } from "./pages/RegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireGuest } from "./components/RequireGuest";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/register" replace />} />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <LoginPage />
          </RequireGuest>
        }
      />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/w/new"
        element={
          <RequireAuth>
            <div>Create workspace — coming soon</div>
          </RequireAuth>
        }
      />
      <Route
        path="/w/*"
        element={
          <RequireAuth>
            <div>Workspace — coming soon</div>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}

export default App;
