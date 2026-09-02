import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/React-modul-3/",
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setup.js",
  },
});
