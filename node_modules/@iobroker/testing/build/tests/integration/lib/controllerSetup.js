"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
// Add debug logging for tests
const debug_1 = __importDefault(require("debug"));
const fs_extra_1 = require("fs-extra");
const net_1 = require("net");
const path = __importStar(require("path"));
const adapterTools_1 = require("../../../lib/adapterTools");
const executeCommand_1 = require("../../../lib/executeCommand");
const tools_1 = require("./tools");
const debug = debug_1.default("testing:integration:ControllerSetup");
class ControllerSetup {
    constructor(adapterDir, testDir, dbConnection) {
        this.adapterDir = adapterDir;
        this.testDir = testDir;
        this.dbConnection = dbConnection;
        debug("Creating ControllerSetup...");
        this.adapterName = adapterTools_1.getAdapterName(this.adapterDir);
        this.appName = adapterTools_1.getAppName(this.adapterDir);
        this.testAdapterDir = tools_1.getTestAdapterDir(this.adapterDir, this.testDir);
        this.testControllerDir = tools_1.getTestControllerDir(this.appName, this.testDir);
        this.testDataDir = tools_1.getTestDataDir(this.appName, this.testDir);
        debug(`  directories:`);
        debug(`    controller: ${this.testControllerDir}`);
        debug(`    adapter:    ${this.testAdapterDir}`);
        debug(`    data:       ${this.testDataDir}`);
        debug(`  appName:      ${this.appName}`);
        debug(`  adapterName:  ${this.adapterName}`);
    }
    prepareTestDir() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Preparing the test directory...");
            // Make sure the test dir exists
            yield fs_extra_1.ensureDir(this.testDir);
            // Write the package.json
            const packageJson = {
                name: path.basename(this.testDir),
                version: "1.0.0",
                main: "index.js",
                scripts: {
                    test: 'echo "Error: no test specified" && exit 1',
                },
                keywords: [],
                author: "",
                license: "ISC",
                dependencies: {
                    [`${this.appName}.js-controller`]: `https://github.com/${this.appName}/${this.appName}.js-controller/tarball/master`,
                },
                description: "",
            };
            yield fs_extra_1.writeJSON(path.join(this.testDir, "package.json"), packageJson, {
                spaces: 2,
            });
            // Delete a possible package-lock.json as it can mess with future installations
            const pckLockPath = path.join(this.testDir, "package-lock.json");
            if (yield fs_extra_1.pathExists(pckLockPath))
                yield fs_extra_1.unlink(pckLockPath);
            // Set the engineStrict flag on new Node.js versions to be in line with newer ioBroker installations
            const nodeMajorVersion = parseInt(process.versions.node.split(".")[0], 10);
            if (nodeMajorVersion >= 10) {
                yield fs_extra_1.writeFile(path.join(this.testDir, ".npmrc"), "engine-strict=true", "utf8");
            }
            debug("  => done!");
        });
    }
    /**
     * Tests if JS-Controller is already installed
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    isJsControllerInstalled() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Testing if JS-Controller is installed...");
            // We expect js-controller to be installed if the dir in <testDir>/node_modules and the data directory exist
            const isInstalled = (yield fs_extra_1.pathExists(this.testControllerDir)) &&
                (yield fs_extra_1.pathExists(this.testDataDir));
            debug(`  => ${isInstalled}`);
            return isInstalled;
        });
    }
    /**
     * Tests if an instance of JS-Controller is already running by attempting to connect to the Objects DB
     */
    isJsControllerRunning() {
        debug("Testing if JS-Controller is running...");
        return new Promise((resolve) => {
            const client = new net_1.Socket();
            // Try to connect to an existing ObjectsDB
            client
                .connect({
                port: 9000,
                host: "127.0.0.1",
            })
                .on("connect", () => {
                // The connection succeeded
                client.destroy();
                debug(`  => true`);
                resolve(true);
            })
                .on("error", () => {
                client.destroy();
                debug(`  => false`);
                resolve(false);
            });
            setTimeout(() => {
                // Assume the connection failed after 1 s
                client.destroy();
                debug(`  => false`);
                resolve(false);
            }, 1000);
        });
    }
    /**
     * Installs a new instance of JS-Controller into the test directory
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    installJsController() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Installing newest JS-Controller from github...");
            // First npm install the JS-Controller into the correct directory
            const installUrl = `https://github.com/${this.appName}/${this.appName}.js-controller/tarball/master`;
            const installResult = yield executeCommand_1.executeCommand("npm", ["i", installUrl, "--save"], {
                cwd: this.testDir,
            });
            if (installResult.exitCode !== 0)
                throw new Error("JS-Controller could not be installed!");
            debug("  => done!");
        });
    }
    /**
     * Sets up an existing JS-Controller instance for testing by executing "iobroker setup first"
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    setupJsController() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Initializing JS-Controller installation...");
            // Stop the controller before calling setup first
            yield executeCommand_1.executeCommand("node", [`${this.appName}.js`, "stop"], {
                cwd: this.testControllerDir,
                stdout: "ignore",
            });
            const setupResult = yield executeCommand_1.executeCommand("node", [`${this.appName}.js`, "setup", "first", "--console"], {
                cwd: this.testControllerDir,
                stdout: "ignore",
            });
            if (setupResult.exitCode !== 0)
                throw new Error(`${this.appName} setup first failed!`);
            debug("  => done!");
        });
    }
    /**
     * Changes the objects and states db to use alternative ports
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    setupSystemConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Moving databases to different ports...");
            const systemFilename = path.join(this.testDataDir, `${this.appName}.json`);
            const systemConfig = require(systemFilename);
            systemConfig.objects.port = 19001;
            systemConfig.states.port = 19000;
            yield fs_extra_1.writeFile(systemFilename, JSON.stringify(systemConfig, null, 2));
            debug("  => done!");
        });
    }
    /**
     * Clears the log dir for integration tests (and creates it if it doesn't exist)
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    clearLogDir() {
        debug("Cleaning log directory...");
        return fs_extra_1.emptyDir(tools_1.getTestLogDir(this.appName, this.testDir));
    }
    /**
     * Clears the sqlite DB dir for integration tests (and creates it if it doesn't exist)
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    clearDBDir() {
        debug("Cleaning SQLite directory...");
        return fs_extra_1.emptyDir(tools_1.getTestDBDir(this.appName, this.testDir));
    }
    /**
     * Disables all admin instances in the objects DB
     * @param objects The contents of objects.json
     */
    disableAdminInstances() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("Disabling admin instances...");
            const objects = yield this.dbConnection.readObjectsDB();
            if (objects) {
                for (const id of Object.keys(objects)) {
                    if (/^system\.adapter\.admin\.\d.+$/.test(id)) {
                        const obj = objects[id];
                        if (obj && obj.common)
                            obj.common.enabled = false;
                    }
                }
                yield this.dbConnection.writeObjectsDB(objects);
            }
            debug("  => done!");
        });
    }
}
exports.ControllerSetup = ControllerSetup;
