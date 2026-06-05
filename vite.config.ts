import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const HERMES_GATEWAY_PROXY_PREFIX = '/__hermes_gateway_proxy__'
const HERMES_GATEWAY_TARGET = 'http://127.0.0.1:9120'

function rewriteHermesGatewayPath(requestPath: string) {
  const next = requestPath.replace(new RegExp(`^${HERMES_GATEWAY_PROXY_PREFIX}`), '')
  return next || '/'
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      [HERMES_GATEWAY_PROXY_PREFIX]: {
        target: HERMES_GATEWAY_TARGET,
        changeOrigin: true,
        rewrite: rewriteHermesGatewayPath,
        ws: true,
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      [HERMES_GATEWAY_PROXY_PREFIX]: {
        target: HERMES_GATEWAY_TARGET,
        changeOrigin: true,
        rewrite: rewriteHermesGatewayPath,
        ws: true,
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'es2022',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  esbuild: {
    // Skip TypeScript type checking
    target: 'es2022',
  },
})
