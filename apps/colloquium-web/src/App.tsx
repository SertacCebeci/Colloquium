import { Routes, Route, Navigate } from "react-router-dom";
import { ChannelFeedPage } from "./features/messaging/ChannelFeedPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Reddit Clone — coming soon</div>} />
      <Route path="/channels/:channelId" element={<ChannelFeedPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
