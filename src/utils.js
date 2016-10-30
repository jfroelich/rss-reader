// See license.md

'use strict';

// A mapping between common file extensions and mime types
const ext_to_mime_type_map = {
  'ai':   'application/postscript',
  'aif':  'audio/aiff',
  'atom': 'application/atom+xml',
  'avi':  'video/avi',
  'bin':  'application/octet-stream',
  'bmp':  'image/bmp',
  'c':    'text/plain',
  'cc':   'text/plain',
  'cgi':  'text/hml',
  'class':'application/java',
  'cpp':  'text/plain',
  'css':  'text/css',
  'doc':  'application/msword',
  'docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'exe':  'application/octet-stream',
  'flac': 'audio/flac',
  'fli':  'video/fli',
  'gif':  'image/gif',
  'gz':   'application/x-gzip',
  'h':    'text/plain',
  'htm':  'text/html',
  'html': 'text/html',
  'ico':  'image/x-icon',
  'java': 'text/plain',
  'jpg':  'image/jpg',
  'js':   'application/javascript',
  'json': 'application/json',
  'jsp':  'text/html',
  'log':  'text/plain',
  'md':   'text/plain',
  'midi': 'audio/midi',
  'mov':  'video/quicktime',
  'mp2':  'audio/mpeg', // can also be video
  'mp3':  'audio/mpeg3', // can also be video
  'mpg':  'audio/mpeg', // can also be video
  'ogg':  'audio/ogg',
  'ogv':  'video/ovg',
  'pdf':  'application/pdf',
  'php':  'text/html',
  'pl':   'text/html',
  'png':  'image/png',
  'pps':  'application/vnd.ms-powerpoint',
  'ppt':  'application/vnd.ms-powerpoint',
  'pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'rar':  'application/octet-stream',
  'rss':  'application/rss+xml',
  'svg':  'image/svg+xml',
  'swf':  'application/x-shockwave-flash',
  'tiff': 'image/tiff',
  'wav':  'audio/wav',
  'xls':  'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xml':  'application/xml',
  'zip':  'application/zip'
};

// Given a url, try and guess the mime type of the url by looking at the
// filename extension
function guess_mime_type_from_url(url_obj) {
  const ext = get_url_extension(url_obj);
  if(ext)
    return ext_to_mime_type_map[ext];
}

// @param url {URL}
// @returns {String} lowercase extension
function get_url_extension(url) {
  const path = url.pathname;

  // must have at least '/a.b'
  if(path.length < 4)
    return;

  const last_dot = path.lastIndexOf('.');
  if(last_dot === -1)
    return;

  // TODO: what about 'foo.', will this throw?
  const ext = path.substring(last_dot + 1);
  const len = ext.length;
  if(len > 0 && len < 5 && /[a-z]/i.test(ext))
    return ext.toLowerCase();
}

// @param url_str {String}
// @param base_url {URL}
function resolve_url(url_str, base_url) {
  if(typeof url_str !== 'string')
    throw new TypeError();
  if(!is_url_object(base_url))
    throw new TypeError();
  if(url_has_js_protocol(url_str) ||
    url_has_data_protocol(url_str))
    return;
  try {
    return new URL(url_str, base_url);
  } catch(error) {
    console.warn(url_str, base_url.href, error);
  }
}

function url_has_data_protocol(url_str) {
  return /^\s*data:/i.test(url_str);
}

function url_has_js_protocol(url_str) {
  return /^\s*javascript:/i.test(url_str);
}

function is_url_object(value) {
  return Object.prototype.toString.call(value) === '[object URL]';
}

function guess_if_url_is_non_html(url) {
  const bad_super_types = ['application', 'audio', 'image', 'video'];
  const type = guess_mime_type_from_url(url);
  if(type) {
    const super_type = type.substring(0, type.indexOf('/'));
    return bad_super_types.includes(super_type);
  }
}

function query_idle_state(idle_period_secs) {
  return new Promise(function(resolve) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

function condense_whitespace(str) {
  return str.replace(/\s{2,}/g, ' ');
}

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function filter_control_chars(str) {
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it s null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Impure.
function filter_empty_props(obj) {
  const copy = {};
  const has_own = Object.prototype.hasOwnProperty;
  const undef = void(0);
  for(let prop in obj) {
    if(has_own.call(obj, prop)) {
      const value = obj[prop];
      if(value !== undef && value !== null && value !== '') {
        copy[prop] = value;
      }
    }
  }
  return copy;
}

function format_date(date, delimiter) {
  const parts = [];
  if(date) {
    // getMonth is a zero based index
    parts.push(date.getMonth() + 1);
    parts.push(date.getDate());
    parts.push(date.getFullYear());
  }
  return parts.join(delimiter || '/');
}

// Calculates the approximate size of a value in bytes. This should only be used
// for basic testing because it is hilariously inaccurate.
// Adapted from http://stackoverflow.com/questions/1248302
// Generally does not work on built-ins (dom, XMLHttpRequest, etc)
function sizeof(object) {
  const seen = [];
  const stack = [object];
  const has_own = Object.prototype.hasOwnProperty;
  const to_string = Object.prototype.to_string;
  let size = 0;
  while(stack.length) {
    const value = stack.pop();

    // NOTE: typeof null === 'object'
    if(value === null)
      continue;

    switch(typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        size += 4;
        break;
      case 'string':
        size += value.length * 2;
        break;
      case 'number':
        size += 8;
        break;
      case 'function':
        size += 2 * value.to_string().length;
        break;
      case 'object':
        if(seen.indexOf(value) === -1) {
          seen.push(value);
          if(ArrayBuffer.isView(value)) {
            size += value.length;
          } else if(Array.isArray(value)) {
            stack.push(...value);
          } else {
            const to_string_output = to_string.call(value);
            if(to_string_output === '[object Date]') {
              size += 8;// guess
            } else if(to_string_output === '[object URL]') {
              size += 2 * value.href.length;// guess
            } else {
              for(let prop in value) {
                if(has_own.call(value, prop)) {
                  size += prop.length * 2;// prop name
                  stack.push(value[prop]);
                }
              }
            }
          }
        }
        break;
      default:
        break;// ignore
    }
  }

  return size;
}
