import type { I18nKey } from '../i18n';

/** Оружие прототипа (этап 1: ручной режим, магазин патронов). */
export interface GunDef {
  id: 'pulse' | 'scatter' | 'rail';
  name: I18nKey;
  kind: I18nKey;
  mag: number;
  delay: number;
  reload: number;
  damage: number;
  speed: number;
  spread: number;
  pellets: number;
  color: string;
  life: number;
  pierce: number;
  bulletR: number;
  shake: number;
}

export const GUNS: readonly GunDef[] = [
  { id: 'pulse', name: 'gun.pulse.name', kind: 'gun.pulse.kind', mag: 24, delay: 0.105, reload: 1.05, damage: 21, speed: 1120, spread: 0.035, pellets: 1, color: '#75f5df', life: 0.85, pierce: 1, bulletR: 3, shake: 1.2 },
  { id: 'scatter', name: 'gun.scatter.name', kind: 'gun.scatter.kind', mag: 7, delay: 0.55, reload: 1.35, damage: 15, speed: 900, spread: 0.29, pellets: 7, color: '#ffb86a', life: 0.48, pierce: 1, bulletR: 3, shake: 3 },
  { id: 'rail', name: 'gun.rail.name', kind: 'gun.rail.kind', mag: 5, delay: 0.65, reload: 1.45, damage: 86, speed: 1850, spread: 0, pellets: 1, color: '#b4a0ff', life: 0.8, pierce: 4, bulletR: 4, shake: 4 },
];
