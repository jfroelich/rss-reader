import assert from "/src/assert/assert.js";

// Returns the first matching css rule within the given sheet, or undefined if no rules match.
//
// @param sheet css style sheet
// @param selectorText {String}
// @returns rule {???}
export function findCSSRule(sheet, selectorText) {
  assert(sheet);
  for(const rule of sheet.cssRules) {
    if(rule.selectorText === selectorText) {
      return rule;
    }
  }
}

// Use the first sheet
export function getDefaultStylesheet() {
  const sheets = document.styleSheets;
  if(sheets.length) {
    return sheets[0];
  }
}
