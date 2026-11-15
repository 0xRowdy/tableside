// S2-21 Export my data (More → Settings → Account, and the restricted gate
// states' "Export my data"): the account archive (the server export: asked
// for after Confirm it's you, built by the server, emailed when ready,
// downloaded for 24 hours) and this device's local supplement (made here with
// no upload, from what hasn't synced). The screen always says records on
// other devices that haven't synced aren't included.
// TODO(frames): unverified against S2-21 — the frame couldn't be read (Pencil unreachable). Every state here (none, preparing, ready, failed, expired, ended, offline), its copy and layout come from spec 2 *Export*, Amendment 1 B2 and #102.

import type { AccountGate, ServerExport, SignInMethodEntry } from '@tableside/account';
import { useFocusEffect } from 'expo-router';
import { Archive, Smartphone } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/Button';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';

import { useAccount } from './AccountProvider';
import { ConfirmItsYouSheet } from './ConfirmItsYouSheet';
import { InlineMessage, Status } from './FirstRunParts';
import { confirmReason } from './method-text';

/** How often the screen looks again while the archive is being prepared. */
const PREPARING_POLL_MS = 3000;

export const OTHER_DEVICES_NOTE =
  "Records on your other devices that haven't synced aren't included in either. To keep those, make a local supplement on each of those devices.";

const FAILED = "Couldn't reach Tableside. Check your connection and try again.";

