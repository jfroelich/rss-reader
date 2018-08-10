// Some words appear adjacent to each other in the view, like the space
// separating them was somehow removed. My initial review suggests it involves
// removal of line break characters at some point in the processing of the
// entry. Either this happens when filtering, or maybe during entry
// sanitization. My first real guess is this is happening during entry
// sanitization, and is related to the changes made to string.js. At some point
// I deprecated filter-unprintable-characters and replaced it with
// filter-controls in the sanity code. filter-controls pays no attention to
// whitespace related characters, and so it is quite likely it is matching these
// \r\n characters and therefore filtering them, leading to adjacent words.

// TODO: first recreate the view here, with a test article where it happens.
// Next, test some of the relevant filters to see if they reproduce the error.
// Next, test the sanitize-entry function to see if it reproduces the error.
// Next, fix it
// Next, create a test for sanitize-entry that ensures that this doesn't happen,
// if that is indeed the bug.
