import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const SERVER = process.env.VITE_SERVER_URL || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from phones on the same network (for the QR code)
    port: 5173,
    proxy: {
      '/api': SERVER,
      '/socket.io': { target: SERVER, ws: true },
    },
  },
});
