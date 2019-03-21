export function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

export function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

// An assertion-like utility for throwing validation errors
export function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
