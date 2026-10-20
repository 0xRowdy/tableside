// The quarantine list shipped with the app (Amendment 3 §1): combinations of
// pinned identities a proven defect affects. A completed record's quarantine
// status is derived from this list on every read, never stored, and the
// server mirrors the same plain, versioned data (Amendment 6 §6). Each new
// entry bumps the version; entries are never edited or removed.

import type { QuarantineList } from '@tableside/engine';

export const QUARANTINE_LIST: QuarantineList = { version: 1, entries: [] };
