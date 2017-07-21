const expect = require('chai').expect;
const assert = require('chai').assert;

const shortTermScript = require('./shortTerm');
const fixture = require("../tests/fixtures/etheur-4h.json");
const balance = require("../tests/fixtures/balance.json");
const immutable = require("immutable");
const nock = require('nock');
const sinon = require("sinon");
const KrakenClient = require('kraken-api');
const client = new KrakenClient("api", "key");

describe('getLastCandle', function () {
    it('retrieves last candle', function () {
        const result = shortTermScript.getLastCandle(fixture, "XETHZEUR");
        expect(result.get("time")).to.eql(1499525400);
        expect(result.get("open")).to.eql("216.66287");
        expect(result.get("high")).to.eql("216.66287");
        expect(result.get("low")).to.eql("216.50000");
        expect(result.get("close")).to.eql("216.50000");
        expect(result.get("vwap")).to.eql("216.59852");
        expect(result.get("volume")).to.eql("58.19335474");
        expect(result.get("count")).to.eql(19);
    })
});

describe('getPersonalBalance', function () {
    after(function(){
        client.api.restore();
    });

    it('should call getPairData based on pair and color', function () {
        const callback = sinon.stub();
        callback.returns(balance);
        const stub = sinon.stub(client, 'api').withArgs("Balance", null, callback);

        shortTermScript.getPersonalBalance(client);

        assert(callback.called);
        assert(stub.called);
    })
});