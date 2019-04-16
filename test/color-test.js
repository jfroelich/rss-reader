import * as color from '/lib/color.js';
import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';

function colorTest() {
  // Check the named colors are valid
  assert(color.isValid(color.BLACK));
  assert(color.isValid(color.WHITE));
  assert(color.isValid(color.TRANSPARENT));

  // exercise basic packing
  let r = 0; let b = 0; let g = 0; let
    a = 0;
  let value = color.pack(r, g, b, a);

  // pack should have produced a valid color
  assert(color.isValid(value));

  // unpacking a component should produce a valid component and be lossless
  r = color.getRed(value);
  assert(r === 0);
  assert(color.isValidComponent(r));

  // non-zero values should also work
  r = 100;
  b = 50;
  g = 30;
  a = 10;
  value = color.pack(r, g, b, a);
  assert(color.isValid(value));

  // unpacking of non-zero values should be lossless and produce valid
  // components
  assert(color.getRed(value) === r);
  assert(color.getBlue(value) === b);
  assert(color.getGreen(value) === g);
  assert(color.isValidComponent(color.getRed(value)));
  assert(color.isValidComponent(color.getBlue(value)));
  assert(color.isValidComponent(color.getGreen(value)));

  // TODO: test lerp
  // TODO: test blend
}

TestRegistry.registerTest(colorTest);
