// TODO: if this module is only used by one other module, this should not be a
// global module, this should be a helper file within that other module's folder

// Changes a url based on a set of rules. Based on Apache's mod_rewrite module.
// @param url {URL} the starting url
// @param rules {Array} an array of rules. A rule should be a function that
// accepts a url and returns a url. A rule should should be pure and not modify
// its input url object. A rule should return undefined if no rewriting
// occurred, or a new url if rewriting occurred. Rule functions should be
// synchronous and not involve side effects. Rule functions should involve
// minimal processing.
// @returns {URL} the rewritten url. This may point to the original if no changes
// introduced
export function rewrite_url(url, rules) {
  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }

  return next;
}
