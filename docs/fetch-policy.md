TODO: this should not be a parameter to better-fetch. Instead, better-fetch should
be a generic fetch library, and then I have an app-specific wrapper fetch
library that wraps the generic library, and within this wrapper, I introduce
the app's fetch policy concerns. So this entire approach so far was wrong,
because it makes it difficult to pluck out app specific crap from a generic
lib, and better-fetch should ideally be a generic library that just adds a few more
features to native fetch.
