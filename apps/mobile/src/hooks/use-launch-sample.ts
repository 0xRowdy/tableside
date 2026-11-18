import { useEffect } from 'react';

import { sampling } from '@/responsiveness/probe';

// Spec 1 Launch gates 5; docs/development.md Responsiveness sampling
export function useLaunchSample(): void {
  useEffect(() => sampling?.launchUsable(), []);
}
