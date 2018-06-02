let current_slide;

export function get_current_slide() {
  return current_slide;
}

export function set_current_slide(slide_element) {
  current_slide = slide_element;
}

export function is_current_slide(slide_element) {
  return slide_element === current_slide;
}
