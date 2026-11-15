// What the web account page (#106) imports: its client, the backend it was
// built for, and the wording it shares with the app. Nothing here pulls in
// the Supabase client or the app's sync, so the page's bundle stays small.

export { type BackendEnvironment, backendEnvironment } from './environment';
export * from './lifecycle-text';
export type { PendingDeletion } from './deletion-progress';
export type {
  CancelDeletionResult,
  CodeRequestResult,
  DeletePermanentlyResult,
  DeletionProgress,
  FreshAuthenticationResult,
  ScheduleDeletionResult,
} from './service';
export {
  WEB_DEVICE_LABEL,
  type WebAccount,
  type WebAccountOptions,
  type WebAccountView,
  type WebSignInResult,
  type WebStorage,
  createWebAccount,
} from './web-account';
