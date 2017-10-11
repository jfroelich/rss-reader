// Library for working with urls
'use strict';

// Dependencies
// assert.js

// Returns the absolute form the input url
// @param url_string {String}
// @param base_url {URL}
// @returns {URL}
function url_resolve(url_string, base_url) {
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
// @param url {String}
function url_is_valid(url) {
  // TODO: choose a more accurate minimum length
  const URL_MIN_LENGTH = 1;

  if(typeof url === 'string') {
    url = url.trim();
    if(url.length >= URL_MIN_LENGTH) {
      return !url.includes(' ');
    }
  }
  return false;
}

function url_path_is_valid(path) {
  // NOTE: it is not obvious but path.length means that path has 1 or more
  // characters, not that path has 0 or more
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

// Return true if the path probably represents a binary resource. The sniff
// keyword indicates this does not actually inspect the bytes of the resource,
// this makes a guess based on the extension alone.
// @param path {String} path component of url to sniff
// @returns {Boolean} true if probably binary, otherewise false
// TODO: test input 'foo.', I suspect it is incorrect
// TODO: write tests
function url_path_sniff_is_binary(path) {
  const extension = url_path_get_extension(path);
  if(!extension)
    return false;

  const mime_type = mime_get_type_for_extension(extension);
  if(!mime_type)
    return false;

  const slash_position = mime_type.indexOf('/');
  // All mime types resulting from the lookup should contain a slash.
  // This is an extra check
  ASSERT(slash_position !== -1);

  // TODO: incorrect in several cases (e.g. application/javascript is text)
  // Basically, testing against the super type is too simple of a solution to
  // the problem, because it is ignoring the fact that certain generally
  // binary super types correspond to textual resources. Not a high priority
  // because of how mime types are checked when fetching, the cost of false
  // positives or false negatives is not high, it simply prevents some
  // function in the poll module from exiting earlier than it could. However,
  // I want to be correct.

  const super_type = mime_type.substring(0, slash_position);
  const bin_super_types = ['application', 'audio', 'image', 'video'];
  return bin_super_types.includes(super_type);
}

// Returns a file name without its extension (and without the '.')
function url_file_name_filter_extension(file_name) {
  const index = file_name.lastIndexOf('.');
  return index < 0 ? file_name : file_name.substring(0, index);
}

function url_path_get_file_name(path) {
  ASSERT(typeof path === 'string');
  ASSERT(path.charAt(0) === '/');
  const index = path.lastIndexOf('/');
  if(index > -1) {
    const index_plus_1 = index + 1;
    if(index_plus_1 < path.length)
      return path.substring(index_plus_1);
  }
  return path;
}

// Returns true if url is a URL object
function url_is_url_object(url) {
  return Object.prototype.toString.call(url) === '[object URL]';
}

// Compares two urls for equality, after normalization and removing the hash
// from each url, if present. Both urls must be defined strings.
// @param url1 {String}
// @param url2 {String}
// @returns Boolean
function url_equals_no_hash(url1, url2) {
  ASSERT(typeof url1 === 'string');
  ASSERT(typeof url2 === 'string');

  // Unmarshalling enables normalization and simple hash filtering
  const url1_object = new URL(url1);
  const url2_object = new URL(url2);
  url1_object.hash = '';
  url2_object.hash = '';
  return url1_object.href === url2_object.href;
}
