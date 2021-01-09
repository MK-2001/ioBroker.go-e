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

        
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates("access_state");
        this.subscribeStates("allow_charging");
        this.subscribeStates("ampere");
        this.subscribeStates("color.*");
        this.subscribeStates("energy.adjustAmpLevelInWatts");
        this.subscribeStates("energy.max_watts");
        this.subscribeStates("max_load");
        this.subscribeStates("settings.ampere_level1");
        this.subscribeStates("settings.ampere_level2");
        this.subscribeStates("settings.ampere_level3");
        this.subscribeStates("settings.ampere_level4");
        this.subscribeStates("settings.ampere_level5");
        this.subscribeStates("settings.color.led_save_energy");
        this.subscribeStates("settings.color.led_brightness");
        this.subscribeStates("stop_state");
        
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
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 1 ) {
                            this.setValue("ast", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".allow_charging":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 1 ) {
                            this.setValue("alw", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
                        break;
                    case this.namespace + ".ampere":
                        this.setValue("amp", state.val.toString());
                        break;
                    case this.namespace + ".energy.adjustAmpLevelInWatts":
                        this.adjustAmpLevelInWatts(parseInt(state.val.toString()));
                        this.setState("energy.changeAmpLevelInWatts",      { val: parseInt(state.val.toString()), ack: true }); 
                        break;
                    case this.namespace + ".energy.max_watts":
                        this.updateAmpLevel(parseInt(state.val.toString()));
                        this.setState("energy.max_watts",                  { val: parseInt(state.val.toString()), ack: true }); 
                        break;
                    case this.namespace + ".max_load":
                        this.setValue("dwo", parseInt(state.val.toString()) * 10);
                        break;
                    case this.namespace + ".settings.ampere_level1":
                        this.setAmpLevelToButton("al1", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.ampere_level2":
                        this.setAmpLevelToButton("al2", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.ampere_level3":
                        this.setAmpLevelToButton("al3", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.ampere_level4":
                        this.setAmpLevelToButton("al4", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.ampere_level5":
                        this.setAmpLevelToButton("al5", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.color.idle":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.color.charging":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.color.finish":
                        // @ts-ignore // Check off null is done
                        this.setValue("cid", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + ".settings.led_save_energy":
                        this.setValue("lse", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".settings.led_brightness":
                        this.setValue("lbr", parseInt(state.val.toString()));
                        break;
                    case this.namespace + ".stop_state":
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue("stp", parseInt(state.val.toString()));
                        } else {
                            this.log.warn("Could not set value " + state.val.toString() + " in " + id);
                        }
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
                this.log.debug("Response: " + o.status + " - " + o.statusText);
                this.log.debug(JSON.stringify(o.data));

                this.processStatusObject(o.data);
                
            })
            .catch(e => {
                this.log.error(e.message);
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

            // TME provides 2208201643
            // Realdate: 22th August 2020 at 16:43 (CET)
            const reggie = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
                // @ts-ignore
                , [, year, month, day, hours, minutes] = reggie.exec(o.tme)
                , dateObject = new Date(parseInt(year)+2000, parseInt(month)-1, parseInt(day), parseInt(hours), parseInt(minutes), 0);

            await queue.add(() => this.setState("synctime",                           { val: dateObject, ack: true })); 
            await queue.add(() => this.setState("reboot_counter",                     { val: o.rbc, ack: true })); // read
            await queue.add(() => this.setState("reboot_timer",                       { val: o.rbt, ack: true })); // read
            await queue.add(() => this.setState("car",                                { val: o.car, ack: true })); // read
            await queue.add(() => this.setState("ampere",                             { val: o.amp, ack: true })); // write
            await queue.add(() => this.setState("error",                              { val: o.err, ack: true })); // read
            await queue.add(() => this.setState("access_state",                       { val: o.ast, ack: true })); // write
            await queue.add(() => this.setState("allow_charging",                     { val: o.alw, ack: true })); // write
            await queue.add(() => this.setState("stop_state",                         { val: o.stp, ack: true })); // write
            
            await queue.add(() => this.setState("phases",                             { val: o.pha, ack: true })); // read
            // Split phases in single states
            await queue.add(() => this.setState("energy.phase1.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase1) == preContactorPhase1), ack: true})); //read
            await queue.add(() => this.setState("energy.phase1.postContactorActive",  { val: ((parseInt(o.pha) & postContactorPhase1) == postContactorPhase1), ack: true})); //read
            await queue.add(() => this.setState("energy.phase2.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase2) == preContactorPhase2), ack: true})); //read
            await queue.add(() => this.setState("energy.phase2.postContactorActive",  { val: ((parseInt(o.pha) & postContactorPhase2) == postContactorPhase2), ack: true})); //read
            await queue.add(() => this.setState("energy.phase3.preContactorActive",   { val: ((parseInt(o.pha) & preContactorPhase3) == preContactorPhase3), ack: true})); //read
            await queue.add(() => this.setState("energy.phase3.postContactorActive",  { val: ((parseInt(o.pha) & postContactorPhase3) == postContactorPhase3), ack: true})); //read
            await queue.add(() => this.setState("energy.phase1.voltage",              { val: o.nrg[0], ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.voltage",              { val: o.nrg[1], ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.voltage",              { val: o.nrg[2], ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.voltage",             { val: o.nrg[3], ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.ampere",               { val: (o.nrg[4] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.ampere",               { val: (o.nrg[5] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.ampere",               { val: (o.nrg[6] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.power",                { val: (o.nrg[7] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.power",                { val: (o.nrg[8] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.power",                { val: (o.nrg[9] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.power",               { val: (o.nrg[10] / 10), ack: true })); // read
            await queue.add(() => this.setState("energy.power",                       { val: (o.nrg[11] / 100), ack: true })); // read
            await queue.add(() => this.setState("energy.phase1.power_coefficient",    { val: o.nrg[12], ack: true })); // read
            await queue.add(() => this.setState("energy.phase2.power_coefficient",    { val: o.nrg[13], ack: true })); // read
            await queue.add(() => this.setState("energy.phase3.power_coefficient",    { val: o.nrg[14], ack: true })); // read
            await queue.add(() => this.setState("energy.neutral.power_coefficient",   { val: o.nrg[15], ack: true })); // read
            await queue.add(() => this.setState("cable_ampere_code",                  { val: o.cbl, ack: true })); // read
            await queue.add(() => this.setState("avail_ampere",                       { val: o.amt, ack: true }));
            await queue.add(() => this.setState("energy.total",                       { val: (o.eto / 10), ack: true })); // read
            // Wifi
            await queue.add(() => this.setState("wifi.state",                         { val: o.wst, ack: true })); // read
            await queue.add(() => this.setState("transmit_interface",                 { val: o.txi, ack: true }));
            await queue.add(() => this.setState("wifi.ssid",                          { val: o.wss, ack: true })); // write
            await queue.add(() => this.setState("wifi.key",                           { val: o.wke, ack: true })); // write
            await queue.add(() => this.setState("wifi.enabled",                       { val: o.wen, ack: true })); // write
            await queue.add(() => this.setState("cloud_disabled",                     { val: o.cdi, ack: true }));
            await queue.add(() => this.setState("wifi.hotspot_key",                   { val: o.wak, ack: true })); // write
            await queue.add(() => this.setState("http_flags",                         { val: o.r1x, ack: true })); // write
            await queue.add(() => this.setState("loaded_energy",                      { val: o.dws, ack: true })); // read
            await queue.add(() => this.setState("loaded_energy_kwh",                  { val: o.dws * 10 / 60 / 60 / 1000, ack: true}));
            await queue.add(() => this.setState("max_load",                           { val: (o.dwo / 10), ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.min_hours",     { val: o.aho, ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.finish_hour",   { val: o.afi, ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.price_zone",    { val: o.azo, ack: true }));
            await queue.add(() => this.setState("max_ampere",                         { val: o.ama, ack: true }));
            await queue.add(() => this.setState("firmware_version",                   { val: o.fwv, ack: true })); // read
            await queue.add(() => this.setState("serial_number",                      { val: o.sse, ack: true })); // read
            await queue.add(() => this.setState("settings.color.led_brightness",      { val: o.lbr, ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level1",             { val: o.al1, ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level2",             { val: o.al2, ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level3",             { val: o.al3, ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level4",             { val: o.al4, ack: true })); // write
            await queue.add(() => this.setState("settings.ampere_level5",             { val: o.al5, ack: true })); // write
            await queue.add(() => this.setState("settings.color.idle",                { val: "#" + ("000000" + parseInt(o.cid).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("settings.color.charging",            { val: "#" + ("000000" + parseInt(o.cch).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("settings.color.finish",              { val: "#" + ("000000" + parseInt(o.cfi).toString(16)).slice(6), ack: true })); // write
            await queue.add(() => this.setState("time_offset",                        { val: o.tof, ack: true})); // write
            await queue.add(() => this.setState("time_daylight_saving",               { val: o.tds, ack: true })); // write
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
            await queue.add(() => this.setState("rfid.badges.10.consumption",         { val: o.ec1, ack: true })); // read    
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
            await queue.add(() => this.setState("mqtt.enabled",                       { val: o.mce, ack: true }));
            await queue.add(() => this.setState("mqtt.server",                        { val: o.mcs, ack: true }));
            await queue.add(() => this.setState("mqtt.port",                          { val: o.mcp, ack: true }));
            await queue.add(() => this.setState("mqtt.user",                          { val: o.mcu, ack: true }));
            await queue.add(() => this.setState("mqtt.key",                           { val: o.mck, ack: true }));
            await queue.add(() => this.setState("mqtt.connection",                    { val: o.mcc, ack: true }));
            await queue.add(() => this.setState("temperatures.maintempereature",      { val: o.tmp, ack: true })); // read
            await queue.add(() => this.setState("temperatures.tempereatureArray",     { val: o.tma, ack: true })); 
            try {
                if(o.tma) {
                    const tempArr = o.tma.toString().split(",");
                    if(tempArr.length == 4) {
                        await queue.add(() => this.setState("temperatures.tempereature1", { val: tempArr[0], ack: true}));
                        await queue.add(() => this.setState("temperatures.tempereature2", { val: tempArr[1], ack: true}));
                        await queue.add(() => this.setState("temperatures.tempereature3", { val: tempArr[2], ack: true}));
                        await queue.add(() => this.setState("temperatures.tempereature4", { val: tempArr[3], ack: true}));
                    } else {
                        this.log.debug("Cant write temp single temps. Expected 3 elements got " + JSON.stringify(tempArr));
                    }
                }
            } catch (e) {
                this.log.warn("Cloud not store temperature array to single values, because of error " + e.message);
            }
            await queue.add(() => this.setState("adapter_in",                         { val: o.adi, ack: true })); // read
            await queue.add(() => this.setState("unlocked_by",                        { val: o.uby, ack: true })); // read
            await queue.add(() => this.setState("settings.color.led_save_energy",     { val: o.lse, ack: true })); // write
            await queue.add(() => this.setState("unlock_state",                       { val: o.ust, ack: true })); // write
            await queue.add(() => this.setState("electricity_exchange.balance_time",  { val: o.dto, ack: true })); // write
            await queue.add(() => this.setState("energy.norway_mode",                 { val: o.nmo, ack: true })); // write
            await queue.add(() => this.setState("scheduler_settings",                 { val: o.sch, ack: true }));
            await queue.add(() => this.setState("scheduler_double_press",             { val: o.sdp, ack: true }));
        } catch (e) {
            this.log.warn("Error in go.e: " + JSON.stringify(e));
        }
    }
    /**
     * 
     * @param {string} id 
     * @param {string | number | boolean} value 
     */
    setValue(id, value) {
        this.log.info("Set value " + value + " of id " + id);
        axios.get("http://" + this.config.serverName + "/mqtt?payload=" + id + "=" + value)
            .then(o => {
                this.log.info(o.status + " with message: " + o.statusText);
                this.processStatusObject(o.data);
            })
            .catch(err => {
                this.log.error(err.message + " at " + id + " / " + value);
            });
    }
    /**
     * Set the maximum ampere level to the device. But not Updates it more than x seconds. Setting ampUpdateInterval
     * @param {number} watts
     */
    async updateAmpLevel(watts) {
        if (!this.ampTimer) {
            this.ampTimer = setTimeout(() => {
                this.ampTimer = null;
            }, this.config.ampUpdateInterval * 1000);
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
                if(car.val == 2) {
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
                    sumVolts = Math.round((prePhase1.val === true ? parseInt(avgVoltage1.val.toString()) : 0 ) + 
                                (prePhase2.val === true ? parseInt(avgVoltage2.val.toString()) : 0 ) + 
                                (prePhase3.val === true ? parseInt(avgVoltage3.val.toString()) : 0 ));
                }

                this.log.debug("Total "+ (car.val == 2 ? "used ":"available ") + sumVolts + " volts");
                const maxAmp = Math.round(watts/sumVolts);
                this.log.debug("Resulting max of " + maxAmp + " Ampere");
                if(maxAmp < 6) {
                    // The smallest value is 6 amperes
                    this.setValue("amp", 6);
                    this.log.debug("set maxAmperes by maxWatts: 6 amperes with " + watts + " watts");
                } else if(maxAmp < 32) {
                    this.setValue("amp", maxAmp);
                    this.log.debug("set maxAmperes by maxWatts: " + maxAmp + " with " + watts + " watts");
                } else {
                    // The maximum is 32 Amperes
                    this.setValue("amp", 32);
                    this.log.debug("set maxAmperes by maxWatts: 32 with " + watts + " watts");
                }
            } catch (e) {
                this.log.error("Error during set MaxWatts: " + e.message);
            }
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

            try {
                const avgVoltage1 = await this.getStateAsync("energy.phase1.voltage");
                if(avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase1.voltage");
                    return;
                }
                const avgVoltage2 = await this.getStateAsync("energy.phase2.voltage");
                if(avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase2.voltage");
                    return;
                }
                const avgVoltage3 = await this.getStateAsync("energy.phase3.voltage");
                if(avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase3.voltage");
                    return;
                }
                const curAmpPha1 = await this.getStateAsync("energy.phase1.ampere");
                if(curAmpPha1 === null || curAmpPha1 === undefined || curAmpPha1.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase1.ampere");
                    return;
                }
                const curAmpPha2 = await this.getStateAsync("energy.phase2.ampere");
                if(curAmpPha2 === null || curAmpPha2 === undefined || curAmpPha2.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase2.ampere");
                    return;
                }
                const curAmpPha3 = await this.getStateAsync("energy.phase3.ampere");
                if(curAmpPha3 === null || curAmpPha3 === undefined || curAmpPha3.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase3.ampere");
                    return;
                }
                const car = await this.getStateAsync("car");
                if(car === null || car === undefined || car.val === null) {
                    this.log.error("changeAmpLevelInWatts: Not all required information about the phases are found. Required Values are: car");
                    return;
                }

                if(car.val != 2) {
                    this.log.warn("Ignore to chnage ampere level by watts, because there is no car loading.");
                    return;
                }

                let usedAmperes = 0;
                let usedVolts = 0;
                // Check which phases are currently used
                if(curAmpPha1.val > 0) {
                    usedVolts += parseInt(avgVoltage1.val.toString());
                    usedAmperes += parseInt(curAmpPha1.val.toString());
                }
                if(curAmpPha2.val > 0) {
                    usedVolts += parseInt(avgVoltage2.val.toString());
                    usedAmperes += parseInt(curAmpPha1.val.toString());
                }
                if(curAmpPha3.val > 0) {
                    usedVolts += parseInt(avgVoltage3.val.toString());
                    usedAmperes += parseInt(curAmpPha1.val.toString());
                }

                const maxAmp = Math.round(((usedVolts * usedAmperes) + changeWatts)/usedVolts);
                this.log.debug("Current used " + Math.round(usedVolts * usedAmperes) +  " Watts adjusting with  " + changeWatts + " watts by " + usedVolts + " Volts to new max of " + maxAmp + " Amperes");
                if(maxAmp < 6) {
                    // The smallest value is 6 amperes
                    this.setValue("amp", 6);
                    this.log.debug("set maxAmperes by adjustAmpLevelInWatts: 6 amperes by " + changeWatts + " watts");
                } else if(maxAmp < 32) {
                    this.setValue("amp", maxAmp);
                    this.log.debug("set maxAmperes by adjustAmpLevelInWatts: " + maxAmp + " with " + changeWatts + " watts");
                } else {
                    // The maximum is 32 Amperes
                    this.setValue("amp", 32);
                    this.log.debug("set maxAmperes by adjustAmpLevelInWatts: 32 with " + changeWatts + " watts");
                }
            } catch (e) {
                this.log.error("Error during set adjust Watts: " + e.message);
            }
        } else {
            // Still existing Block-Timer
            this.log.warn("MaxWatts ignored. You are sending to fast! Update interval in settings is currently set to: " + this.config.ampUpdateInterval);
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