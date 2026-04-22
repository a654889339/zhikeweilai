import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from '@vant/auto-import-resolver';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [VantResolver()],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5301,
    proxy: {
      '/api': {
        target: 'http://localhost:5302',
        changeOrigin: true,
      },
      /** 3D 素材与小程序同源（主前端 nginx 静态目录）；本地无文件时可走线上 */
      '/res': {
        target: 'http://106.54.50.88:5301',
        changeOrigin: true,
      },
    },
  },
});
