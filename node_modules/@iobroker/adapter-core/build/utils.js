"use strict";
/* eslint-disable @typescript-eslint/no-var-requires */
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
/**
 * Resolves the root directory of JS-Controller and returns it or exits the process
 * @param isInstall Whether the adapter is run in "install" mode or if it should execute normally
 */
function getControllerDir(isInstall) {
    // Find the js-controller location
    const possibilities = ["iobroker.js-controller", "ioBroker.js-controller"];
    let controllerPath;
    for (const pkg of possibilities) {
        try {
            const possiblePath = require.resolve(pkg);
            if (fs.existsSync(possiblePath)) {
                controllerPath = possiblePath;
                break;
            }
        }
        catch (_a) {
            /* not found */
        }
    }
    // Apparently, checking vs null/undefined may miss the odd case of controllerPath being ""
    // Thus we check for falsyness, which includes failing on an empty path
    if (!controllerPath) {
        if (!isInstall) {
            console.log("Cannot find js-controller");
            return process.exit(10);
        }
        else {
            return process.exit();
        }
    }
    // we found the controller
    return path.dirname(controllerPath);
}
/** The root directory of JS-Controller */
exports.controllerDir = getControllerDir(typeof process !== "undefined" &&
    process.argv &&
    process.argv.indexOf("--install") !== -1);
/** Reads the configuration file of JS-Controller */
function getConfig() {
    return JSON.parse(fs.readFileSync(path.join(exports.controllerDir, "conf/iobroker.json"), "utf8"));
}
exports.getConfig = getConfig;
/** Creates a new adapter instance */
exports.adapter = require(path.join(exports.controllerDir, "lib/adapter.js"));
/** Creates a new adapter instance */
exports.Adapter = exports.adapter;
