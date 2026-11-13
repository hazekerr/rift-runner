/** Единственное место, где задано имя продукта. */
export const PRODUCT = {
  name: 'RIFT RUNNER',
  short: 'RR',
  /** Части названия для крупного заголовка меню: «RIFT» / «RUNNER.» */
  titleParts: ['RIFT', 'RUNNER.'] as const,
  version: '2.0.0',
  storagePrefix: 'rr',
} as const;
