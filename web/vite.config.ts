import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const server = process.env.VITE_SERVER_URL ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { "/socket.io": { target: server, ws: true }, "/data": server },
  },
});
