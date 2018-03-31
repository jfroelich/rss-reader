import {tfetch} from '/src/lib/url-loader/url-loader.js';

// TODO: decide on whether to reintroduce some kind of policy hook

const image_mime_types = [
  'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
  'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
  'image/vnd.microsoft.icon'
];

export function rdr_fetch_image(url, options) {
  // Pretend that options is immutable, so clone as to remain pure
  const options_clone = Object.assign({types: image_mime_types}, options);
  return tfetch(url, options_clone);
}
