// TODO: so this could obviously be much improved this is just very first horrible draft.
// TODO: write the regex so as to properly exclude quotes instead of doing a second pass
// TODO: minimally validate the url before output, e.g. do not produce obviously invalid urls like
// a value containing an intermediate space, or trailing space, or invalid characters
// TODO: match multiple urls
// TODO: maybe revise as something like parseCSSBackgroundImagePropertyValue, maybe at least rename
// it to something similar


// The parse function expects as input a string representing the raw value of a css property, such
// as the property value in the following CSS property expression:
// background-image: url("http://www.example.com"). This looks for what is in those parens, less
// quotes, and returns that string.
//
// Currently ignores multiple urls. Does no validation of quotes. Does no validation of the url.
export default function parse(cssText) {
  const pattern = /url\(\s*([^\s)]+)\s*\)/ig;
  const matches = pattern.exec(cssText);

  // match 0 is the full match. match 1 is the first subgroup.

  if (matches && matches.length > 1) {
    let result = matches[1];

    // HACK: rather than think about how to write the regex to exclude quotes this just strips
    // them in a second pass. Also note, this strips them from anywhere, as in, including middle
    // ones.
    result = result.replace(/["']/g, '');

    return result;
  }

  return undefined;
}
