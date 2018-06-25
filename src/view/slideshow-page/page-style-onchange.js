import * as config from '/src/config.js';
import * as css from '/src/lib/dom/css.js';

export function page_style_onchange(event) {
  page_style_entry_update();
  page_style_title_update();
  page_style_content_update();

  const rule = css.find_rule('.slide-padding-wrapper');
  if (rule) {
    rule.style.padding = config.read_string('PADDING');
  }
}

function page_style_entry_update() {
  const rule = css.find_rule('.entry');
  if (!rule) {
    return;
  }

  const style = rule.style;
  let path = config.read_string('BG_IMAGE');
  // Support for legacy path values
  if (path && path.startsWith('/images/')) {
    path = path.substring('/images/'.length);
  }

  const color = config.read_string('BG_COLOR');

  if (path) {
    style.backgroundColor = '';
    style.backgroundImage = `url("/images/${path}")`;
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

  const family = config.read_string('HEADER_FONT_FAMILY');
  if (family) {
    style.fontFamily = family;
  } else {
    style.fontFamily = 'initial';
  }

  const size = config.read_int('HEADER_FONT_SIZE');
  if (!isNaN(size)) {
    style.fontSize = size + 'px';
  }
}

function page_style_content_update() {
  const rule = css.find_rule('.entry .entry-content');
  if (!rule) {
    return;
  }

  const style = rule.style;

  // I've commented this out, I have no idea why this is here
  // style.background = '';

  const font_family = config.read_string('BODY_FONT_FAMILY');
  if (font_family) {
    style.fontFamily = font_family;
  } else {
    style.fontFamily = 'initial';
  }

  const font_size = config.read_int('BODY_FONT_SIZE');
  if (!isNaN(font_size)) {
    style.fontSize = font_size + 'px';
  }

  if (config.has_key('JUSTIFY_TEXT')) {
    style.textAlign = 'justify';
  } else {
    style.textAlign = 'left';
  }

  const line_height = config.read_int('BODY_LINE_HEIGHT');
  if (!isNaN(line_height)) {
    style.lineHeight = line_height + 'px';
  } else {
    delete style.lineHeight;
  }

  const column_count = config.read_int('COLUMN_COUNT');
  if (column_count === 1) {
    style.webkitColumnCount = column_count;
  } else if (column_count === 2) {
    style.webkitColumnCount = column_count;
  } else if (column_count === 3) {
    style.webkitColumnCount = column_count;
  } else {
    style.webkitColumnCount = column_count;
  }
}
