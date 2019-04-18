// A simple mock implementation of a channel that just records locally sent messages
export default function RecordingChannel() {
  this.messages = [];
  this.name = 'recording-channel';
}

RecordingChannel.prototype.postMessage = function (message) {
  this.messages.push(message);
};

RecordingChannel.prototype.close = function () {
  // noop
};
