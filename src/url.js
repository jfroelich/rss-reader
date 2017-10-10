// Library for working with urls
'use strict';

// Dependencies
// assert.js

// Returns the absolute form the input url
// @param url_string {String}
// @param base_url {URL}
// @returns {URL}
// TODO: rename to url_resolve
function resolve_url(url_string, base_url) {
  ASSERT(Object.prototype.toString.call(base_url) === '[object URL]');

  // TODO: use a single regex for speed? Or maybe get the protocol,
  // normalize it, and check against a list of bad protocols?
  // TODO: or if it has any protocol, then just return the url as is?
  // - but that would still require a call to new URL
  // Or can we just check for the presence of any colon?
  if(/^\s*javascript:/i.test(url_string) ||
    /^\s*data:/i.test(url_string) ||
    /^\s*mailto:/i.test(url_string)) {
    return;
  }

  let absolute_url_object;
  try {
    absolute_url_object = new URL(url_string, base_url);
  } catch(error) {
  }
  return absolute_url_object;
}


function url_get_hostname(url_string) {
  ASSERT(url_string);
  try {
    const url_object = new URL(url_string);
    return url_object.hostname;
  } catch(error) {
  }
}

// Only minor validation for speed
// Assumes canonical/absolute
// TODO: add min length check
function url_is_valid(url_string) {
  return url_string && !url_string.trim().includes(' ');
}

function url_path_is_valid(path) {
  return typeof path === 'string' &&
    path.length &&
    path.charAt(0) === '/' &&
    !path.includes(' ');
}

function url_path_get_extension(path) {
  ASSERT(url_path_is_valid(path));

  // Fail if the path is probably too short to contain an extension
  const min_path_length = '/a.b'.length;
  if(path.length < min_path_length)
    return;

  const last_dot_position = path.lastIndexOf('.');
  if(last_dot_position === -1)
    return;

  // A path that ends with a period is a valid path.
  // The +1 skips past the period itself.
  // TODO: this should avoid out of bounds error? What if dot is final position?
  let extension = path.substring(last_dot_position + 1);

  // If the path ended with a dot, then the extension string will be
  // empty, so assume the path is malformed and no extension exists
  // TODO: does this make sense if I avoid the case above?
  if(!extension)
    return;

  const max_extension_len = 4;
  if(extension.length > max_extension_len)
    return;

  extension = extension.toLowerCase();
  if(!/[a-z]/.test(extension))
    return;

  return extension;
}


// Return true if the path probably represents a binary resource
// TODO: test input 'foo.'
// TODO: write tests
// TODO: maybe make this a helper to url_sniff_is_binary(url)
function url_path_sniff_is_binary(path) {
  const extension = url_path_get_extension(path);
  if(!extension)
    return false;

  const mime_type = mime_get_type_for_extension(extension);
  if(!mime_type)
    return false;

  const slash_position = mime_type.indexOf('/');
  ASSERT(slash_position !== -1);

  const super_type = mime_type.substring(0, slash_position);
  const bin_super_types = ['application', 'audio', 'image', 'video'];
  return bin_super_types.includes(super_type);
}
