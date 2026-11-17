import { schemaVersionOf, STORE_MIGRATIONS, type StoreMigration } from '../store-schema';

export function laterBuild(migrations: readonly StoreMigration[] = STORE_MIGRATIONS): readonly StoreMigration[] {
  const current = schemaVersionOf(migrations);
  return [
    ...migrations,
    { to: current + 1, migrate: async (tx) => void (await tx.run('ALTER TABLE outgoing ADD COLUMN uploaded INTEGER NOT NULL DEFAULT 0')) },
    {
      to: current + 2,
      migrate: async (tx) => {
        await tx.run(`CREATE TABLE effects_rebuilt (
          activity_id TEXT NOT NULL REFERENCES activities (activity_id),
          effect_key TEXT NOT NULL,
          position INTEGER NOT NULL,
          body TEXT NOT NULL, body_format INTEGER NOT NULL, body_length INTEGER NOT NULL, body_sha256 TEXT NOT NULL,
          PRIMARY KEY (activity_id, effect_key)
        ) STRICT`);
        await tx.run('INSERT INTO effects_rebuilt SELECT * FROM effects');
        await tx.run('DROP TABLE effects');
        await tx.run('ALTER TABLE effects_rebuilt RENAME TO effects');
      },
    },
  ];
}
