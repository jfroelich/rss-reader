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
