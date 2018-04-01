import {fetch_with_timeout} from '/src/lib/url-loader/url-loader.js';

const image_mime_types = [
  'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
  'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
  'image/vnd.microsoft.icon'
];

export function fetch_image(url, options) {
  // Pretend that options is immutable, so clone as to remain pure
  const options_clone = Object.assign({types: image_mime_types}, options);

  // Defer to the fetch_with_timeout's default fetch policy of allow-all by
  // using an undefined parameter
  // TODO: now that this is in the lib, decide on whether to reintroduce some
  // kind of policy hook. Perhaps the easiest way would be to add a parameter to
  // fetch_image and then forward it?
  let policy;

  return fetch_with_timeout(url, options_clone, policy);
}
