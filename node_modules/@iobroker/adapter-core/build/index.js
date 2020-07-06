"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const utils = require("./utils");
/* eslint-disable @typescript-eslint/no-var-requires */
// Export all methods that used to be in utils.js
__export(require("./utils"));
// Export some additional utility methods
const controllerTools = require(path.join(utils.controllerDir, "lib/tools"));
/**
 * Returns the absolute path of the data directory for the current host. On linux, this is usually `/opt/iobroker/iobroker-data`.
 */
function getAbsoluteDefaultDataDir() {
    return path.join(utils.controllerDir, controllerTools.getDefaultDataDir());
}
exports.getAbsoluteDefaultDataDir = getAbsoluteDefaultDataDir;
/**
 * Returns the absolute path of the data directory for the current adapter instance.
 * On linux, this is usually `/opt/iobroker/iobroker-data/<adapterName>.<instanceNr>`
 */
function getAbsoluteInstanceDataDir(adapterObject) {
    return path.join(getAbsoluteDefaultDataDir(), adapterObject.namespace);
}
exports.getAbsoluteInstanceDataDir = getAbsoluteInstanceDataDir;
// TODO: Expose some system utilities here, e.g. for installing npm modules (GH#1)
exports.EXIT_CODES = Object.freeze(Object.assign({}, require(path.join(utils.controllerDir, "lib/exitCodes"))));
