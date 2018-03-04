import '/third-party/parse-srcset.js';

export function serialize(descriptors) {
  if (!Array.isArray(descriptors)) {
    throw new TypeError('descriptors is not an array');
  }

  const descriptor_strings = [];
  for (const descriptor of descriptors) {
    const strings = [descriptor.url];
    if (descriptor.d) {
      strings.push(' ');
      strings.push(descriptor.d);
      strings.push('x');
    } else if (descriptor.w) {
      strings.push(' ');
      strings.push(descriptor.w);
      strings.push('w');
    } else if (descriptor.h) {
      strings.push(' ');
      strings.push(descriptor.h);
      strings.push('h');
    }

    const descriptor_string = strings.join('');
    descriptor_strings.push(descriptor_string);
  }

  return descriptor_strings.join(', ');
}

export function parse(srcset) {
  const fallback_output = [];

  if (typeof srcset !== 'string') {
    return fallback_output;
  }

  if (!srcset) {
    return fallback_output;
  }

  // parseSrcset does not throw in the ordinary case, but avoid surprises
  let descriptors;
  try {
    descriptors = parseSrcset(srcset);
  } catch (error) {
    console.warn(error);
    return fallback_output;
  }

  if (!Array.isArray(descriptors)) {
    return fallback_output;
  }

  return descriptors;
}
