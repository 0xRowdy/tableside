// Spec 3 Lessons › Access, Check protection; S3-14 SUUN4, S3-12 JsXMJ; #149
// Spec 3 Amendment 1 A2, Amendment 2 §3, Amendment 4 §5

import type { LessonSection } from '@tableside/definitions';
import { ArrowLeft, CircleStop, Clock3 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/settings/SettingsParts';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import {
  AFTER_THIS_ATTEMPT,
  afterCheckText,
  BACK_TO_LESSONS,
  END_TO_VIEW,
  ENDING_ABANDONS,
  lessonKind,
  NEEDS_CONNECTION_TITLE,
  needsConnectionText,
  offlineLessonsText,
  RETURN_TO_ATTEMPT,
} from '@/training/lesson-text';
import type { HeldLessonAccess } from '@/training/service';

import { NavButton } from './LessonParts';

export function LessonGate({
  lesson,
  access,
  back,
  busy,
  canEnd,
  endBlocked,
  onLeave,
  onReturnToAttempt,
  onEndAttempt,
}: {
  lesson: { readonly title: string; readonly section: LessonSection };
  access: HeldLessonAccess;
  back: string;
  busy: boolean;
  canEnd: boolean;
  endBlocked: string | null;
  onLeave: () => void;
  onReturnToAttempt: () => void;
  onEndAttempt: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID="lesson-gate-scroll"
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: space[6] }]}
    >
      <View style={styles.header}>
        <BackButton label={back} onPress={onLeave} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.title}>
            {lesson.title}
          </Text>
          <Text maxFontSizeMultiplier={textScale.body} style={styles.kind}>
            {lessonKind(lesson.section)}
          </Text>
        </View>
      </View>
      {access.kind === 'after-check' ? (
        <Body
          heading={AFTER_THIS_ATTEMPT}
          text={afterCheckText(access.attempt)}
          footnote={ENDING_ABANDONS}
          alert={endBlocked}
        >
          <NavButton icon={ArrowLeft} label={RETURN_TO_ATTEMPT} primary block disabled={false} onPress={onReturnToAttempt} />
          <NavButton icon={CircleStop} label={END_TO_VIEW} block disabled={busy || !canEnd} onPress={onEndAttempt} />
        </Body>
      ) : (
        <Body heading={NEEDS_CONNECTION_TITLE} text={needsConnectionText(access)} footnote={offlineLessonsText(access.offlineGame)} alert={null}>
          <NavButton icon={ArrowLeft} label={BACK_TO_LESSONS} primary block disabled={false} onPress={onLeave} />
        </Body>
      )}
    </ScrollView>
  );
}

function Body({ heading, text, footnote, alert, children }: { heading: string; text: string; footnote: string; alert: string | null; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.body}>
      <View style={styles.top}>
        <View style={styles.icon} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Clock3 color={palette.foreground} size={28} />
        </View>
        <Text accessibilityRole="header" maxFontSizeMultiplier={textScale.display} style={styles.heading}>
          {heading}
        </Text>
        <Text maxFontSizeMultiplier={textScale.body} style={styles.text}>
          {text}
        </Text>
      </View>
      <View style={styles.actions}>
        {alert && (
          <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.alert}>
            {alert}
          </Text>
        )}
        {children}
        <Text maxFontSizeMultiplier={textScale.body} style={styles.footnote}>
          {footnote}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  screen: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 56, paddingLeft: space[1], paddingRight: space[2] },
  titles: { flex: 1, gap: 1, paddingVertical: space[1] },
  title: { fontFamily: fonts.uiSemiBold, ...type.body, color: palette.foreground },
  kind: { fontFamily: fonts.ui, ...type.caption, color: palette.mutedForeground },
  body: { flex: 1, justifyContent: 'space-between', gap: space[8], paddingTop: space[6], paddingHorizontal: space[6] - space[1] },
  top: { gap: space[4] },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  heading: { fontFamily: fonts.display, ...type.headline, color: palette.foreground },
  text: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
  actions: { gap: space[4] },
  alert: { fontFamily: fonts.ui, ...type.body, color: palette.warning },
  footnote: { fontFamily: fonts.ui, ...type.secondary, color: palette.mutedForeground },
}));
