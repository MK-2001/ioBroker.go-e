"use strict";
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
// wotan-disable no-unstable-api-use
const typeguards_1 = require("alcalzone-shared/typeguards");
const module_1 = __importDefault(require("module"));
const path = __importStar(require("path"));
const globalRequire = require;
function createMockRequire(originalRequire, options) {
    let relativeToDir;
    if (options.relativeToFile) {
        relativeToDir = path.dirname(options.relativeToFile);
    }
    return function fakeRequire(filename) {
        // Resolve relative paths relative to the require-ing module
        if (relativeToDir != undefined && filename.startsWith(".")) {
            filename = path.join(relativeToDir, filename);
        }
        else if (path.isAbsolute(filename)) {
            // Avoid not finding modules due to mixed slashes and backslashes
            filename = path.normalize(filename);
        }
        if (options.mockedModules && filename in options.mockedModules) {
            // require.cache[filename] = options.mockedModules[filename];
            return options.mockedModules[filename].exports;
        }
        return loadModuleInternal(originalRequire, filename, options);
    };
}
exports.createMockRequire = createMockRequire;
/**
 * Creates a module that is loaded instead of another one with the same name
 */
function createMockModule(id, mocks) {
    const ret = new module_1.default(id);
    ret.exports = mocks;
    return ret;
}
/**
 * Builds a proxy around a global object with the given properties or methods
 * proxied to their given replacements
 */
function buildProxy(global, mocks) {
    return new Proxy(global, {
        get: (target, name) => {
            if (name in mocks)
                return mocks[name];
            const ret = target[name];
            // Bind original functions to the target to avoid illegal invocation errors
            if (typeof ret === "function")
                return ret.bind(target);
            return ret;
        },
    });
}
/**
 * Returns true if the source code is intended to run in strict mode. Does not detect
 * "use strict" if it occurs in a nested function.
 */
function detectStrictMode(code) {
    // Taken from rewirejs
    // remove all comments before testing for "use strict"
    const multiLineComment = /^\s*\/\*.*?\*\//;
    const singleLineComment = /^\s*\/\/.*?[\r\n]/;
    let singleLine = false;
    let multiLine = false;
    while ((singleLine = singleLineComment.test(code)) ||
        (multiLine = multiLineComment.test(code))) {
        if (!!singleLine) {
            code = code.replace(singleLineComment, "");
        }
        if (!!multiLine) {
            code = code.replace(multiLineComment, "");
        }
    }
    const strictModeRegex = /^\s*(?:"use strict"|'use strict')[ \t]*(?:[\r\n]|;)/;
    return strictModeRegex.test(code);
}
/**
 * Monkey-patches module code before executing it by wrapping it in an IIFE whose arguments are modified (proxied) globals
 * @param code The code to monkey patch
 * @param globals A dictionary of globals and their properties to be replaced
 */
function monkeyPatchGlobals(code, globals) {
    const codeIsStrict = detectStrictMode(code);
    const prefix = `${codeIsStrict ? '"use strict"; ' : ""}((${Object.keys(globals).join(", ")}) => {`;
    const patchedArguments = Object.keys(globals).map((glob) => {
        const patchObj = globals[glob];
        const patches = Object.keys(patchObj).map((fn) => `${fn}: ${patchObj[fn]}`);
        return `buildProxy(${glob}, {${patches.join(", ")}})`;
    });
    const postfix = `
})(${patchedArguments.join(", ")});
${buildProxy}`;
    return prefix + code + postfix;
}
exports.monkeyPatchGlobals = monkeyPatchGlobals;
/** Removes a hashbang from the code if it exists since that causes compilation errors */
function removeHashbang(code) {
    return code.replace(/^#!.+$/m, "");
}
exports.removeHashbang = removeHashbang;
/** A test-safe replacement for process.exit that throws a specific error instead */
function fakeProcessExit(code = 0) {
    const err = new Error(`process.exit was called with code ${code}`);
    // @ts-ignore
    err.processExitCode = code;
    throw err;
}
exports.fakeProcessExit = fakeProcessExit;
let isOriginalLoader = true;
let originalLoader;
/**
 * Replaces NodeJS's default loader for .js-files with the given one and returns the original one
 */
function replaceJsLoader(loaderFunction) {
    if (isOriginalLoader) {
        originalLoader = require.extensions[".js"];
    }
    require.extensions[".js"] = loaderFunction;
    isOriginalLoader = false;
}
exports.replaceJsLoader = replaceJsLoader;
/**
 * Replaces a replaced loader for .js-files with the original one
 */
function restoreJsLoader() {
    require.extensions[".js"] = originalLoader;
}
exports.restoreJsLoader = restoreJsLoader;
function loadModuleInternal(require, moduleFilename, options = {}) {
    replaceJsLoader((module, filename) => {
        // If we want to replace some modules with mocks, we need to change the module's require function
        if (typeguards_1.isObject(options.mockedModules)) {
            module.require = createMockRequire(module.require.bind(module), Object.assign(Object.assign({}, options), { relativeToFile: filename }));
        }
        if (options.fakeNotRequired &&
            path.normalize(filename) === path.normalize(moduleFilename)) {
            module.parent = null;
        }
        // If necessary, edit the source code before executing it
        if (typeguards_1.isObject(options.globalPatches)) {
            const originalCompile = module._compile;
            module._compile = (code, _filename) => {
                code = removeHashbang(code);
                code = monkeyPatchGlobals(code, options.globalPatches);
                // Restore everything to not break the NodeJS internals
                module._compile = originalCompile;
                module._compile(code, _filename);
            };
        }
        // Call the original loader
        originalLoader(module, filename);
    });
    // And load the module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const moduleExport = require(moduleFilename);
    // Restore the js loader so we don't fuck up more things
    restoreJsLoader();
    return moduleExport;
}
/**
 * Loads the given module into the test harness and returns the module's `module.exports`.
 */
function loadModuleInHarness(moduleFilename, options = {}) {
    let mockedModules;
    if (typeguards_1.isObject(options.mockedModules)) {
        mockedModules = {};
        for (const mod of Object.keys(options.mockedModules)) {
            mockedModules[mod] = createMockModule(mod, options.mockedModules[mod]);
        }
    }
    // Make sure the main file is not already loaded into the require cache
    if (moduleFilename in globalRequire.cache)
        delete globalRequire.cache[moduleFilename];
    return loadModuleInternal(require, moduleFilename, {
        mockedModules,
        fakeNotRequired: options.fakeNotRequired,
        globalPatches: options.globalPatches,
    });
}
exports.loadModuleInHarness = loadModuleInHarness;
