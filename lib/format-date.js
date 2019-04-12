// Return a date as a formatted string. This is an opinionated implementation
// that is intended to be very simple. This tries to recover from errors and
// not throw.
export default function formatDate(date) {
  if (!(date instanceof Date)) {
    return 'Invalid date';
  }

  // When using native date parsing and encountering an error, rather than
  // throw that error, a date object is created with a NaN time property.
  // Which would be ok but the format call below then throws if the time
  // property is NaN
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }

  // The try/catch is just paranoia for now. This previously threw when date
  // contained time NaN.
  const formatter = new Intl.DateTimeFormat();
  try {
    return formatter.format(date);
  } catch (error) {
    console.debug(error);
    return 'Invalid date';
  }
}
