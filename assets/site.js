(() => {
  'use strict';
  const root = document.documentElement;
  const key = 'lastresolution-theme';
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';
  const read = () => { try { return valid(localStorage.getItem(key)); } catch { return 'system'; } };
  let preference = read();
  function apply() {
    const mode = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = mode;
    const picker = document.querySelector('#theme-picker');
    if (picker) picker.value = preference;
    for (const source of document.querySelectorAll('[data-theme-picture] source')) source.media = mode === 'dark' ? 'all' : 'not all';
  }
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { preference = read(); apply(); } });
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('#theme-picker');
    if (picker) {
      picker.disabled = false;
      picker.addEventListener('change', () => {
        preference = valid(picker.value);
        try { localStorage.setItem(key, preference); } catch { /* A blocked preference store must not stop the control. */ }
        apply();
      });
    }
    apply();
  }, { once:true });
})();
