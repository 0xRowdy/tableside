// tsx src/main.ts                       versions only
// tsx src/main.ts --strategy <id> --profile <id> --key <16 hex> [--from 0] [--count 1]
//                                        runs sessions from..from+count-1, one JSON record per line
import { parseArgs } from 'node:util';

import { benchmarkProfile } from '@tableside/definitions';
import { defaultSelection } from '@tableside/engine';

import { builtInStrategies, parseKey, runnerInfo, runStandardized } from './index';

const { values } = parseArgs({
  options: { strategy: { type: 'string' }, profile: { type: 'string' }, key: { type: 'string' }, from: { type: 'string', default: '0' }, count: { type: 'string', default: '1' } },
});

const info = runnerInfo();
if (!values.strategy) {
  console.log(`Tableside runner: engine ${info.engine}, definitions ${info.definitions}, Node ${info.node}`);
} else {
  const definition = builtInStrategies().find((d) => d.id === values.strategy);
  const profile = values.profile ? benchmarkProfile(values.profile) : undefined;
  if (!definition || !profile || !values.key) throw new Error('a built-in strategy id, a benchmark profile id and a key are required');
  const from = Number(values.from);
  const count = Number(values.count);
  if (!Number.isSafeInteger(from) || from < 0 || !Number.isSafeInteger(count) || count < 1) throw new Error('--from is a whole number from 0 and --count one from 1');
  const indices = Array.from({ length: count }, (_, i) => from + i);
  for (const record of runStandardized({ profile, strategy: defaultSelection(definition), key: parseKey(values.key), indices })) console.log(JSON.stringify(record));
}
