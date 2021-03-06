const candle = require("../candle");
const List = require("immutable").List;
const Map = require("immutable").Map;

const Promise = require('bluebird');
const _async = require('asyncawait/async');
const _await = require('asyncawait/await');

const log4js = require('log4js');
log4js.configure({
    appenders: {
        kraken: {
            type: 'dateFile',
            filename: "./logs/kraken.log",
            pattern: '.yyyy-MM-dd'
        }
    },
    categories: {
        default: {
            appenders: ["kraken"],
            level: 'ALL'
        }
    }
});
const logger = log4js.getLogger('kraken');

const CANDLE_PERIOD = 240;
const PERIOD_BUY_SELL = 6; //Last 6 candles not the last one included
const MARGIN = 0.005;

const TIMEOUT = 45000;
// const UNUSED_CURRENCY = ["ZEUR", "ZUSD", "KFEE", "XXRP", "XXLM"];
// const USED_CURRENCY = ["XXBT", "XXRP", "XLTC", "XXLM", "XETH", "XREP", "XZEC", "XXMR", "DASH", "GNO", "XETC", "EOS"];
const UNUSED_CURRENCY = ["ZEUR", "ZUSD", "KFEE", "XXRP", "XXLM", "XETH", "XXMR"];
const USED_CURRENCY = ["XXBT", "XLTC", "XREP", "XZEC", "DASH", "GNO", "XETC", "EOS"];
const NO_X_CURRENCY = ["DASH", "GNO", "EOS"];