/** A size in words: "48 KB", "1.2 MB". */
export function sizeText(bytes: number): string {
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

const untilText = (at: number) => new Date(at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/** What the archive row says about the latest server export. */
function archiveDetail(latest: ServerExport | null): string {
  if (latest === null) return 'Needs a connection. Check it, then come back.';
  switch (latest.state) {
    case 'none':
      return "A spreadsheet of your sessions and data files of everything your account holds. It's free, and we'll email you when it's ready.";
    case 'preparing':
      return "Preparing your archive. We'll email you when it's ready; you can leave this screen.";
    case 'ready':
      return `Ready · ${sizeText(latest.bytes)} · available until ${untilText(latest.expiresAt)}`;
    case 'failed':
      return "Your last archive couldn't be prepared. Prepare it again.";
    case 'expired':
      return 'Your last archive expired after 24 hours. Prepare a new one.';
    case 'ended':
      return latest.by === 'revocation'
        ? 'Your last archive was canceled because a device was signed out of your account. Prepare a new one.'
        : 'Your last archive is no longer available. Prepare a new one.';
  }
}

/** How much a local supplement holds: records not synced yet (unfinished activities among them), and conflicts awaiting review. */
type SupplementCounts = { readonly unsynced: number; readonly conflicts: number };

/** What the supplement row says about this device. */
function supplementDetail(counts: SupplementCounts | null): string {
  if (counts === null) return 'Made on this device from what it holds; nothing is uploaded.';
  const { unsynced, conflicts } = counts;
  if (unsynced === 0 && conflicts === 0) return "Everything on this device has synced, so there's nothing extra to save.";
  const parts = [
    ...(unsynced > 0 ? [`${unsynced === 1 ? '1 record' : `${unsynced} records`} not synced yet`] : []),
    ...(conflicts > 0 ? [`${conflicts === 1 ? '1 conflict' : `${conflicts} conflicts`} awaiting review`] : []),
  ];
  return `${parts.join(' and ')}, each labeled so it isn't mistaken for a finished session. Nothing is uploaded.`;
}

/** The account an export copy belongs to: the open one's. */
const gateAccount = (gate: AccountGate): string | null => ('accountId' in gate ? gate.accountId : null);

export function ExportScreen({ back }: { back: { label: string; onPress: () => void } }) {
  const { service, account } = useAccount();
  const [latest, setLatest] = useState<ServerExport | null | undefined>();
  const [waiting, setWaiting] = useState<SupplementCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ readonly methods: readonly SignInMethodEntry[]; readonly then: 'request' | 'download' } | null>(null);

  const reload = useCallback(async () => {
    setLatest(await service.export.serverExport());
  }, [service]);

  useFocusEffect(
    useCallback(() => {
      void reload();
      void service.export.localSupplement().then((supplement) => {
        setWaiting(supplement ? { unsynced: supplement.unsynced.length + supplement.unfinished.length, conflicts: supplement.conflicts.length } : null);
      });
    }, [reload, service]),
  );

  // While the archive is prepared, look again now and then.
  useEffect(() => {
    if (latest?.state !== 'preparing') return;
    const timer = setInterval(() => void reload(), PREPARING_POLL_MS);
    return () => clearInterval(timer);
  }, [latest?.state, reload]);

  /** Asks the player to confirm it's them, then carries on. */
  const confirmFirst = async (then: 'request' | 'download') => {
    const methods = await service.freshAuthentication.methods();
    if (methods) setConfirming({ methods, then });
    else setProblem(FAILED);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    setStatus(null);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const request = () =>
    run(async () => {
      const result = await service.export.requestServerExport();
      if (result.status === 'requested' || result.status === 'preparing') setLatest(result.export);
      else if (result.status === 'fresh-authentication-required') await confirmFirst('request');
      else setProblem(FAILED);
    });

  const download = () =>
    run(async () => {
      const result = await service.export.downloadServerExport();
      if (result.status === 'downloaded') {
        const accountId = gateAccount(service.gate);
        const shared = accountId ? await account.exportFiles.share(accountId, { name: result.fileName, mimeType: 'application/zip', contents: result.bytes }) : 'failed';
        if (shared === 'failed') setProblem("Couldn't save the archive on this device. Try again.");
      } else if (result.status === 'fresh-authentication-required') {
        await confirmFirst('download');
      } else if (result.status === 'not-ready') {
        await reload();
      } else {
        setProblem(FAILED);
      }
    });

  const saveSupplement = () =>
    run(async () => {
      const supplement = await service.export.localSupplement();
      if (!supplement) {
        setProblem("Couldn't read this device's records. Close and reopen the app, then try again.");
        return;
      }
      const name = `tableside-local-supplement-${supplement.createdAt.slice(0, 10)}.json`;
      const accountId = gateAccount(service.gate);
      const shared = accountId
        ? await account.exportFiles.share(accountId, { name, mimeType: 'application/json', contents: `${JSON.stringify(supplement, null, 2)}\n` })
        : 'failed';
      if (shared === 'failed') setProblem("Couldn't save the local supplement on this device. Try again.");
      else setStatus('Local supplement made.');
    });

  return (
    <SettingsScreen title="Export my data" back={back}>
      <Note>{"Get a free copy of your data: an archive of everything your account holds, and a supplement of what this device hasn't synced yet."}</Note>
      <GroupLabel>YOUR ACCOUNT</GroupLabel>
      <Group>
        <ListRow icon={Archive} title="Account archive" detail={latest === undefined ? 'Checking…' : archiveDetail(latest)} />
      </Group>
      {latest?.state === 'ready' ? (
        <>
          <Button label="Download archive" stretch disabled={busy} onPress={() => void download()} />
          <Button label="Prepare a new archive" variant="ghost" stretch disabled={busy} onPress={() => void request()} />
        </>
      ) : (
        latest !== undefined &&
        latest !== null &&
        latest.state !== 'preparing' && <Button label="Prepare archive" stretch disabled={busy} onPress={() => void request()} />
      )}
      <Note>{"You'll be asked to confirm it's you first. The archive is kept for 24 hours, and only this account can download it."}</Note>
      <GroupLabel>THIS DEVICE</GroupLabel>
      <Group>
        <ListRow icon={Smartphone} title="Local supplement" detail={supplementDetail(waiting)} />
      </Group>
      <Button label="Save local supplement" variant="secondary" stretch disabled={busy} onPress={() => void saveSupplement()} />
      <Note>{OTHER_DEVICES_NOTE}</Note>
      {problem !== null && <InlineMessage>{problem}</InlineMessage>}
      {status !== null && <Status>{status}</Status>}
      {confirming && (
        <ConfirmItsYouSheet
          reason={confirmReason({ kind: 'export' })}
          methods={confirming.methods}
          onClose={() => setConfirming(null)}
          onConfirmed={() => {
            const { then } = confirming;
            setConfirming(null);
            void (then === 'request' ? request() : download());
          }}
        />
      )}
    </SettingsScreen>
  );
}
