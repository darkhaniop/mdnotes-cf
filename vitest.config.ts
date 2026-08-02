import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                JWT_SECRET: 'test-jwt-secret-not-for-production',
                ASSET_COOKIE_SECRET: 'test-asset-cookie-secret',
                PBKDF2_ITERATIONS: '100000',
              },
            },
          }),
        ],
        resolve: { alias },
        test: {
          name: 'worker',
          include: ['worker/__tests__/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'client',
          environment: 'jsdom',
          globals: true,
          include: ['src/__tests__/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/__tests__/setup.ts'],
        },
      },
    ],
  },
});
