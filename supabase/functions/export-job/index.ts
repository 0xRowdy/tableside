// Spec 2 Export; #102

import { exportReadyMail, sendSecurityNotice } from '../_shared/mail.ts';
import { environmentOf, reply, rpcJson, serviceFetch, serviceRpc } from '../_shared/service.ts';
import { type ZipEntry, zip } from '../_shared/zip.ts';

declare const Deno: { serve(handler: (request: Request) => Promise<Response>): void };
const BUCKET = 'account-exports';
const MAX_BUILDS_PER_WAKE = 5;

const rpc = rpcJson;

function storage(method: 'POST' | 'DELETE', path: string, body: BodyInit, contentType: string): Promise<Response> {
  return serviceFetch(`/storage/v1/object/${path}`, { method, body, headers: { 'content-type': contentType, 'x-upsert': 'true' } });
}

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
    } else {
      const removed = await storage('DELETE', BUCKET, JSON.stringify({ prefixes: [claimed.path] }), 'application/json');
      await removed.body?.cancel();
    }
  } catch {
    console.error('export build failed');
    const failed = await serviceRpc(environment, 'fail_export_build', { export: claimed.export }).catch(() => null);
    await failed?.body?.cancel();
  }
}

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
  const environment = environmentOf(request);
  try {
    let built = 0;
    for (; built < MAX_BUILDS_PER_WAKE; built++) {
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
