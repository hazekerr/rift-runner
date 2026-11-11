export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} не найден`);
  return el as T;
};

/** Создать элемент с классом и детьми без innerHTML. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const c of children) el.append(c);
  return el;
}

/** Писатель в DOM с dirty-check: не трогает DOM, если значение не изменилось. */
export class DirtyText {
  private last = '';
  constructor(private readonly el: HTMLElement) {}
  set(v: string): void {
    if (v !== this.last) {
      this.last = v;
      this.el.textContent = v;
    }
  }
}

export class DirtyStyle {
  private last = '';
  constructor(private readonly el: HTMLElement, private readonly prop: 'width' | 'background' | 'opacity' | 'transform') {}
  set(v: string): void {
    if (v !== this.last) {
      this.last = v;
      this.el.style[this.prop] = v;
    }
  }
}
