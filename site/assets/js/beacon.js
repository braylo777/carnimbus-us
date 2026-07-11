(function() {
  window.NimbusTelemetry = {
    log: function(action, data) {
      var ev = {
        action: action,
        ts: new Date().toISOString(),
        location: data && data.location || null,
        vehicle_id: data && data.vehicle_id || null,
        source: data && data.source || window.location.pathname
      };
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/events", JSON.stringify({ events: [ev] }));
      } else {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: [ev] })
        }).catch(function() {});
      }
    }
  };
})();
