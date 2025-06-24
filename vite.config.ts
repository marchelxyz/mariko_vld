import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@entities": path.resolve(__dirname, "./src/entities"),
      "@radix-ui/react-dialog": "@radix-ui/react-dialog",
      "lucide-react": "lucide-react",
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    cssCodeSplit: true,
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
          animations: ["framer-motion"],
          charts: ["recharts"],
          date: ["date-fns"],
        },
        // Оптимизация имен файлов
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
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
    target: "es2020",
    format: "esm",
  },
}));
