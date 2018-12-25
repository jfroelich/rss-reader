let current_slide = null;
let active_transition_count = 0;

export function get_current_slide() {
  return current_slide;
}

export function set_current_slide(slide_element) {
  current_slide = slide_element;
}

export function is_current_slide(slide_element) {
  return slide_element === current_slide;
}

export function get_active_transition_count() {
  return active_transition_count;
}

export function set_active_transition_count(count) {
  active_transition_count = count;
}

export function increment_active_transition_count() {
  active_transition_count++;
}

// Do not allow transition to negative
export function decrement_active_transition_count() {
  if (active_transition_count > 0) {
    active_transition_count--;
  }
}
