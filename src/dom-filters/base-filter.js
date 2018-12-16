// Removes all base elements from the document
export function base_filter(document) {
  const bases = document.querySelectorAll('base');
  for (const base of bases) {
    base.remove();
  }
}
