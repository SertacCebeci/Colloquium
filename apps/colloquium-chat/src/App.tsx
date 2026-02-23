import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100dvh",
              backgroundColor: "#0d0d0d",
              color: "#e8e8e8",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Colloquium Chat</h1>
              <p style={{ color: "#6b6b6b", fontSize: 14 }}>
                Bootstrap complete — development session pending.
              </p>
            </div>
          </div>
        }
      />
      <Route path="/login" element={<div>Login page — coming soon</div>} />
      <Route path="/register" element={<div>Register page — coming soon</div>} />
      <Route path="/w/*" element={<div>Workspace — coming soon</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
