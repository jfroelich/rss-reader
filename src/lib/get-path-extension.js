export default function get_path_extension(path) {
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
  // Match any character that is not alphabetical or numerical, then return the
  // inverse. If at least one character is not alphanumeric, then the value is
  // not, otherwise it is. Note we make no assumptions about value type (e.g.
  // null/undefined/not-a-string) or validity (e.g. empty string), that is all
  // left to the caller.
  return !/[^\p{L}\d]/u.test(value);
}
