'use strict';

// import base/assert.js

// Returns the first matching css rule within the given sheet, or undefined if
// no rules match.
//
// @param sheet css style sheet
// @param selector_text {String}
// @returns rule
function css_find_rule(sheet, selector_text) {
  ASSERT(sheet);

  for(const rule of sheet.cssRules) {
    if(rule.selectorText === selector_text) {
      return rule;
    }
  }
}

// Use the first sheet
function css_get_default_sheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}
