
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // Fixed: Cast process to any to avoid 'cwd' property error in environments with incomplete or browser-shimmed Process types
    const env = loadEnv(mode, (process as any).cwd(), ''); 
    return {
      define: {
        // Alignment with guidelines: use process.env.API_KEY as the standard for the Gemini SDK
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY)
      },
      // No need for resolve alias if your tsconfig paths handle it or not used
    };
});
