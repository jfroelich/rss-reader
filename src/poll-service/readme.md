
# Feed background updating

Checks for new content

# TODO: rename poll feed context properties to use underscore convention

Left over from prior style, did not change. Did not change because it is more complicated because several callers in several places directly set props.

# TODO: poll service should not manage channel lifetime (or database lifetime)

Consider moving all lifetime management to caller. The opening of the channel in the init helper is the source of an object leak in slideshow context, where this channel is created then replaced and left open. It has no listener, but it is still heavyweight and and well, just incorrect.

Basically, the init helper shouldn't exist. This all has to be done by the caller, because the caller manages the lifetime.

Similar issues with the close helper. Always closing channel is impedance mismatch with persistent channels used by calling contexts, rendering callers unable to easily call this function. Consider removing the close call here, or moving all channel lifetime management concerns to caller. This was the source of a bug in polling from slideshow, where polling closed the slideshow's persistent channel when it should not have.


# TODO: poll service should somehow not depend on badge

This should not be dependent on something in the view, it should be the other way around

# TODO: consider changing feed_poll to accept feed_id instead of feed object

To enforce that the feed parameter is a feed object loaded from the database, it is possible that poll_service_feed_poll would be better implemented if it instead accepted a feedId as a parameter rather than an in-mem feed. That would guarantee the feed it works with is more trusted regarding the locally loaded issue.
