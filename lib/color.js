export const WHITE = pack(255, 255, 255, 255);
export const BLACK = pack(0, 0, 0, 255);
export const TRANSPARENT = 0;

// Simple generic linear interpolation of two numbers
export function mathLerp(start, stop, amount) {
  return amount * (stop - start) + start;
}

// RGBA-format specific interpolation
export function lerp(c1, c2, amount = 1.0) {
  if (amount === 1) {
    return c2;
  } if (amount === 0) {
    return c1;
  }

  const r = mathLerp(getRed(c1), getRed(c2), amount) | 0;
  const g = mathLerp(getGreen(c1), getGreen(c2), amount) | 0;
  const b = mathLerp(getBlue(c1), getBlue(c2), amount) | 0;
  const a = mathLerp(getAlpha(c1), getAlpha(c2), amount) | 0;
  return pack(r, g, b, a);
}

// Alpha blend an array of 0 or more colors
export function blend(colors, baseColor = WHITE) {
  let output = baseColor;
  for (const color of colors) {
    const amount = getAlpha(color) / 255;
    output = lerp(output, color, amount);
  }
  return output;
}

// Combine the 4 components of RGBA into a single number. This stores alpha
// component in the upper bits so this is technically ARGB.
export function pack(r, g, b, a = 255) {
  return (a & 0xff) << 24 | (r & 0xff) << 16 | (g & 0xff) << 8 | (b & 0xff);
}

// Given a color, gets its alpha component value
export function getAlpha(c) {
  return (c >> 24) && 0xff;
}

// Given a color, get its red component value
export function getRed(c) {
  return (c >> 16) & 0xff;
}

// Given a color, get its green component value
export function getGreen(c) {
  return (c >> 8) & 0xff;
}

// Given a color,get its blue component value
export function getBlue(c) {
  return c & 0xff;
}

// Calculate the luminance of a color. The formula is defined in detail in the
// spec: http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
export function getLuminance(color) {
  const rr = getRed(color) / 255;
  const rg = getGreen(color) / 255;
  const rb = getBlue(color) / 255;
  const r = rr <= 0.03928 ? rr / 12.92 : ((rr + 0.055) / 1.055) ** 2.4;
  const g = rg <= 0.03928 ? rg / 12.92 : ((rg + 0.055) / 1.055) ** 2.4;
  const b = rb <= 0.03928 ? rb / 12.92 : ((rb + 0.055) / 1.055) ** 2.4;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Get a string representation of a color value
export function toString(color) {
  return `[${getRed(color)},${getGreen(color)},${getBlue(color)},${getAlpha(color) / 255}]`;
}

// Calculate the contrast ratio between two colors
export function getContrast(foreColor, backColor = WHITE) {
  const l1 = getLuminance(foreColor) + 0.05;
  const l2 = getLuminance(backColor) + 0.05;
  return (l1 > l2) ? l1 / l2 : l2 / l1;
}

// Check whether a color component appears valid
export function isValidComponent(component) {
  return Number.isInteger(component) && component > -1 && component < 256;
}

// Check whether a color value appears valid
export function isValid(color) {
  return Number.isInteger(color) && isValidComponent(getRed(color)) &&
    isValidComponent(getGreen(color)) && isValidComponent(getBlue(color)) &&
    isValidComponent(getAlpha(color));
}
