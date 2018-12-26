# color

## todos
TODO: I think I figured out the confusion. color is an ARGB format. I was
mixing together documents on blending RGB and ARGB. amount applies to RGB,
not to ARGB. In the ARGB case we have the alpha channel already. I think.
The confusion is still that the bottom layer has an alpha of its own, so
if I just use the top layer alpha applied to other channels what does that
mean? Also, there is the confusion surrounding premultiplied. My understanding
is premultiplied basically means that the alpha coeffecient is applied to
the other channels, in which case alpha is not needed, this is like RGB.
In non premultipled the alpha is separate and the other channel values do
not consider it, but, interpolation does consider it.
