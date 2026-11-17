#!/usr/bin/env node
// docs/development.md Commands

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DIR = 'supabase/migrations';
const NAME = /^(\d{14})_[\w-]+\.sql$/;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function option(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) fail([`${name} needs a git ref.`]);
  return value;
}

function fail(problems) {
  console.error(`Migration check failed:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  process.exit(1);
}

function verifyRef(ref) {
  try {
    git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`);
  } catch {
    fail([`${ref} is not a commit here; run \`git fetch origin\` first.`]);
  }
}

const migrationsAt = (ref) =>
  git('ls-tree', '--name-only', ref, `${DIR}/`)
    .split('\n')
    .filter(Boolean)
    .map((path) => basename(path));

function changes(from, to) {
  const output = git('diff', '--no-renames', '--name-status', from, ...(to ? [to] : []), '--', DIR);
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t');
      return { status, name: basename(path) };
    });
}

const versionOf = (name) => NAME.exec(name)?.[1];

function definitions(sql) {
  const code = sql.replace(/--.*$/gm, '');
  const names = new Set();
  for (const [, kind, name] of code.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(function|procedure|view)\s+((?:"?\w+"?\s*\.\s*)?"?\w+"?)/gi)) {
    const plain = name.replace(/["\s]/g, '').toLowerCase();
    names.add(`${kind.toLowerCase()} ${plain.includes('.') ? plain : `public.${plain}`}`);
  }
  return names;
}

const show = (ref, name) => git('show', `${ref}:${DIR}/${name}`);

function checkTree() {
  const problems = [];
  const files = existsSync(join(root, DIR)) ? readdirSync(join(root, DIR)) : [];
  const seen = new Map();
  for (const name of files) {
    const version = versionOf(name);
    if (!version) {
      problems.push(`${name}: name it \`<YYYYMMDDHHMMSS>_<name>.sql\` (\`supabase migration new <name>\` does).`);
      continue;
    }
    if (seen.has(version)) problems.push(`${name} and ${seen.get(version)} share version ${version}; Supabase needs every version to be unique. Give the newer one a fresh version (\`git mv\` it to \`$(date -u +%Y%m%d%H%M%S)_<name>.sql\`).`);
    else seen.set(version, name);
  }
  verifyRef('origin/main');
  for (const { status, name } of changes('origin/main')) {
    if (status !== 'A') problems.push(`${name} is on main and was ${status === 'D' ? 'removed or renamed' : 'edited'}; a merged migration never changes. Add a new migration instead.`);
  }
  if (problems.length) fail(problems);
}

function checkTicket(ticket, into) {
  verifyRef(ticket);
  verifyRef(into);
  const base = git('merge-base', into, ticket).trim();
  const problems = [];
  const intoFiles = new Set(migrationsAt(into));
  const latest = [...intoFiles].map(versionOf).filter(Boolean).sort().at(-1) ?? '';

  const added = [];
  for (const { status, name } of changes(base, ticket)) {
    if (status !== 'A') problems.push(`${ticket} ${status === 'D' ? 'removes or renames' : 'edits'} ${name}, which ${into} already has; a merged migration never changes. Add a new migration instead.`);
    else if (!intoFiles.has(name)) added.push(name);
  }
  for (const name of added) {
    const version = versionOf(name);
    if (version && version <= latest) {
      problems.push(`${name} doesn't sort after ${into}'s latest migration (${latest}), so it would collide or run out of order. \`git mv\` it to a fresh version (\`$(date -u +%Y%m%d%H%M%S)_<name>.sql\`) on ${ticket}.`);
    }
  }

  const intoDefined = new Map();
  for (const { status, name } of changes(base, into)) {
    if (status !== 'A') continue;
    for (const definition of definitions(show(into, name))) intoDefined.set(definition, name);
  }
  const overlaps = [];
  for (const name of added) {
    for (const definition of definitions(show(ticket, name))) {
      if (intoDefined.has(definition)) overlaps.push(`${definition}: ${into}'s ${intoDefined.get(definition)} (re)defines it, and ${ticket}'s ${name} replaces that definition.`);
    }
  }

  if (overlaps.length) {
    console.log(
      `Reconcile by hand: each definition below changed on both sides since ${base.slice(0, 7)}. The ticket's runs later, so it must start from ${into}'s and keep its changes.\n${overlaps.map((line) => `  - ${line}`).join('\n')}`,
    );
  }
  if (problems.length) fail(problems);
}

const ticket = option('--ticket');
if (ticket) checkTicket(ticket, option('--into') ?? 'HEAD');
else checkTree();
