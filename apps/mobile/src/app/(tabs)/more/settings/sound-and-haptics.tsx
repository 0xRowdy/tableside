import { router } from 'expo-router';

import { useFeedbackSettings } from '@/feedback/FeedbackProvider';
import { SwitchRow } from '@/components/SwitchRow';
import { Group, Note, SettingsScreen, VolumeSlider } from '@/settings/SettingsParts';

/** S1-12: one Sound effects slider (0 is off) and one Haptics switch, stored on this device only. */
export default function SoundAndHaptics() {
  const { settings, current } = useFeedbackSettings();
  return (
    <SettingsScreen title="Sound & haptics" back={{ label: 'Settings', onPress: () => router.dismissTo('/more/settings') }}>
      <Group>
        <VolumeSlider
          label="Sound effects"
          value={current.soundVolume}
          onChange={(volume) => void settings.setSoundVolume(volume)}
          help="0 turns sound off. Your silent switch also mutes Tableside. Sounds mix with your music and never pause it."
        />
      </Group>
      <Group>
        <SwitchRow
          title="Haptics"
          detail="Follows your phone's system haptics setting."
          value={current.haptics}
          onChange={(on) => void settings.setHaptics(on)}
        />
      </Group>
      <Note>
        Stored on this device only. Not synced, not exported. Nothing in Tableside depends on hearing or feeling a cue: every sound has something you can see.
      </Note>
    </SettingsScreen>
  );
}
