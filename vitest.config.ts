import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
  '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
};

const migrations = await readD1Migrations('./migrations');

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
                PBKDF2_ITERATIONS: '12500',
                TEST_MIGRATIONS: migrations,
              },
            },
          }),
        ],
        resolve: { alias },
        test: {
          name: 'worker',
          include: ['worker/__tests__/**/*.test.ts'],
          setupFiles: ['./worker/__tests__/apply-migrations.ts'],
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
