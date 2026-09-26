/**
 * "What makes it possible?" — the front says one soft, singular thing; the
 * back branches into everything holding it up.
 *
 * Nodes are real HTML buttons positioned over an SVG line layer, so the map
 * is tabbable and readable by a screen reader rather than being a picture of
 * a diagram. Selecting a node writes its explanation underneath.
 */
export class NodeMap {
  constructor({ data, sound } = {}) {
    this.data = data;
    this.sound = sound;
    this.opened = new Set();
  }

  mount(host) {
    this.host = host;
    host.classList.add('widget', 'widget--nodemap');

    const stage = document.createElement('div');
    stage.className = 'nodemap';

    const svgNS = 'http://www.w3.org/2000/svg';
    const lines = document.createElementNS(svgNS, 'svg');
    lines.setAttribute('class', 'nodemap__lines');
    lines.setAttribute('viewBox', '0 0 100 100');
    lines.setAttribute('preserveAspectRatio', 'none');
    lines.setAttribute('aria-hidden', 'true');
    stage.appendChild(lines);

    const ROOT = { x: 0.5, y: 0.06 };
    this.data.nodes.forEach((n) => {
      const path = document.createElementNS(svgNS, 'path');
      const midY = (ROOT.y + n.y) / 2;
      path.setAttribute('d',
        `M ${ROOT.x * 100} ${ROOT.y * 100} C ${ROOT.x * 100} ${midY * 100}, ${n.x * 100} ${midY * 100}, ${n.x * 100} ${n.y * 100}`);
      path.setAttribute('class', 'nodemap__line');
      path.dataset.node = n.id;
      lines.appendChild(path);
    });
    this.lines = lines;

    const root = this._node({
      id: '__root',
      icon: this.data.rootIcon,
      label: this.data.rootLabel,
      x: ROOT.x,
      y: ROOT.y,
      text: this.data.rootText,
    }, true);
    stage.appendChild(root);

    this.data.nodes.forEach((n) => stage.appendChild(this._node(n, false)));
    host.appendChild(stage);

    const hint = document.createElement('p');
    hint.className = 'nodemap__hint';
    hint.textContent = `Open each one — ${this.data.nodes.length + 1} in all.`;
    this.hint = hint;
    host.appendChild(hint);

    this.detail = document.createElement('div');
    this.detail.className = 'nodemap__detail';
    this.detail.setAttribute('aria-live', 'polite');
    host.appendChild(this.detail);

    this.select('__root');
  }

  _node(n, isRoot) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nodemap__node${isRoot ? ' nodemap__node--root' : ''}`;
    btn.style.left = `${n.x * 100}%`;
    btn.style.top = `${n.y * 100}%`;
    btn.dataset.node = n.id;
    btn.setAttribute('aria-pressed', 'false');

    const icon = document.createElement('span');
    icon.className = 'nodemap__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = n.icon;

    const label = document.createElement('span');
    label.className = 'nodemap__label';
    label.textContent = n.label;

    btn.append(icon, label);
    btn.addEventListener('click', () => this.select(n.id));
    this._byId = this._byId || new Map();
    this._byId.set(n.id, n);
    return btn;
  }

  select(id) {
    const n = this._byId.get(id);
    if (!n) return;
    this.opened.add(id);

    this.host.querySelectorAll('.nodemap__node').forEach((b) => {
      const on = b.dataset.node === id;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-open', this.opened.has(b.dataset.node));
    });
    this.lines.querySelectorAll('.nodemap__line').forEach((p) => {
      p.classList.toggle('is-lit', p.dataset.node === id || this.opened.has(p.dataset.node));
      p.classList.toggle('is-active', p.dataset.node === id);
    });

    this.detail.textContent = '';
    const title = document.createElement('p');
    title.className = 'nodemap__detail-title';
    title.textContent = `${n.icon} ${n.label}`;
    const body = document.createElement('p');
    body.className = 'nodemap__detail-text';
    body.textContent = n.text;
    this.detail.append(title, body);

    const total = this.data.nodes.length + 1;
    this.hint.textContent = this.opened.size >= total
      ? 'That is all of them — and it is still a simplification.'
      : `Opened ${this.opened.size} of ${total}.`;

    if (this.sound) this.sound.tick();
  }

  destroy() {
    if (this.host) {
      this.host.classList.remove('widget', 'widget--nodemap');
      this.host.textContent = '';
    }
  }
}
