import {slide_onclick} from '/src/slideshow-page/slide-onclick.js';

// Remove a slide from the dom
export function remove_slide(slide) {
  slide.remove();

  slide.removeEventListener('click', slide_onclick);
}
