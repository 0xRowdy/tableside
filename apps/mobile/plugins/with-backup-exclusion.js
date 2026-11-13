// Android backup rules (spec 2, *Backup exclusion*): the account vault's
// directory (databases, WAL and sidecars, the installation identifier) and
// SecureStore's key material stay out of Auto Backup (Android 11 and lower,
// full-backup-content) and out of cloud backup and device-to-device transfer
// (Android 12 and higher, data-extraction-rules). Everything else keeps the
// platform default. These rules replace expo-secure-store's own, which is
// configured with configureAndroidBackup: false.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/** The vault's directory under the app's files directory (src/account/native-vault.ts). */
const VAULT_DIRECTORY = 'tableside-vault';

const EXCLUDES = [`<exclude domain="file" path="${VAULT_DIRECTORY}"/>`, '<exclude domain="sharedpref" path="SecureStore"/>'];

const indent = (lines, depth) => lines.map((line) => `${'  '.repeat(depth)}${line}`).join('\n');

const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<!-- Auto Backup, Android 11 and lower: the account vault and key material are excluded. -->
<full-backup-content>
${indent(EXCLUDES, 1)}
</full-backup-content>
`;

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<!-- Cloud backup and device transfer, Android 12 and higher: the account vault and key material are excluded. -->
<data-extraction-rules>
  <cloud-backup>
${indent(EXCLUDES, 2)}
  </cloud-backup>
  <device-transfer>
${indent(EXCLUDES, 2)}
  </device-transfer>
</data-extraction-rules>
`;

function withBackupExclusion(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application[0];
    application.$['android:fullBackupContent'] = '@xml/tableside_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/tableside_data_extraction_rules';
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const directory = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, 'tableside_backup_rules.xml'), FULL_BACKUP_CONTENT);
      fs.writeFileSync(path.join(directory, 'tableside_data_extraction_rules.xml'), DATA_EXTRACTION_RULES);
      return mod;
    },
  ]);
}

module.exports = withBackupExclusion;
module.exports.VAULT_DIRECTORY = VAULT_DIRECTORY;
module.exports.FULL_BACKUP_CONTENT = FULL_BACKUP_CONTENT;
module.exports.DATA_EXTRACTION_RULES = DATA_EXTRACTION_RULES;
