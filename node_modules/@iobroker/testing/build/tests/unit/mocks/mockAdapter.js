"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/camelcase */
const objects_1 = require("alcalzone-shared/objects");
const sinon_1 = require("sinon");
const mockLogger_1 = require("./mockLogger");
const tools_1 = require("./tools");
// Define here which methods were implemented manually, so we can hook them up with a real stub
// The value describes if and how the async version of the callback is constructed
const implementedMethods = {
    getObject: "normal",
    setObject: "normal",
    setObjectNotExists: "normal",
    extendObject: "normal",
    getForeignObject: "normal",
    getForeignObjects: "normal",
    setForeignObject: "normal",
    setForeignObjectNotExists: "normal",
    extendForeignObject: "normal",
    getState: "normal",
    getStates: "normal",
    setState: "normal",
    setStateChanged: "normal",
    delState: "normal",
    getForeignState: "normal",
    setForeignState: "normal",
    setForeignStateChanged: "normal",
    subscribeStates: "normal",
    subscribeForeignStates: "normal",
    subscribeObjects: "normal",
    subscribeForeignObjects: "normal",
    getAdapterObjects: "no error",
    getObjectView: "normal",
    getObjectList: "normal",
    on: "none",
    removeListener: "none",
    removeAllListeners: "none",
    terminate: "none",
};
// wotan-disable no-misused-generics
function getCallback(...args) {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === "function")
        return lastArg;
}
/** Stub implementation which can be promisified */
const asyncEnabledStub = ((...args) => {
    const callback = getCallback(...args);
    if (typeof callback === "function")
        callback();
});
/**
 * Creates an adapter mock that is connected to a given database mock
 */
