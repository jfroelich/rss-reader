export function escape_html(html) {
  const pattern = /[<>"'`]/g;
  if (typeof html === 'string') {
    return html.replace(pattern, encode_first_character);
  }
}

function encode_first_character(string) {
  return '&#' + string.charCodeAt(0) + ';';
}
