// #80
// docs/development.md Releases: recorded checkpoints and the quarantine list
import type { TestCase } from '@tableside/harness';

import {
  advanceActivity,
  advanceChallenge,
  canonicalJson,
  challengeResults,
  decodeChallengeCheckpoint,
  decodeCheckpoint,
  quarantineStatus,
  type ActivityState,
  type ChallengeFact,
  type DomainFact,
  type QuarantineList,
} from '../src';

import { RECORDED_BUILDS } from './recorded';

function continueFrom(state: ActivityState, commands: readonly unknown[]): { state: ActivityState; facts: DomainFact[] } {
  const facts: DomainFact[] = [];
  for (const command of commands) {
    const result = advanceActivity(state, { sequence: state.sequence, commandId: `continue-${state.sequence}`, command: command as never });
    if (result.status !== 'committed') throw new Error(`the recorded continuation was refused: ${JSON.stringify(result)}`);
    state = result.state;
    facts.push(...result.facts);
  }
  return { state, facts };
}

export const compatibilityCases: TestCase[] = [
  {
    name: 'compatibility: recorded checkpoints cover each game and the unfinished phases a session can be left in',
    run: (t) => {
      const builds = RECORDED_BUILDS.map((build) => ({
        build: build.engine,
        games: [...new Set(build.checkpoints.map((recorded) => recorded.game))].sort(),
        phases: [...new Set(build.checkpoints.map((recorded) => recorded.phase))].sort(),
      }));
      t.record('recorded builds', builds);
      for (const build of builds) {
        t.equal(build.games, ['blackjack', 'craps', 'roulette']);
        t.equal(build.phases, ['correction', 'cycle-completion', 'final-settlement', 'open-decision', 'revealing-outcome', 'settled-outcome', 'strategy-settlement']);
      }
    },
  },
  {
    name: 'compatibility: this build resumes every unfinished checkpoint an earlier build recorded, skipped versions included, with the recorded outcomes',
    run: (t) => {
      for (const build of RECORDED_BUILDS) {
        for (const recorded of build.checkpoints) {
          const decoded = decodeCheckpoint(recorded.checkpoint);
          if (!decoded.ok) throw new Error(`${build.engine} ${recorded.name}: ${decoded.error.kind}: ${decoded.error.message}`);
          t.equal([recorded.name, decoded.state.identities.engine, decoded.state.phase], [recorded.name, build.engine, recorded.phase]);
          const { state, facts } = continueFrom(decoded.state, recorded.continuation);
          t.equal([recorded.name, canonicalJson(facts), state.phase, state.balance], [recorded.name, recorded.facts, 'completed', recorded.finalBalance]);
        }
      }
    },
  },
  // #158
  {
    name: 'compatibility: this build resumes every unfinished challenge attempt an earlier build recorded, with the recorded results',
    run: (t) => {
      const phases = new Set<string>();
      for (const build of RECORDED_BUILDS) {
        for (const recorded of build.challenges ?? []) {
          const decoded = decodeChallengeCheckpoint(recorded.checkpoint);
          if (!decoded.ok) throw new Error(`${build.engine} ${recorded.name}: ${decoded.error.kind}: ${decoded.error.message}`);
          phases.add(recorded.phase);
          let state = decoded.state;
          const facts: ChallengeFact[] = [];
          for (const command of recorded.continuation) {
            const result = advanceChallenge(state, { sequence: state.sequence, commandId: `continue-${state.sequence}`, command: command as never });
            if (result.status !== 'committed') throw new Error(`${recorded.name}: the recorded continuation was refused`);
            state = result.state;
            facts.push(...result.facts);
          }
          t.equal([recorded.name, canonicalJson(facts), canonicalJson(challengeResults(state))], [recorded.name, recorded.facts, recorded.results]);
        }
      }
      t.equal([...phases].sort(), ['bet', 'card', 'correction', 'decision', 'explanation', 'question', 'ready', 'recorded']);
    },
  },
  {
    name: 'compatibility: a checkpoint written by a later build (newer schema or engine) is refused as unsupported, so a rollback never reopens it',
    run: (t) => {
      const recorded = RECORDED_BUILDS[0]?.checkpoints[0];
      if (!recorded) throw new Error('no recorded checkpoint');
      const later = (change: (value: { schema: number; identities: { engine: string } }) => void) => {
        const value = JSON.parse(recorded.checkpoint) as { schema: number; identities: { engine: string } };
        change(value);
        return canonicalJson(value);
      };
      const results = [later((v) => (v.schema += 1)), later((v) => (v.identities.engine = '99.0.0'))].map((text) => {
        const result = decodeCheckpoint(text);
        return result.ok ? 'ok' : result.error.kind;
      });
      t.equal(results, ['unsupported', 'unsupported']);
    },
  },
  {
    name: 'compatibility: an unfinished activity is judged against the quarantine list by the same pinned identities as a completed record',
    run: (t) => {
      const build = RECORDED_BUILDS[0];
      const recorded = build?.checkpoints.find((checkpoint) => checkpoint.game === 'craps');
      if (!build || !recorded) throw new Error('no recorded craps checkpoint');
      const decoded = decodeCheckpoint(recorded.checkpoint);
      if (!decoded.ok) throw new Error(decoded.error.message);
      const preset = (recorded.specification as { rules: { id: string; version: number } }).rules;
      const rules = { id: preset.id, version: preset.version };
      const list: QuarantineList = {
        version: 2,
        entries: [{ id: 'q-craps', match: { engine: build.engine, rules }, explanation: 'A craps settlement defect.' }],
      };
      t.equal(quarantineStatus(decoded.state, list), { quarantined: true, entry: 'q-craps', explanation: 'A craps settlement defect.' });
      t.equal(quarantineStatus(decoded.state, { version: 2, entries: [{ ...list.entries[0]!, match: { rules: { ...rules, version: rules.version + 1 } } }] }), { quarantined: false });
    },
  },
];
