import '/third-party/tinycolor-min.js';
import * as color from '/src/lib/color.js';

/*

# css-color

Helpers for working with css color values

# TODOS
* Implement my own css color value parser, decouple from third-party
tinycolor.js
* Limit alpha to two significant digits
* Write tests
* Move todos to github issues


*/

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
