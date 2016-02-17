console.log('script,detector loaded')

window.onbeforeunload = function() {
  console.log('script,onbeforeunload')
  self.port.emit('unloaded', document.location);
};

window.addEventListener('load', function() {
  console.log('script,load')
});
window.addEventListener('pageshow', function() {
  console.log('script,pageshow', document.URL)
});
window.addEventListener('DOMContentLoaded', function() {
  console.log('script,DCL', document.URL)
});
