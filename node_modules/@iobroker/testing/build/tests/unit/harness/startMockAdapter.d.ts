/// <reference types="iobroker" />
import { MockAdapter } from "../mocks/mockAdapter";
import { MockDatabase } from "../mocks/mockDatabase";
export interface StartMockAdapterOptions {
    /** A specific directory to use as the adapter dir. If none is given, all paths are relative */
    adapterDir?: string;
    /** Whether the adapter should be started in compact mode */
    compact?: boolean;
    /** The adapter config */
    config?: Record<string, any>;
    /** An array of objects that should be populated before starting the adapter */
    predefinedObjects?: ioBroker.Object[];
    /** A dictionary of states that should be populated before starting the adapter */
    predefinedStates?: Record<string, ioBroker.State>;
    /** Mocks for loaded modules. This should be a dictionary of module name to module.exports */
    additionalMockedModules?: Record<string, any>;
    /** Allows you to modifiy the behavior of predefined mocks in the predefined methods */
    defineMockBehavior?: (database: MockDatabase, adapter: MockAdapter) => void;
}
/**
 * Starts an adapter by executing its main file in a controlled offline environment.
 * The JS-Controller is replaced by mocks for the adapter and Objects and States DB, so
 * no working installation is necessary.
 * This method may throw (or reject) if something goes wrong during the adapter startup.
 * It returns an instance of the mocked adapter class and the database, so you can perform further tests.
 *
 * @param adapterMainFile The main file of the adapter to start. Must be an absolute path.
 */
export declare function startMockAdapter(adapterMainFile: string, options?: StartMockAdapterOptions): Promise<{
    databaseMock: MockDatabase;
    adapterMock: MockAdapter | undefined;
    processExitCode: number | undefined;
    terminateReason: string | undefined;
}>;
export declare function unloadMockAdapter(adapter: MockAdapter, timeout?: number): Promise<boolean>;
