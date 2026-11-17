// #106

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
} from './account-service/types';
export {
  PROVIDER_AUTHORIZE_URLS,
  WEB_DEVICE_LABEL,
  type WebAccount,
  type WebAccountOptions,
  type WebAccountView,
  type WebProvider,
  type WebProviderSettings,
  type WebProviderSignInResult,
  type WebSignInResult,
  type WebStorage,
  createWebAccount,
} from './web-account';
