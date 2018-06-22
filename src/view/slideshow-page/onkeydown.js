import {show_next_slide, show_prev_slide} from '/src/view/slideshow-page/slide-nav.js';

export function onkeydown(event) {
  // Ignore edit intent
  const target_name = event.target.localName;
  if (target_name === 'input' || target_name === 'textarea') {
    console.debug('Ignoring key down while in editable', target_name);
    return;
  }

  const LEFT = 37, RIGHT = 39;
  const N = 78, P = 80;
  const SPACE = 32;
  const code = event.keyCode;

  if (code === RIGHT || code === N || code === SPACE) {
    event.preventDefault();
    show_next_slide();
  } else if (code === LEFT || code === P) {
    event.preventDefault();
    show_prev_slide();
  }
}