function createAdapterMock(db, options = {}) {
    // In order to support ES6-style adapters with inheritance, we need to work on the instance directly
    const ret = this || {};
    Object.assign(ret, {
        name: options.name || "test",
        host: "testhost",
        instance: options.instance || 0,
        namespace: `${options.name || "test"}.${options.instance || 0}`,
        config: options.config || {},
        common: {},
        systemConfig: null,
        adapterDir: "",
        ioPack: {},
        pack: {},
        log: mockLogger_1.createLoggerMock(),
        version: "any",
        connected: true,
        getPort: sinon_1.stub(),
        stop: sinon_1.stub(),
        checkPassword: sinon_1.stub(),
        setPassword: sinon_1.stub(),
        checkGroup: sinon_1.stub(),
        calculatePermissions: sinon_1.stub(),
        getCertificates: sinon_1.stub(),
        sendTo: sinon_1.stub(),
        sendToHost: sinon_1.stub(),
        idToDCS: sinon_1.stub(),
        getObject: ((id, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getObject(id));
        }),
        setObject: ((id, obj, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            obj._id = id;
            db.publishObject(obj);
            const callback = getCallback(...args);
            if (callback)
                callback(null, { id });
        }),
        setObjectNotExists: ((id, obj, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            const callback = getCallback(...args);
            if (db.hasObject(id)) {
                if (callback)
                    callback(null, { id });
            }
            else {
                ret.setObject(id, obj, callback);
            }
        }),
        getAdapterObjects: ((callback) => {
            callback(db.getObjects(`${ret.namespace}.*`));
        }),
        getObjectView: ((design, search, { startkey, endkey }, ...args) => {
            if (design !== "system") {
                throw new Error("If you want to use a custom design for getObjectView, you need to mock it yourself!");
            }
            const callback = getCallback(...args);
            if (typeof callback === "function") {
                let objects = objects_1.values(db.getObjects("*"));
                objects = objects.filter((obj) => obj.type === search);
                if (startkey)
                    objects = objects.filter((obj) => obj._id >= startkey);
                if (endkey)
                    objects = objects.filter((obj) => obj._id <= endkey);
                callback(null, {
                    rows: objects.map((obj) => ({
                        id: obj._id,
                        value: obj,
                    })),
                });
            }
        }),
        getObjectList: (({ startkey, endkey, include_docs, }, ...args) => {
            const callback = getCallback(...args);
            if (typeof callback === "function") {
                let objects = objects_1.values(db.getObjects("*"));
                if (startkey)
                    objects = objects.filter((obj) => obj._id >= startkey);
                if (endkey)
                    objects = objects.filter((obj) => obj._id <= endkey);
                if (!include_docs)
                    objects = objects.filter((obj) => !obj._id.startsWith("_"));
                callback(null, {
                    rows: objects.map((obj) => ({
                        id: obj._id,
                        value: obj,
                        doc: obj,
                    })),
                });
            }
        }),
        extendObject: ((id, obj, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            const existing = db.getObject(id) || {};
            const target = objects_1.extend({}, existing, obj);
            db.publishObject(target);
            const callback = getCallback(...args);
            if (callback)
                callback(null, { id: target._id, value: target }, id);
        }),
        delObject: ((id, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            db.deleteObject(id);
            const callback = getCallback(...args);
            if (callback)
                callback(undefined);
        }),
        getForeignObject: ((id, ...args) => {
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getObject(id));
        }),
        getForeignObjects: ((pattern, ...args) => {
            const type = typeof args[0] === "string"
                ? args[0]
                : undefined;
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getObjects(pattern, type));
        }),
        setForeignObject: ((id, obj, ...args) => {
            obj._id = id;
            db.publishObject(obj);
            const callback = getCallback(...args);
            if (callback)
                callback(null, { id });
        }),
        setForeignObjectNotExists: ((id, obj, ...args) => {
            const callback = getCallback(...args);
            if (db.hasObject(id)) {
                if (callback)
                    callback(null, { id });
            }
            else {
                ret.setObject(id, obj, callback);
            }
        }),
        extendForeignObject: ((id, obj, ...args) => {
            const target = db.getObject(id) || {};
            Object.assign(target, obj);
            db.publishObject(target);
            const callback = getCallback(...args);
            if (callback)
                callback(null, { id: target._id, value: target }, id);
        }),
        findForeignObject: sinon_1.stub(),
        delForeignObject: ((id, ...args) => {
            db.deleteObject(id);
            const callback = getCallback(...args);
            if (callback)
                callback(undefined);
        }),
        setState: ((id, state, ...args) => {
            const callback = getCallback(...args);
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            let ack;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            else {
                ack = typeof args[0] === "boolean" ? args[0] : false;
            }
            db.publishState(id, { val: state, ack });
            if (callback)
                callback(null, id);
        }),
        setStateChanged: ((id, state, ...args) => {
            const callback = getCallback(...args);
            let ack;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            else {
                ack = typeof args[0] === "boolean" ? args[0] : false;
            }
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            if (!db.hasState(id) || db.getState(id).val !== state) {
                db.publishState(id, { val: state, ack });
            }
            if (callback)
                callback(null, id);
        }),
        setForeignState: ((id, state, ...args) => {
            const callback = getCallback(...args);
            let ack;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            else {
                ack = typeof args[0] === "boolean" ? args[0] : false;
            }
            db.publishState(id, { val: state, ack });
            if (callback)
                callback(null, id);
        }),
        setForeignStateChanged: ((id, state, ...args) => {
            const callback = getCallback(...args);
            let ack;
            if (state != null && typeof state === "object") {
                ack = !!state.ack;
                state = state.val;
            }
            else {
                ack = typeof args[0] === "boolean" ? args[0] : false;
            }
            if (!db.hasState(id) || db.getState(id).val !== state) {
                db.publishState(id, { val: state, ack });
            }
            if (callback)
                callback(null, id);
        }),
        getState: ((id, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getState(id));
        }),
        getForeignState: ((id, ...args) => {
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getState(id));
        }),
        getStates: ((pattern, ...args) => {
            if (!pattern.startsWith(ret.namespace))
                pattern = ret.namespace + "." + pattern;
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getStates(pattern));
        }),
        getForeignStates: ((pattern, ...args) => {
            const callback = getCallback(...args);
            if (callback)
                callback(null, db.getStates(pattern));
        }),
        delState: ((id, ...args) => {
            if (!id.startsWith(ret.namespace))
                id = ret.namespace + "." + id;
            db.deleteState(id);
            const callback = getCallback(...args);
            if (callback)
                callback(undefined);
        }),
        delForeignState: ((id, ...args) => {
            db.deleteState(id);
            const callback = getCallback(...args);
            if (callback)
                callback(undefined);
        }),
        getHistory: sinon_1.stub(),
        setBinaryState: sinon_1.stub(),
        getBinaryState: sinon_1.stub(),
        getEnum: sinon_1.stub(),
        getEnums: sinon_1.stub(),
        addChannelToEnum: sinon_1.stub(),
        deleteChannelFromEnum: sinon_1.stub(),
        addStateToEnum: sinon_1.stub(),
        deleteStateFromEnum: sinon_1.stub(),
        subscribeObjects: asyncEnabledStub,
        subscribeForeignObjects: asyncEnabledStub,
        unsubscribeObjects: asyncEnabledStub,
        unsubscribeForeignObjects: asyncEnabledStub,
        subscribeStates: asyncEnabledStub,
        subscribeForeignStates: asyncEnabledStub,
        unsubscribeStates: asyncEnabledStub,
        unsubscribeForeignStates: asyncEnabledStub,
        createDevice: sinon_1.stub(),
        deleteDevice: sinon_1.stub(),
        createChannel: sinon_1.stub(),
        deleteChannel: sinon_1.stub(),
        createState: sinon_1.stub(),
        deleteState: sinon_1.stub(),
        getDevices: sinon_1.stub(),
        getChannels: sinon_1.stub(),
        getChannelsOf: sinon_1.stub(),
        getStatesOf: sinon_1.stub(),
        readDir: sinon_1.stub(),
        mkDir: sinon_1.stub(),
        readFile: sinon_1.stub(),
        writeFile: sinon_1.stub(),
        delFile: sinon_1.stub(),
        unlink: sinon_1.stub(),
        rename: sinon_1.stub(),
        chmodFile: sinon_1.stub(),
        formatValue: sinon_1.stub(),
        formatDate: sinon_1.stub(),
        terminate: ((reason, exitCode) => {
            if (typeof reason === "number") {
                // Only the exit code was passed
                exitCode = reason;
                reason = undefined;
            }
            const errorMessage = `Adapter.terminate was called${typeof exitCode === "number" ? ` (exit code ${exitCode})` : ""}: ${reason ? reason : "Without reason"}`;
            // Terminates execution by
            const err = new Error(errorMessage);
            // @ts-ignore
            err.terminateReason = reason || "no reason given!";
            throw err;
        }),
        supportsFeature: sinon_1.stub(),
        getPluginInstance: sinon_1.stub(),
        getPluginConfig: sinon_1.stub(),
        // EventEmitter methods
        on: ((event, handler) => {
            // Remember the event handlers so we can call them on demand
            switch (event) {
                case "ready":
                    ret.readyHandler = handler;
                    break;
                case "message":
                    ret.messageHandler = handler;
                    break;
                case "objectChange":
                    ret.objectChangeHandler = handler;
                    break;
                case "stateChange":
                    ret.stateChangeHandler = handler;
                    break;
                case "unload":
                    ret.unloadHandler = handler;
                    break;
            }
            return ret;
        }),
        removeListener: ((event, _listener) => {
            // TODO This is not entirely correct
            switch (event) {
                case "ready":
                    ret.readyHandler = undefined;
                    break;
                case "message":
                    ret.messageHandler = undefined;
                    break;
                case "objectChange":
                    ret.objectChangeHandler = undefined;
                    break;
                case "stateChange":
                    ret.stateChangeHandler = undefined;
                    break;
                case "unload":
                    ret.unloadHandler = undefined;
                    break;
            }
            return ret;
        }),
        removeAllListeners: ((event) => {
            if (!event || event === "ready") {
                ret.readyHandler = undefined;
            }
            if (!event || event === "message") {
                ret.messageHandler = undefined;
            }
            if (!event || event === "objectChange") {
                ret.objectChangeHandler = undefined;
            }
            if (!event || event === "stateChange") {
                ret.stateChangeHandler = undefined;
            }
            if (!event || event === "unload") {
                ret.unloadHandler = undefined;
            }
            return ret;
        }),
        // Mock-specific methods
        resetMockHistory() {
            // reset Adapter
            tools_1.doResetHistory(ret);
            ret.log.resetMockHistory();
        },
        resetMockBehavior() {
            // reset Adapter
            tools_1.doResetBehavior(ret, implementedMethods);
            ret.log.resetMockBehavior();
        },
        resetMock() {
            ret.resetMockHistory();
            ret.resetMockBehavior();
        },
    });
    tools_1.stubAndPromisifyImplementedMethods(ret, implementedMethods, [
        "getObjectView",
        "getObjectList",
    ]);
    // Access the options object directly, so we can react to later changes
    Object.defineProperties(this, {
        readyHandler: {
            get() {
                return options.ready;
            },
            set(handler) {
                options.ready = handler;
            },
        },
        messageHandler: {
            get() {
                return options.message;
            },
            set(handler) {
                options.message = handler;
            },
        },
        objectChangeHandler: {
            get() {
                return options.objectChange;
            },
            set(handler) {
                options.objectChange = handler;
            },
        },
        stateChangeHandler: {
            get() {
                return options.stateChange;
            },
            set(handler) {
                options.stateChange = handler;
            },
        },
        unloadHandler: {
            get() {
                return options.unload;
            },
            set(handler) {
                options.unload = handler;
            },
        },
    });
    return ret;
}
exports.createAdapterMock = createAdapterMock;
