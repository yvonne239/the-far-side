import { THEMES, THEME_ORDER } from '../data/stories.js';

/**
 * "Two lines, two sides." The visitor writes what people see and what they
 * might not, then chooses whether to keep it private or offer it for sharing.
 * Both paths store the text locally — there is no server to send it to.
 */
export class Contribute {
  constructor({ onSave, onDelete }) {
    this.onSave = onSave;
    this.onDelete = onDelete;

    this.form = document.getElementById('contribute-form');
    this.bright = document.getElementById('input-bright');
    this.far = document.getElementById('input-far');
    this.error = document.getElementById('contribute-error');
    this.themeRoot = document.getElementById('contribute-themes');
    this.list = document.getElementById('my-lights');
    this.theme = 'uncertainty';
    this._intent = 'private';

    this._buildThemes();
    this._wireAutoGrow();

    // remember which button submitted the form
    this.form.querySelectorAll('button[type="submit"]').forEach((btn) => {
      btn.addEventListener('click', () => { this._intent = btn.dataset.intent; });
    });

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit();
    });
  }

  _buildThemes() {
    THEME_ORDER.forEach((key, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.theme = key;
      chip.style.setProperty('--c', THEMES[key].color);
      chip.setAttribute('aria-pressed', key === this.theme ? 'true' : 'false');
      const dot = document.createElement('span');
      dot.className = 'chip__dot';
      chip.append(dot, document.createTextNode(THEMES[key].label));
      chip.addEventListener('click', () => {
        this.theme = key;
        this.themeRoot.querySelectorAll('.chip').forEach((c) => {
          c.setAttribute('aria-pressed', c.dataset.theme === key ? 'true' : 'false');
        });
      });
      this.themeRoot.appendChild(chip);
      if (i === 0) chip.dataset.first = 'true';
    });
  }

  /**
   * No character limit and no counter: the fields simply grow with whatever
   * gets written. Height is reset to auto first so the box can shrink again
   * when text is deleted, not just expand.
   */
  _wireAutoGrow() {
    this._grown = [this.bright, this.far];
    this._grown.forEach((el) => {
      el.addEventListener('input', () => this._grow(el));
      this._grow(el);
    });
  }

  _grow(el) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  _resetFields() {
    this._grown.forEach((el) => {
      el.value = '';
      el.style.height = '';
      this._grow(el);
    });
  }

  _submit() {
    const bright = this.bright.value.trim();
    const far = this.far.value.trim();

    if (!bright || !far) {
      this.error.textContent = 'Both sides, please — even if the second one is only a few words.';
      (bright ? this.far : this.bright).focus();
      return;
    }
    this.error.textContent = '';
    this.onSave({ bright, far, theme: this.theme, intent: this._intent });
    this._resetFields();
  }

  /** Something went wrong saving — say so instead of pretending it worked. */
  fail(message) {
    this.error.textContent = message;
  }

  /** Re-render the visitor's own saved lights. */
  renderList(reflections) {
    this.list.textContent = '';
    if (!reflections.length) return;

    const title = document.createElement('p');
    title.className = 'my-lights__title';
    title.textContent = `Your lights on the dark side (${reflections.length})`;
    this.list.appendChild(title);

    reflections.slice().reverse().forEach((r) => {
      const row = document.createElement('div');
      row.className = 'my-light';

      const body = document.createElement('div');
      body.className = 'my-light__body';

      const bright = document.createElement('p');
      bright.className = 'my-light__bright';
      bright.textContent = `“${r.bright}”`;

      const far = document.createElement('p');
      far.className = 'my-light__far';
      far.textContent = r.far;

      const tag = document.createElement('p');
      tag.className = 'my-light__tag';
      tag.textContent = `${THEMES[r.theme]?.label || 'Story'} · ${
        r.intent === 'shared' ? 'offered for sharing' : 'private'
      } · this browser only`;

      body.append(bright, far, tag);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'my-light__del';
      del.textContent = 'Delete';
      del.setAttribute('aria-label', 'Delete this reflection');
      del.addEventListener('click', () => this.onDelete(r.id));

      row.append(body, del);
      this.list.appendChild(row);
    });
  }

  flash(message) {
    this.error.textContent = '';
    const note = document.createElement('p');
    note.className = 'my-lights__title';
    note.textContent = message;
    this.list.prepend(note);
    setTimeout(() => note.remove(), 4000);
  }

  focusFirst() {
    setTimeout(() => this.bright.focus(), 320);
  }
}
