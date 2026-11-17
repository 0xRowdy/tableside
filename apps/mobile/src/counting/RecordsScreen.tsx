// Spec 3 S3-10 OVKkc (Amendment 2 §3); Comparison groups, records and progression; #140

import { CHALLENGE_LESSONS } from '@tableside/definitions';
import type { AssistanceClass, AttemptEndingReason, ChallengeAttemptRecord } from '@tableside/engine';
import { CircleAlert, CircleCheckBig, CircleStop, CloudOff, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/Segmented';
import { useLoaded } from '@/hooks/use-loaded';
import { Group, GroupLabel, ListRow, Note, SettingsScreen } from '@/settings/SettingsParts';
import { fonts, palette, radius, space, textScale } from '@/theme/tokens';
import { COUNTING_TITLE } from '@/training/challenge-text';
import { attemptIdentity, type GroupProgress, type Progress } from '@/training/progress';
import {
  bestsLabel,
  bestText,
  CLASS_LABEL,
  fastestText,
  groupLabel,
  groupTitle,
  HISTORY_LABEL,
  historyText,
  NO_HISTORY,
  noGroups,
  RECORD_CLASSES,
  RECORDS_NOTE,
  RECORDS_TITLE,
  REVIEW_UNAVAILABLE,
  settingsText,
  type StatText,
} from '@/training/records-text';
import type { LessonEntry, TrainingService } from '@/training/service';
import type { AcceptedAttempt } from '@/training/store';

import { CardReview } from './CardReview';

const ENDING_ICON: Record<AttemptEndingReason, LucideIcon> = { completed: CircleCheckBig, abandoned: CircleStop, 'insufficient-funds': CircleAlert, unusable: CircleAlert };

const recordsOf = async (service: TrainingService): Promise<{ readonly progress: Progress; readonly now: number }> => ({ progress: await service.progress(), now: service.now() });

export function RecordsScreen({
  service,
  lessons,
  onOpenLesson,
  onBack,
}: {
  service: TrainingService;
  lessons: readonly LessonEntry[] | undefined;
  onOpenLesson: (lesson: string) => void;
  onBack: () => void;
}) {
  const records = useLoaded(recordsOf, service);
  const [assistance, setAssistance] = useState<AssistanceClass>('unassisted-check');
  const [reviewing, setReviewing] = useState<ChallengeAttemptRecord | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // Spec 3 Amendment 1 C8; #142
  const openReview = async (attemptId: string) => {
    const record = await service.attemptReview(attemptId);
    setUnavailable(!record || record.review.length === 0);
    if (record && record.review.length > 0) setReviewing(record);
  };

  if (reviewing) {
    return (
      <CardReview
        record={reviewing}
        lesson={lessons?.find((lesson) => lesson.id === CHALLENGE_LESSONS[reviewing.groupKey.category])}
        onOpenLesson={onOpenLesson}
        backTo={RECORDS_TITLE}
        onBack={() => setReviewing(null)}
      />
    );
  }

  const groups = records?.progress.groups.filter((group) => group.key.assistanceClass === assistance && group.attempts.some((entry) => entry.record.endingReason !== 'unusable')) ?? [];
  return (
    <SettingsScreen title={RECORDS_TITLE} back={{ label: COUNTING_TITLE, onPress: onBack }}>
      <Segmented label="Records" options={RECORD_CLASSES.map((value) => ({ value, label: CLASS_LABEL[value] }))} selected={assistance} onSelect={setAssistance} />
      <GroupLabel>{bestsLabel(assistance)}</GroupLabel>
      {records && groups.length === 0 && <Note>{noGroups(assistance)}</Note>}
      {groups.map((group) => (
        <GroupCard key={group.id} group={group} />
      ))}
      <GroupLabel>{HISTORY_LABEL}</GroupLabel>
      {unavailable && <Note>{REVIEW_UNAVAILABLE}</Note>}
      {records && records.progress.history.length === 0 ? (
        <Note>{NO_HISTORY}</Note>
      ) : (
        <Group>
          {records?.progress.history.map((entry) => {
            const text = historyText(entry, records.now);
            const { record } = entry;
            return (
              <ListRow
                key={attemptIdentity(record)}
                icon={entry.local ? CloudOff : ENDING_ICON[record.endingReason]}
                title={text.title}
                detail={text.detail}
                value={text.value}
                onPress={hasReview(record) ? () => void openReview(record.attemptId) : undefined}
              />
            );
          })}
        </Group>
      )}
      <Note>{RECORDS_NOTE}</Note>
    </SettingsScreen>
  );
}

// Spec 3 Amendment 1 C8
const hasReview = (record: AcceptedAttempt) =>
  record.review ? record.review.length > 0 : Object.values(record.metrics).some((result) => result !== null && result.total > 0);

function GroupCard({ group }: { group: GroupProgress }) {
  const stats = [...bestText(group), ...(group.key.assistanceClass === 'unassisted-check' ? [fastestText(group)] : [])];
  return (
    <View accessible accessibilityLabel={groupLabel(group, stats)} style={styles.card}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.title}>
        {groupTitle(group.key)}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.settings}>
        {settingsText(group.key)}
      </Text>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <Stat key={stat.label} stat={stat} />
        ))}
      </View>
    </View>
  );
}

function Stat({ stat }: { stat: StatText }) {
  return (
    <View style={styles.stat}>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.statLabel}>
        {stat.label}
      </Text>
      <Text maxFontSizeMultiplier={textScale.body} style={styles.statValue}>
        {stat.value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space[2], padding: space[4], borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  title: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
  settings: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, color: palette.mutedForeground },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  stat: { flexGrow: 1, flexBasis: 140, gap: 2 },
  statLabel: { fontFamily: fonts.ui, fontSize: 12, color: palette.mutedForeground },
  statValue: { fontFamily: fonts.uiBold, fontSize: 16, color: palette.foreground },
});
