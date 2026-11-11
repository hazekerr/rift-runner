import type { I18nKey } from '../i18n';

/** Операторы. Этап 2 — только базовый; правила остальных на этапе 4. */
export interface OperatorDef {
  id: string;
  name: I18nKey;
  startWeapons: readonly string[];
}

export const OPERATORS: readonly OperatorDef[] = [
  { id: 'operator', name: 'op.operator', startWeapons: ['pulse'] },
];
