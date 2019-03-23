// Find and return the extension in a path. |max_extension_length| is optional
// integer that defaults to 10. Return undefined if unable to find extension or
// found extension is too long or not alphanumeric. Undefined behavior for
// invalid input.
export default function get_path_extension(path, max_extension_length = 10) {
  // all (valid) paths start with a /. the shortest valid path that has an
  // extension is "/.a", which is 3 characters. therefore, bail if too short.
  // better to explicitly check here then start doing character searches.
  //
  // this also implicitly bails on empty string case. note it is also important
  // to bail on the empty string case to deal with lastIndexOf returning its
  // second argument when the first is empty, which is undesired. although
  // note that this issue is not currently encountered given the filename
  // workaround
  if (path.length < 3) {
    return;
  }

  // we do not skip the leading slash as tempting as that is, we start from
  // the entire string, the leading may be the only slash in the string
  const slash_index = path.lastIndexOf('/');

  // so, we should not have to do this test if we have a valid path, because
  // all paths start with a leading slash, however we do not know we have a
  // valid path, and still have to avoid unexpected behavior. ideally this
  // represents programmer error but this might be user-input and i'd rather
  // not have the caller worry.
  if (slash_index < 0) {
    return;
  }

  // I ran into unexplainable behavior with using fromIndex parameter as
  // documented on MDB, such as '/b.html'.lastIndexOf('.', 1). To work around
  // this, get the substring and work with the substring from here on
  const filename = path.substring(slash_index + 1);

  const dot_index = filename.lastIndexOf('.');

  // bail when no dot found
  if (dot_index < 0) {
    return;
  }

  // before actually grabbing the string, calculate its length, the -1 is to
  // account for the period itself.
  const extension_length = filename.length - dot_index - 1;

  // bail when final path character is a dot. do this before the substring
  // call below to avoid it.
  if (!extension_length) {
    return;
  }

  // bail if extension has too many characters, do this before the substring
  // call below to avoid it.
  if (extension_length > max_extension_length) {
    return;
  }

  // Get the extension, excluding its leading "." character
  const extension = filename.substring(dot_index + 1);
  if (is_alphanumeric(extension)) {
    return extension;
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
