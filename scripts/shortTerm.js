const kraken = require("../config/secret").krakenRay;
const candle = require("../candle");
const List = require("immutable").List;

module.exports = {
    run() {
        this.getPersonalBalance(kraken);
    },

    getPersonalBalance(client) {
        console.log("Getting Balance");
        return client.api('Balance', null, (error, data) => {
            if (error) {
                console.error("Error while getting Balance", error);
                this.getPersonalBalance();
            }
            if (data) {
                console.log(data);
                const results = data.result;
                if (results) {
                    Object.keys(results).map(function (currencyId, index) {
                        if(!(["ZEUR", "ZUSD", "KFEE"].indexOf(currencyId) > -1)) {
                            if(results[currencyId].substring(0, 2) !== "0.") { //en position
                                console.log(currencyId, "en position");
                                this.getPairData(currencyId + "XEUR")
                            } else { //pas en position
                                console.log(currencyId, "pas en position");
                            }
                        }
                    });
                }
            }
        });
    },

    getPairData(pair) {
        kraken.api('OHLC', {"pair": pair, "interval": 240}, function (error, data) {
            if (error) {
                console.log(error);
                this.getPairData(pair);
            }
            if(data) {
                const result = data.result;
                const out = this.getLastCandle(result, PAIRS[pair]);
                console.log(out);
            }
            else {
                console.log(pair, "not found")
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