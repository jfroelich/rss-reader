
export const console_stub = {
  log: noop,
  warn: noop,
  debug: noop,
  info: noop,
  error: noop,
  trace: noop,
  dir: noop,
  group: noop,
  groupEnd: noop,
  time: noop,
  timeEnd: noop,
  assert: noop,
  assertEnd: noop
};

function noop() {}
