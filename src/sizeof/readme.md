The `sizeof` function calculates the approximate byte size of a value. This should only be used for informational purposes because it is hilariously inaccurate. Adapted from http://stackoverflow.com/questions/1248302.

The sizeof function generally does not work with built-ins, which are objects that are a part of the basic Javascript library, like Document, or Element. There are a few built-ins that are supported, such as URL.

This uses a stack internally to avoid recursion. I actually have not returned to benchmark whether the non-recursive implementation beats the recursive implementation.
