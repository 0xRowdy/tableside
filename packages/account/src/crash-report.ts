// What a crash report may carry (spec 2, *Observability and privacy
// boundaries*; #108): the error's type, a structured code when it has one, and
// the code locations it came through. Never its message, which can hold a
// record body, a token, an email code, raw age data, a clock anchor or an
// address; never a location's query string or fragment, where a token can sit.
// The crash reporter itself is spec 7's: whatever it sends is a CrashReport.

export interface CrashReport {
  /** The error's class name (TypeError, SyncCallError), or what was thrown when it wasn't an error. */
  readonly type: string;
  /** A structured code the error carries (a SyncCallError's kind, a provider's error code). */
  readonly code?: string;
  /** The stack's frames, innermost first: function names and code locations only. */
  readonly frames: readonly string[];
}

const TYPE = /^[A-Z][A-Za-z]{0,63}$/;
const CODE = /^[a-z][a-z0-9_-]{0,63}$/;
/** A function name as it appears in a frame: an identifier path, perhaps with `new`, `async` or `<anonymous>`. */
const FUNCTION = /^(?:new |async )?[\w$.<>[\]]{1,200}$/;
const MAX_FRAMES = 50;

export function crashReport(thrown: unknown): CrashReport {
  if (!(thrown instanceof Error)) return { type: thrown === null ? 'null' : typeof thrown, frames: [] };
  const type = TYPE.test(thrown.name) ? thrown.name : 'Error';
  const coded = thrown as { kind?: unknown; code?: unknown };
  const code = [coded.kind, coded.code].find((value): value is string => typeof value === 'string' && CODE.test(value));
  const frames = (thrown.stack ?? '')
    .split('\n')
    .map(frame)
    .filter((line): line is string => line !== null)
    .slice(0, MAX_FRAMES);
  return { type, ...(code ? { code } : {}), frames };
}

/** One stack line as a frame (V8 and Hermes: `at name (location)` or `at location`; JavaScriptCore: `name@location`), or null when it isn't one. */
function frame(line: string): string | null {
  const v8 = /^\s*at (?:(.+?) \((.+)\)|(.+))$/.exec(line);
  if (v8) {
    const [, name, location, bare] = v8;
    return name !== undefined && location !== undefined ? `at ${functionName(name)} (${cleanLocation(location)})` : `at ${cleanLocation(bare!)}`;
  }
  const jsc = /^([^@\s]*)@(\S+:\d+:\d+)$/.exec(line.trim());
  if (jsc) return `${functionName(jsc[1]!)}@${cleanLocation(jsc[2]!)}`;
  return null;
}

const functionName = (name: string) => (name === '' || FUNCTION.test(name) ? name : '<frame>');

/** A location without its query string or fragment: the file, line and column. */
function cleanLocation(location: string): string {
  const [, file, position] = /^(.*?)((?::\d+){0,2})$/.exec(location)!;
  return `${file!.replace(/[?#].*$/, '')}${position}`;
}
