// What the web account page (#106) imports: its client, the backend it was
// built for, and the wording it shares with the app. Nothing here pulls in
// the Supabase client or the app's sync, so the page's bundle stays small.

export { type BackendEnvironment, backendEnvironment } from './environment';
export {
  BACKUPS_DETAIL,
  CANCEL_FAILED,
  CANCEL_TOO_LATE,
  DELETION_UNKNOWN,
  PROVIDER_GRANT_DETAIL,
  SCHEDULE_UNKNOWN,
  STORES,
  type Store,
  WEB_PAGES,
  analyticsDetail,
  dayText,
  deletionDetail,
  scheduledDetail,
} from './lifecycle-text';
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
