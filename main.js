"use strict";

/*
 * Created with @iobroker/create-adapter v1.26.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
// Load your modules here, e.g.:
// const fs = require("fs");
const axios = require("axios").default;
const {default: PQueue} = require("p-queue");
const sentry = require("@sentry/node");
const schema = require("./lib/schema.js").schema;

class GoE extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "go-e",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        // Timer Object for the update interval for ampere to the adapter
        this.ampTimer = null;

        // Translation Object
        this.translationObject = {
            al1: "settings.ampere_level1",
            al2: "settings.ampere_level2",
            al3: "settings.ampere_level3",
            al4: "settings.ampere_level4",
            al5: "settings.ampere_level5",
            lbr: "settings.color.led_brightness"
        };
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info("Server: " + this.config.serverName);
        this.log.info("Intervall: " + this.config.serverInterval);

        if(this.config.sentryEnabled) {
            // Activate Sentry if enabled
            this.log.warn("Sentry enabled. You can switch it off in settings of the adapter.");
            sentry.init({
                dsn: "https://6190adbfedd24ef5ad49d34aa306abd5@o689933.ingest.sentry.io/5774371",

                // Set tracesSampleRate to 1.0 to capture 100%
                // of transactions for performance monitoring.
                // We recommend adjusting this value in production
                tracesSampleRate: 0.05
            });
        }

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("access_state");
        this.subscribeStates("allow_charging");
        this.subscribeStates("ampere");
        this.subscribeStates("amperePV");
        this.subscribeStates("energy.adjustAmpLevelInWatts");
        this.subscribeStates("energy.max_watts");
        this.subscribeStates("max_load");
        this.subscribeStates("settings.ampere_level1");
        this.subscribeStates("settings.ampere_level2");
        this.subscribeStates("settings.ampere_level3");
        this.subscribeStates("settings.ampere_level4");
        this.subscribeStates("settings.ampere_level5");
        this.subscribeStates("settings.color.idle");
        this.subscribeStates("settings.color.charging");
        this.subscribeStates("settings.color.finish");
        this.subscribeStates("settings.led_save_energy");
        this.subscribeStates("settings.led_brightness");
        this.subscribeStates("stop_state");
        this.subscribeStates("unlock_state");

        // get updates from a foreign adapter if it is set in Settings
        if(this.config.houseBatteryForeignObjectID) {
            this.subscribeForeignStates(this.config.houseBatteryForeignObjectID);
            this.log.debug("Subscribe foreign object " + this.config.houseBatteryForeignObjectID);
        }
        if(this.config.houseConsumptionForeignObjectID) {
            this.subscribeForeignStates(this.config.houseConsumptionForeignObjectID);
            this.log.debug("Subscribe foreign object " + this.config.houseConsumptionForeignObjectID);
        }
        if(this.config.solarPowerForeignObjectID) {
            this.subscribeForeignStates(this.config.solarPowerForeignObjectID);
            this.log.debug("Subscribe foreign object " + this.config.solarPowerForeignObjectID);
        }
        // Get all Information for the first time.
        await this.getStateFromDevice();
        // Start the Adapter to sync in the interval
        this.interval = setInterval(async () => {
            await this.getStateFromDevice();
        }, this.config.serverInterval * 1000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);
            // @ts-ignore
            clearInterval(this.interval);
            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack}) namespace: ` + this.namespace);
            if (!state.ack) {
                // If it is already acknoladged, we dont have to send it to the go-eCharger device. Or have to handle the change.
                // Handle null values with the rejection
                if(state.val === null) {
                    this.log.warn("Not able to handle null Values in " + id);
                    return;
                }
                switch (id) {
                    // Sort by alphabet of attribute
                    case this.namespace + ".access_state":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString(), 10) == 1 || parseInt(state.val.toString(), 10) == 2 ) {
                            this.setValue("ast", parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".allow_charging":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString(), 10) == 1 ) {
                            this.setValue("alw", parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".ampere":
                        this.setValue("amp", state.val.toString());
                        break;
                    case this.namespace + ".amperePV":
                        this.setValue("amx", state.val.toString());
                        break;
                    case this.namespace + ".energy.adjustAmpLevelInWatts":
                        this.adjustAmpLevelInWatts(parseInt(state.val.toString(), 10));
                        this.setState("energy.adjustAmpLevelInWatts",      { val: parseInt(state.val.toString(), 10), ack: true });
                        break;
                    case this.namespace + ".energy.max_watts":
                        this.updateAmpLevel(parseInt(state.val.toString()));
                        this.setState("energy.max_watts",                  { val: parseInt(state.val.toString(), 10), ack: true });
                        break;
                    case this.namespace + ".max_load":
                        this.setValue("dwo", parseInt(state.val.toString(), 10) * 10);
                        break;
                    case this.namespace + ".settings.ampere_level1":
                        this.setAmpLevelToButton("al1", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.ampere_level2":
                        this.setAmpLevelToButton("al2", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.ampere_level3":
                        this.setAmpLevelToButton("al3", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.ampere_level4":
                        this.setAmpLevelToButton("al4", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.ampere_level5":
                        this.setAmpLevelToButton("al5", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.color.idle":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.color.charging":
                        // @ts-ignore // Check off null is done
                        this.setValue("cch", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.color.finish":
                        // @ts-ignore // Check off null is done
                        this.setValue("cfi", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.color.led_save_energy":
                        this.setValue("lse", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".settings.color.led_brightness":
                        this.setValue("lbr", parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + ".stop_state":
                        if(parseInt(state.val.toString()) === 0 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue("stp", parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " into " + id);
                        }
                        break;
                    case this.namespace + ".unlock_state":
                        if(parseInt(state.val.toString()) === 0 || parseInt(state.val.toString()) === 1 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue("ust", parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " into " + id);
                        }

                        break;
                    case this.config.solarPowerForeignObjectID:
                    case this.config.houseBatteryForeignObjectID:
                    case this.config.houseConsumptionForeignObjectID:
                        this.calculateFromForeignObjects(id);
                        break;
                    default:
                        this.log.error("Not deveoped function to write " + id + " with state " + state);
                }
            }
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }


    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === "object" && obj.message) {
    //         if (obj.command === "send") {
    //             // e.g. send email or pushover or whatever
    //             this.log.info("send command");

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    //         }
    //     }
    // }

    // go-eCharger functions
    async getStateFromDevice() {
        this.log.debug("Starte Abfrage an: http://" + this.config.serverName + "/status");
        axios.defaults.baseURL = "http://" + this.config.serverName;
        await axios.get("/status")
            .then((o) => {
                this.log.debug("Response: " + o.status + " - " + o.statusText + " with data as " + typeof o.data);
                this.log.debug(JSON.stringify(o.data));
                if(typeof o.data != "object") {
                    sentry.captureException("Respose id type " + (typeof o.data) + "; " + JSON.stringify(o.data));
                    this.log.error("Respose id type " + (typeof o.data) + "; " + JSON.stringify(o.data));
                } else {
                    const validation = schema.validate(o.data,{abortEarly: false});
                    if (validation.error || validation.value === undefined) {
                        if (validation.value === undefined) {
                            this.log.error("API send no content");
                        } else {
                            sentry.captureException(validation.error);
                            this.log.error("API response validation error: " + JSON.stringify(validation.error.details));
                            this.log.info(JSON.stringify(validation.error._original));
                        }
                    } else {
                        this.processStatusObject(o.data);
                    }
                }
            })
            .catch(e => {
                if(e.code ==  "ENOTFOUND") {
                    this.setState("info.connection", false, true);
                    this.log.warn("Host not found: " + this.config.serverName);
                } else if(e.code == "ECONNRESET") {
                    this.setState("info.connection", false, true);
                    this.log.warn("Cant connect to host " + this.config.serverName);
                } else {
                    this.log.error(e.message);
                    sentry.captureException(e);
                }
            })
            .then(() => {
                this.setState("info.connection", true, true);
            });
    }

    /**
     * Process a default status response as descibed in the api documentation of go-eCharger
     * @param {object} o
     */
    async processStatusObject(o) {
        try {

            // Const for variable pha
            const postContactorPhase1 = 1;
            const postContactorPhase2 = 2;
            const postContactorPhase3 = 4;
            const preContactorPhase1 = 8;
            const preContactorPhase2 = 16;
            const preContactorPhase3 = 32;

            // Allows only 4 asnychronous calls others are queued
            const queue = new PQueue({concurrency: 4});

            await queue.add(() => this.setState("encryption",                         { val: o.version == "C" ? true : false, ack: true })); // read

            // Write the whole object for debugging in a State
            await queue.add(() => this.setObjectNotExists("stateObject", o));

            try {
                // TME provides 2208201643
                // Realdate: 22th August 2020 at 16:43 (CET)
                const reggie = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
                    // @ts-ignore
                    , [, day, month, year, hours, minutes] = reggie.exec(o.tme)
                    , dateObject = new Date(parseInt(year, 10)+2000, parseInt(month, 10)-1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), 0);
                await queue.add(() => this.setState("synctime",                           { val: dateObject.toISOString(), ack: true }));
            } catch (e) {
                this.log.warn("Cloud not store synctime, because of error " + e.message);
                sentry.captureException(e);
            }

            await queue.add(() => this.setState("reboot_counter",                     { val: parseInt(o.rbc, 10), ack: true })); // read
            await queue.add(() => this.setState("reboot_timer",                       { val: parseInt(o.rbt, 10), ack: true })); // read
            await queue.add(() => this.setState("car",                                { val: parseInt(o.car, 10), ack: true })); // read
            await queue.add(() => this.setState("ampere",                             { val: parseInt(o.amp, 10), ack: true })); // write
            if(o.amx === undefined || o.amx == null) {
                await queue.add(() => this.setState("amperePV",                       { val: parseInt(o.amp, 10), ack: true })); // COPY AMP Value to AMX
            } else {
                await queue.add(() => this.setState("amperePV",                       { val: parseInt(o.amx, 10), ack: true })); // write
            }

            await queue.add(() => this.setState("error",                              { val: parseInt(o.err, 10), ack: true })); // read
            await queue.add(() => this.setState("access_state",                       { val: parseInt(o.ast, 10), ack: true })); // write
            await queue.add(() => this.setState("allow_charging",                     { val: parseInt(o.alw, 10), ack: true })); // write
            await queue.add(() => this.setState("stop_state",                         { val: parseInt(o.stp, 10), ack: true })); // write

            await queue.add(() => this.setState("phases",                             { val: parseInt(o.pha, 10), ack: true })); // read
            // Split phases in single states
            await queue.add(() => this.setState("energy.phase1.preContactorActive",   { val: ((parseInt(o.pha, 10) & preContactorPhase1) == preContactorPhase1), ack: true})); //read
            await queue.add(() => this.setState("energy.phase1.postContactorActive",  { val: ((parseInt(o.pha, 10) & postContactorPhase1) == postContactorPhase1), ack: true})); //read
            await queue.add(() => this.setState("energy.phase2.preContactorActive",   { val: ((parseInt(o.pha, 10) & preContactorPhase2) == preContactorPhase2), ack: true})); //read
            await queue.add(() => this.setState("energy.phase2.postContactorActive",  { val: ((parseInt(o.pha, 10) & postContactorPhase2) == postContactorPhase2), ack: true})); //read
            await queue.add(() => this.setState("energy.phase3.preContactorActive",   { val: ((parseInt(o.pha, 10) & preContactorPhase3) == preContactorPhase3), ack: true})); //read
            await queue.add(() => this.setState("energy.phase3.postContactorActive",  { val: ((parseInt(o.pha, 10) & postContactorPhase3) == postContactorPhase3), ack: true})); //read
            await queue.add(() => this.setState("energy.phase1.voltage",              { val: parseInt(o.nrg[0], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.voltage",              { val: parseInt(o.nrg[1], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.voltage",              { val: parseInt(o.nrg[2], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.voltage",             { val: parseInt(o.nrg[3], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.ampere",               { val: (o.nrg[4] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.ampere",               { val: (o.nrg[5] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.ampere",               { val: (o.nrg[6] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.power",                { val: (o.nrg[7] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.power",                { val: (o.nrg[8] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.power",                { val: (o.nrg[9] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.power",               { val: (o.nrg[10] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.power",                       { val: (o.nrg[11] / 100), ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.power_coefficient",    { val: parseInt(o.nrg[12], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.power_coefficient",    { val: parseInt(o.nrg[13], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.power_coefficient",    { val: parseInt(o.nrg[14], 10), ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.power_coefficient",   { val: parseInt(o.nrg[15], 10), ack: true })); // read
            await queue.add(() => this.setState("cable_ampere_code",                  { val: parseInt(o.cbl), ack: true })); // read
            await queue.add(() => this.setState("avail_ampere",                       { val: parseInt(o.amt, 10), ack: true }));
            await queue.add(() => this.setState("energy.total",                       { val: (o.eto / 10), ack: true })); // read
            // Wifi
            await queue.add(() => this.setState("wifi.state",                         { val: parseInt(o.wst, 10), ack: true })); // read
            if(o.txi != undefined) {
                await queue.add(() => this.setState("transmit_interface",                 { val: o.txi, ack: true }));
            }
            await queue.add(() => this.setState("wifi.ssid",                          { val: o.wss, ack: true })); // write
            await queue.add(() => this.setState("wifi.key",                           { val: o.wke, ack: true })); // write
            await queue.add(() => this.setState("wifi.enabled",                       { val: parseInt(o.wen, 10), ack: true })); // write
            await queue.add(() => this.setState("cloud_disabled",                     { val: parseInt(o.cdi, 10), ack: true }));
            await queue.add(() => this.setState("wifi.hotspot_key",                   { val: o.wak, ack: true })); // write
            await queue.add(() => this.setState("http_flags",                         { val: parseInt(o.r1x, 10), ack: true })); // write
            await queue.add(() => this.setState("loaded_energy",                      { val: parseInt(o.dws, 10), ack: true })); // read
            if(/^050/.test(o.fwv)) {
                await queue.add(() => this.setState("loaded_energy_kwh",                  { val: o.dws / 100, ack: true}));
            } else {
                await queue.add(() => this.setState("loaded_energy_kwh",                  { val: o.dws * 10 / 60 / 60 / 1000, ack: true}));
            }
            await queue.add(() => this.setState("max_load",                           { val: (o.dwo / 10), ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.min_hours",     { val: parseInt(o.aho, 10), ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.finish_hour",   { val: parseInt(o.afi, 10), ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.price_zone",    { val: parseInt(o.azo, 10), ack: true }));
            await queue.add(() => this.setState("max_ampere",                         { val: parseInt(o.ama, 10), ack: true }));
            await queue.add(() => this.setState("firmware_version",                   { val: o.fwv, ack: true })); // read
            await queue.add(() => this.setState("serial_number",                      { val: o.sse, ack: true })); // read
            await queue.add(() => this.setState("settings.color.led_brightness",      { val: parseInt(o.lbr, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level1",             { val: parseInt(o.al1, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level2",             { val: parseInt(o.al2, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level3",             { val: parseInt(o.al3, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level4",             { val: parseInt(o.al4, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level5",             { val: parseInt(o.al5, 10), ack: true })); // write
            await queue.add(() => this.setState("settings.color.idle",                { val: "#" + ("000000" + parseInt(o.cid, 10).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("settings.color.charging",            { val: "#" + ("000000" + parseInt(o.cch, 10).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("settings.color.finish",              { val: "#" + ("000000" + parseInt(o.cfi, 10).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("time_offset",                        { val: parseInt(o.tof, 10), ack: true})); // write
            await queue.add(() => this.setState("time_daylight_saving",               { val: parseInt(o.tds, 10), ack: true })); // write
            // RFID Badges
            await queue.add(() => this.setState("rfid.badges.1.consumption",          { val: (o.eca / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.2.consumption",          { val: (o.ecr / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.3.consumption",          { val: (o.ecd / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.4.consumption",          { val: (o.ec4 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.5.consumption",          { val: (o.ec5 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.6.consumption",          { val: (o.ec6 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.7.consumption",          { val: (o.ec7 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.8.consumption",          { val: (o.ec8 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.9.consumption",          { val: (o.ec9 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.10.consumption",         { val: (o.ec1 / 10), ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.1.id",                   { val: o.rca, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.2.id",                   { val: o.rcr, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.3.id",                   { val: o.rcd, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.4.id",                   { val: o.rc4, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.5.id",                   { val: o.rc5, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.6.id",                   { val: o.rc6, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.7.id",                   { val: o.rc7, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.8.id",                   { val: o.rc8, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.9.id",                   { val: o.rc9, ack: true })); // read
            await queue.add(() => this.setState("rfid.badges.10.id",                  { val: o.rc1, ack: true })); // read
            // RFID Name
            await queue.add(() => this.setState("rfid.badges.1.name",                 { val: o.rna, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.2.name",                 { val: o.rnm, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.3.name",                 { val: o.rne, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.4.name",                 { val: o.rn4, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.5.name",                 { val: o.rn5, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.6.name",                 { val: o.rn6, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.7.name",                 { val: o.rn7, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.8.name",                 { val: o.rn8, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.9.name",                 { val: o.rn9, ack: true })); // write
            await queue.add(() => this.setState("rfid.badges.10.name",                { val: o.rn1, ack: true })); // write
            // MQTT Block
            if(o.mce != undefined) {
                await queue.add(() => this.setState("mqtt.enabled",                       { val: parseInt(o.mce, 10), ack: true }));
            }
            await queue.add(() => this.setState("mqtt.server",                        { val: o.mcs, ack: true }));
            if(o.mcp != undefined) {
                await queue.add(() => this.setState("mqtt.port",                          { val: o.mcp, ack: true }));
            }

            await queue.add(() => this.setState("mqtt.user",                          { val: o.mcu, ack: true }));
            await queue.add(() => this.setState("mqtt.key",                           { val: o.mck, ack: true }));
            if(o.mcc != undefined) {
                await queue.add(() => this.setState("mqtt.connection",                    { val: o.mcc, ack: true }));
            }
            if(o.tmp != undefined) {
                await queue.add(() => this.setState("temperatures.maintempereature",      { val: parseInt(o.tmp, 10), ack: true })); // read
            }
            if(this.config.writeTemperatureArray) {
                await queue.add(() => this.setState("temperatures.tempereatureArray",     { val: o.tma, ack: true }));
            }
            try {
                if(o.tma) {
                    const tempArr = o.tma.toString().split(",");
                    for(let i = 0; i<tempArr.length; i++) {
                        await queue.add(() => this.setState("temperatures.tempereature" + (i+1), { val: Number(tempArr[i]), ack: true}));
                    }
                }
            } catch (e) {
                this.log.warn("Cloud not store temperature array to single values, because of error " + e.message);
                sentry.captureException(e);
            }
            await queue.add(() => this.setState("adapter_in",                         { val: parseInt(o.adi, 10), ack: true })); // read
            await queue.add(() => this.setState("unlocked_by",                        { val: parseInt(o.uby, 10), ack: true })); // read
            await queue.add(() => this.setState("settings.color.led_save_energy",     { val: parseInt(o.lse, 10), ack: true })); // write
            await queue.add(() => this.setState("unlock_state",                       { val: parseInt(o.ust, 10), ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.balance_time",  { val: parseInt(o.dto, 10), ack: true })); // write
            await queue.add(() => this.setState("energy.norway_mode",                 { val: parseInt(o.nmo, 10), ack: true })); // write
            await queue.add(() => this.setState("scheduler_settings",                 { val: o.sch, ack: true }));
            await queue.add(() => this.setState("scheduler_double_press",             { val: parseInt(o.sdp, 10), ack: true })); //
            if(o.lon != undefined && false) {
                await queue.add(() => this.setState("lon",                            { val: o.lon, ack: true })); // Lastmanagement: erwartete Anzahl von Ladestationen (derzeit nicht unterstützt)
            }
        } catch (e) {
            this.log.warn("Error in go.e: " + JSON.stringify(e.message) + "; Stack: " + e.stack);
            sentry.captureException(e);
        }
    }
    /**
     *
     * @param {string} id
     * @param {string | number | boolean} value
     */
    setValue(id, value) {
        // const transaction = sentry.startTransaction({
        //    op: "setValue",
        //    name: "setValue(" + id + ", " + value + ")"
        //});
        this.log.info("Set value " + value + " of id " + id);
        axios.get("http://" + this.config.serverName + "/mqtt?payload=" + id + "=" + value)
            .then(o => {
                this.log.info(o.status + " with message: " + o.statusText);
                this.processStatusObject(o.data);
            })
            .catch(err => {
                this.log.error(err.message + " at " + id + " / " + value);
                sentry.captureException(err);
            });
        //transaction.finish();
    }
    /**
     * Set the maximum ampere level to the device by using watts. But not Updates it more than x seconds. Setting ampUpdateInterval
     * @param {number} watts
     */
    async updateAmpLevel(watts) {
        if (!this.ampTimer) {
            this.ampTimer = setTimeout(() => {
                this.ampTimer = null;
            }, this.config.ampUpdateInterval * 1000);
            const transaction = sentry.startTransaction({
                op: "updateAmpLevel",
                name: "updateAmpLevel(" + watts + ")"
            });
            try {
                // San for active phases on Adapter
                const prePhase1   = await this.getStateAsync("energy.phase1.preContactorActive");
                const prePhase2   = await this.getStateAsync("energy.phase2.preContactorActive");
                const prePhase3   = await this.getStateAsync("energy.phase3.preContactorActive");
                const avgVoltage1 = await this.getStateAsync("energy.phase1.voltage");
                const avgVoltage2 = await this.getStateAsync("energy.phase2.voltage");
                const avgVoltage3 = await this.getStateAsync("energy.phase3.voltage");
                const curAmpPha1  = await this.getStateAsync("energy.phase1.ampere");
                const curAmpPha2  = await this.getStateAsync("energy.phase2.ampere");
                const curAmpPha3  = await this.getStateAsync("energy.phase3.ampere");
                const car         = await this.getStateAsync("car");

                if(prePhase1 === null || prePhase1 === undefined || prePhase1.val === null ||
                   prePhase2 === null || prePhase2 === undefined || prePhase2.val === null ||
                   prePhase3 === null || prePhase3 === undefined || prePhase3.val === null ) {
                    this.log.error("Not all required information about the phases are found. Required Values are: energy.phaseX.preContactorActive");
                    return;
                }
                if(avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null ||
                   avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null ||
                   avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null ) {
                    this.log.error("Not all required information about the phases are found. Required Values are: energy.phaseX.voltage");
                    return;
                }
                if(curAmpPha1 === null || curAmpPha1 === undefined || curAmpPha1.val === null ||
                   curAmpPha2 === null || curAmpPha2 === undefined || curAmpPha2.val === null ||
                   curAmpPha3 === null || curAmpPha3 === undefined || curAmpPha3.val === null ) {
                    this.log.error("Not all required information about the phases are found. Required Values are: energy.phaseX.ampere");
                    return;
                }
                if(car === null || car === undefined || car.val === null) {
                    this.log.error("Not all required information about the phases are found. Required Values are: car");
                    return;
                }

                // Check which & how many phases are used for loading and summarize of these phases the volts
                let sumVolts = 0;
                if(car.val === 2) {
                    if(curAmpPha1.val > 0) {
                        sumVolts += parseInt(avgVoltage1.val.toString());
                    }
                    if(curAmpPha2.val > 0) {
                        sumVolts += parseInt(avgVoltage2.val.toString());
                    }
                    if(curAmpPha3.val > 0) {
                        sumVolts += parseInt(avgVoltage3.val.toString());
                    }
                } else {
                    sumVolts = Math.round((prePhase1.val === true ? parseInt(avgVoltage1.val.toString(), 10) : 0 ) +
                                (prePhase2.val === true ? parseInt(avgVoltage2.val.toString(), 10) : 0 ) +
                                (prePhase3.val === true ? parseInt(avgVoltage3.val.toString(), 10) : 0 ));
                }

                this.log.debug("Total "+ (car.val == 2 ? "used ":"available ") + sumVolts + " volts");
                const maxAmp = Math.round(watts/sumVolts);
                this.log.debug("Resulting max of " + maxAmp + " Ampere");
                // Get Firmware Version if amx is available
                const fw = await this.getStateAsync("firmware_version");
                let amp = "";
                if(fw != undefined && fw != null && parseInt(fw.toString()) > 33) {
                    // Use AMX insted of AMP. Becaus the EEPROM of amp is only 100.000 times writeable
                    // Available by firmware > 033
                    amp = "amx";
                } else {
                    amp = "amp";
                }
                if(maxAmp < 6) {
                    // The smallest value is 6 amperes
                    this.setValue(amp, 6);
                    this.log.debug("set maxAmperes (" + amp + ") by maxWatts: 6 amperes with " + watts + " watts");
                } else if(maxAmp < 32) {
                    this.setValue(amp, maxAmp);
                    this.log.debug("set maxAmperes (" + amp + ") by maxWatts: " + maxAmp + " with " + watts + " watts");
                } else {
                    // The maximum is 32 Amperes
                    this.setValue(amp, 32);
                    this.log.debug("set maxAmperes (" + amp + ") by maxWatts: 32 with " + watts + " watts");
                }
            } catch (e) {
                this.log.error("Error during set MaxWatts: " + e.message);
            }
            transaction.finish();
        } else {
            // Still existing Block-Timer
            this.log.warn("MaxWatts ignored. You are sending to fast! Update interval in settings is currently set to: " + this.config.ampUpdateInterval);
        }
    }
    /**
     * Adjust the Ampere Level by set the amount of watts
     */
    async adjustAmpLevelInWatts(changeWatts) {
        if (!this.ampTimer) {
            this.ampTimer = setTimeout(() => {
                this.ampTimer = null;
            }, this.config.ampUpdateInterval * 1000);
            const transaction = sentry.startTransaction({
                op: "adjustAmpLevelInWatts",
                name: "adjustAmpLevelInWatts(" + changeWatts + ")"
            });
            try {
                const avgVoltage1 = await this.getStateAsync("energy.phase1.voltage");
                if(avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase1.voltage");
                    return;
                }
                const avgVoltage2 = await this.getStateAsync("energy.phase2.voltage");
                if(avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase2.voltage");
                    return;
                }
                const avgVoltage3 = await this.getStateAsync("energy.phase3.voltage");
                if(avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase3.voltage");
                    return;
                }
                const curAmpPha1 = await this.getStateAsync("energy.phase1.ampere");
                if(curAmpPha1 === null || curAmpPha1 === undefined || curAmpPha1.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase1.ampere");
                    return;
                }
                const curAmpPha2 = await this.getStateAsync("energy.phase2.ampere");
                if(curAmpPha2 === null || curAmpPha2 === undefined || curAmpPha2.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase2.ampere");
                    return;
                }
                const curAmpPha3 = await this.getStateAsync("energy.phase3.ampere");
                if(curAmpPha3 === null || curAmpPha3 === undefined || curAmpPha3.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase3.ampere");
                    return;
                }
                const car = await this.getStateAsync("car");
                if(car === null || car === undefined || car.val === null) {
                    this.log.error("adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: car");
                    return;
                }

                if(car.val != 2) {
                    this.log.debug("Ignore to chnage ampere level by watts, because there is no car loading.");
                    return;
                }

                let usedAmperes = 0;
                let usedVolts = 0;
                let usedWatts = 0;
                let usedPhases = 0;

                // Check which phases are currently used
                if(curAmpPha1.val > 0) {
                    usedVolts += parseInt(avgVoltage1.val.toString(), 10);
                    usedAmperes += parseInt(curAmpPha1.val.toString(), 10);
                    usedWatts += parseInt(avgVoltage1.val.toString(), 10) * parseInt(curAmpPha1.val.toString(), 10);
                    usedPhases += 1;
                }
                if(curAmpPha2.val > 0) {
                    usedVolts += parseInt(avgVoltage2.val.toString(), 10);
                    usedAmperes += parseInt(curAmpPha2.val.toString(), 10);
                    usedWatts += parseInt(avgVoltage2.val.toString(), 10) * parseInt(curAmpPha2.val.toString(), 10);
                    usedPhases += 1;
                }
                if(curAmpPha3.val > 0) {
                    usedVolts += parseInt(avgVoltage3.val.toString(), 10);
                    usedAmperes += parseInt(curAmpPha3.val.toString(), 10);
                    usedWatts += parseInt(avgVoltage3.val.toString(), 10) * parseInt(curAmpPha3.val.toString(), 10);
                    usedPhases += 1;
                }
                // Currents Watts + adjustment / average Volts / usedPhases => max Ampere
                // Example: 3 Phases, 220V , Current 14 A (Adding 2A each Phase)
                // (9240 W + 1320) / (660 / 3) / 3 => 16 A
                const maxAmp = Math.round((usedWatts + changeWatts) / (usedVolts / usedPhases) / usedPhases);
                this.log.debug("Current used " + Math.round(usedWatts) +  " Watts with " + usedAmperes + " Ampere (sum) by " + usedPhases + "Phases and adjusting this with  " + changeWatts + " watts by " + (usedVolts / usedPhases) + " Volts (avg) to new max of " + maxAmp + " Amperes per Phase");

                // Get Firmware Version if amx is available
                const fw = await this.getStateAsync("firmware_version");
                let amp = "";
                if(fw != undefined && fw != null && parseInt(fw.toString(), 10) > 33) {
                    amp = "amp";
                } else {
                    // Use AMX insted of AMP. Becaus the EEPROM of amp is only 100.000 times writeable
                    amp = "amx";
                }
                if(maxAmp < 6) {
                    // The smallest value is 6 amperes
                    this.setValue(amp, 6);
                    this.log.debug("set maxAmperes (" + amp + ") by adjustAmpLevelInWatts: 6 amperes by " + changeWatts + " watts");
                } else if(maxAmp < 32) {
                    this.setValue(amp, maxAmp);
                    this.log.debug("set maxAmperes (" + amp + ") by adjustAmpLevelInWatts: " + maxAmp + " with " + changeWatts + " watts");
                } else {
                    // The maximum is 32 Amperes
                    this.setValue(amp, 32);
                    this.log.debug("set maxAmperes (" + amp + ") by adjustAmpLevelInWatts: 32 with " + changeWatts + " watts");
                }
            } catch (e) {
                this.log.error("Error during set adjust Watts: " + e.message);
                sentry.captureException(e);
            }
            transaction.finish();
        } else {
            // Still existing Block-Timer
            this.log.warn("MaxWatts ignored. You are sending to fast! Update interval in settings is currently set to: " + this.config.ampUpdateInterval);
        }
    }
    /**
     * Get the max Watts from foreign adapters
     */
    async calculateFromForeignObjects(adapterName = "unknown") {

        const transaction = sentry.startTransaction({
            op: "calculateFromForeignObjects",
            name: "calculateFromForeignObjects(" + adapterName + ")"
        });
        try {
            const usedPower = await this.getStateAsync("energy.power");
            // Check if used Power has a value
            if(usedPower === undefined || usedPower == null || usedPower.val == null) {
                this.log.debug("No actual energy.power found. Abort recalculation by foreign adapter.");
                return;
            }

            let availWatts = 0;
            availWatts += (await this.getNumberFromForeignObjectId(this.config.solarPowerForeignObjectID));
            if(availWatts >= this.config.bufferToSolar) {
                availWatts -= this.config.bufferToSolar;
            }
            availWatts -= await this.getNumberFromForeignObjectId(this.config.houseConsumptionForeignObjectID);
            let houseBattery = await this.getNumberFromForeignObjectId(this.config.houseBatteryForeignObjectID);
            if(houseBattery > this.config.bufferToBattery) {
                houseBattery -= this.config.bufferToBattery;
            } else {
                houseBattery = 0;
            }
            availWatts += houseBattery;
            // If your home battery contains 3000 Wh use in one hour the whole energy to load.
            //

            this.log.debug("Start ajust by foreign Object with " + (availWatts - parseInt(usedPower.val.toString(), 10)) + " Watts");
            this.adjustAmpLevelInWatts(availWatts - parseInt(usedPower.val.toString(), 10));
        } catch (err) {
            this.log.error("Error in calculateFromForeignObjects: " + JSON.stringify(err));
        }
        transaction.finish();
    }
    /**
     * get a number from a foreign object id or reply with a default value
     * @param {string} ObjectId
     * @param {number} defaultValue
     * @returns number
     */
    async getNumberFromForeignObjectId(ObjectId, defaultValue = 0) {
        try {
            const obj = await this.getForeignStateAsync(ObjectId);
            if(obj != null && obj != undefined && obj.val != null) {
                return parseInt(obj.val.toString(), 10);
            } else {
                return defaultValue;
            }
        } catch (err) {
            return defaultValue;
        }
    }
    /**
     * set amplevel to button
     * @param {string} attribute be al1, al2, al3, al4, al5
     * @param {number} ampLvl is the value to be set
     */
    async setAmpLevelToButton(attribute, ampLvl) {
        if(ampLvl >= 6 && ampLvl <= 32) {
            this.setValue(attribute, ampLvl);
            this.setState(this.translationObject[attribute], { val: ampLvl, ack: true });
        } else {
            this.log.warn("Cant set " + ampLvl + " to " + attribute + "it must be between 6 and 32 ampere");
            sentry.captureException("Cant set " + ampLvl + " to " + attribute + "it must be between 6 and 32 ampere");
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new GoE(options);
} else {
    // otherwise start the instance directly
    new GoE();
}