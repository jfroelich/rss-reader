// Given an array of srcset descriptor objects, return a string representing the
// serialized form
export function serialize_srcset(descriptors) {
  // Calling this an anything other than array represents a programming error.
  if (!Array.isArray(descriptors)) {
    throw new TypeError('descriptors is not an array');
  }

  const buf = [];
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
    buf.push(descriptor_string);
  }

  return buf.join(', ');
}
