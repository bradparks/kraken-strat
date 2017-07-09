const immutable = require("immutable");

const candle = immutable.Record({
    time: 0,
    open: "",
    high: "",
    low: "",
    close: "",
    vwap: "",
    volume: "",
    count: 0,
});

module.exports = candle;
