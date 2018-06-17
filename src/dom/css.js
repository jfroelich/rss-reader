// General css utilities

// Returns the first matching css rule or undefined
// @param selector_text {String}
// @returns rule {CSSStyleRule}
export function find_rule(selector_text) {
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.rules) {
      if (rule.selectorText === selector_text) {
        return rule;
      }
    }
  }
}
