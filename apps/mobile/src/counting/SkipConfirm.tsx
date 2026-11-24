// Spec 3 S3-05 UKfJA, YLGVK; docs/decisions/clarify-challenge-vocabulary.md

import { SkipForward } from 'lucide-react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { Sheet, SheetText } from '@/components/Sheet';
import { fonts, palette, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';
import { skipConfirmText, type SkipItem } from '@/training/challenge-text';

export function useSkipConfirm(item: SkipItem, enabled: boolean, onSkip: () => void) {
  const [asking, setAsking] = useState(false);
  const keep = () => setAsking(false);
  const skip = () => {
    setAsking(false);
    onSkip();
  };
  return {
    ask: () => setAsking(true),
    sheet: asking && enabled ? <SkipConfirmSheet item={item} onKeep={keep} onSkip={skip} /> : null,
  };
}

function SkipConfirmSheet({ item, onKeep, onSkip }: { item: SkipItem; onKeep: () => void; onSkip: () => void }) {
  const styles = useStyles();
  const text = skipConfirmText(item);
  return (
    <Sheet title={text.title} onClose={onKeep} testID="skip-confirm">
      <Text maxFontSizeMultiplier={textScale.body} style={styles.lead}>
        {text.lead}
      </Text>
      {text.detail && <SheetText>{text.detail}</SheetText>}
      <Button label={text.keep} stretch onPress={onKeep} />
      <Button label={text.skip} icon={SkipForward} variant="outline" stretch onPress={onSkip} />
    </Sheet>
  );
}

const useStyles = makeStyles((type) => ({
  lead: { fontFamily: fonts.ui, ...type.body, color: palette.foreground },
}));
