// Return a date as a formatted string. This is an opinionated implementation
// that is intended to be very simple
// TODO: perhaps it is too simple and should exist in the app view and not as a
// general lib
export function format_date(date) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // Date objects created by new Date(string) or Date.parse produce a date
  // object with an invalid internal time property
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  const formatter = new Intl.DateTimeFormat();
  try {
    return formatter.format(date);
  } catch (error) {
    console.debug(error);
    return 'Invalid date';
  }
}
