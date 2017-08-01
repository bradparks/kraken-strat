const script = require("./scripts/shortTerm");
const schedule = require('node-schedule');

const startTime = new Date();
startTime.setHours(2, 0, 0, 0);

const rule = new schedule.RecurrenceRule();
rule.hour = [2, 6, 10, 14, 18, 22];
rule.minute = 1;

console.log(new Date());
const s = schedule.scheduleJob({ start: startTime, rule: rule }, function() {
    script.run();
});