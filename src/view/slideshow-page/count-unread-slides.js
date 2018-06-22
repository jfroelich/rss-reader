// Returns the number of unread slide elements present in the view
export function count_unread_slides() {
  const selector = 'slide:not([read]):not([read-pending])';
  const slides = document.body.querySelectorAll(selector);
  return slides.length;
}
