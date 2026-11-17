// Spec 2 S2-22, S2-23; #104

import { parseDeletionStatus, parseProgress } from '../deletion-progress';
import { cancelAnswer, retriedOperations, scheduleAnswer } from '../lifecycle-answers';

import type { ServiceContext } from './context';
import { deletedKey } from './credentials';
import type { AccountSession } from './session';
import { type AccountDeletion, type DeletionProgress, opensRestrictedPaths } from './types';

export function createDeletion(ctx: ServiceContext, session: AccountSession): AccountDeletion {
  const { options } = ctx;
  const { backend } = options;
  const operations = retriedOperations(() => ctx.randomHex(16));
  session.onDeletionMoved(() => operations.settle());

  const isDeleted = () => ctx.gate.state === 'deleted';

  const deletionProgress = async (): Promise<DeletionProgress | null> => {
    const token = (await session.readDeleted())?.token;
    if (!token || !options.device.online.current()) return null;
    try {
      const response = await ctx.post('/rest/v1/rpc/deletion_progress_v1', { token });
      if (!response.ok || !isDeleted()) {
        await response.arrayBuffer();
        return null;
      }
      return parseProgress(await response.json().catch(() => null));
    } catch {
      return null;
    }
  };

  return {
    async schedule() {
      const { gate } = ctx;
      if (gate.state === 'deletion-scheduled') return { status: 'scheduled', deadline: gate.deadline };
      const current = session.opened;
      if (!current || !opensRestrictedPaths(gate)) return { status: 'failed' };
      if (!options.device.online.current()) return { status: 'offline' };
      const answer = await ctx.actAsPlayer('schedule-deletion', { operationId: operations.id('schedule', ctx.generation) }, 'restricted');
      if (session.opened !== current) return { status: 'failed' };
      if (answer && answer.code < 500) operations.settle();
      const scheduled = scheduleAnswer(answer?.code, answer?.body);
      if (scheduled?.status === 'fresh-authentication-required') return scheduled;
      if (!scheduled) {
        await session.checkLifecycle(current);
        return { status: 'failed' };
      }
      await session.rememberDeletion(current, scheduled.deadline);
      return { status: 'scheduled', deadline: scheduled.deadline };
    },

    async cancel() {
      const current = session.opened;
      if (ctx.gate.state !== 'deletion-scheduled' || !current) return { status: 'failed' };
      if (!options.device.online.current()) return { status: 'offline' };
      const answer = (await ctx.operation('cancel_deletion_v1', { operation_id: operations.id('cancel', ctx.generation) }, 'restricted')) as { status?: unknown } | null;
      if (session.opened !== current) return { status: 'failed' };
      if (typeof answer?.status === 'string') operations.settle();
      const result = cancelAnswer(answer?.status);
      if (result?.status === 'fresh-authentication-required') return result;
      if (result?.status === 'canceled') {
        await session.rememberDeletion(current, undefined);
        return result;
      }
      await session.checkLifecycle(current);
      return result ?? { status: 'failed' };
    },

    async deletePermanently() {
      const current = session.opened;
      if (isDeleted()) return { status: 'deleted' };
      if (!current || !opensRestrictedPaths(ctx.gate)) return { status: 'failed' };
      if (!options.device.online.current()) return { status: 'offline' };
      const token = await session.storedStatus(current.remembered.accountId);
      const answer = (await ctx.operation('delete_permanently_v1', undefined, 'restricted')) as { status?: unknown } | null;
      if (session.opened !== current) return isDeleted() ? { status: 'deleted' } : { status: 'failed' };
      if (answer?.status === 'fresh-authentication-required') return { status: answer.status };
      if (answer?.status === 'deleted') {
        await session.eraseDeleted(current, token);
      } else {
        await session.checkLifecycle(current);
      }
      return isDeleted() ? { status: 'deleted' } : { status: 'failed' };
    },

    async dismiss() {
      if (!isDeleted()) return;
      await ctx.writeCredentials(() => ctx.credentials.removeItem(deletedKey(backend.name)));
      if (isDeleted()) ctx.setGate({ state: 'no-account' });
    },

    async status() {
      if (isDeleted()) return deletionProgress();
      const current = session.opened;
      const answer = parseDeletionStatus(await ctx.operation('deletion_status_v1', undefined, 'restricted'));
      if (!current || session.opened !== current || !answer) return null;
      await session.rememberDeletion(current, answer.status === 'scheduled' ? answer.deadline : undefined);
      return answer;
    },
  };
}
