import {slide_onclick} from '/src/view/slideshow-page/slide-onclick.js';

export function remove_slide(slide) {
  slide.remove();
  slide.removeEventListener('click', slide_onclick);
}
