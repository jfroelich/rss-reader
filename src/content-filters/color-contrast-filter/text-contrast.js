import '/third-party/tinycolor-min.js';
import {rgba, rgba_composite, RGBA_WHITE_OPAQUE} from '/src/content-filters/color-contrast-filter/blender.js';

// TODO: use color-parse.js instead of directly interacting with tinycolor
// TODO: use color.js color type instead of tinycolor or blend rgba types


// TODO: the api should be based off any node, not just text nodes. It should
// accept element nodes or text nodes.

// Elements with contrast ratios below this threshold are inperceptible. I use a
// value that is lower than the recommendation of 4.5, but distinguishes
// red/green better. It screws up dark gray on black. The difference in contrast
// ratios is basically because I am making unreliable approximations and because
// the immediate audience is a content-filter, not a person.
const default_min_contrast_ratio = 1.2;
const default_text_tinycolor = tinycolor('#000');
const default_background_tinycolor = tinycolor('#fff');
const transparent_tinycolor = tinycolor('rgba(0,0,0,0)');

// Analyzes a text node for color perceptibility. If the node, based on its
// containing element, has an explicit text color and background color, and the
// contrast ratio between those two colors is too low, then the node is deemed
// not perceptible. Return true if perceptible, false if not perceptible,
// undefined on error or ambiguity. Throws if not called on a text node.
export function text_node_is_color_perceptible(node, min_contrast_ratio) {
  // Allow for simulated nodes by using weaker type check
  if (!(nodeType in node)) {
    throw new TypeError('node is not a Node');
  }

  if (node.nodeType !== Node.TEXT_NODE) {
    throw new TypeError('node is not a text node');
  }

  if (isNaN(min_contrast_ratio) || !isFinite(min_contrast_ratio) ||
      min_contrast_ratio < 0) {
    min_contrast_ratio = default_min_contrast_ratio;
  }

  const element = node.parentNode;
  if (element) {
    const text_color = element_derive_text_color(element);
    const background_color = element_derive_background_color(element);
    const contrast_ratio = tinycolor.readability(text_color, background_color);
    return contrast_ratio > min_contrast_ratio;
  }
}

// Get the foreground color of an element. Returns a tinycolor object. If there
// is an error parsing the css-value, or if the value is missing, then a default
// color is returned.
export function element_derive_text_color(element) {
  const style = getComputedStyle(element);
  if (style) {
    const color = tinycolor(style.color);
    if (color.isValid()) {
      return color;
    }
  }

  return default_text_tinycolor;
}

// Return a tinycolor object based on the css-value of the background-color of
// the element itself, ignoring all contextual information. An element without a
// color is assumed transparent. An element with an incorrect css-value is
// assigned transparent. This function does not expose how it made its decision
// so it is ambiguous when the css-value is explicitly transparent.
export function element_derive_background_color_inline(element) {
  // TODO: it is possible I should still use getComputedStyle due to the
  // use of css values such as inherit? Or maybe it doesn't matter since I plan
  // to blend. Or maybe it does because I should not assume that is the only way
  // this function is used

  const style = element.style;
  if (style) {
    const bgc = style.backgroundColor;
    if (bgc) {
      const bgtc = tinycolor(bgc);
      if (bgtc.isValid()) {
        return bgtc;
      }
    }
  }
  return transparent_tinycolor;
}

// Returns a tinycolor that is an approximate guess as to the background color
// of the element, using alpha compositing.
export function element_derive_background_color(element) {
  // NOTE: this is basically a map-reduce style function

  // Get all elements up to root, from deepest to shallowest. Note that this is
  // the inverse order of painting, and that this includes the element itself.
  let layers = [];
  let node = element;
  while (node) {
    layers.push(node);
    node = node.parentNode;
  }

  // Convert the layers into colors.
  const tinycolors = layers.map(element_derive_background_color_inline);

  // Convert tinycolors into objects similar to blender.js rgba objects. The rgb
  // object produced by toRgb has the same properties as object produced by the
  // rgba constructor function. rgba_composite does not have a strict
  // type check, so this can just pass along tinycolor's own exported color
  // format object instead of converting it first, which avoids allocations
  const rgbas = tinycolors.map(tc => tc.toRgb());

  // Reorder the array so that shallowest color (the bottom layer) is the first
  // element of the array. Array.prototype.reverse modifies the array itself
  // and also returns a reference to the array which we ignore.
  rgbas.reverse();

  // Alpha-blend using white as the backdrop
  const blend = rgba_composite(rgbas, RGBA_WHITE_OPAQUE);

  // Return the blended color as a tinycolor
  return tinycolor(blend);
}

// Returns an approximate background color of an element as a tinycolor object.
// This is an approximation because full compositing is cost-prohibitive.
// This makes a guess based on the first opaque ancestor.
export function element_derive_background_color_simple(element) {
  // Walk upwards, starting from the input element, and find the first element
  // that has a valid, non-transparent background.
  let node = element;
  while (node) {
    const style = node.style;
    if (style) {
      const color = style.backgroundColor;
      if (color) {
        const tc = tinycolor(color);
        if (tc.isValid() && tc.getAlpha() !== 0) {
          return tc;
        }
      }
    }

    node = node.parentNode;
  }

  return default_background_tinycolor;
}
