import {show_next_slide, show_prev_slide} from '/src/slideshow-page/slide-nav.js';

export function onkeydown(event) {
  const code = event.keyCode;

  if (event.target.localName === 'input' ||
      event.target.localName === 'textarea') {
    console.debug(
        'Ignoring key down while in editable', event.target.localName);
    return;
  }

  if (is_edit_intent(event)) {
    return;
  }

  const LEFT = 37, RIGHT = 39;
  const N = 78, P = 80;
  const SPACE = 32;

  if (code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    show_next_slide();
    return;
  }

  if (code === LEFT || code === P) {
    event.preventDefault();
    show_prev_slide();
    return;
  }
}
