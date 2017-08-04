const script = require("./scripts/shortTerm");
const schedule = require('node-schedule');
const schedule2 = require('node-schedule');
const krakenRay = require("./config/secret").krakenRay;
const krakenTom = require("./config/secret").krakenTom;

const rule = new schedule.RecurrenceRule();
rule.hour = [2, 6, 10, 14, 18, 22];
rule.minute = 1;

const rule2 = new schedule2.RecurrenceRule();
rule2.hour = [2, 6, 10, 14, 18, 22];
rule2.minute = 30;

// script.run(krakenRay, 200, "Ray");
// script.run(krakenTom, 200, "Tom");

const s = schedule.scheduleJob({ rule: rule }, function() {
    script.run(krakenRay, 200, "Ray");
});

const s2 = schedule2.scheduleJob({ rule: rule2 }, function() {
    script.run(krakenTom, 200, "Tom");
});