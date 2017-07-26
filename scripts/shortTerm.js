const kraken = require("../config/secret").krakenRay;
const candle = require("../candle");
const List = require("immutable").List;

const Promise = require('bluebird');
const async = require('asyncawait/async');
const await = require('asyncawait/await');

module.exports = {
    run() {
        const self = this;
        const asyncFunc = async(() => {
            const balance = await(new Promise((resolve, reject) => {
                    self.getPersonalBalance(kraken, resolve, reject)
                })
            );
            if (balance) {
                console.log(balance);
                Object.keys(balance).map(function (currencyId, index) {
                    if (!(["ZEUR", "ZUSD", "KFEE"].indexOf(currencyId) > -1)) {
                        const pair = currencyId + "ZEUR";
                        const pairData = await(new Promise((resolve, reject) => {
                            self.getPairData(kraken, pair, resolve, reject)
                        }));

                        if (pairData) {
                            return self.getLastCandle(pairData, pair);
                        }
                    }
                });
            }
        });

        asyncFunc()
            .then((d) => {
                console.log(d);
            })
            .catch((e) => {
                console.log(e);
            })
    },

    getPersonalBalance(client, resolve, reject) {
        const self = this;
        console.log("Getting Balance");
        return client.api('Balance', null, (error, data) => {
            if (error) {
                console.error("Error while getting Balance", error);
                self.getPersonalBalance(client, resolve, reject);
            }
            if (data) {
                const results = data.result;
                if (results) {
                    resolve(results);
                }
            }
        });
    },

    getPairData(client, pair, resolve, reject) {
        const self = this;
        console.log("Getting pair", pair);
        return client.api('OHLC', {"pair": pair, "interval": 240}, function (error, data) {
            if (error) {
                console.log("Error while getting pair data for", pair, error);
                self.getPairData(client, pair, resolve, reject);
            }
            if (data) {
                const result = data.result;
                if (result) {
                    resolve(result);
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