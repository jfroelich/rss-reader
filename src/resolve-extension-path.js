// TODO: consider returning a URL object
export function resolve_extension_path(path) {
  return chrome.extension.getURL(path);
}
