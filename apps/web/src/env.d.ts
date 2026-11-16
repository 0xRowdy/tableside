// The build-time settings Vite writes into the page (vite.config.ts).
interface ImportMetaEnv {
  readonly TABLESIDE_WEB_ENVIRONMENT: string | undefined;
  readonly TABLESIDE_WEB_SUPABASE_URL: string | undefined;
  readonly TABLESIDE_WEB_SUPABASE_PUBLISHABLE_KEY: string | undefined;
  /** Sign in with Apple on the page: the Services ID whose return URL is the page's (provider-callback). Unset: no Apple button. */
  readonly TABLESIDE_WEB_APPLE_CLIENT_ID: string | undefined;
  /** Sign in with Google on the page: its web client ID. Unset: no Google button. */
  readonly TABLESIDE_WEB_GOOGLE_CLIENT_ID: string | undefined;
}
