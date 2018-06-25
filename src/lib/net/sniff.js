import * as string from '/src/lib/string.js';
import * as mime from '/src/lib/net/mime.js';

// `classify` classifies a resource as binary, text, or unknown. The function
// returns unknown when it is not confident in the results. The function guesses
// the class of the resource purely by looking at its url, without actually
// performing any I/O operations or investigating the bytes of the resource.
// Internally, the function attempts to find the file name's extension in the
// url path, find its mime type, and determine class based on mime type.
//
// * Internal note: the text protocols list is not exhaustive, it only includes
// some typical protocols off the top of my head
// * Internal note: the application super type exceptions is not exhaustive, it
// only lists typical mime types with which this app is concerned
// * Internal note: the extension to mime type map is not exhaustive and not
// necessarily canonical (normative), I've only done basic research and hobbled
// together a list from online resources

export const UNKNOWN_CLASS = 0;
export const TEXT_CLASS = 1;
export const BINARY_CLASS = 2;

export const text_protocols = ['tel:', 'mailto:', 'javascript:'];

export const application_text_types = [
  'application/atom+xml', 'application/javascript', 'application/json',
  'application/rdf+xml', 'application/rss+xml',
  'application/vnd.mozilla.xul+xml', 'application/xhtml+xml', 'application/xml'
];

export function classify(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL');
  }

  if (url.href === 'about:blank') {
    return TEXT_CLASS;
  }

  if (text_protocols.includes(url.protocol)) {
    return TEXT_CLASS;
  }

  if (url.protocol === 'data:') {
    const mime_type = find_mime_type_in_data_url(url);
    return mime_type ? mime_type_is_binary(mime_type) : UNKNOWN_CLASS;
  }

  const extension = url_get_extension(url);
  if (extension) {
    const mime_type = EXTENSION_TYPE_MAP[extension];
    if (mime_type) {
      return mime_type_is_binary(mime_type);
    }
  }

  return UNKNOWN_CLASS;
}

export function find_mime_type_in_data_url(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL');
  }

  if (url.protocol !== 'data:') {
    throw new TypeError('url is not a data URI');
  }

  // Data URIs that do not specify a mime type default to text/plain
  const default_type = 'text/plain';

  const href = url.href;
  if (href.length < mime.MIME_TYPE_MIN_LENGTH) {
    return default_type;
  }

  const PREFIX_LENGTH = 'data:'.length;
  const search_start = PREFIX_LENGTH;
  const search_end = PREFIX_LENGTH + mime.MIME_TYPE_MAX_LENGTH + 1;
  const haystack = href.substring(search_start, search_end);

  const sc_position = haystack.indexOf(';');
  if (sc_position < 0) {
    return default_type;
  }

  if (sc_position < mime.MIME_TYPE_MIN_LENGTH) {
    return default_type;
  }

  const mime_type = haystack.substring(0, sc_position);
  return mime.is_mime_type(mime_type) ? mime_type : default_type;
}

export function url_get_extension(url) {
  const minlen = 3;
  const ext_max_len = 20;
  const path = url.pathname;
  const pathlen = path.length;

  if (pathlen >= minlen) {
    const last_dot_pos_p1 = path.lastIndexOf('.') + 1;
    if (last_dot_pos_p1 > 0 && last_dot_pos_p1 < pathlen) {
      const ext = path.substring(last_dot_pos_p1);
      if (ext.length <= ext_max_len && string.is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

export function mime_type_is_binary(mime_type) {
  if (!mime.is_mime_type(mime_type)) {
    throw new TypeError('Invalid mime type argument: ' + mime_type);
  }

  const slash_position = mime_type.indexOf('/');
  const super_type = mime_type.substring(0, slash_position);

  switch (super_type) {
    case 'application':
      return application_text_types.includes(mime_type) ? TEXT_CLASS :
                                                          BINARY_CLASS;
    case 'text':
      return TEXT_CLASS;
    case 'audio':
      return BINARY_CLASS;
    case 'image':
      return BINARY_CLASS;
    case 'video':
      return BINARY_CLASS;
    case 'multipart':
      return BINARY_CLASS;
    default:
      return UNKNOWN_CLASS;
  }
}

export const EXTENSION_TYPE_MAP = {
  ai: 'application/postscript',
  aif: 'audio/aiff',
  atom: 'application/atom+xml',
  avi: 'video/avi',
  bin: 'application/octet-stream',
  bmp: 'image/bmp',
  c: 'text/plain',
  cc: 'text/plain',
  cgi: 'text/html',
  'class': 'application/java',
  com: 'application/octet-stream',
  cpp: 'text/plain',
  css: 'text/css',
  doc: 'application/msword',
  docx: 'application/msword',
  eml: 'message/rfc822',
  eps: 'application/postscript',
  exe: 'application/octet-stream',
  flac: 'audio/flac',
  fli: 'video/fli',
  gif: 'image/gif',
  gz: 'application/gzip',
  h: 'text/plain',
  htm: 'text/html',
  html: 'text/html',
  ico: 'image/x-icon',
  ics: 'text/calendar',
  java: 'text/plain',
  jfif: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'application/javascript',
  json: 'application/json',
  jsp: 'text/html',
  log: 'text/plain',
  m3u8: 'application/x-mpegurl',
  m4a: 'audio/x-m4a',
  m4v: 'video/mp4',
  md: 'text/plain',
  mth: 'multipart/related',
  mhtml: 'multipart/related',
  midi: 'audio/midi',
  mov: 'video/quicktime',
  mp2: 'audio/mpeg',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  ogm: 'video/ogg',
  ogv: 'video/ovg',
  opus: 'audio/ogg',
  pdf: 'application/pdf',
  php: 'text/html',
  pjp: 'image/jpeg',
  pjpeg: 'image/jpeg',
  pl: 'text/html',
  png: 'image/x-png',
  pps: 'application/vnd.ms-powerpoint',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.ms-powerpoint',
  ps: 'application/postscript',
  rar: 'application/octet-stream',
  rdf: 'application/rdf+xml',
  rss: 'application/rss+xml',
  sh: 'text/x-sh',
  shtm: 'text/html',
  shtml: 'text/html',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  swf: 'application/x-shockwave-flash',
  swl: 'application/x-shockwave-flash',
  tar: 'application/x-tar',
  text: 'text/plain',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  tgz: 'application/gzip',
  txt: 'text/plain',
  wav: 'audio/wav',
  webm: 'audio/webm',
  webp: 'image/webp',
  woff: 'application/font-woff',
  xbl: 'text/xml',
  xht: 'application/xhtml+xml',
  xhtm: 'application/xhtml+xml',
  xhtml: 'application/xhtml+xml',
  xmb: 'image/x-xbitmap',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xml: 'text/xml',
  xsl: 'text/xml',
  xslt: 'text/xml',
  xul: 'application/vnd.mozilla.xul+xml',
  zip: 'application/zip'
};
