/// <reference types="node" />
import Module from "module";
export declare type NodeRequireFunction = (id: string) => any;
export declare type LoaderFunction = (m: NodeModule, filename: string) => any;
export declare function createMockRequire(originalRequire: NodeRequire, options: LoadModuleOptions): NodeRequireFunction;
/**
 * Monkey-patches module code before executing it by wrapping it in an IIFE whose arguments are modified (proxied) globals
 * @param code The code to monkey patch
 * @param globals A dictionary of globals and their properties to be replaced
 */
export declare function monkeyPatchGlobals(code: string, globals: Record<string, Record<string, any>>): string;
/** Removes a hashbang from the code if it exists since that causes compilation errors */
export declare function removeHashbang(code: string): string;
/** A test-safe replacement for process.exit that throws a specific error instead */
export declare function fakeProcessExit(code?: number): never;
/**
 * Replaces NodeJS's default loader for .js-files with the given one and returns the original one
 */
export declare function replaceJsLoader(loaderFunction: LoaderFunction): void;
/**
 * Replaces a replaced loader for .js-files with the original one
 */
export declare function restoreJsLoader(): void;
export interface HarnessOptions {
    /** Mocks for loaded modules. This should be a dictionary of module name to module.exports */
    mockedModules?: Record<string, any>;
    /** Whether the main module should believe that it was not required */
    fakeNotRequired?: boolean;
    /** Patches for global objects like `process` */
    globalPatches?: Record<string, Record<string, any>>;
}
interface LoadModuleOptions {
    /** Mocks for loaded modules. This should be a dictionary of module name to module objects */
    mockedModules?: Record<string, Module>;
    /** Whether the main module should believe that it was not required */
    fakeNotRequired?: boolean;
    /** Patches for global objects like `process` */
    globalPatches?: Record<string, Record<string, any>>;
    relativeToFile?: string;
}
/**
 * Loads the given module into the test harness and returns the module's `module.exports`.
 */
export declare function loadModuleInHarness(moduleFilename: string, options?: HarnessOptions): unknown;
export {};
