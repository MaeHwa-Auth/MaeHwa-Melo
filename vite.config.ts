import { defineConfig } from "vite";

export default defineConfig({ clearScreen: false, server: { port: 14200, strictPort: true }, envPrefix: ["VITE_", "TAURI_ENV_*"], build: { target: "es2022" } });
