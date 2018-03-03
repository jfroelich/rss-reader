import '/third-party/tinycolor-min.js';
import * as color from '/src/color/color.js';

export function parse(value) {
  if (typeof value === 'string' && value.length) {
    const tc = new tinycolor(value);
    if (tc.isValid()) {
      return tinycolor_to_color(tc);
    }
  }
}

function tinycolor_to_color(tiny_color) {
  const o = tiny_color.toRgb();
  return color.color_pack(o.r, o.g, o.b, o.a * 255 | 0);
}

export function format(value) {
  return 'rgba(' + color.color_red(value) + ', ' + color.color_green(value) +
      ', ' + color.color_blue(value) + ', ' + color.color_alpha(value) / 255 +
      ')';
}
