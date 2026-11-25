// TODO(spec 2 S2-20)
// TODO(spec 7)

import type { AccountSync, HistoryDownload, SyncStatus, UpdateNotice, UploadStatus } from '@tableside/account';
import {
  CircleAlert,
  CloudCheck,
  CloudDownload,
  CloudOff,
  CloudUpload,
  Download,
  Flag,
  HardDrive,
  HardDriveDownload,
  Hourglass,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useSyncExternalStore } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { findGame } from '@/games';
import { useKeyboardFocus } from '@/hooks/use-keyboard-focus';
import { Group, Note, SettingsScreen } from '@/settings/SettingsParts';
import { pressStyle } from '@/theme/press';
import { fonts, MIN_TOUCH_TARGET, palette, radius, space, textScale, type ColorToken } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

export interface SyncStatusScreenProps {
  readonly sync: AccountSync;
  readonly onBack: () => void;
  readonly onUpdate: () => void;
  readonly now?: () => number;
}

export function SyncStatusScreen({ sync, onBack, onUpdate, now = Date.now }: SyncStatusScreenProps) {
  const status = useSyncStatus(sync);
  const at = now();
  const required = status.update?.state === 'required';
  const waiting = status.uploads.filter((upload) => ROW_STATE[upload.state].uploads);
  const flagged = status.uploads.filter((upload) => upload.state === 'flagged');
  const accountError = ACCOUNT_ERRORS.has(status.error);
  const { history, download } = status;
  const storageStop =
    download.state === 'stopped' && download.reason === 'storage'
      ? { what: 'Download all history', progress: download.progress, resume: () => void sync.downloadAllHistory() }
      : history.state === 'incomplete' && history.stopped === 'storage'
        ? { what: 'The first download', progress: history.detail, resume: () => void sync.reconcile() }
        : null;
  return (
    <SettingsScreen title="Sync status" back={{ label: 'Account', onPress: onBack }}>
      {status.update?.state === 'retiring' && <RetiringNotice update={status.update} onUpdate={onUpdate} />}
      {required && <UpdateRequired testID="update-required" reason={status.update?.reason ?? null} onUpdate={onUpdate} />}
      {storageStop ? (
        <Banner
          testID="storage-banner"
          icon={HardDrive}
          tone="destructive"
          title={`Your ${DEVICE} is full`}
          body={`${storageStop.what} stopped at ${percentOf(storageStop.progress)}%. To make room, nothing unsynced or unfinished was removed. Free up space, then resume.`}
          action={{ label: 'Resume download', onPress: storageStop.resume }}
        />
      ) : (
        <StatusCard status={status} waiting={waiting.length} now={at} />
      )}
      {status.error === 'offline' && (
        <Banner
          testID="error-banner"
          icon={CircleAlert}
          tone="destructive"
          title="Sync error"
          body="No response from the server. We'll keep trying while the app is open, and when your connection comes back."
          action={{ label: 'Retry now', onPress: () => void sync.reconcile() }}
        />
      )}
      {status.error === 'sign-in-required' && (
        <Banner
          testID="error-banner"
          icon={CircleAlert}
          tone="destructive"
          title="Sign in again to sync"
          body={`Your records are safe on this ${DEVICE} and sync once you sign in to this account again.`}
          action={{ label: 'Retry now', onPress: () => void sync.reconcile() }}
        />
      )}
      {status.error === 'storage' && (
        <Banner
          testID="error-banner"
          icon={CircleAlert}
          tone="destructive"
          title="Sync error"
          body={`Tableside couldn't save what it synced on this ${DEVICE}. Nothing was lost. Free up some space, then retry.`}
          action={{ label: 'Retry now', onPress: () => void sync.reconcile() }}
        />
      )}
      {status.error === 'unreadable-change' && !required && (
        <Banner
          testID="error-banner"
          icon={Download}
          tone="warning"
          title="Update to get everything"
          body={`Your account has changes this version of Tableside can't show yet. Records on this ${DEVICE} keep syncing.`}
          action={{ label: STORE_ACTION, onPress: onUpdate }}
        />
      )}
      {flagged.length > 0 && <FlaggedBanner flagged={flagged} sync={sync} now={at} />}
      {history.state === 'incomplete' && (
        <>
          <Progress label="Summaries and totals" fraction={history.summaries} />
          <Progress label="Last 90 days of detail" fraction={history.detail} />
          <Banner
            icon={Hourglass}
            tone="warning"
            title="First download isn't finished"
            body="Some sessions show a summary only until their detail arrives. Older detail downloads when you open it."
          />
          {download.state === 'not-requested' && (
            <>
              <SecondaryButton icon={HardDriveDownload} label="Download all history" onPress={() => void sync.downloadAllHistory()} />
              <Note>Download all history keeps everything on this device, for trips without a connection. It can pause and resume.</Note>
            </>
          )}
        </>
      )}
      <DownloadProgress download={download} />
      {storageStop && <Note>If saving a session fails for the same reason, play pauses with a saving error rather than continuing unsaved.</Note>}
      {status.uploads.length > 0 && (
        <>
          <SectionLabel>Waiting</SectionLabel>
          <Group>
            {status.uploads.map((upload, index) => (
              <UploadRow key={upload.id} upload={upload} now={at} first={index === 0} />
            ))}
          </Group>
        </>
      )}
      {waiting.length > 0 && !accountError && !required && <SecondaryButton icon={RefreshCw} label="Sync now" onPress={() => void sync.reconcile()} />}
      {waiting.length > 0 && (
        <Note>{`Records waiting here are only on this ${DEVICE}. If you delete the app before they sync, they're lost. Everything synced comes back when you sign in again.`}</Note>
      )}
      {status.error === 'offline' && <Note>Practice works normally offline. Nothing is lost or counted twice when sync resumes.</Note>}
    </SettingsScreen>
  );
}

