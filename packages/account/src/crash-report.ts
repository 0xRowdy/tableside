// Spec 2 Observability and privacy boundaries; #108

export interface CrashReport {
  readonly type: string;
  readonly code?: string;
  readonly frames: readonly string[];
}

const TYPE = /^[A-Z][A-Za-z]{0,63}$/;
const CODE = /^[a-z][a-z0-9_-]{0,63}$/;
const FUNCTION = /^(?:new |async )?[\w$.<>[\]]{1,200}$/;
const MAX_FRAMES = 50;

export function crashReport(thrown: unknown): CrashReport {
  if (!(thrown instanceof Error)) return { type: thrown === null ? 'null' : typeof thrown, frames: [] };
  const type = TYPE.test(thrown.name) ? thrown.name : 'Error';
  const coded = thrown as { kind?: unknown; code?: unknown };
  const code = [coded.kind, coded.code].find((value): value is string => typeof value === 'string' && CODE.test(value));
  const frames = stackWithoutMessage(thrown)
    .split('\n')
    .map(parseFrame)
    .filter((line): line is string => line !== null)
    .slice(0, MAX_FRAMES);
  return { type, ...(code ? { code } : {}), frames };
}

function stackWithoutMessage(error: Error): string {
  const stack = error.stack ?? '';
  const header = error.message === '' ? error.name : `${error.name}: ${error.message}`;
  for (const start of [header, error.message]) if (start !== '' && stack.startsWith(start)) return stack.slice(start.length);
  return stack;
}

const LOCATION = /(?::\d+:\d+|^native|<anonymous>)$/;

function parseFrame(line: string): string | null {
  const v8 = /^\s*at (?:(.+?) \((.+)\)|(.+))$/.exec(line);
  if (v8) {
    const [, name, location, bare] = v8;
    if (!LOCATION.test(location ?? bare!)) return null;
    return name !== undefined && location !== undefined ? `at ${functionName(name)} (${withoutQueryOrFragment(location)})` : `at ${withoutQueryOrFragment(bare!)}`;
  }
  const jsc = /^([^@\s]*)@(\S+:\d+:\d+)$/.exec(line.trim());
  if (jsc) return `${functionName(jsc[1]!)}@${withoutQueryOrFragment(jsc[2]!)}`;
  return null;
}

const functionName = (name: string) => (name === '' || FUNCTION.test(name) ? name : '<frame>');

function withoutQueryOrFragment(location: string): string {
  const [, file, position] = /^(.*?)((?::\d+){0,2})$/.exec(location)!;
  return `${file!.replace(/[?#].*$/, '')}${position}`;
}
