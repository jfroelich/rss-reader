import '/third-party/tinycolor-min.js';
import * as color from '/src/color/color.js';

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
  return color.color_pack(o.r, o.g, o.b, o.a * 255 | 0);
}

export function css_color_format(color_value) {
  return 'rgba(' + color.color_red(color_value) + ', ' +
      color.color_green(color_value) + ', ' + color.color_blue(color_value) +
      ', ' + color.color_alpha(color_value) / 255 + ')';
}
