// tsx src/main.ts                       versions only
// tsx src/main.ts --strategy <id> --profile <id> --key <16 hex> [--from 0] [--count 1]
//                                        runs sessions from..from+count-1, one JSON record per line
import { parseArgs } from 'node:util';

import { benchmarkProfile } from '@tableside/definitions';

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
  const indices = Array.from({ length: Number(values.count) }, (_, i) => from + i);
  for (const record of runStandardized({ profile, definition, key: parseKey(values.key), indices })) console.log(JSON.stringify(record));
}
