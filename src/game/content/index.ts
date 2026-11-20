// Puts the content files together into the data the engine uses.
//   resources.ts      resources, islands, Health
//   nodes.ts          nodes (what they use and make)
//   node-upgrades.ts  upgrades shown on a node
//   upgrades.ts       upgrades in the Build panel, in sections
// Balance check: `npm run sim` plays the game with bots and reports timings.

import type { GameData, UpgradeDef } from '../defs.ts';
import { HEALTH, REGIONS, RESOURCES } from './resources.ts';
import { NODES } from './nodes.ts';
import { NODE_UPGRADES } from './node-upgrades.ts';
import { SECTIONS } from './upgrades.ts';

/** Node upgrades: the change applies to the node they're listed under. */
const nodeUpgrades: UpgradeDef[] = Object.entries(NODE_UPGRADES).flatMap(([node, list]) =>
  list.map(({ change, ...u }) => ({ ...u, changes: [{ converter: node, mode: 'by' as const, ...change }] })),
);

const sectionUpgrades: UpgradeDef[] = SECTIONS.flatMap((s) => s.upgrades.map((u) => ({ ...u, section: s.id })));

export const DATA: GameData = {
  resources: RESOURCES,
  regions: REGIONS,
  converters: NODES,
  upgrades: [...nodeUpgrades, ...sectionUpgrades],
  sections: SECTIONS.map(({ id, name, intro }) => ({ id, name, intro })),
  health: HEALTH,
};
