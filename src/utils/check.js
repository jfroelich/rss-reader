import sprintf from "/src/utils/sprintf.js";

// The check function works similar to assert, but throws a checked error as opposed to an assertion
// error. assert is intended to be used only for "this should never happen situations" that
// represent unexpected, static (unchanging), permanent (not ephemeral) programming errors based on
// very faulty assumptions. Checked errors represent errors that happen in expected, typical
// situations, such as receiving bad input, or something temporarily not being available.

export default function check(condition, errorConstructor, ...varargs) {
  if(condition) {
    return;
  }

  errorConstructor = errorConstructor || Error;
  const message = sprintf(...varargs) || 'Unknown error';
  const error = new errorConstructor(message);
  //console.error(error);
  throw error;
}
