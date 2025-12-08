import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/' : '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared/ui": path.resolve(__dirname, "./src/shared/ui/ui"),
      "@shared/ui/widgets": path.resolve(__dirname, "./src/shared/ui/widgets.ts"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@entities": path.resolve(__dirname, "./src/entities"),
      "@widgets": path.resolve(__dirname, "./src/widgets"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@radix-ui/react-dialog": "@radix-ui/react-dialog",
      "lucide-react": "lucide-react",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode === 'production' ? 'hidden' : false,
    minify: "esbuild",
    target: "es2017",
    cssCodeSplit: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Оптимизированный code splitting
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-toast"],
          icons: ["lucide-react"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          utils: ["class-variance-authority", "clsx", "tailwind-merge"],
        },
        // Оптимизация имен файлов
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
    chunkSizeWarningLimit: 900,
  },
  optimizeDeps: {
    include: [
      "react", 
      "react-dom", 
      "react-router-dom",
      "@radix-ui/react-dialog",
      "lucide-react"
    ],
    exclude: ["@radix-ui/react-tooltip", "@radix-ui/react-hover-card"],
  },
  // Производительность для разработки
  esbuild: {
    target: "es2017",
    format: "esm",
  },
}));
