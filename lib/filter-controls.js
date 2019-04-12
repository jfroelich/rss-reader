export default function filterControls(value) {
  return value.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
