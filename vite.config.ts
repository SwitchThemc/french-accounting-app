import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react-vendor";
          if (id.includes("node_modules/jspdf") || id.includes("node_modules/html2canvas") || id.includes("node_modules/dompurify")) return "pdf-vendor";
          if (id.includes("node_modules/tesseract.js") || id.includes("node_modules/tesseract.js-core")) return "ocr-vendor";
          if (id.includes("node_modules/@supabase")) return "supabase-vendor";
        },
      },
    },
  },
});
