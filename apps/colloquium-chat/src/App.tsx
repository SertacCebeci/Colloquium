import { Routes, Route, Navigate } from "react-router-dom";
import { RegisterPage } from "./pages/RegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { WorkspaceCreatePage } from "./pages/WorkspaceCreatePage";
import { RequireAuth } from "./components/RequireAuth";
import { RequireGuest } from "./components/RequireGuest";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import { WorkspacePage } from "./pages/WorkspacePage";

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
        path="/w/*"
        element={
          <RequireAuth>
            <WorkspaceLayout>
              <Routes>
                <Route path="new" element={<WorkspaceCreatePage />} />
                <Route path=":slug/*" element={<WorkspacePage />} />
              </Routes>
            </WorkspaceLayout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/register" replace />} />
    </Routes>
  );
}

export default App;
