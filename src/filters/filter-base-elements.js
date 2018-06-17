export function filter_base_elements(document) {
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}
