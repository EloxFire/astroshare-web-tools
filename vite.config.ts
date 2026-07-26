import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Chargées via import() dynamique uniquement au moment de l'export PDF :
    // les pré-bundler évite l'erreur "Failed to fetch dynamically imported module"
    // au premier clic sur "Exporter".
    include: ['html2canvas-pro', 'jspdf'],
  },
})
