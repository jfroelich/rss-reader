import '/src/dom/css-color/third-party/tinycolor-min.js';
import * as color from '/src/argb8888.js';

// Parses a css color value into a color.js color
export function parse(value) {
  if (typeof value === 'string' && value.length) {
    const tc = new tinycolor(value);
    if (tc.isValid()) {
      return tinycolor_to_color(tc);
    }
  }
}

// Convert a third party tinycolor value into a color.js color value
function tinycolor_to_color(tiny_color) {
  const o = tiny_color.toRgb();
  return color.pack(o.r, o.g, o.b, o.a * 255 | 0);
}

// Serializes a color.js color into a css color value
export function format(value) {
  return 'rgba(' + color.get_red(value) + ', ' + color.get_green(value) + ', ' +
      color.get_blue(value) + ', ' + color.get_alpha(value) / 255 + ')';
}
