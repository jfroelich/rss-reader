import '/third-party/tinycolor-min.js';
import {color_alpha, color_blue, color_green, color_pack, color_red} from '/src/color/color.js';

export function css_color_parse(css_value_string) {
  if (typeof css_value_string === 'string' && css_value_string.length) {
    const tc = new tinycolor(css_value_string);
    if (tc.isValid()) {
      return tinycolor_to_color(tc);
    }
  }
}

function tinycolor_to_color(tiny_color) {
  const o = tiny_color.toRgb();
  return color_pack(o.r, o.g, o.b, Math.round(o.a * 255));
}

export function css_color_format(color) {
  return 'rgba(' + color_red(color) + ', ' + color_green(color) + ', ' +
      color_blue(color) + ', ' + color_alpha(color) / 255 + ')';
}
