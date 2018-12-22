# mime-utils
This module provides helpers for interacting with purported mime-type values.

A mime-type is a specialized type of string. I chose to use strings as the representation so that there is no need to deal with allocation of an object. I do not think there is much benefit to adding in all that overhead. Most of the time passing around a string is fine.
