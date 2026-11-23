// Visitor counting with GoatCounter (free, no cookies, no banner needed).
// Page visits are counted by the GoatCounter script in index.html.
// This file adds a few "events" so you can see which features people use.
// It never sends what people typed or where they are, only the event name.
// If GoatCounter isn't loaded (opened from your computer, or blocked), it quietly does nothing.
const Track = (() => {
  const sentOnce = new Set();
  function event(name) {
    try {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: name, title: name, event: true });
      }
    } catch (e) { /* counting must never break the app */ }
  }
  // Count something at most once per visit (e.g. "used Custom stay").
  function once(name) { if (!sentOnce.has(name)) { sentOnce.add(name); event(name); } }
  return { event, once };
})();
