export default function filterEmptyProperties(value) {
  // const { hasOwnProperty } = Object.prototype;

  if (!value) {
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    const pv = value[key];
    if (pv === null || pv === '' || pv === undefined) {
      delete value[key];
    }
  }
}
