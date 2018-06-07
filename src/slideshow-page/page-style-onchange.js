import * as css from '/src/lib/dom/css.js';

export function page_style_onchange(event) {
  page_style_entry_update();
  page_style_title_update();
  page_style_content_update();

  const rule = css.find_rule('.slide-padding-wrapper');
  if (rule) {
    rule.style.padding = localStorage.PADDING;
  }
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
