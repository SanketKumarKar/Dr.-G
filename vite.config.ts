import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY),
      'process.env.GOOGLE_GENAI_API_KEY': JSON.stringify(env.GOOGLE_GENAI_API_KEY),
      'import.meta.env.GOOGLE_GENAI_API_KEY': JSON.stringify(env.GOOGLE_GENAI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'terser',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom'],
            'animation': ['framer-motion']
          }
        }
      }
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});
