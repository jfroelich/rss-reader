
export const NAME = 'favicon-cache';
export const VERSION = 3;
export const OPEN_TIMEOUT = 500;

export const MAX_AGE = 1000 * 60 * 60 * 24 * 30;
export const MAX_FAILURE_COUNT = 2;
export const SKIP_FETCH = false;
export const FETCH_HTML_TIMEOUT = 5000;
export const FETCH_IMAGE_TIMEOUT = 1000;
export const MIN_IMAGE_SIZE = 50;
export const MAX_IMAGE_SIZE = 10240;

function noop() {}
export const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
