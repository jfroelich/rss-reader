import {show_next_slide, show_prev_slide} from '/src/slideshow-page/slide-nav.js';

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
      show_prev_slide();
      break;
    }

    default: { break; }
  }
}

function is_edit_intent(event) {
  return event.target.localName === 'input' ||
      event.target.localName === 'textarea';
}
