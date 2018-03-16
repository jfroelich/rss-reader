export function rewrite_url(url, rules) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL ' + url);
  }

  if (!Array.isArray(rules)) {
    throw new TypeError('rules is not an array' + rules);
  }

  if (!rules.length) {
    return url;
  }

  let prev = url;
  let next = url;
  for (const rule of rules) {
    prev = next;
    next = rule(prev) || prev;
  }

  return next;
}
