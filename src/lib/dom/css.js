// General css utilities
// TODO: maybe deprecate, this is just too simple for a module
// TODO: rename file to function name?

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
