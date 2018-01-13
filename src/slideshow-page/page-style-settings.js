import assert from "/src/common/assert.js";

// TODO: it's not finding rules because I am using multiple style sheets.
// Change rule finder to search all style sheets.

// TODO: after moving display setting change ability from options page to slideshow page,
// this this module will be used exclusively by slideshow page, and should merged into it, or
// made as a helper module to it exclusively.

// Get the current settings from local storage and then modify the css rules in the default style
// sheet
export function pageStyleSettingsOnchange(event) {
  entryCSSUpdateRule();
  entryCSSUpdateTitleRule();
  entryCSSUpdateContentRule();

  // Padding wrapper change
  const rule = findRule('.slide-padding-wrapper');
  if(rule) {
    const padding = localStorage.PADDING || '0';
    rule.style.padding = padding;
  }
}

// Get the current settings from local storage and then create css rules and append them to the
// default style sheet.
export function pageStyleSettingsOnload() {
  const sheet = document.styleSheets[0];
  assert(sheet instanceof CSSStyleSheet);
  sheet.addRule('.entry', entryCSSCreateEntryRuleText());

  // TODO: convert these two to be like above pattern where I get the text and then add the rule
  entryCSSAddTitleRule(sheet);
  entryCSSAddContentRule(sheet);

  // Padding wrapper init
  const padding = localStorage.PADDING;
  if(padding) {
    sheet.addRule('.slide-padding-wrapper', 'padding:' + padding);
  }
}

function entryCSSCreateEntryRuleText() {
  const buffer = [];
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

  sheet.addRule('.entry .entry-title', buffer.join(''));
}

function entryCSSAddContentRule(sheet) {
  let buffer = [];

  // TODO: use px not em
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

  const columnCountString = localStorage.COLUMN_COUNT;
  if(columnCountString === '2' || columnCountString === '3') {
    buffer.push(`-webkit-column-count: ${columnCountString};`);
    buffer.push('-webkit-column-gap: 30px;');
    buffer.push('-webkit-column-rule: 1px outset #AAAAAA;');
  }

  sheet.addRule('.entry .entry-content', buffer.join(''));
}

function entryCSSUpdateRule() {

  const rule = findRule('.entry');

  if(!rule) {
    console.error('Could not find rule ".entry"');
    return;
  }

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

function entryCSSUpdateTitleRule() {

  const rule = findRule('.entry .entry-title');
  if(!rule) {
    console.error('Could not find rule ".entry a.entry-title"');
    return;
  }

  console.debug('Found rule:', rule, rule instanceof CSSStyleRule);

  const style = rule.style;
  style.background = '';
  style.fontFamily = localStorage.HEADER_FONT_FAMILY;

  const size = parseInt(localStorage.HEADER_FONT_SIZE, 10);
  if(!isNaN(size)) {
    style.fontSize = (size / 10).toFixed(2) + 'em';
  }
}

function entryCSSUpdateContentRule() {

  const rule = findRule('.entry .entry-content');

  if(!rule) {
    console.error('Could not find rule ".entry span.entry-content"');
    return;
  }

  console.debug('Found rule:', rule, rule instanceof CSSStyleRule);

  if(!(rule instanceof CSSStyleRule)) {
    console.error('Rule is not a css style rule');
    return;
  }

  rule.style.background = '';

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


// Returns the first matching css rule or undefined.
//
// @param selectorText {String}
// @returns rule {CSSStyleRule}
function findRule(selectorText) {
  const sheets = document.styleSheets;
  for(const sheet of sheets) {
    const rules = sheet.rules;
    for(const rule of rules) {
      if(rule.selectorText === selectorText) {
        return rule;
      }
    }
  }
}
