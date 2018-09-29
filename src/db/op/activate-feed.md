TODO: inline activate_feed_internal
TODO: in hindsight, i think this should be decoupled from update_feed even
though it requires more code and repetition. I feel like the nested
transition function is wonky. i like the idea of having ops be separate. but
i am on the fence right now, and focused more on moving back to separate ops.
TODO: use more specific error types, because js requires errors be part of
control flow logic and the caller may want to differentiate between kinds of
database errors. For example, an 'already-active' or 'invalid-state' error
is quite different than the database being unreadable or the channel being
in a closed state.
TODO: make a markdown document for documentation
TODO: this broadcasts two messages, is that what i want?
TODO: make channel non-optional again? require a stub?
