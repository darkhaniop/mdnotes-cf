/**
 * The Worker is bundled by Vite (via @cloudflare/vite-plugin), so `import.meta.env`
 * is available even though it is not part of the Workers runtime types.
 */
interface ImportMeta {
  readonly env?: { readonly DEV?: boolean; readonly PROD?: boolean; readonly MODE?: string };
}
