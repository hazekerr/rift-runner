import { LANGS, t, type I18nKey } from '../i18n';
import type { Settings } from '../save/meta';
import { $, h } from './dom';

/** Экран настроек: ползунки громкости и тряски, переключатели, язык, качество. Изменения применяются сразу. */
export function renderSettings(st: Settings, onChange: (next: Settings) => void): void {
  const root = $('setlist');
  root.replaceChildren();
  const emit = (patch: Partial<Settings>): void => {
    const next = { ...st, ...patch };
    onChange(next);
    renderSettings(next, onChange);
  };
  const slider = (key: 'music' | 'sfx' | 'shake', label: I18nKey): HTMLElement => {
    const input = h('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '5';
    input.value = String(Math.round(st[key] * 100));
    input.setAttribute('aria-label', t(label));
    const val = h('span', 'val', `${input.value}%`);
    input.addEventListener('input', () => { val.textContent = `${input.value}%`; });
    input.addEventListener('change', () => emit({ [key]: Number(input.value) / 100 }));
    return h('div', 'set-row', h('label', '', t(label)), input, val);
  };
  const seg = <T extends string | boolean>(label: I18nKey, options: Array<[T, string]>, cur: T, set: (v: T) => void): HTMLElement => {
    const box = h('div', 'seg');
    for (const [v, text] of options) {
      const b = h('button', v === cur ? 'on' : '', text);
      b.setAttribute('aria-pressed', String(v === cur));
      b.addEventListener('click', () => set(v));
      box.append(b);
    }
    return h('div', 'set-row', h('label', '', t(label)), box);
  };
  const onOff = (label: I18nKey, key: 'flashes' | 'numbers'): HTMLElement =>
    seg(label, [[true, t('set.on')], [false, t('set.off')]], st[key], (v) => emit({ [key]: v }));
  root.append(
    slider('music', 'set.music'),
    slider('sfx', 'set.sfx'),
    slider('shake', 'set.shake'),
    onOff('set.flashes', 'flashes'),
    onOff('set.numbers', 'numbers'),
    seg('set.lang', LANGS.map((l) => [l, l.toUpperCase()] as [Settings['lang'], string]), st.lang, (v) => emit({ lang: v })),
    seg('set.quality', [['high', t('set.quality.high')], ['low', t('set.quality.low')]] as Array<[Settings['quality'], string]>, st.quality, (v) => emit({ quality: v })),
  );
}
