import type { ConverterState } from '../game/engine';

export const STATE_LABEL: Record<ConverterState, string> = {
  ok: 'Running',
  stopped: 'Stopped',
  noInput: 'Waiting for input',
  full: 'Output full',
};
