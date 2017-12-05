
// NOTE: the + is used on the assumption it will cause fewer replacements to occur, even though it
// is admittedly superfluous given the greedy modifer. For all I know thie regex lib does
// some intelligent rewriting and recognizes the overlap.

// NOTE: the pattern is defined, superficially, per call, but I assume the interpreter is smart
// enough to hoist it out of the function. I'd like to eventually test this.

// NOTE: at the moment this is only in use by a single module, maybe I should just move the
// function to its sole calling context.

export default function filterWhitespace(string) {
  return string.replace(/\s+/g, '');
}
