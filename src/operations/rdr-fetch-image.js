import {tfetch} from '/src/url-loader/url-loader.js';

// TODO: this is only in use by the favicon-service. Therefore I should probably
// make this is a sub-module of the favicon-service, not an app-wide operation

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
