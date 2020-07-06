"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const mockAdapter_1 = require("./mockAdapter");
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function mockAdapterCore(database, options = {}) {
    /**
     * The root directory of JS-Controller
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    const controllerDir = path.join(options.adapterDir || "", "..", "iobroker.js-controller");
    const dataDir = path.join(os.tmpdir(), `test-iobroker-data`);
    /**
     * The test location for iobroker-data
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    function getAbsoluteDefaultDataDir() {
        return dataDir;
    }
    /**
     * The test location for adapter-specific data
     * If this has to exist in the test, the user/tester has to take care of it!
     */
    function getAbsoluteInstanceDataDir(adapterObject) {
        return path.join(getAbsoluteDefaultDataDir(), adapterObject.namespace);
    }
    /** Reads the configuration file of JS-Controller */
    function getConfig() {
        return {};
    }
    const AdapterConstructor = function (nameOrOptions) {
        // This needs to be a class with the correct `this` context or the ES6 tests won't work
        if (!(this instanceof AdapterConstructor))
            return new AdapterConstructor(nameOrOptions);
        const createAdapterMockOptions = typeof nameOrOptions === "string"
            ? { name: nameOrOptions }
            : nameOrOptions;
        mockAdapter_1.createAdapterMock.bind(this)(database, createAdapterMockOptions);
        if (typeof options.onAdapterCreated === "function")
            options.onAdapterCreated(this);
        return this;
    };
    return {
        controllerDir,
        getConfig,
        Adapter: AdapterConstructor,
        adapter: AdapterConstructor,
        getAbsoluteDefaultDataDir,
        getAbsoluteInstanceDataDir,
    };
}
exports.mockAdapterCore = mockAdapterCore;
