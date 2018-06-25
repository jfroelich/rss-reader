import * as config from '/src/config.js';

export function page_style_onload() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

  const padding = config.read_int('padding');
  if (!isNaN(padding)) {
    sheet.addRule('.slide-padding-wrapper', 'padding: ' + padding + 'px');
  }
}

function page_style_entry_rule_create() {
  const buffer = [];

  let path = config.read_string('bg_image');
  // Support for legacy path that included folder
  if (path && path.startsWith('/images/')) {
    path = path.substring('/images/'.length);
  }

  const color = config.read_string('bg_color');

  if (path) {
    buffer.push(`background: url("/images/${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('header_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  const font_family = config.read_string('header_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];
  const font_size = config.read_int('body_font_size');
  if (!isNaN(font_size)) {
    buffer.push(`font-size: ${font_size}px;`);
  }

  if (config.read_boolean('justify_text')) {
    buffer.push('text-align: justify;');
  }

  const font_family = config.read_string('body_font_family');
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  const line_height = config.read_int('body_line_height');
  if (!isNaN(line_height)) {
    buffer.push(`line-height: ${line_height};`);
  }

  const column_count = config.read_int('column_count');
  if (column_count === 2 || column_count === 3) {
    buffer.push(`-webkit-column-count: ${column_count};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #aaaaaa;');
  }

  return buffer.join('');
}
