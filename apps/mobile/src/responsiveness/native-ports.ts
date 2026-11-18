// Spec 1 Launch gates 5; docs/development.md Responsiveness sampling
import type { ResponsivenessSamplingNative } from '../../modules/responsiveness-sampling';
import type { SamplerPorts } from './sampler';

export function nativeTiming(native: ResponsivenessSamplingNative): Pick<SamplerPorts, 'now' | 'afterCommit' | 'nextFrame' | 'processStart'> {
  return {
    now: () => performance.now(),
    afterCommit: (run) => void setTimeout(run, 0),
    nextFrame: () => native.nextFrame(),
    processStart: () => native.processStart(),
  };
}
