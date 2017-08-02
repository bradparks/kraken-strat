const script = require("./scripts/shortTerm");
const schedule = require('node-schedule');

const rule = new schedule.RecurrenceRule();
rule.hour = [2, 6, 10, 14, 18, 22];
rule.minute = 1;

script.run();
// const s = schedule.scheduleJob({ rule: rule }, function() {
//     console.log(new Date());
//     script.run();
// });