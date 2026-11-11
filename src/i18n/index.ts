import { PRODUCT } from '../config';
import { ru } from './ru';

export type I18nKey = keyof typeof ru;
export type Dict = Partial<Record<I18nKey, string>>;
export type Lang = 'ru' | 'en';

const dicts: Record<Lang, Dict> = { ru, en: {} };
let current: Lang = 'ru';

export function registerDict(lang: Lang, dict: Dict): void {
  dicts[lang] = dict;
}
export function setLang(lang: Lang): void {
  current = lang;
}
export function getLang(): Lang {
  return current;
}

const BUILTIN: Record<string, string> = { name: PRODUCT.name, short: PRODUCT.short };

/** Перевод с подстановкой {param}. Отсутствующий ключ в языке падает на русский. */
export function t(key: I18nKey, params: Record<string, string | number> = {}): string {
  const raw = dicts[current][key] ?? ru[key];
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? BUILTIN[k] ?? `{${k}}`));
}

/** Применить переводы к DOM: data-i18n (textContent), data-i18n-title, data-i18n-aria. */
export function applyDom(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as I18nKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle as I18nKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as I18nKey));
  });
}
