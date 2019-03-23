// Find and return the extension in a path. |max_extension_length| is optional
// integer that defaults to 10. Return undefined if unable to find extension,
// the found extension is too long, or the found extension is not alphanumeric.
// Undefined behavior for invalid input.
export default function get_path_extension(path, max_extension_length = 10) {
  // All (valid) paths start with a /. The shortest valid path that has an
  // extension is "/.a", which is 3 characters. Therefore, bail if too short.
  // It is better to explicitly check here then start doing character searches.
  //
  // This also implicitly bails on empty string case. It is important to bail on
  // the empty string case to deal with lastIndexOf returning its second
  // argument when the first is empty. Although, this is not an issue at the
  // moment given the filename workaround.
  if (path.length < 3) {
    return;
  }

  // We want to find the last position of the period only after the last slash,
  // to avoid matching periods preceding slashes, so we start by finding the
  // last slash. Start from the beginning of the string because the leading
  // slash may be the only slash.
  const slash_index = path.lastIndexOf('/');

  // All valid paths begin with a slash, but we do not know if the path is
  // valid, so we might not see a slash, which we tolerate rather than treat
  // as programmer error.
  if (slash_index < 0) {
    return;
  }

  const filename = path.substring(slash_index + 1);
  const dot_index = filename.lastIndexOf('.');

  if (dot_index < 0) {
    return;
  }

  // Before grabbing the extension string, calculate its length, the -1 is to
  // account for the period itself.
  const extension_length = filename.length - dot_index - 1;

  // When the filename ends with a period, the extension length is 0. Avoid
  // treating this as a found extension.
  if (!extension_length) {
    return;
  }

  // bail if extension has too many characters, do this before the substring
  // call below to avoid it.
  if (extension_length > max_extension_length) {
    return;
  }

  // The +1 excludes the period
  const extension = filename.substring(dot_index + 1);

  if (is_alphanumeric(extension)) {
    return extension;
  }
}

function is_alphanumeric(value) {
  // Check for the presence of any character that is not alphabetical or
  // numerical, then return the inverse. If at least one character is not
  // alphanumeric, then the value is not, otherwise it is. Note we make no
  // assumptions about value type (e.g. null/undefined/not-a-string) or validity
  // (e.g. empty string), that is all left to the caller.
  return !/[^\p{L}\d]/u.test(value);
}
