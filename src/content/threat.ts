/**
 * Уровни Угрозы (открываются победами). Каждый уровень включает все предыдущие.
 * 1: HP врагов ×1.2 · 2: элиты ×2 и с волны 2 · 3: урон врагов ×1.25, вражеские снаряды ×1.15 ·
 * 4: цены ×1.2, в запас разлома 25% вместо 50%. Очки ×(1 + 0.25·уровень).
 */
export const THREAT_MAX = 4;

export interface ThreatMods {
  hpMult: number;
  dmgMult: number;
  bulletSpeedMult: number;
  eliteMult: number;
  eliteFromWave: number;
  priceMult: number;
  bonusShare: number;
  scoreMult: number;
}

export function threatMods(level: number): ThreatMods {
  const l = Math.max(0, Math.min(THREAT_MAX, Math.floor(level)));
  return {
    hpMult: l >= 1 ? 1.2 : 1,
    eliteMult: l >= 2 ? 2 : 1,
    eliteFromWave: l >= 2 ? 2 : 5,
    dmgMult: l >= 3 ? 1.25 : 1,
    bulletSpeedMult: l >= 3 ? 1.15 : 1,
    priceMult: l >= 4 ? 1.2 : 1,
    bonusShare: l >= 4 ? 0.25 : 0.5,
    scoreMult: 1 + 0.25 * l,
  };
}
