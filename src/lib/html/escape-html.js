// Returns a new string where certain 'unsafe' characters in the input string
// have been replaced with html entities. If input is not a string returns
// undefined.
//
// See https://stackoverflow.com/questions/784586
export function escape_html(html_string) {
  // TEMP: not replacing & due to common double encoding issue
  const escape_html_pattern = /[<>"'`]/g;
  if (typeof html_string === 'string') {
    return html_string.replace(escape_html_pattern, html_encode_first_char);
  }

  // otherwise return undefined
}

// Returns the first character of the input string as an numeric html entity
function html_encode_first_char(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
