import assert from '/src/lib/assert.js';
import is_iterable from '/src/lib/is-iterable.js';

export default function is_iterable_test() {
  assert(is_iterable([]));
  assert(is_iterable(''));

  const domlist = document.querySelectorAll('p');
  assert(is_iterable(domlist));

  assert(!is_iterable(null));
  assert(!is_iterable(0));
  assert(!is_iterable(false));
  assert(!is_iterable(new Date()));
}
