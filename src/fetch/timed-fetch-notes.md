TODO: I am repeatedly using the same fetch timeout code all throughout the
app. Write a helper function here that decorates fetch and provides fetches
that can timeout. Then update all callers to use this instead of repeating
the same pattern everywhere. This also provides a small buffer against
changes in the fetch api. The cost is everything depends on this. But I
suppose that in this case the dependency is reasonable.

NOTE: this is not currently in use, nor tested

do not forget about feed discovery - that could defer to this as well