module.exports = {
    run(kraken, INITIAL_CAPITAL, user) {
        const self = this;
        const asyncFunc = _async(() => {
            const balance = _await(new Promise((resolve, reject) => {
                self.getPersonalBalance(kraken, user, resolve, reject)
            }));
            const openOrders = _await(new Promise((resolve, reject) => {
                self.getOpenOrders(kraken, user, resolve, reject)
            }));

            if (balance) {
                USED_CURRENCY.map(function (currencyId, index) {
                    if (!(UNUSED_CURRENCY.indexOf(currencyId) > -1)) {
                        const pair = NO_X_CURRENCY.indexOf(currencyId) > -1 ? currencyId + "EUR" : currencyId + "ZEUR";
                        const orderPair = NO_X_CURRENCY.indexOf(currencyId) > -1 ? currencyId + "EUR" : currencyId.slice(1) + "EUR";
                        const pairData = _await(new Promise((resolve, reject) => {
                            self.getPairData(kraken, user, pair, resolve, reject)
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

                            if (balance.hasOwnProperty(currencyId) && balance[currencyId] == "0.0000000000" || !balance.hasOwnProperty(currencyId)) {
                                if (redOrGreen == "RED") {
                                    logger.info(user, "Dernière bougie rouge et je ne suis pas en position, je descend le SL BUY");
                                    if (openOrderIdsForPair.length) {
                                        // Delete old orders SL BUY
                                        self.cancelOrders(kraken, user, openOrderIdsForPair, orderPair);
                                    }

                                    const price = highest * (1 + MARGIN);
                                    const volume = (INITIAL_CAPITAL / price).toString();

                                    // New order SL BUY
                                    self.addOrders(kraken, user, orderPair, price, volume, "buy");
                                }
                                else {
                                    logger.info(user, "Pas en position sur " + pair + " et bougie verte, I'm out");
                                }
                            }
                            else {
                                const volume = balance[currencyId];
                                logger.info(user, "En position sur " + pair + " avec un volume de " + volume);

                                if (redOrGreen == "GREEN") {
                                    logger.info(user, "Dernière bougie verte et je suis en position, je monte le SL SELL");
                                    if (openOrderIdsForPair.length) {
                                        // Delete old order SL SELL
                                        self.cancelOrders(kraken, user, openOrderIdsForPair, orderPair);
                                    }

                                    const price = lowest * (1 - MARGIN);

                                    // New order SL SELL
                                    self.addOrders(kraken, user, orderPair, price, volume, "sell");
                                }
                                else {
                                    logger.info(user, "En position sur " + pair + " et bougie rouge, I'm out");
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
                logger.info(user, "Done", d);
            })
            .catch((e) => {
                logger.error(user, e);
            })
    },

    cancelOrders(client, user, openOrderIdsForPair, orderPair) {
        const self = this;
        logger.info(user, "Orders to be cancelled", openOrderIdsForPair);

        openOrderIdsForPair.forEach(id => {
            const cancelledOrder = _await(new Promise((resolve, reject) => {
                setTimeout(() => {
                    self.APICancelOrder(client, user, id, resolve, reject);
                }, TIMEOUT);
            }));

            if (cancelledOrder == "CANCELLED") {
                logger.info(user, id, "has been cancelled for", orderPair);
            } else {
                logger.warn(user, id, "has failed to cancel, retrying");
                let check = true;
                while (check) {
                    logger.info(user, "Getting open orders again");
                    const orders = _await(new Promise((resolve, reject) => {
                        setTimeout(() => {
                            self.getOpenOrders(client, user, resolve, reject)
                        }, TIMEOUT);
                    }));

                    if (orders.hasOwnProperty(id)) {
                        logger.info(user, "Retry cancelling again", id);
                        const cancelOrder = _await(new Promise((resolve, reject) => {
                            setTimeout(() => {
                                self.APICancelOrder(client, user, id, resolve, reject);
                            }, TIMEOUT);
                        }));

                        if (cancelOrder == "CANCELLED") {
                            check = false;
                            logger.info(user, id, "has been cancelled for", orderPair);
                        } else {
                            logger.error(user, id, "has failed to cancel, will retry", orderPair);
                        }
                    } else {
                        check = false;
                        logger.info(user, id, "has already been cancelled for", orderPair);
                    }
                }
            }
        });
    },

    addOrders(client, user, orderPair, price, volume, type) {
        const self = this;
        const addedOrder = _await(new Promise((resolve, reject) => {
            setTimeout(() => {
                self.APIAddOrder(client, user, orderPair, type, price, price, volume, resolve, reject);
            }, TIMEOUT);
        }));

        if (addedOrder == "MAYBE") {
            let check = true;
            while (check) {
                logger.info(user, "Getting open orders again");
                const orders = _await(new Promise((resolve, reject) => {
                    setTimeout(() => {
                        self.getOpenOrders(client, user, resolve, reject)
                    }, TIMEOUT);
                }));

                for (let orderId in orders) {
                    if (orders.hasOwnProperty(orderId) && orders[orderId]["descr"]["pair"] == orderPair) {
                        check = false;
                        logger.info(user, "Already exists", orders[orderId]["descr"]["order"], orderId);
                    }
                }

                if (check) {
                    const addedOrder = _await(new Promise((resolve, reject) => {
                        setTimeout(() => {
                            self.APIAddOrder(client, user, orderPair, type, price, price, volume, resolve, reject);
                        }, TIMEOUT);
                    }));

                    if (addedOrder == "MAYBE") {
                        logger.error(user, "Order may have failed to be added, will retry", orderPair);
                    } else {
                        check = false;
                        logger.info(user, "OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
                    }
                }
            }
        } else {
            logger.info(user, "OK", addedOrder["descr"]["order"], addedOrder["txid"][0]);
        }
    },

    getPersonalBalance(client, user, resolve, reject) {
        const self = this;
        logger.info(user, "Getting Balance");
        return client.api('Balance', null, (error, data) => {
            if (error) {
                logger.error(user, "Error while getting Balance");
                logger.error(user, error.toString());
                setTimeout(() => {
                    self.getPersonalBalance(client, user, resolve, reject);
                }, TIMEOUT);
            }
            if (data) {
                const results = data.result;
                if (results) {
                    logger.info(user, results);
                    resolve(results);
                }
            }
        });
    },

    APICancelOrder(client, user, txId, resolve, reject) {
        logger.info(user, "Cancelling order", txId);
        return client.api('CancelOrder', {"txid": txId}, function (error, data) {
            if (error) {
                logger.error(user, "Error while cancelling order", txId);
                logger.error(user, error.toString());
                resolve("KO");
            }
            if (data) {
                logger.info(user, "Order " + txId + " cancelled");
                resolve("CANCELLED");
            }
        });
    },

    APIAddOrder(client, user, pair, type, price1, price2, volume, resolve, reject) {
        logger.info(user, "Adding order");
        return client.api('AddOrder', {
            "pair": pair,
            "type": type,
            "ordertype": "stop-loss-limit",
            "price": price1,
            "price2": price2,
            "volume": volume
        }, function (error, data) {
            if (error) {
                logger.error(user, "Error while adding order for", pair, type, price1, price2, volume);
                logger.error(user, error.toString());
                resolve("MAYBE");
            }
            if (data) {
                resolve(data.result);
            }
        });
    },

    getPairData(client, user, pair, resolve, reject) {
        const self = this;
        logger.info(user, "Getting pair", pair);
        return client.api('OHLC', {"pair": pair, "interval": CANDLE_PERIOD}, function (error, data) {
            if (error) {
                logger.error(user, "Error while getting pair data for", pair);
                logger.error(user, error.toString());
                setTimeout(() => {
                    self.getPairData(client, user, pair, resolve, reject);
                }, TIMEOUT);
            }
            if (data) {
                const result = data.result;
                if (result) {
                    logger.info(user, "Got pair data for", pair);
                    resolve(result);
                }
            }
        });
    },

    /**
     * Retrieve open orders from API
     * @param client
     * @param resolve
     * @param reject
     * @returns data for open orders: Object with txid as keys
     */
    getOpenOrders(client, user, resolve, reject) {
        const self = this;
        logger.info(user, "Getting Open Orders");
        return client.api('OpenOrders', null, function (error, data) {
            if (error) {
                logger.error(user, "Error while getting open orders");
                logger.error(user, error.toString());
                setTimeout(() => {
                    self.getOpenOrders(client, user, resolve, reject);
                }, TIMEOUT);
            }
            if (data) {
                // logger.info(user, data["result"]["open"]);
                logger.info(user, "Got open orders");
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