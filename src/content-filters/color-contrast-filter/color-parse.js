import '/third-party/tinycolor-min.js';
import {color_pack_4} from '/src/content-filters/color-contrast-filter/color.js';

// Parses a CSS3 color value into a color.js type. Returns undefined on error
export function color_parse(css_value_string) {
  if (typeof css_value_string !== 'string') {
    return;
  }

  const tc_color = new tinycolor(css_value_string);
  if (!tc_color.isValid()) {
    return;
  }

  const rgba = tc_color.toRgb();
  return color_pack_4(
      rgba.r, rgba.g, rgba.b, rescale_tinycolor_alpha_to_color_alpha(rgba.a));
}


// The alpha value of the rgba value is on a scale of 0-1, so we multiple
// it by 255 to put it on color.js scale of 0-255.

function rescale_tinycolor_alpha_to_color_alpha(alpha) {
  return alpha * 255;
}
