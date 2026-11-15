// Each scenario starts with fresh code-request windows: every scenario runs
// from this one machine's address, so the per-IP limit would otherwise carry
// over from one scenario to the next.

import { beforeEach } from 'vitest';

import { localStack } from '../src/testing';

beforeEach(() => localStack().resetCodeRequests());
