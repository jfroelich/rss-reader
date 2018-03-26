export function date_format(date) {
  if (!(date instanceof Date)) {
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
