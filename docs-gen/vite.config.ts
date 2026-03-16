
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000, // force everything to be inlined
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    outDir: '../dist-docs',
    emptyOutDir: true,
  }
})
