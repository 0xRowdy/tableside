// The in-memory store runs the store-port contract suite that spec 2's SQLite
// store must also pass.

import { MemoryActivityStore } from '@/practice/memory-store';
import { describeActivityStoreContract } from '@/practice/testing/store-contract';

describeActivityStoreContract('the in-memory store', async () => {
  const store = new MemoryActivityStore();
  return { store, reopen: async () => store.reopen() };
});
