// The build-time settings Vite writes into the page (vite.config.ts).
interface ImportMetaEnv {
  readonly TABLESIDE_WEB_ENVIRONMENT: string | undefined;
  readonly TABLESIDE_WEB_SUPABASE_URL: string | undefined;
  readonly TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY: string | undefined;
}
