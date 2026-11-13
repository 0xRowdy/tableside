#!/usr/bin/env node
// Runs a Supabase CLI command against this checkout's local stack.
//
// TABLESIDE_STACK_SLOT (default 0) lets several worktrees each run a stack at
// once. Slot 0 is the plain `supabase/` project on the default ports. Slot N
// is a generated project in `.stacks/<N>/supabase/` whose config is this
// checkout's with its own project id and every port moved up by N * 100; its
// migrations and templates are symlinks, so they always match the checkout.
//
//   TABLESIDE_STACK_SLOT=2 pnpm stack start --exclude studio,imgproxy,vector,logflare
//   TABLESIDE_STACK_SLOT=2 pnpm test:accounts
//   TABLESIDE_STACK_SLOT=2 pnpm stack db reset

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const raw = process.env.TABLESIDE_STACK_SLOT ?? '0';
if (!/^[0-9]$/.test(raw)) {
  console.error(`TABLESIDE_STACK_SLOT must be a single digit, got "${raw}".`);
  process.exit(2);
}
const slot = Number(raw);
const args = process.argv.slice(2);

let workdir = root;
if (slot > 0) {
  workdir = join(root, '.stacks', String(slot));
  const project = join(workdir, 'supabase');
  mkdirSync(project, { recursive: true });
  const offset = slot * 100;
  const config = readFileSync(join(root, 'supabase', 'config.toml'), 'utf8')
    .replace(/^project_id = "(.*)"$/m, (_, id) => `project_id = "${id}-${slot}"`)
    .replace(/^(\s*(?:port|shadow_port|inspector_port) = )(\d+)$/gm, (_, key, port) => `${key}${Number(port) + offset}`)
    .replace(/host\.docker\.internal:(\d+)/g, (_, port) => `host.docker.internal:${Number(port) + offset}`);
  writeFileSync(join(project, 'config.toml'), config);
  for (const entry of readdirSync(join(root, 'supabase'), { withFileTypes: true })) {
    const link = join(project, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && !existsSync(link)) {
      symlinkSync(join(root, 'supabase', entry.name), link, 'dir');
    }
  }
}

const result = spawnSync('supabase', [...args, '--workdir', workdir], { stdio: 'inherit' });
process.exit(result.status ?? 1);
