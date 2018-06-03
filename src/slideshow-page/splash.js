// Simple control for splash-panel in UI

const element = document.getElementById('initial-loading-panel');

export function show_splash() {
  element.style.display = 'block';
}

export function hide_splash() {
  element.style.display = 'none';
}
