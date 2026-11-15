// Routine logs carry no private data (spec 2, *Observability and privacy
// boundaries*, gate 11; #108): no record body, token, email code, raw age
// data, clock anchor, account email or casino session. Every log line in
// shipped code is checked here: a `console` call in the app, the shared
// packages or an edge function may log only fixed text, a step name or an
// HTTP status, and a database function may raise only a fixed message.
// Events go through the metrics catalog and crash reports through
// crashReport() (packages/account/src); their checks sit beside them.

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

/** What a log call may pass besides fixed text: names of steps and statuses, never values. */
const LOGGABLE_PROPERTIES = new Set(['status', 'step']);

function loggable(node: ts.Expression): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) return true;
  if (ts.isParenthesizedExpression(node)) return loggable(node.expression);
  if (ts.isPropertyAccessExpression(node)) return LOGGABLE_PROPERTIES.has(node.name.text);
  // Either branch is logged, whatever decides between them.
  if (ts.isConditionalExpression(node)) return loggable(node.whenTrue) && loggable(node.whenFalse);
  return false;
}

/** Each `console` call whose arguments aren't all loggable, as its source text. */
function unsafeLogCalls(source: string, fileName = 'example.ts'): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isConsole =
        (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) && ts.isIdentifier(callee.expression) && callee.expression.text === 'console';
      if (isConsole && !node.arguments.every(loggable)) found.push(node.getText(file));
    }
    // `console` handed on (console.log as a callback, `const log = console`) logs whatever it is given.
    if (ts.isIdentifier(node) && node.text === 'console' && !(ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent))) {
      found.push(node.parent.getText(file));
    }
    const called = node.parent !== undefined && ts.isCallExpression(node.parent) && node.parent.expression === node;
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && ts.isIdentifier(node.expression) && node.expression.text === 'console' && !called) {
      found.push(node.parent.getText(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Each `raise` in SQL that could put a value in the database log: anything but an exception with a fixed message. */
function unsafeRaises(sql: string): string[] {
  const statements = sql.match(/\braise\b[^;]*;/gi) ?? [];
  return statements.filter((statement) => !/^raise\s+exception\s+'[^'%]*'(\s+using\s+(errcode|hint)\s*=\s*'[^'%]*'(\s*,\s*(errcode|hint)\s*=\s*'[^'%]*')*)?\s*;$/i.test(statement.replace(/\s+/g, ' ')));
}

async function filesUnder(directory: string, accept: (path: string) => boolean): Promise<string[]> {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .filter((path) => !path.includes('node_modules') && accept(path));
}

/** Shipped source: not tests, test harnesses, scripts or generated native projects. */
const shipped = (path: string) =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.tsx?$|\.cases\.ts$|\.d\.ts$/.test(path) &&
  !/(^|\/)(test|tests|__tests__|testing|scripts|ios|android)\//.test(path);

describe('the log checks', () => {
  it.each([
    ["console.error('request-code failed', error instanceof StepError ? error.step : 'unexpected');", []],
    ["console.error('bind failed', response.status);", []],
    ["console.error('failed', error);", ["console.error('failed', error)"]],
    ['console.log(`sent to ${email}`);', ['console.log(`sent to ${email}`)']],
    ["console.warn('payload', JSON.stringify(record));", ["console.warn('payload', JSON.stringify(record))"]],
    ["console['info'](token);", ["console['info'](token)"]],
    ['promise.catch(console.error);', ['promise.catch(console.error)']],
    ['const log = console; log.info(code);', ['log = console']],
  ])('%s', (source, expected) => {
    expect(unsafeLogCalls(source)).toEqual(expected);
  });

  it.each([
    ["raise exception 'not authorized' using errcode = '42501';", []],
    ["raise exception 'protocol_retired' using errcode = 'PT426', hint = 'Update the app to sync.';", []],
    ["raise exception 'no account for %', p_email;", ["raise exception 'no account for %', p_email;"]],
    ["raise notice 'payload %', p_request;", ["raise notice 'payload %', p_request;"]],
    ["raise log 'here';", ["raise log 'here';"]],
  ])('%s', (sql, expected) => {
    expect(unsafeRaises(sql)).toEqual(expected);
  });
});

describe('routine logs in shipped code', () => {
  it('log only fixed text, step names and statuses: in the app, the web account page, the shared packages and the edge functions', async () => {
    const files = [
      ...(await filesUnder('apps/mobile/src', shipped)),
      ...(await filesUnder('apps/web/src', shipped)),
      // The packages the app and backend ship. The harness and the runner are developer tools that print their own reports.
      ...(await filesUnder('packages', (path) => /^packages\/(account|engine|definitions)\/src\//.test(path) && shipped(path))),
      ...(await filesUnder('supabase/functions', shipped)),
    ];
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('supabase/functions/request-code/index.ts');
    const unsafe: string[] = [];
    for (const path of files) for (const call of unsafeLogCalls(await readFile(join(root, path), 'utf8'), path)) unsafe.push(`${path}: ${call}`);
    expect(unsafe).toEqual([]);
  });

  it('raise only fixed messages from the database', async () => {
    const migrations = await filesUnder('supabase', (path) => path.endsWith('.sql'));
    expect(migrations.length).toBeGreaterThan(10);
    const unsafe: string[] = [];
    for (const path of migrations) for (const raise of unsafeRaises(await readFile(join(root, path), 'utf8'))) unsafe.push(`${path}: ${raise}`);
    expect(unsafe).toEqual([]);
  });
});
