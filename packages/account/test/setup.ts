import { beforeEach } from 'vitest';

import { localStack } from '../src/testing';

beforeEach(() => localStack().resetCodeRequests());
