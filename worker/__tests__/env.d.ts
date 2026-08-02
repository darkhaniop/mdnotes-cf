/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      /** Injected by vitest.config.ts via `readD1Migrations()`. */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
