/* ToggleInput Web Component
 * - Mirrors native checkbox behavior using a hidden <input type="checkbox"> inside shadow DOM
 * - Supports: checked, disabled, name, value, required, indeterminate, autofocus, tabindex
 * - Emits native-like 'input' and 'change' only on user interactions
 * - Participates in forms via ElementInternals or a hidden fallback input
 *
 * - Developed by AMLAN DAS KARMAKAR
 * - https://itsamlan.com
 * - https://github.com/PhoenixBWS
 */

class ToggleInput extends HTMLElement {
  static formAssociated = true;

  static get observedAttributes() {
    return ['checked', 'disabled', 'name', 'value', 'aria-label', 'required', 'indeterminate', 'autofocus', 'tabindex'];
  }

  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host { display: inline-block; --w:44px; --h:26px; --track-off: rgb(0 0 0 / 0.2); --track-on: #4caf50; --track-indeterminate: #9e9e9e; --knob-bg: #fff; --knob-shadow: 0 1px 2px rgba(0,0,0,0.2); --focus-ring: rgba(76,175,80,0.14); --disabled-opacity: .6; }

      /* Toggle track */
      button {
        all: unset;
        box-sizing: border-box;
        display: inline-block;
        position: relative;
        width: var(--w);
        height: var(--h);
        background: var(--track-off);
        border-radius: 999px;
        cursor: pointer;
        transition: background .15s ease, opacity .12s ease;
      }

      /* knob */
      .knob {
        position: absolute;
        left: 3px;
        top: 3px;
        width: calc(var(--h) - 6px);
        height: calc(var(--h) - 6px);
        background: var(--knob-bg);
        border-radius: 50%;
        box-shadow: var(--knob-shadow);
        transition: transform .15s ease, background .15s ease;
        will-change: transform;
      }

      /* 'on' state */
      :host([checked]) button {
        background: var(--track-on);
      }
      :host([checked]) .knob {
        transform: translateX(calc(var(--w) - var(--h)));
      }

      /* indeterminate visual (centered knob and dimmed track) */
      :host([indeterminate]) button {
        background: var(--track-indeterminate);
      }
      :host([indeterminate]) .knob {
        transform: translateX(calc((var(--w) - var(--h)) / 2));
      }

      /* disabled */
      :host([disabled]) { opacity: var(--disabled-opacity); pointer-events: none; }

      /* focus ring when host is focused */
      :host(:focus) button { box-shadow: 0 0 0 4px var(--focus-ring); }

      /* hide legacy icon element if present */
      i { display: none; }

      input[type="checkbox"] { position:absolute; opacity:0; width:0; height:0; pointer-events:none }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        :host { --track-off: rgb(255 255 255 / 0.2); --track-on: #66bb6a; --track-indeterminate: #5f5f5f; --knob-bg: #f3f3f3; --knob-shadow: 0 1px 3px rgba(0,0,0,0.6); --focus-ring: rgba(102,187,106,0.18); }
      }
    `;

    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.setAttribute('part', 'control');

    // visual elements: optional hidden icon (kept for compatibility) and the knob
    this._icon = document.createElement('i');
    this._icon.textContent = 'check_box_outline_blank';

    this._knob = document.createElement('span');
    this._knob.className = 'knob';

    // Hidden native input to capture exact checkbox semantics/events
    this._native = document.createElement('input');
    this._native.type = 'checkbox';
    this._native.tabIndex = -1;

    this._button.appendChild(this._icon);
    this._button.appendChild(this._knob);
    this._shadow.append(style, this._native, this._button);

    this._internals = this.attachInternals ? this.attachInternals() : null;
    this._hiddenInput = null;
    this._customValidity = '';

    this._defaultChecked = false;
    this._defaultIndeterminate = false;

    this._onClick = this._onClick.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onNativeInput = this._onNativeInput.bind(this);
    this._onNativeChange = this._onNativeChange.bind(this);
    this._onFormReset = this._onFormReset.bind(this);

    this._native.addEventListener('input', this._onNativeInput);
    this._native.addEventListener('change', this._onNativeChange);
  }

  connectedCallback() {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'checkbox');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');

    this._defaultChecked = this.hasAttribute('checked');
    this._defaultIndeterminate = this.hasAttribute('indeterminate');

    this._upgradeProperty('checked');
    this._upgradeProperty('disabled');
    this._upgradeProperty('name');
    this._upgradeProperty('value');
    this._upgradeProperty('indeterminate');

    this._render();
    this._button.addEventListener('click', this._onClick);
    this.addEventListener('keydown', this._onKeyDown);

    this._updateFormValue();
    this._updateValidity();
    this._ensureHiddenInput();

    const form = this.closest('form');
    if (form) form.addEventListener('reset', this._onFormReset);

    if (this.hasAttribute('autofocus')) {
      try { this.focus(); } catch (e) {}
    }
  }

  disconnectedCallback() {
    this._button.removeEventListener('click', this._onClick);
    this.removeEventListener('keydown', this._onKeyDown);
    const form = this.closest('form');
    if (form) form.removeEventListener('reset', this._onFormReset);
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;

    if (name === 'checked') this._native.checked = this.hasAttribute('checked');
    if (name === 'disabled') this._native.disabled = this.hasAttribute('disabled');
    if (name === 'name') this._native.name = this.getAttribute('name') || '';
    if (name === 'value') this._native.value = this.getAttribute('value') ?? 'on';
    if (name === 'indeterminate') this._native.indeterminate = this.hasAttribute('indeterminate');

    this._render();

    if (name === 'name' || name === 'value' || name === 'checked' || name === 'indeterminate') {
      this._updateHiddenInput();
      this._updateFormValue();
    }
    if (name === 'required' || name === 'checked' || name === 'aria-label') {
      this._updateValidity();
    }
    if (name === 'autofocus' && this.hasAttribute('autofocus')) {
      try { this.focus(); } catch (e) {}
    }
  }

  get checked() { return this._native.checked; }
  set checked(val) { if (val) this.setAttribute('checked', ''); else this.removeAttribute('checked'); }

  get disabled() { return this._native.disabled; }
  set disabled(val) { if (val) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }

  get name() { return this.getAttribute('name'); }
  set name(v) { if (v == null) this.removeAttribute('name'); else this.setAttribute('name', v); }

  get value() { return this.getAttribute('value') ?? 'on'; }
  set value(v) { if (v == null) this.removeAttribute('value'); else this.setAttribute('value', v); }

  get required() { return this.hasAttribute('required'); }
  set required(val) { if (val) this.setAttribute('required', ''); else this.removeAttribute('required'); }

  get indeterminate() { return this._native.indeterminate; }
  set indeterminate(val) { if (val) this.setAttribute('indeterminate', ''); else this.removeAttribute('indeterminate'); }

  _upgradeProperty(prop) {
    if (this.hasOwnProperty(prop)) {
      let value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  _onClick(e) {
    if (this.disabled) return;
    // Let the native input handle toggle semantics – trigger its click
    this._native.click();
    // Dispatch a host click for listeners attached to the element
    this.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));
  }

  _onKeyDown(e) {
    if (this.disabled) return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'Enter') {
      e.preventDefault();
      this._native.click();
    }
  }

  _onNativeInput() {
    if (this._native.indeterminate) this.removeAttribute('indeterminate');
    if (this._native.checked) this.setAttribute('checked', ''); else this.removeAttribute('checked');

    this._updateHiddenInput();
    this._updateFormValue();
    this._updateValidity();
    this._render();

    this.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  }

  _onNativeChange() {
    if (this._native.indeterminate) this.removeAttribute('indeterminate');
    if (this._native.checked) this.setAttribute('checked', ''); else this.removeAttribute('checked');

    this._updateHiddenInput();
    this._updateFormValue();
    this._updateValidity();
    this._render();

    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  _onFormReset() {
    if (this._defaultChecked) this.setAttribute('checked', ''); else this.removeAttribute('checked');
    if (this._defaultIndeterminate) this.setAttribute('indeterminate', ''); else this.removeAttribute('indeterminate');
    this._updateHiddenInput();
    this._updateFormValue();
    this._updateValidity();
    this._render();
  }

  toggle() {
    this._native.checked = !this._native.checked;
    if (this._native.indeterminate) this._native.indeterminate = false;
    if (this._native.checked) this.setAttribute('checked', ''); else this.removeAttribute('checked');
    this._updateHiddenInput();
    this._updateFormValue();
    this._updateValidity();
    this._render();
  }

  _render() {
    const checked = this._native.checked;
    const disabled = this._native.disabled;
    const required = this.required;
    const indeterminate = this._native.indeterminate;

    this.setAttribute('aria-checked', indeterminate ? 'mixed' : (checked ? 'true' : 'false'));
    if (disabled) this.setAttribute('aria-disabled', 'true'); else this.removeAttribute('aria-disabled');
    if (required) this.setAttribute('aria-required', 'true'); else this.removeAttribute('aria-required');

    if (indeterminate) {
      this._button.classList.add('indeterminate');
      this._button.classList.remove('on');
    } else if (checked) {
      this._button.classList.add('on');
      this._button.classList.remove('indeterminate');
    } else {
      this._button.classList.remove('on');
      this._button.classList.remove('indeterminate');
    }

    if (disabled) this._button.classList.add('disabled'); else this._button.classList.remove('disabled');
  }

  _ensureHiddenInput() {
    if (!this.isConnected) return;
    const form = this.closest('form');
    if (!form && this._hiddenInput) {
      if (this._hiddenInput.parentNode) this._hiddenInput.parentNode.removeChild(this._hiddenInput);
      this._hiddenInput = null;
      return;
    }

    if (!this._internals && form && !this._hiddenInput && this.name) {
      this._hiddenInput = document.createElement('input');
      this._hiddenInput.type = 'hidden';
      this._hiddenInput.name = this.name;
      form.appendChild(this._hiddenInput);
      this._updateHiddenInput();
    }
  }

  _updateHiddenInput() {
    if (!this._hiddenInput) {
      this._ensureHiddenInput();
      if (!this._hiddenInput) return;
    }

    if (this._native.checked) {
      this._hiddenInput.name = this.name || '';
      this._hiddenInput.value = this.value;
    } else {
      this._hiddenInput.removeAttribute('name');
      this._hiddenInput.removeAttribute('value');
    }
  }

  _updateFormValue() {
    if (this._internals) {
      if (this._native.checked) this._internals.setFormValue(this.value);
      else this._internals.setFormValue(null);
    } else {
      this._updateHiddenInput();
    }
  }

  _updateValidity() {
    const isValueMissing = this.required && !this._native.checked;
    if (this._internals) {
      const validity = {};
      if (isValueMissing) validity.valueMissing = true;
      if (this._customValidity) validity.customError = true;
      if (Object.keys(validity).length > 0) {
        this._internals.setValidity(validity, this._customValidity || 'This checkbox cannot be left unchecked.', this._button);
      } else {
        this._internals.setValidity({});
      }
    } else {
      if (isValueMissing || this._customValidity) this.setAttribute('aria-invalid', 'true'); else this.removeAttribute('aria-invalid');
    }
  }

  checkValidity() {
    this._updateValidity();
    if (this._internals) return this._internals.validity.valid;
    return !(this.required && !this._native.checked) && !this._customValidity;
  }

  reportValidity() {
    this._updateValidity();
    if (this._internals && typeof this._internals.reportValidity === 'function') return this._internals.reportValidity();
    if (this.checkValidity()) return true;
    const msg = this._customValidity || 'Please fill out this field.';
    try { this.focus(); } catch (e) {}
    alert(msg);
    return false;
  }

  setCustomValidity(message) {
    this._customValidity = message || '';
    if (this._internals) {
      if (this._customValidity) this._internals.setValidity({ customError: true }, this._customValidity, this._button);
      else this._updateValidity();
    } else this._updateValidity();
  }

  focus() { try { this._button.focus(); } catch (e) {} }
  blur() { try { this._button.blur(); } catch (e) {} }
}

customElements.define('toggle-input', ToggleInput);

export default ToggleInput;
