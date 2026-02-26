import { Routes, Route, Navigate } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Reddit Clone — coming soon</div>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
