
// TODO: meh, this is over-engineering. Just remember the caveat by convention. I think in
// this case it is sufficiently idiomatic

// Wraps a call to parseInt with a base 10 parameter. General guidance is that parseInt should
// always be called with its radix parameter to avoid surprising results. For example, if no radix
// is specified, then '010' is parsed as octal instead of decimal. Rather than remember this
// everytime parseInt is used, the goal is to always use this abstraction instead, so that it is
// absurdly explicit and surprise is minimized.

// TODO: maybe assert string?

export default function parseInt10(value) {
  const BASE_10_RADIX = 10;
  return parseInt(value, BASE_10_RADIX);
}
