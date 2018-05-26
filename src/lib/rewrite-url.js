/*

# rewrite-url
Based on Apache's mod_rewrite module. The `rewrite_url` function changes a url
based on a set of rewriting rules. A typical reason to use this is to reduce the
number of urls in a list of urls where the first url redirects to each
subsequent url. In other words, given a list of urls, reduce the list to a
single url.

The rules parameter should be an array of rules.

A rule should be a function that accepts a url and returns a url. A rule should
should be pure and not modify its input url object. A rule should return
undefined if no rewriting occurred, or a new url if rewriting occurred. Rule
functions should be synchronous and not involve side effects. Rule functions
should involve minimal processing.

Here, redirect is defined loosely to account for atypical redirection methods.
For example, a comment technique used by some websites is to pass outgoing link
clicks through an intermediate page that tracks the clicks before continuing.
The use of that intermediate page is something I do not like because of its
network inefficiency and telemetry.

### TODOs

* use a serializable rule format so that rules can be stored in external
settings rather than defined functions
* what if multiple rules apply? This is wrong in that it applies the rules only
once, in the order of the rules array
* what about recursive application of rules? and what is the stopping condition
if that was implemented?


*/

export function rewrite_url(url, rules) {
  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }

  return next;
}
