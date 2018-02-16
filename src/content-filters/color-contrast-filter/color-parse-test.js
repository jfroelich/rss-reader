import {color_parse} from '/src/content-filters/color-contrast-filter/color-parse.js';
import * as libcolor from '/src/content-filters/color-contrast-filter/color.js';

// Give an element id {String}, return the background color
window.color_parse_test = function(id) {
  if (!id) {
    return;
  }

  const element = document.getElementById(id);
  if (!element) {
    return;
  }

  const style = element.style;
  if (!style) {
    return;
  }

  const css_color = style.backgroundColor;
  const color = color_parse(style.backgroundColor);

  const r = libcolor.color_get_red(color);
  const g = libcolor.color_get_green(color);
  const b = libcolor.color_get_blue(color);
  // Divide by 255 to get alpha on scale of 0 to 1
  const a = libcolor.color_get_alpha(color) / 255;

  console.debug('rgba(%d, %d, %d, %d)', r, g, b, a);

  return color;
};

window.libcolor = libcolor;
