import type { ProjectState } from '@/db/schema/projects';

export const transitions: Record<ProjectState, ReadonlyArray<ProjectState>> = {
  lead: ['qualifying', 'done'],
  qualifying: ['discovery', 'done'],
  discovery: ['contract', 'done'],
  contract: ['execution', 'done'],
  execution: ['reporting'],
  reporting: ['closing'],
  closing: ['done'],
  done: []
};

export const prevTransitions: Record<ProjectState, ReadonlyArray<ProjectState>> = {
  lead: [],
  qualifying: ['lead'],
  discovery: ['qualifying'],
  contract: ['discovery'],
  execution: ['contract'],
  reporting: ['execution'],
  closing: ['reporting'],
  done: ['closing']
};