function DownloadProgress({ download }: { download: HistoryDownload }) {
  if (download.state === 'not-requested') return null;
  if (download.state === 'complete') return <Note>{`All your history is on this ${DEVICE}, for trips without a connection.`}</Note>;
  return (
    <>
      <Progress label="Download all history" fraction={download.progress} />
      {download.state === 'stopped' && download.reason === 'throttled' && (
        <Banner
          testID="throttled-banner"
          icon={Hourglass}
          tone="warning"
          title="Download all history is paused"
          body={`It carries on by itself later. Recent detail, and anything you open, still downloads, and nothing on this ${DEVICE} was removed.`}
        />
      )}
    </>
  );
}

const percentOf = (fraction: number): number => Math.round(Math.min(1, Math.max(0, fraction)) * 100);

function statusStore(sync: AccountSync) {
  let latest = sync.status;
  return {
    subscribe: (changed: () => void) =>
      sync.subscribe((status) => {
        latest = status;
        changed();
      }),
    snapshot: () => latest,
  };
}

function useSyncStatus(sync: AccountSync): SyncStatus {
  const store = useMemo(() => statusStore(sync), [sync]);
  return useSyncExternalStore(store.subscribe, store.snapshot);
}

const DEVICE = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'device';
const STORE_ACTION = Platform.OS === 'ios' ? 'Update in the App Store' : 'Update in Google Play';

const ACCOUNT_ERRORS: ReadonlySet<SyncStatus['error']> = new Set(['offline', 'sign-in-required', 'storage']);

function StatusCard({ status, waiting, now }: { status: SyncStatus; waiting: number; now: number }) {
  const synced = status.lastSyncedAt !== null ? ` Last sync ${ago(status.lastSyncedAt, now)}.` : '';
  if (ACCOUNT_ERRORS.has(status.error)) {
    const body = status.error === 'offline' ? `We couldn't reach Tableside. Your records are safe on this ${DEVICE}.` : `Your records are safe on this ${DEVICE}.`;
    return <Card icon={CloudOff} tone="destructive" title="Can't sync right now" body={body} />;
  }
  if (status.history.state === 'incomplete') {
    return <Card icon={CloudDownload} tone="info" title="Getting your history" body="Summaries and lifetime totals are here. Recent detail is still downloading." />;
  }
  if (waiting > 0) {
    const body = status.update?.state === 'required' ? `They're safe on this ${DEVICE}.` : `They'll upload automatically.${synced}`;
    return <Card icon={CloudUpload} tone="warning" title={`${waiting} ${waiting === 1 ? 'record' : 'records'} waiting to sync`} body={body} />;
  }
  return <Card icon={CloudCheck} tone="correct" title="All synced" body={synced.trim()} />;
}

