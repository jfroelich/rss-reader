// HTML escape utility function

// See https://stackoverflow.com/questions/784586 for reference
// TEMP: not replacing & due to common double encoding issue

const HTML_PATTERN = /[<>"']/g;

// Returns a new string where certain 'unsafe' characters in the input string have been replaced
// with html entities. If input is not a string returns undefined.
export default function escapeHTML(htmlString) {
  if(typeof htmlString === 'string') {
    return htmlString.replace(HTML_PATTERN, encodeFirst);
  }
}

// Returns the first character of the input string as an numeric html entity
function encodeFirst(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
