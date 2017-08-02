const kraken = require("../config/secret").krakenRay;
const candle = require("../candle");
const List = require("immutable").List;
const Map = require("immutable").Map;

const Promise = require('bluebird');
const _async = require('asyncawait/async');
const _await = require('asyncawait/await');

const log4js = require('log4js');
log4js.configure({
    appenders: {kraken: {type: 'file', filename: 'kraken.log'}},
    categories: {default: {appenders: ['kraken'], level: 'ALL'}}
});
const logger = log4js.getLogger('kraken');

const CANDLE_PERIOD = 240;
const PERIOD_BUY_SELL = 6; //Last 6 candles not the last one included
const INITIAL_CAPITAL = 10;
const MARGIN = 0.005;

const TIMEOUT = 45000;
const NB_RETRIES = 5;
// const UNUSED_CURRENCY = ["ZEUR", "ZUSD", "KFEE", "XXRP", "XXLM"];
// const USED_CURRENCY = ["XXBT", "XXRP", "XLTC", "XXLM", "XETH", "XREP", "XZEC", "XXMR", "DASH", "GNO", "XETC", "EOS"];
const UNUSED_CURRENCY = ["ZEUR", "ZUSD", "KFEE", "XXRP", "XXLM", "XXBT", "XETH", "XXMR"];
const USED_CURRENCY = ["XLTC", "XREP", "XZEC", "DASH", "GNO", "XETC", "EOS"];
const NO_X_CURRENCY = ["DASH", "GNO", "EOS"];

