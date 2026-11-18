import { useEffect } from 'react';

import { sampling } from '@/responsiveness/probe';

// Spec 1 Launch gates 5; docs/development.md Responsiveness sampling (cold launch)
export function useLaunchSample(usable: boolean): void {
  useEffect(() => {
    if (usable) sampling?.launchUsable();
  }, [usable]);
}
