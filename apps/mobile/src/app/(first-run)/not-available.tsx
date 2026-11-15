// The age step's under-13 end state: no account, and nothing further asked.
// TODO(frames): unverified against S2-15 (Pencil couldn't open Tableside.pen for #88).

import { FirstRunScreen } from '@/account/FirstRunParts';

export default function NotAvailable() {
  return <FirstRunScreen title="Tableside isn't available" intro="Tableside is for people 13 and older. No account was created and nothing you entered was kept." />;
}