function RetiringNotice({ update, onUpdate }: { update: Extract<UpdateNotice, { state: 'retiring' }>; onUpdate: () => void }) {
  const retires = new Date(update.retiresAt);
  const lastDay = new Date(update.retiresAt - 86_400_000);
  const body = `This version stops syncing on ${retires.getDate()} ${MONTHS[retires.getMonth()]!.slice(0, 3)} ${retires.getFullYear()}. Practice keeps working, and records made before you update stay on this ${DEVICE} and sync afterwards.`;
  return (
    <>
      <Banner
        testID="update-notice"
        icon={Download}
        tone="warning"
        title={`Update Tableside by ${retires.getDate()} ${MONTHS[retires.getMonth()]}`}
        body={update.reason ? `${body} ${update.reason}` : body}
        action={{ label: STORE_ACTION, onPress: onUpdate }}
      />
      <SectionLabel>{`After ${lastDay.getDate()} ${MONTHS[lastDay.getMonth()]}, without the update`}</SectionLabel>
      <UpdateRequired reason={null} onUpdate={onUpdate} preview />
    </>
  );
}

function UpdateRequired({ reason, onUpdate, preview = false, testID }: { reason: string | null; onUpdate: () => void; preview?: boolean; testID?: string }) {
  return (
    <Banner
      testID={testID}
      icon={CircleAlert}
      tone="destructive"
      title="Sync stopped: update required"
      body="Your local records are kept and nothing is deleted. Update to sync them."
      detail={reason}
      action={{ label: 'Update', onPress: onUpdate }}
      preview={preview}
    />
  );
}

function FlaggedBanner({ flagged, sync, now }: { flagged: readonly UploadStatus[]; sync: AccountSync; now: number }) {
  const one = flagged.length === 1 ? flagged[0]! : null;
  const named = flagged.map((upload) => `${titleOf(upload)}, ${dayOf(upload, now, false)}`).join('; ');
  return (
    <Banner
      testID="flagged-banner"
      icon={Flag}
      tone="destructive"
      title={one ? '1 record keeps failing' : `${flagged.length} records keep failing`}
      body={
        one
          ? `${named}, couldn't upload after several tries. It's safe on this ${DEVICE}, and everything else keeps syncing.`
          : `${named}, couldn't upload after several tries. They're safe on this ${DEVICE}, and everything else keeps syncing.`
      }
      action={{
        label: one ? 'Retry this record' : 'Retry these records',
        onPress: () => void Promise.all(flagged.map((upload) => sync.retryRecord(upload.id))),
      }}
    />
  );
}

const ROW_STATE: Record<UploadStatus['state'], { label: string; tone: ColorToken; detail: string; failing: boolean; uploads: boolean }> = {
  waiting: { label: 'Local', tone: 'mutedForeground', detail: `this ${DEVICE}`, failing: false, uploads: true },
  paused: { label: 'Paused', tone: 'mutedForeground', detail: 'waits for a failing record', failing: false, uploads: true },
  flagged: { label: 'Failing', tone: 'destructive', detail: 'flagged', failing: true, uploads: true },
  review: { label: 'Needs review', tone: 'destructive', detail: 'not accepted by your account', failing: true, uploads: false },
  unconfirmed: { label: 'Needs review', tone: 'warning', detail: 'not confirmed after time away', failing: true, uploads: false },
};

