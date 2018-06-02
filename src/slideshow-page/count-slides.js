// TODO: this module probably should not exist but it helps right now during
// refactoring

export function count_slides() {
  const container = document.getElementById('slideshow-container');
  return container.childElementCount;
}
