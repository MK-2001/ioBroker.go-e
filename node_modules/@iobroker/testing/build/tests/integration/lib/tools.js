"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const adapterTools_1 = require("../../../lib/adapterTools");
/**
 * Locates the directory where JS-Controller is installed for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestControllerDir(appName, testDir) {
    return path.resolve(testDir, "node_modules", `${appName}.js-controller`);
}
exports.getTestControllerDir = getTestControllerDir;
/**
 * Locates the directory where JS-Controller stores its data for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestDataDir(appName, testDir) {
    return path.resolve(testDir, `${appName}-data`);
}
exports.getTestDataDir = getTestDataDir;
/**
 * Locates the directory where JS-Controller stores its logs for integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestLogDir(appName, testDir) {
    return path.resolve(testDir, "log");
}
exports.getTestLogDir = getTestLogDir;
/**
 * Locates the directory where JS-Controller stores its sqlite db during integration tests
 * @param appName The branded name of "iobroker"
 * @param testDir The directory the integration tests are executed in
 */
function getTestDBDir(appName, testDir) {
    return path.resolve(getTestDataDir(appName, testDir), "sqlite");
}
exports.getTestDBDir = getTestDBDir;
/**
 * Locates the directory where the adapter will be be stored for integration tests
 * @param adapterDir The root directory of the adapter
 * @param testDir The directory the integration tests are executed in
 */
function getTestAdapterDir(adapterDir, testDir) {
    const adapterName = adapterTools_1.getAdapterFullName(adapterDir);
    return path.resolve(testDir, "node_modules", adapterName);
}
exports.getTestAdapterDir = getTestAdapterDir;