function UploadRow({ upload, now, first }: { upload: UploadStatus; now: number; first: boolean }) {
  const styles = useStyles();
  const title = titleOf(upload);
  const detail = detailOf(upload, now);
  const state = ROW_STATE[upload.state];
  const { failing } = state;
  const Icon = failing ? Flag : CloudOff;
  return (
    <View testID="waiting-row" accessible accessibilityLabel={`${title}. ${detail}. ${state.label}`} style={[styles.row, !first && styles.rowDivider]}>
      <View style={styles.rowLead}>
        <Icon color={failing ? palette.destructive : palette.foreground} size={18} />
      </View>
      <View style={styles.rowText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.rowTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
          {detail}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={textScale.body} style={[styles.rowState, { color: palette[state.tone] }]}>
        {state.label}
      </Text>
    </View>
  );
}

function titleOf(upload: UploadStatus): string {
  const game = isRecord(upload.payload) ? findGame(upload.payload.game) : undefined;
  return upload.recordType === 'completed-practice-session' && game ? `${game.title} session` : 'Record';
}

function detailOf(upload: UploadStatus, now: number): string {
  const day = dayOf(upload, now, true);
  const { detail } = ROW_STATE[upload.state];
  return day ? `${day} · ${detail}` : detail;
}

function dayOf(upload: UploadStatus, now: number, withTime: boolean): string {
  const endedAt = isRecord(upload.payload) ? upload.payload.endedAt : undefined;
  if (typeof endedAt !== 'number') return '';
  const day = new Date(endedAt);
  const today = new Date(now);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(day, today)) return withTime ? `Today ${day.getHours()}:${String(day.getMinutes()).padStart(2, '0')}` : 'today';
  if (sameDay(day, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1))) return withTime ? 'Yesterday' : 'yesterday';
  return `${day.getDate()} ${MONTHS[day.getMonth()]!.slice(0, 3)}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ago(then: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - then) / 60_000);
  const unit = (count: number, name: string) => `${count} ${name}${count === 1 ? '' : 's'} ago`;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return unit(minutes, 'minute');
  if (minutes < 48 * 60) return unit(Math.floor(minutes / 60), 'hour');
  return unit(Math.floor(minutes / (24 * 60)), 'day');
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function Card({ icon: Icon, tone, title, body }: { icon: LucideIcon; tone: ColorToken; title: string; body: string }) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.cardLead}>
        <Icon color={palette[tone]} size={22} />
      </View>
      <View style={styles.cardText}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.cardTitle}>
          {title}
        </Text>
        {body !== '' && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
            {body}
          </Text>
        )}
      </View>
    </View>
  );
}

function Banner({
  icon: Icon,
  tone,
  title,
  body,
  detail = null,
  action,
  preview = false,
  testID,
}: {
  icon: LucideIcon;
  tone: 'destructive' | 'warning';
  title: string;
  body: string;
  detail?: string | null;
  action?: { label: string; onPress: () => void };
  preview?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View testID={testID} style={[styles.banner, { borderColor: palette[tone] }]}>
      <Icon color={palette[tone]} size={20} />
      <View style={styles.bannerText}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.bannerTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
          {body}
        </Text>
        {detail && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.muted}>
            {detail}
          </Text>
        )}
        {action && !preview && <TextAction label={action.label} onPress={action.onPress} />}
        {action && preview && (
          <Text maxFontSizeMultiplier={textScale.body} style={styles.previewAction}>
            {action.label}
          </Text>
        )}
      </View>
    </View>
  );
}

function TextAction({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} {...focusProps} style={[styles.textAction, focused && styles.focused]}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.actionLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const styles = useStyles();
  const { focused, focusProps } = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      {...focusProps}
      style={({ pressed }) => [styles.secondary, pressed && pressStyle.feltShadow, focused && styles.focused]}
    >
      <Icon color={palette.foreground} size={18} />
      <Text maxFontSizeMultiplier={textScale.body} style={styles.secondaryLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function Progress({ label, fraction }: { label: string; fraction: number }) {
  const styles = useStyles();
  const percent = percentOf(fraction);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
      style={styles.progress}
    >
      <View style={styles.progressLabels}>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.progressLabel}>
          {label}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.progressValue}>{`${percent}%`}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.body} style={styles.section}>
      {children}
    </Text>
  );
}

const useStyles = makeStyles((type) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space[4],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
  },
  cardLead: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  muted: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], padding: 14, borderRadius: 12, borderWidth: 1, backgroundColor: palette.card },
  bannerText: { flex: 1, gap: space[1] },
  bannerTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  textAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', borderRadius: radius.sm, borderWidth: 2, borderColor: palette.transparent },
  actionLabel: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.primary },
  previewAction: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.mutedForeground },
  section: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.mutedForeground },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 64, paddingVertical: space[3], paddingHorizontal: space[4] },
  rowDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  rowLead: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  rowState: { fontFamily: fonts.ui, ...type.body },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: space[3],
    paddingHorizontal: 20,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.controlBorder,
    backgroundColor: palette.secondary,
  },
  secondaryLabel: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  focused: { borderColor: palette.ring },
  progress: { gap: 6 },
  progressLabels: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  progressLabel: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  progressValue: { fontFamily: fonts.uiSemiBold, ...type.label, color: palette.foreground },
  track: { height: 8, borderRadius: 4, borderWidth: 1, borderColor: palette.controlBorder, backgroundColor: palette.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: palette.primary },
}));
