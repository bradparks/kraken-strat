const expect = require('chai').expect;

const shortTermScript = require('./shortTerm');
const fixture = require("../tests/fixtures/etheur-4h.json");
const immutable = require("immutable");

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