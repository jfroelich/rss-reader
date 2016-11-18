// See license.md

'use strict';

// A drop in replacement for the global console variable
class SilentConsole {
  static debug() {}
  static log() {}
  static error() {}
  static warn() {}
  static group() {}
  static dir() {}
  static table() {}
}
