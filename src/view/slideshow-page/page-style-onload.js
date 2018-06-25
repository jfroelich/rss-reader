import * as config from '/src/config.js';

export function page_style_onload() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

  const padding = config.read_string('PADDING');
  if (padding) {
    sheet.addRule('.slide-padding-wrapper', 'padding:' + padding);
  }
}

function page_style_entry_rule_create() {
  const buffer = [];

  let path = config.read_string('BG_IMAGE');
  // Support for legacy path that included folder
  if (path && path.startsWith('/images/')) {
    path = path.substring('/images/'.length);
  }

  const color = config.read_string('BG_COLOR');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('HEADER_FONT_SIZE');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  const font_family = config.read_string('HEADER_FONT_FAMILY');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('BODY_FONT_SIZE');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  if (config.has_key('JUSTIFY_TEXT')) {
    buffer.push('text-align: justify;');
  }

  const font_family = config.read_string('BODY_FONT_FAMILY');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  const line_height = config.read_int('BODY_LINE_HEIGHT');
  if (!isNaN(line_height)) {
    buffer.push(`line-height: ${line_height};`);
  }

  const column_count = config.read_int('COLUMN_COUNT');
  if (column_count === 2 || column_count === 3) {
    buffer.push(`-webkit-column-count: ${column_count};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #aaaaaa;');
  }

  return buffer.join('');
}
