const kraken = require("../config/secret").krakenRay;
const candle = require("../candle");
const List = require("immutable").List;
const Map = require("immutable").Map;
const PAIRS = Map({
    "ETHEUR": "XETHZEUR",
    "LTCEUR": "XLTCZEUR"
});

module.exports = {
    run() {
        this.getPersonalBalance();
    },

    getPersonalBalance() {
        console.log("Getting Balance");
        return kraken.api('Balance', null, (error, data) => {
            if (error) {
                console.error("Error while getting Balance", error);
                this.getPersonalBalance();
            }
            if (data) {
                // const results = data.result;
                // if (results && results.open) {
                //     Object.keys(results.open).map(function (txid, index) {
                //         console.log(txid, results.open[txid]["descr"]);
                //         const descr = results.open[txid]["descr"];
                //         const openPair = descr["pair"];
                //         const type = descr["type"];
                //
                //         PAIRS.forEach((OHLCPair, pair) => {
                //             if(openPair == pair) {
                //                 this.getPairData(pair, type);
                //             }
                //         });
                //     });
                // }
            }
        });
    },

    getPairData(pair, type) {
        kraken.api('OHLC', {"pair": pair, "interval": 240}, function (error, data) {
            if (error) {
                console.log(error);
                this.getPairData(pair);
            }
            else {
                const result = data.result;
                const out = this.getLastCandle(result, PAIRS[pair]);
                // const isGreenOrRed =
                if(type == "sell") {
                    console.log(type, out);
                } else {
                    console.log(type, out);
                }
            }
        });
    },

    getLastCandle(data, key) {
        return List(data[key].map(x => {
            let candleResult = candle();
            candleResult = candleResult.set("time", x[0]);
            candleResult = candleResult.set("open", x[1]);
            candleResult = candleResult.set("high", x[2]);
            candleResult = candleResult.set("low", x[3]);
            candleResult = candleResult.set("close", x[4]);
            candleResult = candleResult.set("vwap", x[5]);
            candleResult = candleResult.set("volume", x[6]);
            candleResult = candleResult.set("count", x[7]);
            return candleResult;
        })).filter(x => x.get("time") == data["last"]).first();
    }
};