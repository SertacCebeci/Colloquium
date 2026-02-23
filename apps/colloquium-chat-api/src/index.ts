import { serve } from "@hono/node-server";
import app from "./app.js";

const PORT = Number(process.env.PORT ?? 5001);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`colloquium-chat-api running on http://localhost:${info.port}`);
  }
);
