export function date_format(date) {
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
