/* Linux JS signals — zero-dependency reactive state.
   No React hooks, no virtual DOM: a signal holds a value; effects that read it
   re-run when it changes; the change directly notifies subscribers and patches
   only the DOM those effects touch — the Linux JS state model. */
(function (g) {
  var CURRENT = null;
  function signal(value) {
    var subs = new Set();
    function s(next) {
      if (arguments.length) { if (next !== value) { value = next; subs.forEach(function (f) { f(); }); } return next; }
      if (CURRENT) subs.add(CURRENT);
      return value;
    }
    s.peek = function () { return value; };
    return s;
  }
  function effect(fn) {
    function run() { var prev = CURRENT; CURRENT = run; try { fn(); } finally { CURRENT = prev; } }
    run(); return run;
  }
  function computed(fn) { var out = signal(undefined); effect(function () { out(fn()); }); return function () { return out(); }; }
  g.signal = signal; g.effect = effect; g.computed = computed;
})(window);
