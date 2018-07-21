import '/third-party/parse-srcset.js';

// Parses an attribute value into an array of descriptors. If the input is bad,
// or an error occurs, or no descriptors found, returns an empty array.
export function parse(value) {
  return (value && typeof value === 'string') ? parseSrcset(value) : [];
}

// Convert an array of descriptors into a string
export function serialize(descriptors) {
  const buf = [];
  for (const descriptor of descriptors) {
    const dbuf = [descriptor.url];
    if (descriptor.d) {
      dbuf.push(' ');
      dbuf.push(descriptor.d);
      dbuf.push('x');
    } else if (descriptor.w) {
      dbuf.push(' ');
      dbuf.push(descriptor.w);
      dbuf.push('w');
    } else if (descriptor.h) {
      dbuf.push(' ');
      dbuf.push(descriptor.h);
      dbuf.push('h');
    }

    const descriptor_string = dbuf.join('');
    buf.push(descriptor_string);
  }

  return buf.length ? buf.join(', ') : '';
}
