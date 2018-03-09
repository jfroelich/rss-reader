import * as mime from '/src/mime/mime.js';

export function url_is_binary(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.href === 'about:blank') {
    return false;
  }

  const text_protocols = ['tel:', 'mailto:', 'javascript:'];
  if (text_protocols.includes(url.protocol)) {
    return false;
  }

  if (url.protocol === 'data:') {
    const default_type = 'text/plain';
    const mime_type = find_mime_type_in_data_url(url) || default_type;
    return mime_type_is_binary(mime_type);
  }

  const extension = url_get_extension(url);
  if (!extension) {
    return false;
  }

  const mime_type = find_mime_type_for_extension(extension);
  if (!mime_type) {
    return false;
  }

  return mime_type_is_binary(mime_type);
}

export function find_mime_type_for_extension(extension) {
  if (typeof extension === 'string') {
    return EXTENSION_TYPE_MAP[extension];
  }
}

export function find_mime_type_in_data_url(url) {
  if (!(url instanceof URL)) {
    throw new TypeError('Invalid url ' + url);
  }

  if (url.protocol !== 'data:') {
    throw new TypeError('Invalid data url ' + url.href);
  }

  const href = url.href;
  if (href.length < mime.MIME_TYPE_MIN_LENGTH) {
    return;
  }

  const PREFIX_LENGTH = 'data:'.length;
  const search_start = PREFIX_LENGTH;
  const search_end = PREFIX_LENGTH + mime.MIME_TYPE_MAX_LENGTH + 1;
  const haystack = href.substring(search_start, search_end);

  const sc_position = haystack.indexOf(';');
  if (sc_position < 0) {
    return;
  }

  if (sc_position < mime.MIME_TYPE_MIN_LENGTH) {
    return;
  }

  const mime_type = haystack.substring(0, sc_position);
  if (mime.is_mime_type(mime_type)) {
    return mime_type;
  }
}

export function url_get_extension(url) {
  const minlen = 3;
  const maxlen = 255;
  const path = url.pathname;
  const pathlen = path.length;

  if (pathlen >= minlen) {
    const last_dot_pos = path.lastIndexOf('.');
    if ((last_dot_pos >= 0) && (last_dot_pos + 1 < pathlen)) {
      const ext = path.substring(last_dot_pos + 1);
      if (ext.length <= maxlen && string_is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

export function string_is_alphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}

const application_text_types = [
  'application/atom+xml', 'application/javascript', 'application/json',
  'application/rdf+xml', 'application/rss+xml',
  'application/vnd.mozilla.xul+xml', 'application/xhtml+xml', 'application/xml'
];

export function mime_type_is_binary(mime_type) {
  if (!mime.is_mime_type(mime_type)) {
    throw new TypeError('Invalid mime_type ' + mime_type);
  }

  const slash_position = mime_type.indexOf('/');
  const super_type = mime_type.substring(0, slash_position);

  switch (super_type) {
    case 'application':
      return !application_text_types.includes(mime_type);
    case 'text':
      return false;
    case 'audio':
      return true;
    case 'image':
      return true;
    case 'video':
      return true;
    case 'multipart':
      return true;
    default:
      return false;
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
  docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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
  pptx:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
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
