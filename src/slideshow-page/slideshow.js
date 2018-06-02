import {get_current_slide, set_current_slide} from '/src/slideshow-page/slideshow-state.js';

// TODO: break up into modules

export const SLIDE_ELEMENT_NAME = 'slide';


let active_transition_count = 0;

export function slide_get_first() {
  const container = document.getElementById('slideshow-container');
  return container.firstElementChild;
}

export function next() {
  if (active_transition_count > 0) {
    return false;
  }

  if (!get_current_slide()) {
    return false;
  }

  const next_slide = get_current_slide().nextElementSibling;
  if (!next_slide) {
    return false;
  }

  active_transition_count++;
  get_current_slide().style.left = '-100%';

  // NOTE: in process of creating this lib I noticed the source of the strange
  // behavior with why count is only 1 despite two transitions, it was here
  // because I forgot to increment again. But it is working like I want so I am
  // hesitant to change it at the moment.

  // active_transition_count++;

  next_slide.style.left = '0';
  set_current_slide(next_slide);

  return true;
}

export function prev() {
  if (active_transition_count > 0) {
    return;
  }

  if (!get_current_slide()) {
    return;
  }

  const previous_slide = get_current_slide().previousElementSibling;
  if (!previous_slide) {
    return;
  }

  active_transition_count++;
  get_current_slide().style.left = '100%';
  // active_transition_count++;
  previous_slide.style.left = '0';
  set_current_slide(previous_slide);
}



// Remove a slide from the dom
export function remove(slide) {
  slide.remove();
}

export function transition_onend(event) {
  // The slide that the transition occured upon (event.target) is not guaranteed
  // to be equal to the current slide. We fire off two transitions per
  // animation, one for the slide being moved out of view, and one for the slide
  // being moved into view. Both transitions result in call to this listener,
  // but we only want to call focus on one of the two elements. We want to be in
  // the state where after both transitions complete, the new slide (which is
  // the current slide at this point) is now focused. Therefore we ignore
  // event.target and directly affect the current slide only.
  get_current_slide().focus();

  // There may be more than one transition effect occurring at the moment. Point
  // out that this transition completed. This provides a method for checking if
  // any transitions are outstanding.
  active_transition_count--;
}
