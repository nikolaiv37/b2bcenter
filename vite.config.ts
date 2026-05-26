import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    svgr(),
    // Only run visualizer when ANALYZE=true (don't slow normal builds)
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    // lucide-react removed from exclude - let Vite pre-bundle it for faster dev cold start
  },
  build: {
    // recharts, posthog, and @react-pdf are only reached via dynamic import().
    // Letting Rollup chunk them naturally keeps them in async-only chunks so
    // Vite does not emit eager <link rel="modulepreload"> for them in index.html.
    chunkSizeWarningLimit: 1600,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: ['evromar.local', 'hotfarms.local', 'platform.centivon.local', 'centivon.local'],
  },
})
