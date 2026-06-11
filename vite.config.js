import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' = relative asset paths: works at psa-sucks.com root
// AND at username.github.io/repo/ without edits
export default defineConfig({
  plugins: [react()],
  base: './',
})
