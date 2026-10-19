/* Shared with tests: never draw across missing observations. */
(function(root) {
  function segments(records, gapMs) {
    const result = [];
    for (const p of records) {
      const last = result.at(-1);
      if (!last || p.time - last.at(-1).time > gapMs || p.source !== last.at(-1).source) result.push([p]);
      else last.push(p);
    }
    return result;
  }
  if (typeof module !== 'undefined') module.exports = { segments };
  else root.pressureSegments = segments;
})(typeof window !== 'undefined' ? window : globalThis);