module.exports = {
    run() {
        const self = this;
        const asyncFunc = _async(() => {
            const balance = _await(new Promise((resolve, reject) => {
                self.getPersonalBalance(kraken, resolve, reject)
            }));
            const openOrders = _await(new Promise((resolve, reject) => {
                self.getOpenOrders(kraken, resolve, reject)
            }));

            if (balance) {
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
                            let openOrderIdsForPair = [];

                            if (openOrders) {
                                for (let orderId in openOrders) {
                                    if (openOrders.hasOwnProperty(orderId) && openOrders[orderId]["descr"]["pair"] == orderPair) {
                                        openOrderIdsForPair.push(orderId);
                                    }
                                }
                            }

                            const redOrGreen = lastCandle.get("open") > lastCandle.get("close") ? "RED" : "GREEN";

                            if (balance.hasOwnProperty(currencyId) && balance[currencyId].substring(0, 2) == "0." || !balance.hasOwnProperty(currencyId)) {
                                if (redOrGreen == "RED") {
                                    logger.info("Dernière bougie rouge et je ne suis pas en position, je descend le SL BUY");
                                    if (openOrderIdsForPair.length) {
                                        // Delete old orders SL BUY
                                        openOrderIdsForPair.forEach(id => {
                                            const cancelOrder = _await(new Promise((resolve, reject) => {
                                                setTimeout(() => {
                                                    self.cancelOrder(kraken, id, resolve, reject, 0);
                                                }, TIMEOUT);
                                            }));

                                            if (cancelOrder == "OK") {
                                                logger.info(id, "has been cancelled");
                                            } else {
                                                logger.warn(id, "has probably been cancelled");
                                            }
                                        });
                                    }

                                    const price = highest * (1 + MARGIN);
                                    const volume = (INITIAL_CAPITAL / price).toString();

                                    // New order SL BUY
                                    const addedOrder = _await(new Promise((resolve, reject) => {
                                        setTimeout(() => {
                                            self.addOrder(kraken, orderPair, "buy", price, price, volume, resolve, reject);
                                        }, TIMEOUT);
                                    }));

                                    if (addedOrder == "MAYBE") {
                                        let check = true;
                                        while (check) {
                                            const orders = _await(new Promise((resolve, reject) => {
                                                self.getOpenOrders(kraken, resolve, reject)
                                            }));

                                            for (let orderId in orders) {
                                                if (orders.hasOwnProperty(orderId) && orders[orderId]["descr"]["pair"] == orderPair) {
                                                    check = false;
                                                }
                                            }
                                            if (check) {
                                                const addedOrder = _await(new Promise((resolve, reject) => {
                                                    setTimeout(() => {
                                                        self.addOrder(kraken, orderPair, "buy", price, price, volume, resolve, reject);
                                                    }, TIMEOUT);
                                                }));

                                                if (addedOrder !== "MAYBE") {
                                                    check = true;
                                                    logger.info("OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
                                                }
                                            }
                                        }
                                    } else {
                                        logger.info("OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
                                    }
                                }
                                else {
                                    logger.info("Pas en position sur " + pair + " et bougie verte, I'm out");
                                }
                            }
                            else {
                                const volume = balance[currencyId];
                                logger.info("En position sur" + pair + " avec un volume de " + volume);

                                if (redOrGreen == "GREEN") {
                                    logger.info("Dernière bougie verte et je suis en position, je monte le SL SELL");
                                    if (openOrderIdsForPair.length) {
                                        // Delete old order SL BUY
                                        openOrderIdsForPair.forEach(id => {
                                            const cancelledOrder = _await(new Promise((resolve, reject) => {
                                                setTimeout(() => {
                                                    self.cancelOrder(kraken, id, resolve, reject, 0);
                                                }, TIMEOUT);
                                            }));

                                            if (cancelledOrder == "OK") {
                                                logger.info(id, "has been cancelled");
                                            } else {
                                                logger.warn(id, "has probably been cancelled");
                                            }
                                        });

                                    }

                                    const price = lowest * (1 - MARGIN);

                                    // New order SL SELL
                                    const addedOrder = _await(new Promise((resolve, reject) => {
                                        setTimeout(() => {
                                            self.addOrder(kraken, orderPair, "sell", price, price, volume, resolve, reject);
                                        }, TIMEOUT);
                                    }));

                                    if (addedOrder == "MAYBE") {
                                        let check = true;
                                        while (check) {
                                            const orders = _await(new Promise((resolve, reject) => {
                                                self.getOpenOrders(kraken, resolve, reject)
                                            }));

                                            for (let orderId in orders) {
                                                if (orders.hasOwnProperty(orderId) && orders[orderId]["descr"]["pair"] == orderPair) {
                                                    check = false;
                                                }
                                            }
                                            if (check) {
                                                const addedOrder = _await(new Promise((resolve, reject) => {
                                                    setTimeout(() => {
                                                        self.addOrder(kraken, orderPair, "sell", price, price, volume, resolve, reject);
                                                    }, TIMEOUT);
                                                }));

                                                if (addedOrder !== "MAYBE") {
                                                    check = true;
                                                    logger.info("OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
                                                }
                                            }
                                        }
                                    } else {
                                        logger.info("OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
                                    }
                                }
                                else {
                                    logger.info("En position sur " + pair + " et bougie rouge, I'm out");
                                }
                            }
                        }
                    }
                });

                return Promise.resolve("OK");
            }
        });

        asyncFunc()
            .then((d) => {
                logger.info("Done", d);
            })
            .catch((e) => {
                logger.error(e);
            })
    },

    getPersonalBalance(client, resolve, reject) {
        const self = this;
        logger.info("Getting Balance");
        return client.api('Balance', null, (error, data) => {
            if (error) {
                logger.error("Error while getting Balance", error);
                self.getPersonalBalance(client, resolve, reject);
            }
            if (data) {
                const results = data.result;
                if (results) {
                    logger.info(results);
                    resolve(results);
                }
            }
        });
    },

    cancelOrder(client, txId, resolve, reject, cnt) {
        const self = this;
        logger.info("Cancelling order", txId);
        return client.api('CancelOrder', {"txid": txId}, function (error, data) {
            if (error) {
                logger.error("Error while cancelling order", txId);
                logger.error(error.toString());
                if (!(error.toString().includes("Unknown order:")) && cnt <= NB_RETRIES) {
                    setTimeout(() => {
                        logger.info("Trying to rerun cancellation of", txId, "retry #", cnt);
                        self.cancelOrder(client, txId, resolve, reject, cnt + 1);
                    }, TIMEOUT);
                } else {
                    resolve("PROBABLY");
                }
            }
            if (data) {
                logger.info("Order " + txId + " cancelled");
                resolve("OK");
            }
        });
    },

    addOrder(client, pair, type, price1, price2, volume, resolve, reject) {
        const self = this;
        logger.info("Adding order");
        return client.api('AddOrder', {
            "pair": pair,
            "type": type,
            "ordertype": "stop-loss-limit",
            "price": price1,
            "price2": price2,
            "volume": volume
        }, function (error, data) {
            if (error) {
                logger.error("Error while adding order for", pair, type, price1, price2, volume);
                logger.error(error.toString());
                if (!(error.toString().includes("ESOCKETTIMEDOUT"))) {
                    setTimeout(() => {
                        logger.info("Trying to re-add order for ", pair, type, price1, price2, volume);
                        self.addOrder(client, pair, type, price1, price2, volume, resolve, reject);
                    }, TIMEOUT);
                } else {
                    resolve("MAYBE");
                }
            }
            if (data) {
                resolve(data.result);
            }
        });
    },

    getPairData(client, pair, resolve, reject) {
        const self = this;
        logger.info("Getting pair", pair);
        return client.api('OHLC', {"pair": pair, "interval": CANDLE_PERIOD}, function (error, data) {
            if (error) {
                setTimeout(() => {
                    logger.error("Error while getting pair data for", pair, error);
                    self.getPairData(client, pair, resolve, reject);
                }, TIMEOUT);
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
        logger.info("Getting Open Orders");
        return client.api('OpenOrders', null, function (error, data) {
            if (error) {
                setTimeout(() => {
                    logger.error("Error while getting open orders", error);
                    self.getOpenOrders(client, resolve, reject);
                }, TIMEOUT);
            }
            if (data) {
                logger.info(data["result"]["open"]);
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