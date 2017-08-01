const kraken = require("../config/secret").krakenRay;
const candle = require("../candle");
const List = require("immutable").List;
const Map = require("immutable").Map;

const Promise = require('bluebird');
const async = require('asyncawait/async');
const _await = require('asyncawait/await');

const CANDLE_PERIOD = 240;
const PERIOD_BUY_SELL = 6; //Last 6 candles not the last one included
const INITIAL_CAPITAL = 100;
const MARGIN = 0.005;
const UNUSED_CURRENCY = ["ZEUR", "ZUSD", "KFEE", "XXRP", "XXLM"];
const USED_CURRENCY = ["XXBT", "XXRP", "XLTC", "XXLM", "XETH", "XREP", "XZEC", "XXMR", "DASH", "GNO", "XETC", "EOS"];
const NO_X_CURRENCY = ["DASH", "GNO", "EOS"];

module.exports = {
    run() {
        const self = this;
        const asyncFunc = async(() => {
            const balance = _await(new Promise((resolve, reject) => {
                self.getPersonalBalance(kraken, resolve, reject)
            }));
            const openOrders = _await(new Promise((resolve, reject) => {
                self.getOpenOrders(kraken, resolve, reject)
            }));

            return [balance, openOrders];

            if (balance) {
                console.log(balance);
                USED_CURRENCY.map(function (currencyId, index) {
                    if (!(UNUSED_CURRENCY.indexOf(currencyId) > -1)) {
                        const pair = NO_X_CURRENCY.indexOf(currencyId) > -1 ? currencyId + "EUR" : currencyId + "ZEUR";
                        const orderPair = NO_X_CURRENCY.indexOf(currencyId) > -1 ? currencyId + "EUR" : currencyId.slice(1) + "EUR";
                        const pairData = _await(new Promise((resolve, reject) => {
                            self.getPairData(kraken, pair, resolve, reject)
                        }));

                        if (pairData) {
                            const lastCandle = self.getLastCandle(pairData, pair);
                            const highestLowest = self.getHighestAndLowestOfPeriod(pairData, pair, PERIOD_BUY_SELL);
                            const highest = highestLowest.get("highest");
                            const lowest = highestLowest.get("lowest");
                            let openOrderIdForPair = "";

                            if (openOrders) {
                                for (let orderId in openOrders) {
                                    if (openOrders.hasOwnProperty(orderId) && openOrders[orderId]["descr"]["pair"] == orderPair) {
                                        openOrderIdForPair = orderId;
                                    }
                                }
                            }

                            const redOrGreen = lastCandle.get("open") > lastCandle.get("close") ? "RED" : "GREEN";

                            if (balance.hasOwnProperty(currencyId) && balance[currencyId].substring(0, 2) == "0.") {
                                if (redOrGreen == "RED") {
                                    // console.log("RED", pair, lastCandle, highest, lowest);
                                    if (openOrderIdForPair) {
                                        // Delete old order SL BUY
                                        const openOrder = _await(new Promise((resolve, reject) => {
                                            self.cancelOrder(kraken, openOrderIdForPair, resolve, reject);
                                        }));

                                        if (openOrder == "OK") {
                                            console.log("Order " + openOrderIdForPair + " cancelled");
                                        }
                                    }

                                    const price = highest * (1 + MARGIN);
                                    const volume = (INITIAL_CAPITAL / price).toString();

                                    // New order SL BUY

                                    const addedOrder = _await(new Promise((resolve, reject) => {
                                        self.addOrder(kraken, orderPair, "buy", price, price, volume, resolve, reject);
                                    }));

                                    if (addedOrder) {
                                        // console.log("OK for " + orderPair + ", order added BUY " + addedOrder.txid);
                                        return Promise.resolve("OK for " + orderPair + ", order added BUY " + addedOrder.txid);
                                    }
                                }
                                else {
                                    console.log("Pas en position sur " + pair + " et bougie verte, I'm out");
                                }
                            }
                            else {
                                console.log("En position sur", pair);
                                if (redOrGreen == "GREEN") {
                                    // console.log("GREEN", pair, lastCandle, highest, lowest);
                                    if (openOrderIdForPair) {
                                        // Delete old order SL SELL
                                        const openOrder = _await(new Promise((resolve, reject) => {
                                            self.cancelOrder(kraken, openOrderIdForPair, resolve, reject);
                                        }));

                                        if (openOrder == "OK") {
                                            console.log("Order " + openOrderIdForPair + " cancelled");
                                        }
                                    }

                                    const price = lowest * (1 - MARGIN);
                                    const volume = (INITIAL_CAPITAL / price).toString();

                                    // New order SL SELL

                                    const addedOrder = _await(new Promise((resolve, reject) => {
                                        self.addOrder(kraken, orderPair, "sell", price, price, volume, resolve, reject);
                                    }));

                                    if (addedOrder) {
                                        // console.log("OK for " + orderPair + ", order added SELL " + addedOrder.txid);
                                        return Promise.resolve("OK for " + orderPair + ", order added SELL " + addedOrder.txid);
                                    }
                                }
                                else {
                                    console.log("En position sur " + pair + " et bougie rouge, I'm out");
                                }
                            }
                        }
                    }
                });
            }
        });

        asyncFunc()
            .then((d) => {
                console.log("Done", d);
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

    cancelOrder(client, txId, resolve, reject) {
        const self = this;
        console.log("Cancelling last order");
        return client.api('cancelOrder', {"txid": txId}, function (error, data) {
            if (error) {
                console.log("Error while cancelling last order", error);
                self.cancelOrder(client, txId, resolve, reject);
            }
            if (data) {
                resolve("OK");
            }
        });
    },

    addOrder(client, pair, type, price1, price2, volume, resolve, reject) {
        const self = this;
        console.log("Adding order");
        return client.api('AddOrder', {
            "pair": pair,
            "type": type,
            "ordertype": "stop-loss-limit",
            "price": price1,
            "price2": price2,
            "volume": volume
        }, function (error, data) {
            if (error) {
                console.log("Error while cancelling last order", error);
                self.addOrder(client, pair, type, price1, price2, volume, resolve, reject);
            }
            if (data) {
                resolve("OK");
            }
        });
    },

    getPairData(client, pair, resolve, reject) {
        const self = this;
        console.log("Getting pair", pair);
        return client.api('OHLC', {"pair": pair, "interval": CANDLE_PERIOD}, function (error, data) {
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

    getOpenOrders(client, resolve, reject) {
        const self = this;
        console.log("Getting Open Orders");
        return client.api('OpenOrders', null, function (error, data) {
            if (error) {
                console.log("Error while getting open orders", error);
                self.getOpenOrders(client, resolve, reject);
            }
            if (data) {
                resolve(data["result"]["open"]);
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
    },

    getHighestAndLowestOfPeriod(data, key, period) {
        const lst = List(data[key].map(x => {
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
        })).slice(-(period + 1)).slice(0, 6);

        const highest = lst.map(x => parseFloat(x.get("high"))).max().toString();
        const lowest = lst.map(x => parseFloat(x.get("low"))).min().toString();

        return Map({"highest": highest, "lowest": lowest});
    }
};