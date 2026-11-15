// The export job (spec 2, #102): builds every queued server export into the
// private account-exports bucket, then removes what ended exports left there.
// The database wakes it (pg_net, after a request, an invalidation or the
// upkeep cron); a wake carries no authority, since the work comes from the
// database with the service role, so anyone waking it only makes it look.
//
// POST, naming the backend environment in x-tableside-environment. Answers
// 200 { built, removed } or 502 { status: 'failed' }.
//
// For each export: the database writes its files as parts in one snapshot
// (begin_export_build); this pages them, zips them, stores the zip, marks it
// ready and emails "export ready". A failure marks the build failed and its
// partial object is removed by the sweep. Nothing here logs an address,
// account, path or record.

import { exportReadyMail, sendSecurityNotice } from '../_shared/mail.ts';
import { ENVIRONMENT_HEADER, reply, serviceRpc } from '../_shared/service.ts';
import { type ZipEntry, zip } from '../_shared/zip.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void; env: { get(name: string): string | undefined } };

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BUCKET = 'account-exports';
/** Builds per wake: the rest wait for the next one. */
const MAX_BUILDS = 5;

async function rpc<T>(environment: string, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const response = await serviceRpc(environment, name, args);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(name);
  }
  return (await response.json()) as T;
}

function storage(method: 'POST' | 'DELETE', path: string, body: BodyInit, contentType: string): Promise<Response> {
  return fetch(`${SUPABASE_URL}/storage/v1/object/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}`, 'content-type': contentType, 'x-upsert': 'true' },
    body,
  });
}

/** Every part of a building export, each path's text in order; null once it ended. */
async function readFiles(environment: string, exportId: string): Promise<ZipEntry[] | null> {
  const files: { path: string; chunks: string[] }[] = [];
  let after = -1;
  for (;;) {
    const page = await rpc<{ status: string; parts?: { ordinal: number; path: string; content: string }[]; more?: boolean }>(
      environment,
      'export_parts_page',
      { export: exportId, after, page_size: 500 },
    );
    if (page.status !== 'page' || !page.parts) return null;
    for (const part of page.parts) {
      const last = files.at(-1);
      if (last?.path === part.path) last.chunks.push(part.content);
      else files.push({ path: part.path, chunks: [part.content] });
      after = part.ordinal;
    }
    if (!page.more) return files.map((file) => ({ path: file.path, text: file.chunks.join('') }));
  }
}

async function build(environment: string, claimed: { export: string; path: string }): Promise<void> {
  try {
    const files = await readFiles(environment, claimed.export);
    if (!files) return;
    const archive = await zip(files, new Date());
    const stored = await storage('POST', `${BUCKET}/${claimed.path}`, archive, 'application/zip');
    await stored.body?.cancel();
    if (!stored.ok) throw new Error('store');
    const finished = await rpc<{ status: string; email?: string | null; expiresAt?: string }>(environment, 'finish_export_build', {
      export: claimed.export,
      bytes: archive.length,
    });
    if (finished.status === 'ready' && finished.expiresAt) {
      await sendSecurityNotice(environment, finished.email, exportReadyMail(finished.expiresAt), 'export-ready');
    }
  } catch {
    console.error('export build failed');
    const failed = await serviceRpc(environment, 'fail_export_build', { export: claimed.export }).catch(() => null);
    await failed?.body?.cancel();
  }
}

/** Removes ended exports' objects through the Storage API (the database can't). */
async function sweep(environment: string): Promise<number> {
  const ended = await rpc<{ export: string; path: string }[]>(environment, 'exports_to_remove');
  if (ended.length === 0) return 0;
  const removed = await storage('DELETE', BUCKET, JSON.stringify({ prefixes: ended.map((entry) => entry.path) }), 'application/json');
  await removed.body?.cancel();
  if (!removed.ok) throw new Error('remove');
  const marked = await serviceRpc(environment, 'exports_removed', { exports: ended.map((entry) => entry.export) });
  await marked.body?.cancel();
  return ended.length;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(400, { status: 'invalid' });
  await request.body?.cancel();
  const environment = request.headers.get(ENVIRONMENT_HEADER) ?? '';
  try {
    let built = 0;
    for (; built < MAX_BUILDS; built++) {
      const claimed = await rpc<{ status: string; export?: string; path?: string }>(environment, 'begin_export_build');
      if (claimed.status !== 'building' || !claimed.export || !claimed.path) break;
      await build(environment, { export: claimed.export, path: claimed.path });
    }
    const removed = await sweep(environment);
    return reply(200, { built, removed });
  } catch {
    console.error('export job failed');
    return reply(502, { status: 'failed' });
  }
});
