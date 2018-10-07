// TEMP: not replacing & due to common double encoding issue, this needs to be
// fixed

// Returns a new string where certain 'unsafe' characters in the input string
// have been replaced with html entities. If input is not a string returns
// undefined. See https://stackoverflow.com/questions/784586.
export function escape_html(html_string) {
  const escape_html_pattern = /[<>"'`]/g;
  if (typeof html_string === 'string') {
    return html_string.replace(escape_html_pattern, encode_first_character);
  }
}

// Returns the first character of the input string as an numeric html entity
function encode_first_character(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
