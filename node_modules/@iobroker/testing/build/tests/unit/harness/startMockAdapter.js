"use strict";
// wotan-disable no-unused-expression
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
const objects_1 = require("alcalzone-shared/objects");
const chai_1 = require("chai");
const path = __importStar(require("path"));
const mockAdapterCore_1 = require("../mocks/mockAdapterCore");
const mockDatabase_1 = require("../mocks/mockDatabase");
const loader_1 = require("./loader");
/**
 * Starts an adapter by executing its main file in a controlled offline environment.
 * The JS-Controller is replaced by mocks for the adapter and Objects and States DB, so
 * no working installation is necessary.
 * This method may throw (or reject) if something goes wrong during the adapter startup.
 * It returns an instance of the mocked adapter class and the database, so you can perform further tests.
 *
 * @param adapterMainFile The main file of the adapter to start. Must be an absolute path.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function startMockAdapter(adapterMainFile, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        // Setup the mocks
        const databaseMock = new mockDatabase_1.MockDatabase();
        // If objects and/or states are predefined, populate the database mock with them
        if (options.predefinedObjects && options.predefinedObjects.length) {
            databaseMock.publishObjects(...options.predefinedObjects);
        }
        if (options.predefinedStates) {
            databaseMock.publishStates(options.predefinedStates);
        }
        let adapterMock;
        const adapterCoreMock = mockAdapterCore_1.mockAdapterCore(databaseMock, {
            onAdapterCreated: (mock) => {
                adapterMock = mock;
                // Give the user the chance to change the mock behavior
                if (typeof options.defineMockBehavior === "function")
                    options.defineMockBehavior(databaseMock, adapterMock);
                // If an adapter configuration was given, set it on the mock
                if (options.config)
                    mock.config = options.config;
            },
            adapterDir: options.adapterDir,
        });
        // Replace the following modules with mocks
        const mockedModules = {};
        if (options.additionalMockedModules) {
            // eslint-disable-next-line prefer-const
            for (let [mdl, mock] of objects_1.entries(options.additionalMockedModules)) {
                mdl = mdl.replace("{CONTROLLER_DIR}", adapterCoreMock.controllerDir);
                if (mdl.startsWith(".") || path.isAbsolute(mdl))
                    mdl = path.normalize(mdl);
                mockedModules[mdl] = mock;
            }
        }
        mockedModules["@iobroker/adapter-core"] = adapterCoreMock;
        // If the adapter supports compact mode and should be executed in "normal" mode,
        // we need to trick it into thinking it was not required
        const fakeNotRequired = !options.compact;
        // Make process.exit() test-safe
        const globalPatches = { process: { exit: loader_1.fakeProcessExit } };
        let processExitCode;
        let terminateReason;
        try {
            // Load the adapter file into the test harness and capture it's module.exports
            const mainFileExport = loader_1.loadModuleInHarness(adapterMainFile, {
                mockedModules,
                fakeNotRequired,
                globalPatches,
            });
            if (options.compact) {
                // In compact mode, the main file must export a function
                if (typeof mainFileExport !== "function")
                    throw new Error("The adapter's main file must export a function in compact mode!");
                // Call it to initialize the adapter
                mainFileExport();
            }
            // Assert some basic stuff
            if (adapterMock == undefined)
                throw new Error("The adapter was not initialized!");
            chai_1.expect(adapterMock.readyHandler, "The adapter's ready method could not be found!").to.exist;
            // Execute the ready method (synchronously or asynchronously)
            const readyResult = adapterMock.readyHandler();
            if (readyResult instanceof Promise)
                yield readyResult;
        }
        catch (e) {
            // We give special handling to Errors here, as we also use them to convey that
            // process.exit or adapter.terminate was called
            if (e instanceof Error) {
                const anyError = e;
                if (typeof anyError.processExitCode === "number") {
                    processExitCode = anyError.processExitCode;
                }
                else if (typeof anyError.terminateReason === "string") {
                    terminateReason = anyError.terminateReason;
                    if (!options.compact) {
                        // in non-compact mode, adapter.terminate calls process.exit(11)
                        processExitCode = 11;
                    }
                }
                else {
                    // This error was not meant for us, pass it through
                    throw e;
                }
            }
        }
        // Return the mock instances so the tests can work with them
        return {
            databaseMock,
            adapterMock,
            processExitCode,
            terminateReason,
        };
    });
}
exports.startMockAdapter = startMockAdapter;
function unloadMockAdapter(adapter, timeout = 500) {
    return new Promise((res, rej) => {
        function finishUnload() {
            res(true);
        }
        if (adapter.unloadHandler.length >= 1) {
            // The method takes (at least) a callback
            adapter.unloadHandler(finishUnload);
        }
        else {
            // The method takes no arguments, so it must return a Promise
            const unloadPromise = adapter.unloadHandler();
            if (unloadPromise instanceof Promise) {
                // Call finishUnload in the case of success and failure
                unloadPromise.then(finishUnload, finishUnload);
            }
            else {
                // No callback accepted and no Promise returned - force unload
                rej(new Error(`The unload method must return a Promise if it does not accept a callback!`));
            }
        }
        // If the developer forgets to call the callback within the configured time, fail the test
        setTimeout(() => rej(new Error("The unload callback was not called within the timeout")), timeout);
    });
}
exports.unloadMockAdapter = unloadMockAdapter;
