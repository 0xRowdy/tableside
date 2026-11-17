import { execFileSync } from 'node:child_process';

const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

const seen = new Map();
for (const path of paths) {
  const parts = path.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const prefix = parts.slice(0, i).join('/');
    const key = prefix.toLowerCase();
    const known = seen.get(key);
    if (known === undefined) seen.set(key, new Set([prefix]));
    else known.add(prefix);
  }
}

const collisions = [...seen.values()].filter((spellings) => spellings.size > 1);
if (collisions.length > 0) {
  console.error('Tracked paths that differ only by case (rename one with `git mv`):');
  for (const spellings of collisions) console.error(`  ${[...spellings].join('  ')}`);
  process.exit(1);
}
