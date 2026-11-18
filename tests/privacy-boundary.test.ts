// Spec 2 Observability and privacy boundaries; #108

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));

const LOGGABLE_PROPERTIES = new Set(['status', 'step']);

function loggable(node: ts.Expression): boolean {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) return true;
  if (ts.isParenthesizedExpression(node)) return loggable(node.expression);
  if (ts.isPropertyAccessExpression(node)) return LOGGABLE_PROPERTIES.has(node.name.text);
  if (ts.isConditionalExpression(node)) return loggable(node.whenTrue) && loggable(node.whenFalse);
  return false;
}

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

// Spec 3 Information hiding (end to end), Launch gates 2; #156
describe('challenge and lesson code', () => {
  const CHALLENGE_AND_LESSON = /^(apps\/mobile\/src\/(training|counting|lessons)\/|packages\/engine\/src\/(challenge|challenge-record|table-challenge)\.ts$|packages\/definitions\/src\/(challenges|lessons|counting-examples|hints)\.ts$)/;

  function consoleUses(source: string, fileName: string): string[] {
    const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text === 'console') found.push(node.parent.getText(file));
      ts.forEachChild(node, visit);
    };
    visit(file);
    return found;
  }

  it('writes no routine log at all, so no answer, card, reference or unfinished attempt can reach one', async () => {
    const files = [...(await filesUnder('apps/mobile/src', shipped)), ...(await filesUnder('packages', shipped))].filter((path) => CHALLENGE_AND_LESSON.test(path));
    expect(files).toEqual(
      expect.arrayContaining([
        'apps/mobile/src/training/controller.ts',
        'apps/mobile/src/training/service.ts',
        'apps/mobile/src/counting/ChallengeExercise.tsx',
        'apps/mobile/src/lessons/WorkedExample.tsx',
        'packages/engine/src/challenge.ts',
        'packages/definitions/src/lessons.ts',
      ]),
    );
    const uses: string[] = [];
    for (const path of files) for (const use of consoleUses(await readFile(join(root, path), 'utf8'), path)) uses.push(`${path}: ${use}`);
    expect(uses).toEqual([]);
  });
});

// Spec 3 Information hiding (end to end), Launch gates 2; #156
describe('the apps', () => {
  const CHANNELS = [
    /^expo-notifications$/, /^@notifee\//, /push-notification/, /^@react-native-firebase\//, /^@sentry\//, /^sentry-expo$/, /^@bugsnag\//, /crashlytics/,
    /^@datadog\//, /^@amplitude\//, /^@segment\//, /^posthog/, /^mixpanel/, /^expo-insights$/, /^@newrelic\//, /^instabug/, /^@embrace-io\//,
  ];
  const isChannel = (name: string) => CHANNELS.some((pattern) => pattern.test(name));

  it.each(['expo-notifications', '@sentry/react-native', '@bugsnag/expo', '@react-native-firebase/crashlytics', 'posthog-react-native'])('the check catches %s', (name) => {
    expect(isChannel(name)).toBe(true);
  });

  it('carry no notification, crash-reporting, breadcrumb or analytics SDK, so a challenge or lesson has no such channel to leak through (spec 7 adds one under its consent rules)', async () => {
    const found: string[] = [];
    for (const app of ['apps/mobile', 'apps/web']) {
      const manifest = JSON.parse(await readFile(join(root, app, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
      for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) if (isChannel(name)) found.push(`${app}: ${name}`);
    }
    for (const path of [...(await filesUnder('apps', shipped)), ...(await filesUnder('packages', shipped))]) {
      const source = await readFile(join(root, path), 'utf8');
      for (const [, name] of source.matchAll(/(?:from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g)) if (isChannel(name!)) found.push(`${path}: ${name}`);
    }
    expect(found).toEqual([]);
  });
});
