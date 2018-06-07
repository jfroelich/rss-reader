import {load_url} from '/src/lib/net/load-url.js';

const image_mime_types = [
  'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
  'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
  'image/vnd.microsoft.icon'
];

export function fetch_image(url, options) {
  // Pretend that options is immutable, so clone as to remain pure
  const options_clone = Object.assign({types: image_mime_types}, options);

  // Defer to the load's default policy by using an undefined parameter
  let undefined_policy;
  return load_url(url, options_clone, undefined_policy);
}
