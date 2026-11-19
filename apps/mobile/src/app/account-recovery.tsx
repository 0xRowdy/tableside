// TODO(spec 2 S2-23)

import { Redirect, router } from 'expo-router';
import { HardDriveDownload, LogOut, RotateCw, TriangleAlert, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { deviceName } from '@/account/account-text';
import { useAccount } from '@/account/AccountProvider';
import { Actions, Body, FirstRunScreen, SupportLinks } from '@/account/FirstRunParts';
import { Button } from '@/components/Button';
import { fonts, palette, radius, textScale } from '@/theme/tokens';
import { makeStyles } from '@/theme/type';

const STORE = Platform.OS === 'ios' ? 'the App Store' : 'Google Play';

export default function AccountRecovery() {
  const styles = useStyles();
  const { gate, service } = useAccount();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (gate.state !== 'recovery-needed' && gate.state !== 'database-unavailable') return <Redirect href="/" />;
  const device = deviceName();

  const signOut = async (then?: () => void) => {
    setBusy(true);
    await service.signOut();
    setBusy(false);
    then?.();
  };
  const leave = (
    <>
      <Button label="Sign out" icon={LogOut} variant="secondary" stretch disabled={busy} onPress={() => void signOut()} />
      <Button label="Use a different account" icon={UserRound} variant="ghost" stretch disabled={busy} onPress={() => void signOut(() => router.push('/welcome'))} />
    </>
  );

  if (gate.state === 'database-unavailable' && gate.reason === 'needs-update') {
    return (
      <FirstRunScreen title="Update Tableside" lead={<StateIcon />}>
        <Body>Your data on this {device} was saved by a newer version of Tableside. Update the app from {STORE} to open it. Nothing has been changed or deleted.</Body>
        <Actions>{leave}</Actions>
        <SupportLinks />
      </FirstRunScreen>
    );
  }

  if (gate.state === 'database-unavailable') {
    return (
      <FirstRunScreen title="Your data can't be opened yet" lead={<StateIcon />}>
        <Body>Tableside couldn&apos;t finish updating your data, so it left it exactly as it was. Close and reopen the app to try again. If there isn&apos;t enough free space on this {device}, free some up first.</Body>
        <Actions>{leave}</Actions>
        <SupportLinks />
      </FirstRunScreen>
    );
  }

  const restore = async () => {
    setBusy(true);
    setFailed(false);
    const { status } = await service.recover();
    setBusy(false);
    if (status === 'failed') setFailed(true);
  };
  return (
    <FirstRunScreen title="Your data can't be opened" lead={<StateIcon />}>
      <Body>
        Tableside can&apos;t open this account&apos;s data on this {device}. It has kept the data exactly as it was, and won&apos;t replace or delete it.
      </Body>
      <Body>
        You can restore everything that reached your account into a fresh copy: sign in again, with a connection, and your synced history downloads. Records that
        hadn&apos;t synced yet stay only in the kept copy, which Tableside can&apos;t open.
      </Body>
      {failed && (
        <Text accessibilityRole="alert" maxFontSizeMultiplier={textScale.body} style={styles.failed}>
          That didn&apos;t work. Your data is still as it was. Try again.
        </Text>
      )}
      <Actions>
        <Button label="Restore synced history" icon={busy ? RotateCw : HardDriveDownload} stretch disabled={busy} onPress={() => void restore()} />
        {leave}
      </Actions>
      <SupportLinks />
    </FirstRunScreen>
  );
}

function StateIcon() {
  const styles = useStyles();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <TriangleAlert color={palette.warning} size={30} />
    </View>
  );
}

const useStyles = makeStyles((type) => ({
  icon: { width: 64, height: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.secondary },
  failed: { fontFamily: fonts.ui, ...type.body, color: palette.destructive },
}))
