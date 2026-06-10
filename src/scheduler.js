const cron = require('node-cron');

let task = null;

function start(scanFn, intervalMinutes = 30) {
  const expr = `*/${intervalMinutes} * * * *`;
  task = cron.schedule(expr, scanFn, { scheduled: true });
  console.log(`[scheduler] Scanning every ${intervalMinutes} minutes (${expr})`);
}

function stop() {
  if (task) { task.destroy(); task = null; }
}

module.exports = { start, stop };
