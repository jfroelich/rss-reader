import '/src/css-color/third-party/tinycolor-min.js';
import * as color from '/src/color.js';

// Parses a css color value into a color.js color
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
  return color.pack(o.r, o.g, o.b, o.a * 255 | 0);
}

export function format(value) {
  return 'rgba(' + color.get_red(value) + ', ' + color.get_green(value) + ', ' +
      color.get_blue(value) + ', ' + color.get_alpha(value) / 255 + ')';
}
