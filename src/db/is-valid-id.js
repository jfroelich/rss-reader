// Returns whether the given value represents a valid object identifier in the
// datbase
export default function is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}
