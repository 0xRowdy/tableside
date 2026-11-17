import { MemoryActivityStore } from '@/practice/memory-store';
import { describeActivityStoreContract } from '@/practice/testing/store-contract';

describeActivityStoreContract('the in-memory store', async () => {
  const store = new MemoryActivityStore();
  return { store, reopen: async () => store.reopen() };
});
