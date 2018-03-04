import * as css from '/src/css/css.js';

// TODO: after moving display setting change ability from options page to
// slideshow page, this this module will be used exclusively by slideshow page,
// and should merged into it, or made as a helper module to it exclusively.

// Get the current settings from local storage and then modify the css rules in
// the default style sheet
export function page_style_onchange(event) {
  page_style_entry_update();
  page_style_title_update();
  page_style_content_update();

  // Padding wrapper change
  const rule = css.find_rule('.slide-padding-wrapper');
  if (rule) {
    // It is fine is padding is set to undefined
    rule.style.padding = localStorage.PADDING;
  }
}

// Get the current settings from local storage and then create css rules and
// append them to the default style sheet.
export function page_style_onload() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

  // Padding wrapper init
  const padding = localStorage.PADDING;
  if (padding) {
    sheet.addRule('.slide-padding-wrapper', 'padding:' + padding);
  }
}

function page_style_entry_rule_create() {
  const buffer = [];
  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;
  if (path) {
    buffer.push(`background: url("${path}");`);
  } else if (color) {
    buffer.push(`background: ${color};`);
  }

  return buffer.join('');
}

function page_style_title_rule_create(sheet) {
  const buffer = [];
  const header_font_size = parseInt(localStorage.HEADER_FONT_SIZE, 10);
  if (header_font_size) {
    buffer.push(`font-size:${(header_font_size / 10).toFixed(2)}em;`);
  }

  const header_font_family = localStorage.HEADER_FONT_FAMILY;
  if (header_font_family) {
    buffer.push(`font-family:${header_font_family};`);
  }

  return buffer.join('');
}

function page_style_content_rule_create(sheet) {
  const buffer = [];

  // TODO: use px, and append value as is
  const font_size = parseInt(localStorage.BODY_FONT_SIZE, 10);
  if (font_size) {
    buffer.push(`font-size: ${(font_size / 10).toFixed(2)}em;`);
  }

  if (localStorage.JUSTIFY_TEXT === '1') {
    buffer.push('text-align: justify;');
  }

  const font_family = localStorage.BODY_FONT_FAMILY;
  if (font_family) {
    buffer.push(`font-family: ${font_family};`);
  }

  // TODO: use px, append as is
  let line_height_string = localStorage.BODY_LINE_HEIGHT;
  if (line_height_string) {
    const line_height = parseInt(line_height_string, 10);
    if (line_height) {
      buffer.push(`line-height: ${(line_height / 10).toFixed(2)};`);
    }
  }

  // TODO: did column-count become standard css yet?
  const column_count = localStorage.COLUMN_COUNT;
  if (column_count === '2' || column_count === '3') {
    buffer.push(`-webkit-column-count: ${column_count};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #AAAAAA;');
  }

  return buffer.join('');
}

function page_style_entry_update() {
  const rule = css.find_rule('.entry');
  if (!rule) {
    return;
  }

  const style = rule.style;
  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;

  if (path) {
    style.backgroundColor = '';
    style.backgroundImage = `url("${path}")`;
  } else if (color) {
    style.backgroundColor = color;
    style.backgroundImage = '';
  } else {
    style.backgroundColor = '';
    style.backgroundImage = '';
  }
}

function page_style_title_update() {
  const rule = css.find_rule('.entry .entry-title');
  if (!rule) {
    return;
  }

  const style = rule.style;
  style.fontFamily = localStorage.HEADER_FONT_FAMILY;

  // TODO: use raw value, px
  const size = parseInt(localStorage.HEADER_FONT_SIZE, 10);
  if (!isNaN(size)) {
    style.fontSize = (size / 10).toFixed(2) + 'em';
  }
}

function page_style_content_update() {
  const rule = css.find_rule('.entry .entry-content');
  if (!rule) {
    return;
  }

  rule.style.background = '';

  const font_family = localStorage.BODY_FONT_FAMILY;
  if (font_family) {
    rule.style.fontFamily = font_family;
  } else {
    rule.style.fontFamily = 'initial';
  }

  const font_size_string = localStorage.BODY_FONT_SIZE;
  if (font_size_string) {
    const font_size = parseInt(font_size_string, 10);

    // TODO: use px, raw value
    if (font_size) {
      rule.style.fontSize = (font_size / 10).toFixed(2) + 'em';
    }
  }

  rule.style.textAlign =
      (localStorage.JUSTIFY_TEXT === '1') ? 'justify' : 'left';

  // TODO: use px, raw value
  const line_height = parseInt(localStorage.BODY_LINE_HEIGHT, 10);
  rule.style.lineHeight = (line_height / 10).toFixed(2);

  let column_count_string = localStorage.COLUMN_COUNT;
  if (column_count_string && !['1', '2', '3'].includes(column_count_string)) {
    column_count_string = '1';
  }
  rule.style.webkitColumnCount = column_count_string;
}
