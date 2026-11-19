// docs/decisions/lessons-entry-points.md; S1-04 qylNY
import { HINTS, type HintId } from '@tableside/definitions';
import type { GameId } from '@tableside/engine';
import { router, type Href } from 'expo-router';
import { BookOpen, CirclePause, Library, Lightbulb, Play } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Group, GroupLabel, ListRow } from '@/settings/SettingsParts';
import { fonts, palette, space, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { gameLessonOffer } from '@/training/lesson-offer';
import { allGameLessons, gameLessonsLabel, HELP_TITLE, HINTS_AGAIN_HERE, hintsAgainHereDetail, offerAction, offerDetail, SUSPENDS_SESSION, THIS_SCREEN } from '@/training/lesson-text';
import type { TrainingService } from '@/training/service';
import { useLessonsOf } from '@/training/TrainingProvider';

import { lessonHref, lessonsHref } from './routes';

export function HintsAgainRow({ ids, onPress }: { ids: readonly HintId[]; onPress: () => void }) {
  return (
    <Group>
      <ListRow icon={Lightbulb} title={HINTS_AGAIN_HERE} detail={hintsAgainHereDetail(ids.map((id) => HINTS[id].name))} chevron={false} onPress={onPress} />
    </Group>
  );
}

export function TableHelpSheet({
  game,
  service,
  hints,
  onShowHints,
  onClose,
}: {
  game: GameId;
  service: TrainingService;
  hints: readonly HintId[];
  onShowHints: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const lessons = useLessonsOf(service);
  const offer = lessons ? gameLessonOffer(lessons, game) : null;
  const count = lessons?.filter((lesson) => lesson.section === game).length;
  const open = (href: Href) => {
    onClose();
    router.navigate(href);
  };
  return (
    <Sheet title={HELP_TITLE} onClose={onClose} testID="table-help">
      <View style={styles.section}>
        <GroupLabel>{gameLessonsLabel(game)}</GroupLabel>
        <Group>
          {offer && offer.kind !== 'after-check' && (
            <>
              <ListRow
                icon={offer.kind === 'continue' ? Play : BookOpen}
                title={offerAction(offer)}
                detail={offerDetail(offer)}
                onPress={() => open(lessonHref(offer.lesson.id, { section: game, from: 'table' }))}
              />
              <View style={styles.divider} />
            </>
          )}
          <ListRow
            icon={Library}
            title={allGameLessons(game)}
            {...(count === undefined ? {} : { value: String(count) })}
            onPress={() => open(lessonsHref({ section: game, from: 'table' }))}
          />
        </Group>
        <View style={styles.note}>
          <CirclePause color={palette.foreground} size={18} />
          <Text maxFontSizeMultiplier={textScale.body} style={styles.noteText}>
            {SUSPENDS_SESSION}
          </Text>
        </View>
      </View>
      {hints.length > 0 && (
        <View style={styles.section}>
          <GroupLabel>{THIS_SCREEN}</GroupLabel>
          <HintsAgainRow
            ids={hints}
            onPress={() => {
              onShowHints();
              onClose();
            }}
          />
        </View>
      )}
    </Sheet>
  );
}

const useStyles = makeStyles((type) => ({
  section: { gap: space[2] },
  divider: { height: 1, backgroundColor: palette.border },
  note: { flexDirection: 'row', gap: space[2] + 2, paddingHorizontal: space[1], paddingTop: space[1] },
  noteText: { flex: 1, fontFamily: fonts.ui, ...type.secondary, color: palette.foreground },
}));
