import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// import tanstackRouter from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // tanstackRouter({
    //   target: 'react',
    //   autoCodeSplitting: true,
    //   verboseFileRoutes: false,
    // }),
      viteReact(),
    tailwindcss(),
  ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  })
