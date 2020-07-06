"use strict";
// wotan-disable async-function-assignability
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const async_1 = require("alcalzone-shared/async");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const adapterTools_1 = require("../../lib/adapterTools");
const executeCommand_1 = require("../../lib/executeCommand");
const adapterSetup_1 = require("./lib/adapterSetup");
const controllerSetup_1 = require("./lib/controllerSetup");
const dbConnection_1 = require("./lib/dbConnection");
const harness_1 = require("./lib/harness");
function testAdapter(adapterDir, options = {}) {
    const appName = adapterTools_1.getAppName(adapterDir);
    const adapterName = adapterTools_1.getAdapterName(adapterDir);
    const testDir = path.join(os.tmpdir(), `test-${appName}.${adapterName}`);
    let harness;
    const dbConnection = new dbConnection_1.DBConnection(appName, testDir);
    const controllerSetup = new controllerSetup_1.ControllerSetup(adapterDir, testDir, dbConnection);
    console.log();
    console.log(`Running tests in ${testDir}`);
    console.log();
    describe(`Test the adapter (in a live environment)`, () => {
        let objectsBackup;
        let statesBackup;
        before(function () {
            return __awaiter(this, void 0, void 0, function* () {
                // Installation may take a while - especially if rsa-compat needs to be installed
                const oneMinute = 60000;
                this.timeout(30 * oneMinute);
                if (yield controllerSetup.isJsControllerRunning()) {
                    throw new Error("JS-Controller is already running! Stop it for the first test run and try again!");
                }
                const adapterSetup = new adapterSetup_1.AdapterSetup(adapterDir, testDir, dbConnection);
                // First we need to copy all files and execute an npm install
                yield controllerSetup.prepareTestDir();
                yield adapterSetup.copyAdapterFilesToTestDir();
                // Remember if JS-Controller is installed already. If so, we need to call setup first later
                const wasJsControllerInstalled = yield controllerSetup.isJsControllerInstalled();
                // Call npm install
                yield executeCommand_1.executeCommand("npm", ["i", "--production"], {
                    cwd: testDir,
                });
                // Prepare/clean the databases and config
                if (wasJsControllerInstalled)
                    yield controllerSetup.setupJsController();
                yield controllerSetup.setupSystemConfig();
                yield controllerSetup.disableAdminInstances();
                yield adapterSetup.deleteOldInstances();
                yield adapterSetup.addAdapterInstance();
                // Create a copy of the databases that we can restore later
                ({
                    objects: objectsBackup,
                    states: statesBackup,
                } = yield dbConnection.readDB());
            });
        });
        beforeEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                this.timeout(30000);
                // Clean up before every single test
                yield Promise.all([
                    controllerSetup.clearDBDir(),
                    controllerSetup.clearLogDir(),
                    dbConnection.writeDB(objectsBackup, statesBackup),
                ]);
                // Create a new test harness
                harness = new harness_1.TestHarness(adapterDir, testDir);
                // Enable the adapter and set its loglevel to debug
                yield harness.changeAdapterConfig(appName, testDir, adapterName, {
                    common: {
                        enabled: true,
                        loglevel: "debug",
                    },
                });
                // Start the controller instance
                yield harness.startController();
                // And enable the sendTo emulation
                yield harness.enableSendTo();
            });
        });
        afterEach(function () {
            return __awaiter(this, void 0, void 0, function* () {
                // Stopping the processes may take a while
                this.timeout(30000);
                // Stop the controller again
                yield harness.stopController();
                harness.removeAllListeners();
            });
        });
        it("The adapter starts", function () {
            this.timeout(60000);
            return new Promise((resolve, reject) => {
                // Register a handler to check the alive state and exit codes
                harness
                    .on("stateChange", (id, state) => __awaiter(this, void 0, void 0, function* () {
                    if (id === `system.adapter.${adapterName}.0.alive` &&
                        state &&
                        state.val === true) {
                        // Wait a bit so we can catch errors that do not happen immediately
                        yield async_1.wait(options.waitBeforeStartupSuccess != undefined
                            ? options.waitBeforeStartupSuccess
                            : 5000);
                        resolve(`The adapter started successfully.`);
                    }
                }))
                    .on("failed", (code) => {
                    if (options.allowedExitCodes == undefined ||
                        options.allowedExitCodes.indexOf(code) === -1) {
                        reject(new Error(`The adapter startup was interrupted unexpectedly with ${typeof code === "number"
                            ? "code"
                            : "signal"} ${code}`));
                    }
                    else {
                        // This was a valid exit code
                        resolve(`The expected ${typeof code === "number"
                            ? "exit code"
                            : "signal"} ${code} was received.`);
                    }
                });
                harness.startAdapter();
            }).then((msg) => console.log(msg));
        });
        // Call the user's tests
        if (typeof options.defineAdditionalTests === "function") {
            options.defineAdditionalTests(() => harness);
        }
    });
}
exports.testAdapter = testAdapter;
