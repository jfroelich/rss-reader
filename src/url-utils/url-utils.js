export function get_extension(url) {
  const path = url.pathname;

  if (path.length > 2) {
    const last_dot_pos_p1 = path.lastIndexOf('.') + 1;
    if (last_dot_pos_p1 > 0 && last_dot_pos_p1 < path.length) {
      const ext = path.substring(last_dot_pos_p1);
      if (ext.length < 5 && is_alphanumeric(ext)) {
        return ext;
      }
    }
  }
}

function is_alphanumeric(value) {
  return !/[^\p{L}\d]/u.test(value);
}
