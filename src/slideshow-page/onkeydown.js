import {show_next_slide} from '/src/slideshow-page/show-next-slide.js';
import * as slideshow_state from '/src/slideshow-page/slideshow-state.js';

export function onkeydown(event) {
  const code = event.keyCode;

  if (is_edit_intent(event)) {
    console.debug('Ignoring key down while in input', event.target.localName);
    return;
  }

  const LEFT = 37;
  const RIGHT = 39;
  const N = 78;
  const P = 80;
  const SPACE = 32;

  switch (code) {
    case RIGHT:
    case N:
    case SPACE: {
      event.preventDefault();
      show_next_slide();
      break;
    }

    case LEFT:
    case P: {
      event.preventDefault();
      prev();
      break;
    }

    default: { break; }
  }
}

function is_edit_intent(event) {
  return event.target.localName === 'input' ||
      event.target.localName === 'textarea';
}

function prev() {
  if (slideshow_state.get_active_transition_count() > 0) {
    console.debug('Canceling previous navigation, too many transitions');
    return;
  }

  if (!slideshow_state.get_current_slide()) {
    return;
  }

  const previous_slide =
      slideshow_state.get_current_slide().previousElementSibling;
  if (!previous_slide) {
    return;
  }

  slideshow_state.increment_active_transition_count();
  slideshow_state.get_current_slide().style.left = '100%';

  // TEMP: testing proper transition count
  slideshow_state.increment_active_transition_count();

  previous_slide.style.left = '0';
  slideshow_state.set_current_slide(previous_slide);
}
