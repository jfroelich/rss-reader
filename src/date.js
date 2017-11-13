
// @throws {AssertionError}
export function formatDate(date, delimiter) {
  // Tolerate some forms bad input
  if(!date) {
    return '';
  }

  assert(date instanceof Date);
  const parts = [];
  // Add 1 because getMonth is a zero based index
  parts.push(date.getMonth() + 1);
  parts.push(date.getDate());
  parts.push(date.getFullYear());
  return parts.join(delimiter || '/');
}
