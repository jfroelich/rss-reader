import * as css from '/src/lib/dom/css.js';

/*

# page-style-settings

### Todos
* move these notes into slideshow page and remove this file
* after moving display setting change ability from options page to slideshow
page, this this module will be used exclusively by slideshow page, and should
merged into it, or made as a helper module to it exclusively.
* use px instead of em everywhere, and append value as is, such as for setting
font-size property in `page_style_content_rule_create`
* did column-count become standard css yet? if so drop prefix


*/

export function page_style_onchange(event) {
  page_style_entry_update();
  page_style_title_update();
  page_style_content_update();

  const rule = css.find_rule('.slide-padding-wrapper');
  if (rule) {
    rule.style.padding = localStorage.PADDING;
  }
}

export function page_style_onload() {
  const sheet = document.styleSheets[0];
  sheet.addRule('.entry', page_style_entry_rule_create());
  sheet.addRule('.entry .entry-title', page_style_title_rule_create());
  sheet.addRule('.entry .entry-content', page_style_content_rule_create());

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

  let line_height_string = localStorage.BODY_LINE_HEIGHT;
  if (line_height_string) {
    const line_height = parseInt(line_height_string, 10);
    if (line_height) {
      buffer.push(`line-height: ${(line_height / 10).toFixed(2)};`);
    }
  }

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
    if (font_size) {
      rule.style.fontSize = (font_size / 10).toFixed(2) + 'em';
    }
  }

  const should_justify = localStorage.JUSTIFY_TEXT === '1';
  rule.style.textAlign = should_justify ? 'justify' : 'left';

  const line_height = parseInt(localStorage.BODY_LINE_HEIGHT, 10);
  rule.style.lineHeight = (line_height / 10).toFixed(2);

  let column_count_string = localStorage.COLUMN_COUNT;
  if (column_count_string && !['1', '2', '3'].includes(column_count_string)) {
    column_count_string = '1';
  }
  rule.style.webkitColumnCount = column_count_string;
}
