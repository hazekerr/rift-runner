export const WORLD = { w: 1900, h: 1250 } as const;
export const ARENA_CENTER = { x: 950, y: 625 } as const;

export interface ObstacleDef {
  x: number;
  y: number;
  w: number;
  h: number;
  crate: boolean;
  hp: number;
}

const WALLS: ReadonlyArray<readonly [number, number, number, number]> = [
  [380, 260, 160, 65], [1360, 260, 160, 65], [380, 925, 160, 65], [1360, 925, 160, 65],
  [650, 460, 65, 160], [1185, 630, 65, 160], [190, 580, 90, 90], [1620, 580, 90, 90],
  [890, 210, 120, 55], [890, 985, 120, 55],
];
const CRATES: ReadonlyArray<readonly [number, number]> = [
  [620, 260], [1220, 940], [330, 840], [1510, 380], [1010, 840], [810, 360], [280, 380], [1560, 840],
];
export const CRATE_SIZE = 46;
export const CRATE_HP = 65;

export function makeArena(): ObstacleDef[] {
  const out: ObstacleDef[] = [];
  for (const [x, y, w, h] of WALLS) out.push({ x, y, w, h, hp: Infinity, crate: false });
  for (const [x, y] of CRATES) out.push({ x, y, w: CRATE_SIZE, h: CRATE_SIZE, hp: CRATE_HP, crate: true });
  return out;
}
