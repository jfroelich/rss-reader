import assert from "/src/common/assert.js";

// TODO: after moving display setting change ability from options page to slideshow page,
// this this module will be used exclusively by slideshow page, and should merged into it, or
// made as a helper module to it exclusively.

// Get the current settings from local storage and then modify the css rules in the default style
// sheet
export function pageStyleSettingsOnchange(event) {
  const sheet = getDefaultStylesheet();
  assert(sheet instanceof CSSStyleSheet);
  entryCSSUpdateRule(sheet);
  entryCSSUpdateTitleRule(sheet);
  entryCSSUpdateContentRule(sheet);
}

// Get the current settings from local storage and then create css rules and append them to the
// default style sheet.
export function pageStyleSettingsOnload() {
  const sheet = getDefaultStylesheet();
  assert(sheet instanceof CSSStyleSheet);
  sheet.addRule('slide.entry', entryCSSCreateEntryRuleText());

  // TODO: convert these two to be like above pattern where I get the text and then add the rule
  entryCSSAddTitleRule(sheet);
  entryCSSAddContentRule(sheet);
}

function entryCSSCreateEntryRuleText() {
  const buffer = [];
  buffer.push('margin: 0px;');
  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;
  if(path) {
    buffer.push(`background: url("${path}");`);
  } else if(color) {
    buffer.push(`background: ${color};`);
  }


  return buffer.join('');
}

function entryCSSAddTitleRule(sheet) {
  let buffer = [];
  const headerFontSize = parseInt(localStorage.HEADER_FONT_SIZE || '0', 10);
  if(headerFontSize) {
    buffer.push(`font-size: ${(headerFontSize / 10).toFixed(2)}em;`);
  }

  const headerFontFamily = localStorage.HEADER_FONT_FAMILY;
  if(headerFontFamily) {
    buffer.push(`font-family:${headerFontFamily};`);
  }


  const padding = localStorage.PADDING;
  if(padding) {
    buffer.push(`padding: ${padding}px;`);
  }

  sheet.addRule('.entry a.entry-title', buffer.join(''));
}

function entryCSSAddContentRule(sheet) {
  let buffer = [];


  const padding = localStorage.PADDING;
  if(padding) {
    buffer.push(`padding: ${padding}px;`);
  }

  const bodyFontSize = parseInt(localStorage.BODY_FONT_SIZE || '0', 10);
  if(bodyFontSize) {
    buffer.push(`font-size: ${(bodyFontSize / 10).toFixed(2)}em;`);
  }

  const bodyJustifyText = localStorage.JUSTIFY_TEXT === '1';
  if(bodyJustifyText) {
    buffer.push('text-align: justify;');
  }

  const bodyFontFamily = localStorage.BODY_FONT_FAMILY;
  if(bodyFontFamily) {
    buffer.push(`font-family: ${bodyFontFamily};`);
  }

  let bodyLineHeightString = localStorage.BODY_LINE_HEIGHT;
  if(bodyLineHeightString) {
    const bodyLineHeight = parseInt(bodyLineHeightString, 10);

    // TODO: units?
    if(bodyLineHeight) {
      buffer.push(`line-height: ${(bodyLineHeight / 10).toFixed(2)};`);
    }
  }

  buffer.push('vertical-align: text-top;');
  buffer.push('display: block;');
  buffer.push('word-wrap: break-word;');
  buffer.push('margin: 0;');

  const columnCountString = localStorage.COLUMN_COUNT;
  if(columnCountString === '2' || columnCountString === '3') {
    buffer.push(`-webkit-column-count: ${columnCountString};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #AAAAAA;');
  }

  sheet.addRule('.entry .entry-content', buffer.join(''));
}

function entryCSSUpdateRule(sheet) {
  assert(sheet instanceof CSSStyleSheet);
  const rule = findRule(sheet, '.entry');
  assert(rule instanceof CSSStyleRule);
  const style = rule.style;

  const path = localStorage.BG_IMAGE;
  const color = localStorage.BG_COLOR;

  if(path) {
    style.backgroundColor = '';
    style.backgroundImage = `url("${path}")`;
  } else if(color) {
    style.backgroundColor = color;
    style.backgroundImage = '';
  } else {
    style.backgroundColor = '';
    style.backgroundImage = '';
  }


}

function entryCSSUpdateTitleRule(sheet) {
  assert(sheet instanceof CSSStyleSheet);
  const rule = findRule(sheet, '.entry a.entry-title');
  assert(rule instanceof CSSStyleRule);
  const style = rule.style;

  const padding = localStorage.PADDING || '0';
  style.padding = `${padding}px`;

  style.background = '';
  style.fontFamily = localStorage.HEADER_FONT_FAMILY;

  const size = parseInt(localStorage.HEADER_FONT_SIZE, 10);
  if(!isNaN(size)) {
    style.fontSize = (size / 10).toFixed(2) + 'em';
  }
}

function entryCSSUpdateContentRule(sheet) {
  assert(sheet instanceof CSSStyleSheet);
  const rule = findRule(sheet, '.entry span.entry-content');
  assert(rule instanceof CSSStyleRule);

  rule.style.background = '';

  const padding = localStorage.PADDING || '0';
  rule.style.padding = `${padding}px`;

  const bodyFontFamily = localStorage.BODY_FONT_FAMILY;
  if(bodyFontFamily) {
    rule.style.fontFamily = bodyFontFamily;
  } else {
    rule.style.fontFamily = 'initial';
  }

  const bodyFontSizeString = localStorage.BODY_FONT_SIZE;
  if(bodyFontSizeString) {
    const bodyFontSizeNumber = parseInt(bodyFontSizeString, 10);

    // TODO:
    // Why am I dividing by 10 here??
    // Why am I using em?
    // What is the base font?
    if(bodyFontSizeNumber) {
      rule.style.fontSize = (bodyFontSizeNumber / 10).toFixed(2) + 'em';
    }
  }

  rule.style.textAlign = (localStorage.JUSTIFY_TEXT === '1') ? 'justify' : 'left';

  const bodyLineHeight = parseInt(localStorage.BODY_LINE_HEIGHT, 10) || 10;
  rule.style.lineHeight = (bodyLineHeight / 10).toFixed(2);

  let columnCountString = localStorage.COLUMN_COUNT;
  const validColumnCounts = { '1': 1, '2': 1, '3': 1 };
  if(!(columnCountString in validColumnCounts)) {
    columnCountString = '1';
  }

  rule.style.webkitColumnCount = columnCountString;
}


// Use the first sheet
function getDefaultStylesheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}


// Returns the first matching css rule within the given sheet, or undefined if no rules match.
//
// @param sheet {CSSStyleSheet}
// @param selectorText {String}
// @returns rule {CSSStyleRule}
function findRule(sheet, selectorText) {
  assert(sheet instanceof CSSStyleSheet);
  const rules = sheet.rules || sheet.cssRules || [];
  for(const rule of rules) {
    if(rule.selectorText === selectorText) {
      return rule;
    }
  }
}
