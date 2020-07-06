"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sinon_1 = require("sinon");
const tools_1 = require("./tools");
// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods = {};
/**
 * Creates an adapter mock that is connected to a given database mock
 */
function createLoggerMock() {
    const ret = {
        info: sinon_1.stub(),
        warn: sinon_1.stub(),
        error: sinon_1.stub(),
        debug: sinon_1.stub(),
        silly: sinon_1.stub(),
        level: "info",
        // Mock-specific methods
        resetMockHistory() {
            // reset Logger
            tools_1.doResetHistory(ret);
        },
        resetMockBehavior() {
            // reset Logger
            tools_1.doResetBehavior(ret, implementedMethods);
        },
        resetMock() {
            ret.resetMockHistory();
            ret.resetMockBehavior();
        },
    };
    tools_1.stubAndPromisifyImplementedMethods(ret, implementedMethods);
    return ret;
}
exports.createLoggerMock = createLoggerMock;
