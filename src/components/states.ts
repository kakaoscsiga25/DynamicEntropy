import type { ConverterState } from '../game/engine';

// Where a node is in its cycle. The colors are the .state-* classes in app.css.
export const STATE_LABEL: Record<ConverterState, string> = {
  noInput: 'Waiting for input',
  ok: 'Running',
  interrupted: 'Interrupted',
  full: 'Output full',
  stopped: 'Stopped',
};

/** Legend order: the cycle's phases, then switched off. */
export const STATE_ORDER: ConverterState[] = ['noInput', 'ok', 'interrupted', 'full', 'stopped'];
