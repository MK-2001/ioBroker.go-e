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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path = __importStar(require("path"));
const tools_1 = require("./tools");
/** The DB connection capsules access to the objects.json and states.json on disk */
class DBConnection {
    /**
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    constructor(appName, testDir) {
        this.appName = appName;
        this.testDir = testDir;
        this.testDataDir = tools_1.getTestDataDir(appName, testDir);
        this.objectsPath = path.join(this.testDataDir, "objects.json");
        this.statesPath = path.join(this.testDataDir, "states.json");
    }
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    readObjectsDB() {
        return __awaiter(this, void 0, void 0, function* () {
            // debug(`reading objects db...`);
            // debug(`  dataDir:     ${dataDir}`);
            // debug(`  objectsPath: ${objectsPath}`);
            if (yield fs_extra_1.pathExists(this.objectsPath)) {
                // debug(`  exists:      true`);
                return fs_extra_1.readJSON(this.objectsPath, { encoding: "utf8" });
            }
        });
    }
    writeObjectsDB(objects) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!objects)
                return;
            return fs_extra_1.writeJSON(this.objectsPath, objects);
        });
    }
    writeStatesDB(states) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!states)
                return;
            return fs_extra_1.writeJSON(this.statesPath, states);
        });
    }
    readStatesDB() {
        return __awaiter(this, void 0, void 0, function* () {
            // debug(`reading states db...`);
            // debug(`  dataDir:     ${dataDir}`);
            // debug(`  statesPath:  ${statesPath}`);
            if (yield fs_extra_1.pathExists(this.statesPath)) {
                // debug(`  exists:      true`);
                return fs_extra_1.readJSON(this.statesPath, { encoding: "utf8" });
            }
        });
    }
    /**
     * Creates a backup of the objects and states DB, so it can be restored after each test
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    readDB() {
        return __awaiter(this, void 0, void 0, function* () {
            const objects = yield this.readObjectsDB();
            const states = yield this.readStatesDB();
            return { objects, states };
        });
    }
    /**
     * Restores a previous backup of the objects and states DB
     * @param appName The branded name of "iobroker"
     * @param testDir The directory the integration tests are executed in
     */
    writeDB(objects, states) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeObjectsDB(objects);
            yield this.writeStatesDB(states);
        });
    }
}
exports.DBConnection = DBConnection;
