import {show_next_slide} from '/src/slideshow-page/show-next-slide.js';
import {prev} from '/src/slideshow-page/slideshow.js';

// TODO: navigation occassionally pauses. This shouldn't happen. Should
// immediately navigate to something like an empty div, show a 'loading'
// message, then load, then hide the loading message.

// TODO: is the debouncing stuff with idle callback approach needed??


const LEFT = 37;
const RIGHT = 39;
const N = 78;
const P = 80;
const SPACE = 32;
const DOWN = 40;
const UP = 38;

let timer_id = null;

function onkeydown(event) {
  const code = event.keyCode;

  if (is_edit_intent(event)) {
    console.debug('Ignoring key down while in input', event.target.localName);
    return;
  }

  switch (code) {
    case RIGHT:
    case N:
    case SPACE: {
      event.preventDefault();
      cancelIdleCallback(timer_id);
      timer_id = requestIdleCallback(show_next_slide);
      break;
    }

    case LEFT:
    case P: {
      event.preventDefault();
      cancelIdleCallback(timer_id);
      timer_id = requestIdleCallback(prev);
      break;
    }

    case DOWN: {
      // TODO: I want to animate a scrollTop change I think?
      // with ease in?

      // For reference check out this:
      // https://github.com/ariya/kinetic/blob/master/2/scroll.js

      // See also -webkit-overflow-scrolling: touch;

      break;
    }

    case UP: {
      // I want to animate a scrollTop change I think?
      break;
    }

    default: { break; }
  }
}

// Return whether the event target should not be intercepted because the intent
// of the key press is to move the text cursor around some editable text
// TODO: test, this has never been tested and just a guess
function is_edit_intent(event) {
  const target = event.target;
  return target.localName === 'input' || target.localName === 'textarea';
}

// TODO: do I need window? is addEventListener without qualification available
// in module scope?

window.addEventListener('keydown', onkeydown);
