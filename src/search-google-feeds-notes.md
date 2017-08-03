
# TODO

* Based on errors in the console Chrome may implicitly be treating
204 as a network error, based on seeing "no content errors" that occur
sometimes when doing fetch. There may not be a need to explicitly check for
this error code. I would need to test further.
