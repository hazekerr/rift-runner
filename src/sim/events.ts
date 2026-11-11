import type { I18nKey } from '../i18n';

/** Звуковые события. Конкретные патчи — в audio/bank.ts. */
export type SfxId =
  | 'start' | 'reload' | 'reloadDone' | 'switch' | 'dash' | 'pulse'
  | 'shoot.pulse' | 'shoot.scatter' | 'shoot.rail'
  | 'kill' | 'killBoss' | 'hurt' | 'gameover' | 'upgradeOpen' | 'upgradeTake'
  | 'pickup' | 'bossSpawn' | 'bossVolley';

/** Сим не рисует и не играет звук — он пишет события, их читают render/audio/ui. */
export type SimEvent =
  | { t: 'burst'; x: number; y: number; color: string; n: number; force: number }
  | { t: 'ring'; x: number; y: number; color: string; max: number; life: number }
  | { t: 'floater'; x: number; y: number; key: I18nKey; n: number; color: string }
  | { t: 'shake'; v: number }
  | { t: 'flash'; v: number }
  | { t: 'sfx'; id: SfxId; v?: number }
  | { t: 'toast'; key: I18nKey; sub: I18nKey; params: Record<string, number | string>; duration: number }
  | { t: 'gameover' }
  | { t: 'upgrade' };

export type EventSink = SimEvent[];
