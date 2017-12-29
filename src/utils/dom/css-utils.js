import assert from "/src/common/assert.js";

// Returns the first matching css rule within the given sheet, or undefined if no rules match.
//
// @param sheet {CSSStyleSheet}
// @param selectorText {String}
// @returns rule {CSSStyleRule}
export function findRule(sheet, selectorText) {
  assert(sheet instanceof CSSStyleSheet);
  const rules = sheet.rules || sheet.cssRules || [];
  for(const rule of rules) {
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
