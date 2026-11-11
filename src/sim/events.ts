import type { I18nKey } from '../i18n';

/** Звуковые события. Конкретные патчи — в audio/bank.ts. */
export type SfxId =
  | 'start' | 'dash' | 'pulse'
  | 'shoot.pulse' | 'shoot.scatter' | 'shoot.rail' | 'shoot.nailer' | 'shoot.arc' | 'swing'
  | 'shoot.rocket' | 'shoot.flamer' | 'shoot.cryo' | 'shoot.mortar' | 'shoot.laser' | 'explode' | 'turretDeploy'
  | 'teleWarn' | 'bossLaser' | 'bossSlam' | 'synergy' | 'unlock'
  | 'kill' | 'killElite' | 'killBoss' | 'hurt' | 'dodge' | 'gameover' | 'victory'
  | 'scrap' | 'pickup' | 'levelUp' | 'choose' | 'reroll' | 'waveEnd' | 'waveStart'
  | 'bossSpawn' | 'bossVolley' | 'bossLeave' | 'mineArm' | 'mineBoom' | 'split' | 'error';

/** Сим не рисует и не играет звук — он пишет события, их читают render/audio/ui. */
export type SimEvent =
  | { t: 'burst'; x: number; y: number; color: string; n: number; force: number }
  | { t: 'ring'; x: number; y: number; color: string; max: number; life: number }
  | { t: 'floater'; x: number; y: number; key: I18nKey; n: number; color: string; big?: boolean }
  | { t: 'beam'; pts: number[]; color: string; life: number; straight?: boolean }
  | { t: 'swing'; x: number; y: number; a: number; arc: number; r: number; color: string }
  | { t: 'shake'; v: number }
  | { t: 'kick'; a: number; v: number }
  | { t: 'flash'; v: number }
  | { t: 'hitstop'; ms: number }
  | { t: 'sfx'; id: SfxId; v?: number }
  | { t: 'toast'; key: I18nKey; sub: I18nKey; params: Record<string, number | string>; duration: number }
  | { t: 'phase' };

export type EventSink = SimEvent[];
