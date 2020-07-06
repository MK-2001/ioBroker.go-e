"use strict";
/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-var-requires */
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
const async_1 = require("alcalzone-shared/async");
const objects_1 = require("alcalzone-shared/objects");
const child_process_1 = require("child_process");
const debug_1 = __importDefault(require("debug"));
const events_1 = require("events");
const path = __importStar(require("path"));
const adapterTools_1 = require("../../../lib/adapterTools");
const dbConnection_1 = require("./dbConnection");
const tools_1 = require("./tools");
const debug = debug_1.default("testing:integration:TestHarness");
const isWindows = /^win/.test(process.platform);
/** The logger instance for the objects and states DB */
const logger = {
    silly: console.log,
    debug: console.log,
    info: console.log,
    warn: console.warn,
    error: console.error,
};
const fromAdapterID = "system.adapter.test.0";
/**
 * The test harness capsules the execution of the JS-Controller and the adapter instance and monitors their status.
 * Use it in every test to start a fresh adapter instance
 */
class TestHarness extends events_1.EventEmitter {
    /**
     * @param adapterDir The root directory of the adapter
     * @param testDir The directory the integration tests are executed in
     */
    constructor(adapterDir, testDir) {
        super();
        this.adapterDir = adapterDir;
        this.testDir = testDir;
        this.sendToID = 1;
        debug("Creating instance");
        this.adapterName = adapterTools_1.getAdapterName(this.adapterDir);
        this.appName = adapterTools_1.getAppName(adapterDir);
        this.testControllerDir = tools_1.getTestControllerDir(this.appName, testDir);
        this.testAdapterDir = tools_1.getTestAdapterDir(this.adapterDir, testDir);
        debug(`  directories:`);
        debug(`    controller: ${this.testControllerDir}`);
        debug(`    adapter:    ${this.testAdapterDir}`);
        debug(`  appName:           ${this.appName}`);
        debug(`  adapterName:       ${this.adapterName}`);
        this.dbConnection = new dbConnection_1.DBConnection(this.appName, this.testDir);
    }
    /** The actual objects DB */
    get objects() {
        return this._objects;
    }
    /** The actual states DB */
    get states() {
        return this._states;
    }
    /** The process the adapter is running in */
    get adapterProcess() {
        return this._adapterProcess;
    }
    /** Contains the adapter exit code or signal if it was terminated unexpectedly */
    get adapterExit() {
        return this._adapterExit;
    }
    /** Creates the objects DB and sets up listeners for it */
    createObjectsDB() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("creating objects DB");
            const Objects = require(path.join(this.testControllerDir, "lib/objects/objectsInMemServer"));
            return new Promise((resolve) => {
                this._objects = new Objects({
                    connection: {
                        type: "file",
                        host: "127.0.0.1",
                        port: 19001,
                        user: "",
                        pass: "",
                        noFileCache: false,
                        connectTimeout: 2000,
                    },
                    logger,
                    connected: () => {
                        debug("  => done!");
                        resolve();
                    },
                    change: this.emit.bind(this, "objectChange"),
                });
                this._objects.subscribe("*");
            });
        });
    }
    /** Creates the states DB and sets up listeners for it */
    createStatesDB() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("creating states DB");
            const States = require(path.join(this.testControllerDir, "lib/states/statesInMemServer"));
            return new Promise((resolve) => {
                this._states = new States({
                    connection: {
                        type: "file",
                        host: "127.0.0.1",
                        port: 19000,
                        options: {
                            auth_pass: null,
                            retry_max_delay: 15000,
                        },
                    },
                    logger,
                    connected: () => {
                        debug("  => done!");
                        resolve();
                    },
                    change: this.emit.bind(this, "stateChange"),
                });
                this._states.subscribe("*");
            });
        });
    }
    /** Checks if the controller instance is running */
    isControllerRunning() {
        return !!this._objects || !!this._states;
    }
    /** Starts the controller instance by creating the databases */
    startController() {
        return __awaiter(this, void 0, void 0, function* () {
            debug("starting controller instance...");
            if (this.isControllerRunning())
                throw new Error("The Controller is already running!");
            yield this.createObjectsDB();
            yield this.createStatesDB();
            debug("controller instance created");
        });
    }
    /** Stops the controller instance (and the adapter if it is running) */
    stopController() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isControllerRunning())
                return;
            debug("Stopping controller instance...");
            if (this._objects) {
                // Set adapter instance disabled
                this._objects.setObject(`system.adapter.${this.adapterName}.0`, {
                    common: {
                        enabled: false,
                    },
                });
            }
            // Give the adapter time to stop, but maximum 5s
            if (!this.didAdapterStop()) {
                debug("Stopping adapter instance...");
                yield Promise.race([this.stopAdapter(), async_1.wait(5000)]);
                if (this.isAdapterRunning()) {
                    debug("Adapter did not terminate, killing it");
                    this._adapterProcess.kill("SIGKILL");
                }
                else {
                    debug("Adapter terminated");
                }
            }
            else {
                debug("Adapter failed to start - no need to terminate!");
            }
            if (this._objects) {
                this._objects.destroy();
                this._objects = null;
            }
            if (this._states) {
                this._states.destroy();
                this._states = null;
            }
            debug("Controller instance stopped");
        });
    }
    /**
     * Starts the adapter in a separate process and monitors its status
     * @param env Additional environment variables to set
     */
    startAdapter(env = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isAdapterRunning())
                throw new Error("The adapter is already running!");
            else if (this.didAdapterStop())
                throw new Error("This test harness has already been used. Please create a new one for each test!");
            const mainFileAbsolute = yield adapterTools_1.locateAdapterMainFile(this.testAdapterDir);
            const mainFileRelative = path.relative(this.testAdapterDir, mainFileAbsolute);
            const onClose = (code, signal) => {
                this._adapterProcess.removeAllListeners();
                this._adapterExit = code != undefined ? code : signal;
                this.emit("failed", this._adapterExit);
            };
            this._adapterProcess = child_process_1.spawn(isWindows ? "node.exe" : "node", [mainFileRelative, "--console"], {
                cwd: this.testAdapterDir,
                stdio: ["inherit", "inherit", "inherit"],
                env: Object.assign(Object.assign({}, process.env), env),
            })
                .on("close", onClose)
                .on("exit", onClose);
        });
    }
    /**
     * Starts the adapter in a separate process and resolves after it has started
     * @param env Additional environment variables to set
     */
    startAdapterAndWait(env = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.on("stateChange", (id, state) => __awaiter(this, void 0, void 0, function* () {
                    if (id === `system.adapter.${this.adapterName}.0.alive` &&
                        state &&
                        state.val === true) {
                        resolve();
                    }
                }))
                    .on("failed", (code) => {
                    reject(new Error(`The adapter startup was interrupted unexpectedly with ${typeof code === "number" ? "code" : "signal"} ${code}`));
                })
                    .startAdapter(env);
            });
        });
    }
    /** Tests if the adapter process is still running */
    isAdapterRunning() {
        return !!this._adapterProcess;
    }
    /** Tests if the adapter process has already exited */
    didAdapterStop() {
        return this._adapterExit != undefined;
    }
    /** Stops the adapter process */
    stopAdapter() {
        if (!this.isAdapterRunning())
            return;
        return new Promise((resolve) => {
            const onClose = (code, signal) => {
                if (!this._adapterProcess)
                    return;
                this._adapterProcess.removeAllListeners();
                this._adapterExit = code != undefined ? code : signal;
                this._adapterProcess = undefined;
                debug("Adapter process terminated:");
                debug(`  Code:   ${code}`);
                debug(`  Signal: ${signal}`);
                resolve();
            };
            this._adapterProcess.removeAllListeners()
                .on("close", onClose)
                .on("exit", onClose)
                .kill("SIGTERM");
        });
    }
    /**
     * Updates the adapter config. The changes can be a subset of the target object
     */
    changeAdapterConfig(appName, testDir, adapterName, changes) {
        return __awaiter(this, void 0, void 0, function* () {
            const objects = yield this.dbConnection.readObjectsDB();
            const adapterInstanceId = `system.adapter.${adapterName}.0`;
            if (objects && adapterInstanceId in objects) {
                const target = objects[adapterInstanceId];
                objects_1.extend(target, changes);
                yield this.dbConnection.writeObjectsDB(objects);
            }
        });
    }
    /** Enables the sendTo method */
    enableSendTo() {
        return new Promise((resolve) => {
            this._objects.setObject(fromAdapterID, {
                common: {},
                type: "instance",
            }, () => {
                this._states.subscribeMessage(fromAdapterID);
                resolve();
            });
        });
    }
    /** Sends a message to an adapter instance */
    sendTo(target, command, message, callback) {
        const stateChangedHandler = (id, state) => {
            if (id === `messagebox.${fromAdapterID}`) {
                callback(state.message);
                this.removeListener("stateChange", stateChangedHandler);
            }
        };
        this.addListener("stateChange", stateChangedHandler);
        this._states.pushMessage(`system.adapter.${target}`, {
            command: command,
            message: message,
            from: fromAdapterID,
            callback: {
                message: message,
                id: this.sendToID++,
                ack: false,
                time: Date.now(),
            },
        }, (err, id) => console.log("published message " + id));
    }
}
exports.TestHarness = TestHarness;
