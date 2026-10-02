'use strict';
const assert = require('assert'), barometer = require('../barometer');
describe('Independent plugin input guards', () => {
    beforeEach(() => barometer.clear());
    it('ignores paths outside the legacy forecast subscription', () => {
        assert.deepStrictEqual(barometer.onDeltasUpdate({updates: [{values: [{path: 'environment.water.temperature', value: 288.15}]}]}), []);
    });
    it('throws a real Error for malformed deltas', () => {
        for (const value of [null, undefined, {}, {updates: null}]) assert.throws(() => barometer.onDeltasUpdate(value), Error);
    });
    it('rejects non-finite and invalid pressure values', () => {
        for (const value of [NaN, Infinity, -Infinity, null, '101500', 0, -1]) barometer.onDeltasUpdate({updates: [{values: [{path: 'environment.outside.pressure', value}]}]});
        assert.equal(barometer.getAll().length, 0);
    });
});
