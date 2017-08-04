const script = require("./scripts/shortTerm");
const schedule = require('node-schedule');
const krakenRay = require("./config/secret").krakenRay;
const krakenTom = require("./config/secret").krakenTom;

const rule = new schedule.RecurrenceRule();
rule.hour = [2, 6, 10, 14, 18, 22];
rule.minute = 1;

// script.run(krakenRay);

const s = schedule.scheduleJob({ rule: rule }, function() {
    script.run(krakenRay);
    // script.run(krakenTom);
});