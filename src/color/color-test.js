import assert from '/src/assert.js';
import * as color from '/src/color/color.js';

export function color_test() {
  // Check the named colors are valid
  assert(color.is_valid(color.BLACK));
  assert(color.is_valid(color.WHITE));
  assert(color.is_valid(color.TRANSPARENT));

  // exercise basic packing
  let r = 0, b = 0, g = 0, a = 0;
  let value = color.pack(r, g, b, a);

  // pack should have produced a valid color
  assert(color.is_valid(value));

  // unpacking a component should produce a valid component and be lossless
  r = color.get_red(value);
  assert(r === 0);
  assert(color.is_valid_component(r));

  // non-zero values should also work
  r = 100, b = 50, g = 30, a = 10;
  value = color.pack(r, g, b, a);
  assert(color.is_valid(value));

  // unpacking of non-zero values should be lossless and produce valid
  // components
  assert(color.get_red(value) === r);
  assert(color.get_blue(value) === b);
  assert(color.get_green(value) === g);
  assert(color.is_valid_component(color.get_red(value)));
  assert(color.is_valid_component(color.get_blue(value)));
  assert(color.is_valid_component(color.get_green(value)));

  // TODO: test lerp
  // TODO: test blend
}
