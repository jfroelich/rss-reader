// Returns the number of unread slide elements present in the view
export function count_unread_slides() {
  // Find all slide elements within the slideshow container element that do not
  // have the read attribute
  const selector = '#slideshow-container > slide:not([read])';
  const slides = document.body.querySelectorAll(selector);
  return slides.length;
}
