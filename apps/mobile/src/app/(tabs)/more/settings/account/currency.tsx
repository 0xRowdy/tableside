// The account currency (spec 2 Amendment 4 §4): one real-money currency for
// casino records, chosen here. It needs a connection, and it can't change while
// any casino session exists, since amounts are never converted. Simulated
// amounts never use it.
// TODO(frames): unverified against S2-17, which has no currency screen; built from the spec's copy.

import { router } from 'expo-router';
import { useState } from 'react';

import { CURRENCIES, currencyText } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { ChoiceGroup, ChoiceRow, InlineMessage } from '@/account/FirstRunParts';
import { useAccountOverview } from '@/account/use-account-summary';
import { Note, SettingsScreen } from '@/settings/SettingsParts';

const PROBLEMS = {
  failed: "Couldn't change the currency. Changing it needs a connection; try again when you're online.",
  locked: "The currency can't change while you have casino sessions.",
} as const;

export default function Currency() {
  const { service } = useAccount();
  const current = useAccountOverview()?.summary?.currency;
  const [problem, setProblem] = useState<keyof typeof PROBLEMS | null>(null);
  const [saving, setSaving] = useState(false);
  const choose = async (code: string) => {
    if (saving || code === current) return;
    setSaving(true);
    setProblem(null);
    const result = await service.setAccountCurrency(code);
    setSaving(false);
    if (result.status === 'changed') router.dismissTo('/more/settings/account');
    else setProblem(result.status);
  };
  // A currency on record that isn't in the list still shows, selected.
  const choices = current && !CURRENCIES.some((currency) => currency.code === current) ? [current, ...CURRENCIES.map((c) => c.code)] : CURRENCIES.map((c) => c.code);
  return (
    <SettingsScreen title="Currency" back={{ label: 'Account', onPress: () => router.dismissTo('/more/settings/account') }}>
      <Note>Casino sessions you log use this currency. Practice and challenges use plain units. Once you have a casino session, the currency can&apos;t change.</Note>
      {problem && <InlineMessage>{PROBLEMS[problem]}</InlineMessage>}
      <ChoiceGroup label="Account currency">
        {choices.map((code) => (
          <ChoiceRow key={code} label={currencyText(code)} selected={code === current} onPress={() => void choose(code)} />
        ))}
      </ChoiceGroup>
    </SettingsScreen>
  );
}
