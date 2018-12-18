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
