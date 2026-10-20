// Update compatibility at the engine interface (#80). Every release keeps
// behaviour for every valid unfinished activity an earlier supported build can
// leave: the checkpoints in test/recorded/ were written by earlier builds (one
// module per build, never edited or removed), and this build must decode each
// one directly, whichever releases in between were skipped, and play it on to
// exactly the outcomes that build recorded. Rollback is the other direction: a
// checkpoint this build can't run is refused as unsupported, never reinterpreted.
import type { TestCase } from '@tableside/harness';

import { advanceActivity, canonicalJson, decodeCheckpoint, quarantineStatus, type ActivityState, type DomainFact, type QuarantineList } from '../src';

import { RECORDED_BUILDS } from './recorded';

/** Plays a recorded continuation from a decoded checkpoint, collecting every fact. */
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
        t.equal(build.phases, ['correction', 'cycle-completion', 'final-settlement', 'open-decision', 'revealing-outcome', 'settled-outcome']);
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
          // The pinned identities are kept as recorded, never replaced by this build's.
          t.equal([recorded.name, decoded.state.identities.engine, decoded.state.phase], [recorded.name, build.engine, recorded.phase]);
          const { state, facts } = continueFrom(decoded.state, recorded.continuation);
          t.equal([recorded.name, canonicalJson(facts), state.phase, state.balance], [recorded.name, recorded.facts, 'completed', recorded.finalBalance]);
        }
      }
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
      // The combination as a defect report would name it: the recording build and the rule preset it was given.
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
