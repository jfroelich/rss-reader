import * as url_loader from '/src/lib/url-loader.js';

const image_mime_types = [
  'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
  'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
  'image/vnd.microsoft.icon'
];

export function fetch_image(url, options) {
  // Pretend that options is immutable, so clone as to remain pure
  const options_clone = Object.assign({types: image_mime_types}, options);

  // Defer to the load's default policy by using an undefined
  // parameter
  // TODO: now that this is in the lib, decide on whether to reintroduce some
  // kind of policy hook. Perhaps the easiest way would be to add a parameter to
  // fetch_image and then forward it?
  let undefined_policy;

  return url_loader.load(url, options_clone, undefined_policy);
}
