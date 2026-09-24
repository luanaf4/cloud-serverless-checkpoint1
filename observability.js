'use strict';
function createLogger({write = console.log} = {}) {
  const counters = new Map();
  function emit(severity, event, fields = {}) {
    const entry = {severity, event, timestamp: new Date().toISOString(), ...fields};
    if (fields.metricName) counters.set(fields.metricName, (counters.get(fields.metricName) ?? 0) + 1);
    write(JSON.stringify(entry)); return entry;
  }
  return {info: (event, fields) => emit('INFO', event, fields), warn: (event, fields) => emit('WARNING', event, fields), error: (event, fields) => emit('ERROR', event, fields), metrics: () => Object.fromEntries(counters)};
}
module.exports = {createLogger};
