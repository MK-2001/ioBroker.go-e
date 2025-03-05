'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
// Load your modules here, e.g.:
// const fs = require("fs");
const axios = require('axios').default;
const {default: PQueue} = require('p-queue');
const schema = require('./lib/schema.js').schema;

class GoE extends utils.Adapter {
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'go-e',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on("objectChange", this.onObjectChange.bind(this));
        // this.on("message", this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));

        // Timer Object for the update interval for ampere to the adapter
        this.ampTimer = null;

        // Timestamp for lastSwitchRequest
        this.lastPhaseSwitchRequest = null;

        // Timestamp for lastStop Request
        this.lastStopRequest = null;

        // Translation Object
        this.translationObject = {
            al1: 'settings.ampere_level1',
            al2: 'settings.ampere_level2',
            al3: 'settings.ampere_level3',
            al4: 'settings.ampere_level4',
            al5: 'settings.ampere_level5',
            lbr: 'settings.color.led_brightness'
        };

        // Translation Object API v2
        this.translationObjectV2 = {
            alw: {name: 'allow_charging'},
            rbc: {name: 'reboot_counter'},
            rbt: {name: 'reboot_timer'},
            car: {name: 'car'},
            amp: {name: 'ampere'}
        };


        // Ack alignment object
        this.ackObj = {};
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here
        // Write it to possible values
        this.log.info('Adapter is staring in Version setByGitHubActions');
        // this.log.debug('Update selectable values from ' + JSON.stringify(this.config.selectedAttributes) + ' to ' + Object.keys(this.translationObjectV2) + '; Working with Version ' + this.config.apiVersion);
        // this.config.possibleAttributes = Object.keys(this.translationObjectV2);

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('Server: ' + this.config.serverName);
        this.log.info('Intervall: ' + this.config.serverInterval);
        this.log.info('Calculation Method: ' + this.config.calcMethod);

        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        this.subscribeStates('access_state');
        this.subscribeStates('allow_charging');
        this.subscribeStates('ampere');
        this.subscribeStates('amperePV');
        this.subscribeStates('energy.adjustAmpLevelInWatts');
        this.subscribeStates('energy.max_watts');
        this.subscribeStates('max_load');
        this.subscribeStates('settings.ampere_level1');
        this.subscribeStates('settings.ampere_level2');
        this.subscribeStates('settings.ampere_level3');
        this.subscribeStates('settings.ampere_level4');
        this.subscribeStates('settings.ampere_level5');
        this.subscribeStates('settings.color.idle');
        this.subscribeStates('settings.color.charging');
        this.subscribeStates('settings.color.finish');
        this.subscribeStates('settings.led_save_energy');
        this.subscribeStates('settings.led_brightness');
        this.subscribeStates('solarLoadOnly');
        this.subscribeStates('stop_state');
        this.subscribeStates('unlock_state');
        this.subscribeStates('phaseSwitchMode');
        this.subscribeStates('schedule.allowChargeingForMins');
        this.subscribeStates('schedule.stopChargeingAt');

        if(this.config.calcMethod == 'iob') {
            // Disable FUP (Solar überschuss)
            if(this.config.apiVersion == 2)
                this.setValueV2('fup', false).catch(() => {
                    // Do nothing
                });
            // get updates from a foreign adapter if it is set in Settings
            if(this.config.houseBatteryForeignObjectID) {
                this.subscribeForeignStates(this.config.houseBatteryForeignObjectID);
                this.ackObj[this.config.houseBatteryForeignObjectID] = this.config.houseBatteryForeignObjectAck;
                this.log.debug('Subscribe foreign object ' + this.config.houseBatteryForeignObjectID);
            }
            if(this.config.houseConsumptionForeignObjectID) {
                this.subscribeForeignStates(this.config.houseConsumptionForeignObjectID);
                this.ackObj[this.config.houseConsumptionForeignObjectID] = this.config.houseConsumptionForeignObjectAck;
                this.log.debug('Subscribe foreign object ' + this.config.houseConsumptionForeignObjectID);
            }
            if(this.config.solarPowerForeignObjectID) {
                this.subscribeForeignStates(this.config.solarPowerForeignObjectID);
                this.ackObj[this.config.solarPowerForeignObjectID] = this.config.solarPowerForeignObjectAck;
                this.log.debug('Subscribe foreign object ' + this.config.solarPowerForeignObjectID);
            }
        }
        this.log.silly('Ack-Obj: ' + JSON.stringify(this.ackObj));
        // setup axios
        axios.defaults.baseURL = 'http://' + this.config.serverName;
        // Get all Information for the first time.
        await this.getStateFromDevice();
        // Start the Adapter to sync in the interval
        this.interval = setInterval(async () => {
            await this.getStateFromDevice();
        }, this.config.serverInterval * 1000);
        if(this.config.calcMethod !== 'iob' && this.config.apiVersion == 2) {
            // Start the Adapter to sync in the interval
            this.interval = setInterval(async () => {
                await this.writeIds();
            }, 4 * 1000);
        } else if (this.config.calcMethod !== 'iob' && this.config.apiVersion != 2) {
            this.log.error('For Hardware use to calc PV is API V2 required. But is not enabled in settings.');
        }
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
            this.log.silly('callback ' + e);
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
            if (!state.ack) {
                // If it is already acknoladged, we dont have to send it to the go-eCharger device. Or have to handle the change.
                this.log.silly(`state ${id} changed: ${state.val} (ack = ${state.ack}) namespace: ` + this.namespace);
                // Handle null values with the rejection
                if(state.val === null) {
                    this.log.warn('Not able to handle null Values in ' + id);
                    return;
                }
                switch (id) {
                    // Sort by alphabet of attribute
                    case this.namespace + '.access_state':
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString(), 10) == 1 || parseInt(state.val.toString(), 10) == 2 ) {
                            this.setValue('ast', parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn('Could not set value ' + state.val.toString() + ' in ' + id);
                        }
                        break;
                    case this.namespace + '.allow_charging':
                        if(parseInt(state.val.toString()) == 0 || parseInt(state.val.toString(), 10) == 1 ) {
                            this.setValue('alw', parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn('Could not set value ' + state.val.toString() + ' in ' + id);
                        }
                        break;
                    case this.namespace + '.ampere':
                        this.setValue('amp', state.val.toString());
                        break;
                    case this.namespace + '.amperePV':
                        this.setValue('amx', state.val.toString());
                        break;
                    case this.namespace + '.energy.adjustAmpLevelInWatts':
                        this.adjustAmpLevelInWatts(parseInt(state.val.toString(), 10));
                        this.setState('energy.adjustAmpLevelInWatts',      { val: parseInt(state.val.toString(), 10), ack: true });
                        break;
                    case this.namespace + '.energy.max_watts':
                        this.updateAmpLevel(parseInt(state.val.toString()));
                        this.setState('energy.max_watts',                  { val: parseInt(state.val.toString(), 10), ack: true });
                        break;
                    case this.namespace + '.max_load':
                        this.setValue('dwo', parseInt(state.val.toString(), 10) * 10);
                        break;
                    case this.namespace + '.settings.ampere_level1':
                        this.setAmpLevelToButton('al1', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.ampere_level2':
                        this.setAmpLevelToButton('al2', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.ampere_level3':
                        this.setAmpLevelToButton('al3', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.ampere_level4':
                        this.setAmpLevelToButton('al4', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.ampere_level5':
                        this.setAmpLevelToButton('al5', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.color.idle':
                        // @ts-ignore // Check off null is done
                        this.setValue('cid', /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + '.settings.color.charging':
                        // @ts-ignore // Check off null is done
                        // this.setValue("cch", /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        // bug in versions starting 042; have to use V2
                        this.setValueV2('cch', encodeURIComponent(/^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? state.val.toString() : '#FFFFFF')).catch();
                        break;
                    case this.namespace + '.settings.color.finish':
                        // @ts-ignore // Check off null is done
                        this.setValue('cfi', /^#?([a-f\d]{6})$/i.exec(state.val.toString()) !== null ? parseInt(/^#?([a-f\d]{6})$/i.exec(state.val.toString())[1], 16) : 0);
                        break;
                    case this.namespace + '.settings.color.led_save_energy':
                        this.setValue('lse', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.settings.color.led_brightness':
                        this.setValue('lbr', parseInt(state.val.toString(), 10));
                        break;
                    case this.namespace + '.solarLoadOnly':
                        if(this.config.calcMethod == 'iob') {
                            // Is solarOnly => false (off)
                            if(!state.val) {
                                this.setValue('alw', 1);
                                if(this.config.apiVersion == 2) {
                                    this.setValueV2('fup', 0).catch(() => {}); // go-e Solarladen deaktivieren
                                    this.setValueV2('psm', this.config.defaultPSM).catch(() => {}); // Phases Switch to auto
                                }
                            } else {
                                this.setValueV2('psm', 1).catch(() => {}); // Phases Switch to 1-phase
                            }
                        } else {
                            this.setValueV2('fup', state.val)
                                .then(() => {
                                    this.setState('solarLoadOnly', {ack:true});
                                })
                                .catch(() => {
                                    // Do nothing
                                });
                        }
                        break;
                    case this.namespace + '.stop_state':
                        if(parseInt(state.val.toString()) === 0 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue('stp', parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn('Could not set value ' + state.val.toString() + ' into ' + id);
                        }
                        break;
                    case this.namespace + '.unlock_state':
                        if(parseInt(state.val.toString()) === 0 || parseInt(state.val.toString()) === 1 || parseInt(state.val.toString()) == 2 ) {
                            this.setValue('ust', parseInt(state.val.toString(), 10));
                        } else {
                            this.log.warn('Could not set value ' + state.val.toString() + ' into ' + id);
                        }

                        break;
                    case this.namespace + '.phaseSwitchMode':
                        if(parseInt(state.val.toString()) === 0 || parseInt(state.val.toString()) === 1 || parseInt(state.val.toString()) == 2 ) {
                            this.setValueV2('psm', parseInt(state.val.toString())).catch(() => {});
                        } else {
                            this.log.warn('Could not set value ' + state.val.toString() + ' into ' + id + ' (psm)');
                        }
                        break;
                    case this.namespace + '.schedule.allowChargeingForMins':
                        if(parseInt(state.val.toString()) > 0) {
                            this.setState('schedule.allowChargeingForMins', {val: state.val, ack: true});
                            this.setState('schedule.stopChargeingAt', {val: new Date(Date.now() + (parseInt(state.val.toString()) * 60 * 1000)).toISOString(), ack: true});
                            this.setState('schedule.stopChargeingEnabled', {val: true, ack:true});
                            if(state.val !== undefined && state.val !== null)
                                this.setStopTimeout = setTimeout(() => {
                                    this.setValue('alw', 0);
                                    this.log.info('Stop process because of schedule Minutes');
                                }, parseInt(state.val.toString()) * 1000);
                        }
                        break;
                    case this.namespace + '.schedule.stopChargeingAt':
                        if(!isNaN(Date.parse(state.val.toString())) && Date.parse(state.val.toString()) > Date.now()) {
                            this.setState('schedule.stopChargeingAt', {val: state.val, ack: true});
                            this.setState('schedule.stopChargeingEnabled', {val: true, ack:true});
                            if(state.val !== undefined && state.val !== null)
                                this.setStopTimeout = setTimeout(() => {
                                    this.setValue('alw', 0);
                                    this.log.info('Stop process because of schedule At');
                                }, Date.parse(state.val.toString()) - Date.now());
                        }
                        break;
                    case this.config.solarPowerForeignObjectID:
                    case this.config.houseBatteryForeignObjectID:
                    case this.config.houseConsumptionForeignObjectID:
                        if(this.ackObj[id] === false) {
                            this.log.silly('Will work on ' + id + ' becase ack is ' + state.ack + ' and should be ' + this.ackObj[id]);
                            this.calculateFromForeignObjects(id);
                        } else {
                            this.log.silly('Will NOT work on ' + id + ' becase ack is ' + state.ack + ' and should be ' + this.ackObj[id]);
                        }
                        break;
                    default:
                        this.log.error('Not developed function to write ' + id + ' with state ' + state.val.toString());
                }
            } else {
                // Ack = true
                switch (id) {
                    case this.config.solarPowerForeignObjectID:
                    case this.config.houseBatteryForeignObjectID:
                    case this.config.houseConsumptionForeignObjectID:
                        this.log.silly(`state ${id} changed: ${state.val} (ack = ${state.ack}) namespace: ` + this.namespace);
                        if(this.ackObj[id] === true) {
                            this.log.silly('Will work on ' + id + ' becase ack is ' + state.ack + ' and should be ' + this.ackObj[id]);
                            this.calculateFromForeignObjects(id);
                        } else {
                            this.log.silly('Will NOT work on ' + id + ' becase ack is ' + state.ack + ' and should be ' + this.ackObj[id]);
                        }
                        break;
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

    /**
     * This function get the JSON Object from the go-E Charger status API
     */
    async getStateFromDevice() {
        // let apiEndpoint = "/status";
        if(this.config.apiVersion == 2) {
            // apiEndpoint = "/api/status?filter=" + Object.keys(this.translationObjectV2).join(",");
            // Get additional parameters from API v2
            this.log.debug(`Starte V2 Abfrage an: http://${this.config.serverName}/api/status?filter=psm`);
            axios.get('/api/status?filter=psm')
                .then((o) => {
                    this.log.silly('Response: ' + o.status + ' - ' + o.statusText + ' with data as ' + typeof o.data);
                    // this.log.debug(JSON.stringify(o.data));
                    if(typeof o.data == 'object') {
                        this.setState('phaseSwitchMode', { 'val': parseInt(o.data['psm']), ack: true });
                    } else {
                        this.log.warn(`Response of psm is ${typeof o.data}`);
                    }
                })
                .catch((e) => {
                    this.log.error(e);
                });
            // Hole die benutzerdefinierten Informationen
            const queryStr = this.config.selectedAttributes.join(',');
            this.log.debug(`http://${this.config.serverName}/api/status?filter=${queryStr}`);
            // todo abfrage erstellen.
            axios.get(`/api/status?filter=${queryStr}`)
                .then((o) => {
                    this.log.silly('Response: ' + o.status + ' - ' + o.statusText + ' with data as ' + typeof o.data);
                    this.log.debug(JSON.stringify(o.data));
                    this.processStatusObject(o.data);
                })
                .catch((e) => {
                    this.log.error(e);
                });
        }

        // Get all other attributes from API-V1
        // this.log.debug("Starte V1 Abfrage an: http://" + this.config.serverName + apiEndpoint);
        axios.defaults.baseURL = 'http://' + this.config.serverName;
        await axios.get('/status')
            .then((o) => {
                this.log.silly('Response: ' + o.status + ' - ' + o.statusText + ' with data as ' + typeof o.data);
                this.log.debug(JSON.stringify(o.data));
                if(typeof o.data != 'object') {
                    this.log.error('Respose id type ' + (typeof o.data) + '; ' + JSON.stringify(o.data));
                } else {
                    const validation = schema.validate(o.data,{abortEarly: false});
                    // @ts-ignore
                    if (validation.error != undefined && (validation.error || validation.value === undefined)) {
                        if (validation.value === undefined) {
                            this.log.error('API send no content');
                        } else {
                            this.log.error('API response validation error: ' + JSON.stringify(validation.error.details));
                            this.log.info(JSON.stringify(validation.error._original));
                        }
                    } else {
                        this.processStatusObject(o.data);
                    }
                }
                this.setState('info.connection', true, true);
            })
            .catch(e => {
                if(e.code ==  'ENOTFOUND') {
                    this.setState('info.connection', false, true);
                    this.log.warn('Host not found: ' + this.config.serverName);
                } else if(e.code == 'EAI_AGAIN') {
                    this.setState('info.connection', false, true);
                    this.log.warn('Network/DNS broken to: ' + this.config.serverName);
                } else if(e.code == 'ECONNRESET') {
                    this.setState('info.connection', false, true);
                    this.log.warn('Cant connect to host ' + this.config.serverName);
                } else if(e.code == 'EHOSTUNREACH') {
                    this.setState('info.connection', false, true);
                    this.log.warn('Can not route to the host ' + this.config.serverName);
                } else if (e.response && e.response.status === 404) {
                    this.setState('info.connection', false, true);
                    this.log.warn('Adapter not ready ' + this.config.serverName);
                } else {
                    this.log.error(e.message);
                }
            });

    }

    /**
     * This function is writing the IDS endpoint on the go-e adapter based to given attributes
     */
    async writeIds() {
        let availWatts = await this.getNumberFromForeignObjectId(this.config.solarPowerForeignObjectID);
        let houseBattery = await this.getNumberFromForeignObjectId(this.config.houseBatteryForeignObjectID);
        if(this.config.solarPowerForeignObjectNegate) {
            availWatts = availWatts * -1;
            this.log.silly('Negate watts of Solar; new: ' + availWatts);
        }
        if(this.config.houseBatteryForeignObjectNegate) {
            houseBattery = houseBattery * -1;
            this.log.silly('Negate watts of HouseBattery; new: ' + houseBattery);
        }
        const buildObj =  {
            pGrid: availWatts,
            pAkku: houseBattery
        };
        axios.get('/api/set?ids=' + JSON.stringify(buildObj))
            .then((res) => {
                this.log.debug('Wrote ids Object: ' + JSON.stringify(buildObj) + ' with response ' + JSON.stringify(res.data));
            })
            .catch((e) => {
                this.log.warn('Was not able to write ids: ' + JSON.stringify(buildObj) + '; Error: ' + e.message);
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

            for (const [key, value] of Object.entries(o)) {
                //console.log(`${key}: ${value}`);
                switch (key) {
                    case 'version':
                        await queue.add(() => this.setState('encryption',                         { val: o.version == 'C' ? true : false, ack: true })); // read
                        break;
                    case 'tme':
                        try {
                            // TME provides 2208201643
                            // sometimes it provides "0302-300526" see #171
                            // TODO: No glue what this is about.
                            // Realdate: 22th August 2020 at 16:43 (CET)
                            // this.log.debug(" Synctime: " + o.tme);
                            const reggie = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;
                            // @ts-ignore
                            const [, day, month, year, hours, minutes] = reggie.exec(o.tme);
                            const dateObject = new Date(parseInt(year, 10)+2000, parseInt(month, 10)-1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), 0);
                            await queue.add(() => this.setState('synctime',                           { val: dateObject.toISOString(), ack: true }));
                        } catch (e) {
                            // @ts-ignore
                            this.log.info('Cloud not store synctime, because of error ' + e.message);
                        }
                        break;
                    case 'rbc':
                        await queue.add(() => this.setState('reboot_counter',                     { val: parseInt(o.rbc, 10), ack: true })); // read, V1, V2
                        break;
                    case 'car':
                        await queue.add(() => this.setState('car',                                { val: parseInt(o.car, 10), ack: true })); // read, V1, V2
                        break;
                    case 'rbt':
                        await queue.add(() => this.setState('reboot_timer',                       { val: parseInt(o.rbt, 10), ack: true })); // read, V1, V2
                        break;
                    case 'amp':
                        await queue.add(() => this.setState('ampere',                             { val: parseInt(o.amp, 10), ack: true })); // write, V1, V2
                        break;
                    case 'amx':
                        if(o.amx === undefined || o.amx == null) {
                            await queue.add(() => this.setState('amperePV',                       { val: parseInt(o.amp, 10), ack: true })); // COPY AMP Value to AMX V1
                        } else {
                            await queue.add(() => this.setState('amperePV',                       { val: parseInt(o.amx, 10), ack: true })); // write, V1
                        }
                        break;
                    case 'err':
                        await queue.add(() => this.setState('error',                              { val: parseInt(o.err, 10), ack: true })); // read
                        break;
                    case 'ast':
                        await queue.add(() => this.setState('access_state',                       { val: parseInt(o.ast, 10), ack: true })); // write
                        break;
                    case 'alw':
                        if(typeof o.alw == 'boolean')
                            await queue.add(() => this.setState('allow_charging',                     { val: + o.alw, ack: true })); // V2 (Convert to Integer by using +)
                        else
                            await queue.add(() => this.setState('allow_charging',                     { val: parseInt(o.alw, 10), ack: true })); // write, V2
                        break;
                    case 'stp':
                        await queue.add(() => this.setState('stop_state',                         { val: parseInt(o.stp, 10), ack: true })); // write
                        break;
                    case 'pha':
                        await queue.add(() => this.setState('phases',                             { val: parseInt(o.pha, 10), ack: true })); // read
                        // Split phases in single states
                        await queue.add(() => this.setState('energy.phase1.preContactorActive',   { val: ((parseInt(o.pha, 10) & preContactorPhase1) == preContactorPhase1), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase1.postContactorActive',  { val: ((parseInt(o.pha, 10) & postContactorPhase1) == postContactorPhase1), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase2.preContactorActive',   { val: ((parseInt(o.pha, 10) & preContactorPhase2) == preContactorPhase2), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase2.postContactorActive',  { val: ((parseInt(o.pha, 10) & postContactorPhase2) == postContactorPhase2), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase3.preContactorActive',   { val: ((parseInt(o.pha, 10) & preContactorPhase3) == preContactorPhase3), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase3.postContactorActive',  { val: ((parseInt(o.pha, 10) & postContactorPhase3) == postContactorPhase3), ack: true})); //read
                        await queue.add(() => this.setState('energy.phase1.voltage',              { val: parseInt(o.nrg[0], 10), ack: true })); // read
                        break;
                    case 'nrg':
                        await queue.add(() => this.setState('energy.phase2.voltage',              { val: parseInt(o.nrg[1], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase3.voltage',              { val: parseInt(o.nrg[2], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.neutral.voltage',             { val: parseInt(o.nrg[3], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase1.ampere',               { val: (o.nrg[4] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase2.ampere',               { val: (o.nrg[5] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase3.ampere',               { val: (o.nrg[6] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase1.power',                { val: (o.nrg[7] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase2.power',                { val: (o.nrg[8] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase3.power',                { val: (o.nrg[9] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.neutral.power',               { val: (o.nrg[10] / 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.power',                       { val: (o.nrg[11] / 100), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase1.power_coefficient',    { val: parseInt(o.nrg[12], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase2.power_coefficient',    { val: parseInt(o.nrg[13], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.phase3.power_coefficient',    { val: parseInt(o.nrg[14], 10), ack: true })); // read
                        await queue.add(() => this.setState('energy.neutral.power_coefficient',   { val: parseInt(o.nrg[15], 10), ack: true })); // read
                        break;
                    case 'cbl':
                        await queue.add(() => this.setState('cable_ampere_code',                  { val: parseInt(o.cbl), ack: true })); // read
                        break;
                    case 'amt':
                        await queue.add(() => this.setState('avail_ampere',                       { val: parseInt(o.amt, 10), ack: true }));
                        break;
                    case 'eto':
                        await queue.add(() => this.setState('energy.total',                       { val: (o.eto / 10), ack: true })); // read
                        break;
                    case 'wst':
                        await queue.add(() => this.setState('wifi.state',                         { val: parseInt(o.wst, 10), ack: true })); // read
                        break;
                    case 'txi':
                        await queue.add(() => this.setState('transmit_interface',                 { val: o.txi, ack: true }));
                        break;
                    case 'wss':
                        await queue.add(() => this.setState('wifi.ssid',                          { val: o.wss, ack: true })); // write
                        break;
                    case 'wke':
                        await queue.add(() => this.setState('wifi.key',                           { val: o.wke, ack: true })); // write
                        break;
                    case 'wen':
                        await queue.add(() => this.setState('wifi.enabled',                       { val: parseInt(o.wen, 10), ack: true })); // write
                        break;
                    case 'cdi':
                        await queue.add(() => this.setState('cloud_disabled',                     { val: parseInt(o.cdi, 10), ack: true }));
                        break;
                    case 'wak':
                        await queue.add(() => this.setState('wifi.hotspot_key',                   { val: o.wak, ack: true })); // write
                        break;
                    case 'r1x':
                        await queue.add(() => this.setState('http_flags',                         { val: parseInt(o.r1x, 10), ack: true })); // write
                        break;
                    case 'dws':
                        await queue.add(() => this.setState('loaded_energy',                      { val: parseInt(o.dws, 10), ack: true })); // read
                        if(/^050/.test(o.fwv)) {
                            await queue.add(() => this.setState('loaded_energy_kwh',                  { val: o.dws / 100, ack: true}));
                        } else {
                            await queue.add(() => this.setState('loaded_energy_kwh',                  { val: o.dws * 10 / 60 / 60 / 1000, ack: true}));
                        }
                        break;
                    case 'dwo':
                        await queue.add(() => this.setState('max_load',                           { val: (o.dwo / 10), ack: true })); // write
                        break;
                    case 'aho':
                        await queue.add(() => this.setState('electricity_exchange.min_hours',     { val: parseInt(o.aho, 10), ack: true })); // write
                        break;
                    case 'afi':
                        await queue.add(() => this.setState('electricity_exchange.finish_hour',   { val: parseInt(o.afi, 10), ack: true })); // write
                        break;
                    case 'azo':
                        await queue.add(() => this.setState('electricity_exchange.price_zone',    { val: parseInt(o.azo, 10), ack: true }));
                        break;
                    case 'ama':
                        await queue.add(() => this.setState('max_ampere',                         { val: parseInt(o.ama, 10), ack: true }));
                        break;
                    case 'fwv':
                        await queue.add(() => this.setState('firmware_version',                   { val: o.fwv, ack: true })); // read
                        break;
                    case 'sse':
                        await queue.add(() => this.setState('serial_number',                      { val: o.sse, ack: true })); // read
                        break;
                    case 'lbr':
                        await queue.add(() => this.setState('settings.color.led_brightness',      { val: parseInt(o.lbr, 10), ack: true })); // write
                        break;
                    case 'al1':
                        await queue.add(() => this.setState('settings.ampere_level1',             { val: parseInt(o.al1, 10), ack: true })); // write
                        break;
                    case 'al2':
                        await queue.add(() => this.setState('settings.ampere_level2',             { val: parseInt(o.al2, 10), ack: true })); // write
                        break;
                    case 'al3':
                        await queue.add(() => this.setState('settings.ampere_level3',             { val: parseInt(o.al3, 10), ack: true })); // write
                        break;
                    case 'al4':
                        await queue.add(() => this.setState('settings.ampere_level4',             { val: parseInt(o.al4, 10), ack: true })); // write
                        break;
                    case 'al5':
                        await queue.add(() => this.setState('settings.ampere_level5',             { val: parseInt(o.al5, 10), ack: true })); // write
                        break;
                    case 'cid':
                        await queue.add(() => this.setState('settings.color.idle',                { val: '#' + ('000000' + parseInt(o.cid, 10).toString(16)).slice(6), ack: true })); // write
                        break;
                    case 'cch':
                        await queue.add(() => this.setState('settings.color.charging',            { val: '#' + ('000000' + parseInt(o.cch, 10).toString(16)).slice(6), ack: true })); // write
                        break;
                    case 'cfi':
                        await queue.add(() => this.setState('settings.color.finish',              { val: '#' + ('000000' + parseInt(o.cfi, 10).toString(16)).slice(6), ack: true })); // write
                        break;
                    case 'tof':
                        await queue.add(() => this.setState('time_offset',                        { val: parseInt(o.tof, 10), ack: true})); // write
                        break;
                    case 'tds':
                        await queue.add(() => this.setState('time_daylight_saving',               { val: parseInt(o.tds, 10), ack: true })); // write
                        break;
                    case 'eca':
                        // RFID Badges
                        await queue.add(() => this.setState('rfid.badges.1.consumption',          { val: (o.eca / 10), ack: true })); // read
                        break;
                    case 'ecr':
                        await queue.add(() => this.setState('rfid.badges.2.consumption',          { val: (o.ecr / 10), ack: true })); // read
                        break;
                    case 'ecd':
                        await queue.add(() => this.setState('rfid.badges.3.consumption',          { val: (o.ecd / 10), ack: true })); // read
                        break;
                    case 'ec4':
                        await queue.add(() => this.setState('rfid.badges.4.consumption',          { val: (o.ec4 / 10), ack: true })); // read
                        break;
                    case 'ec5':
                        await queue.add(() => this.setState('rfid.badges.5.consumption',          { val: (o.ec5 / 10), ack: true })); // read
                        break;
                    case 'ec6':
                        await queue.add(() => this.setState('rfid.badges.6.consumption',          { val: (o.ec6 / 10), ack: true })); // read
                        break;
                    case 'ec7':
                        await queue.add(() => this.setState('rfid.badges.7.consumption',          { val: (o.ec7 / 10), ack: true })); // read
                        break;
                    case 'ec8':
                        await queue.add(() => this.setState('rfid.badges.8.consumption',          { val: (o.ec8 / 10), ack: true })); // read
                        break;
                    case 'ec9':
                        await queue.add(() => this.setState('rfid.badges.9.consumption',          { val: (o.ec9 / 10), ack: true })); // read
                        break;
                    case 'ec1':
                        await queue.add(() => this.setState('rfid.badges.10.consumption',         { val: (o.ec1 / 10), ack: true })); // read
                        break;
                    case 'rca':
                        await queue.add(() => this.setState('rfid.badges.1.id',                   { val: o.rca, ack: true })); // read
                        break;
                    case 'rcr':
                        await queue.add(() => this.setState('rfid.badges.2.id',                   { val: o.rcr, ack: true })); // read
                        break;
                    case 'rcd':
                        await queue.add(() => this.setState('rfid.badges.3.id',                   { val: o.rcd, ack: true })); // read
                        break;
                    case 'rc4':
                        await queue.add(() => this.setState('rfid.badges.4.id',                   { val: o.rc4, ack: true })); // read
                        break;
                    case 'rc5':
                        await queue.add(() => this.setState('rfid.badges.5.id',                   { val: o.rc5, ack: true })); // read
                        break;
                    case 'rc6':
                        await queue.add(() => this.setState('rfid.badges.6.id',                   { val: o.rc6, ack: true })); // read
                        break;
                    case 'rc7':
                        await queue.add(() => this.setState('rfid.badges.7.id',                   { val: o.rc7, ack: true })); // read
                        break;
                    case 'rc8':
                        await queue.add(() => this.setState('rfid.badges.8.id',                   { val: o.rc8, ack: true })); // read
                        break;
                    case 'rc9':
                        await queue.add(() => this.setState('rfid.badges.9.id',                   { val: o.rc9, ack: true })); // read
                        break;
                    case 'rc1':
                        await queue.add(() => this.setState('rfid.badges.10.id',                  { val: o.rc1, ack: true })); // read
                        break;
                    case 'rna':
                        // RFID Name
                        await queue.add(() => this.setState('rfid.badges.1.name',                 { val: o.rna, ack: true })); // write
                        break;
                    case 'rnm':
                        await queue.add(() => this.setState('rfid.badges.2.name',                 { val: o.rnm, ack: true })); // write
                        break;
                    case 'rne':
                        await queue.add(() => this.setState('rfid.badges.3.name',                 { val: o.rne, ack: true })); // write
                        break;
                    case 'rn4':
                        await queue.add(() => this.setState('rfid.badges.4.name',                 { val: o.rn4, ack: true })); // write
                        break;
                    case 'rn5':
                        await queue.add(() => this.setState('rfid.badges.5.name',                 { val: o.rn5, ack: true })); // write
                        break;
                    case 'rn6':
                        await queue.add(() => this.setState('rfid.badges.6.name',                 { val: o.rn6, ack: true })); // write
                        break;
                    case 'rn7':
                        await queue.add(() => this.setState('rfid.badges.7.name',                 { val: o.rn7, ack: true })); // write
                        break;
                    case 'rn8':
                        await queue.add(() => this.setState('rfid.badges.8.name',                 { val: o.rn8, ack: true })); // write
                        break;
                    case 'rn9':
                        await queue.add(() => this.setState('rfid.badges.9.name',                 { val: o.rn9, ack: true })); // write
                        break;
                    case 'rn1':
                        await queue.add(() => this.setState('rfid.badges.10.name',                { val: o.rn1, ack: true })); // write
                        break;
                    case 'mce':
                        await queue.add(() => this.setState('mqtt.enabled',                       { val: parseInt(o.mce, 10), ack: true }));
                        break;
                    case 'mcs':
                        await queue.add(() => this.setState('mqtt.server',                        { val: o.mcs, ack: true }));
                        break;
                    case 'mcp':
                        await queue.add(() => this.setState('mqtt.port',                          { val: o.mcp, ack: true }));
                        break;
                    case 'mcu':
                        await queue.add(() => this.setState('mqtt.user',                          { val: o.mcu, ack: true }));
                        break;
                    case 'mck':
                        await queue.add(() => this.setState('mqtt.key',                           { val: o.mck, ack: true }));
                        break;
                    case 'mcc':
                        await queue.add(() => this.setState('mqtt.connection',                    { val: o.mcc, ack: true }));
                        break;
                    case 'tmp':
                        await queue.add(() => this.setState('temperatures.maintemperature',      { val: parseInt(o.tmp, 10), ack: true })); // read
                        break;
                    case 'tma':
                        try {
                            let tempArr = o.tma.toString().split(',');
                            for(let i = 0; i<tempArr.length; i++) {
                                const tmpObj = await this.getObjectAsync('temperatures.temperature' + (i+1));
                                this.log.silly('temperatures.temperature' + (i+1) + ': ' + JSON.stringify(tmpObj));
                                if ( tmpObj == null) {
                                    const obj = {
                                        name:       'temperatures.temperature' + (i+1),
                                        type:       'number',
                                        read:       true,
                                        write:      false,
                                        role:       'value.temperature',
                                        desc:       'Temperature Sensor'
                                    };
                                    this.log.info('Object not found, try to create: temperatures.temperature' + (i+1));
                                    // @ts-ignore
                                    this.createState('', 'temperatures', 'temperature' + (i+1), obj, {id: '', property: ''} , (e, o) => {
                                        this.log.debug('Callback with ' + JSON.stringify(o) + ' Error: ' + JSON.stringify(e));
                                    });
                                } else {
                                    // this.log.silly("Object found, try to update: temperatures.temperature" + (i+1));
                                    await queue.add(() => this.setState('temperatures.temperature' + (i+1), { val: Number(tempArr[i]), ack: true}));
                                }
                            }
                        } catch (e) {
                            const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
                            this.log.warn('Cloud not store temperature array to single values, because of error ' + errMsg);
                        }
                        break;
                    case 'adi':
                        await queue.add(() => this.setState('adapter_in',                         { val: parseInt(o.adi, 10), ack: true })); // read
                        break;
                    case 'uby':
                        await queue.add(() => this.setState('unlocked_by',                        { val: parseInt(o.uby, 10), ack: true })); // read
                        break;
                    case 'lse':
                        await queue.add(() => this.setState('settings.color.led_save_energy',     { val: parseInt(o.lse, 10), ack: true })); // write
                        break;
                    case 'ust':
                        await queue.add(() => this.setState('unlock_state',                       { val: parseInt(o.ust, 10), ack: true })); // write
                        break;
                    case 'dto':
                        await queue.add(() => this.setState('electricity_exchange.balance_time',  { val: parseInt(o.dto, 10), ack: true })); // write
                        break;
                    case 'nmo':
                        await queue.add(() => this.setState('energy.norway_mode',                 { val: parseInt(o.nmo, 10), ack: true })); // write
                        break;
                    case 'sch':
                        await queue.add(() => this.setState('scheduler_settings',                 { val: o.sch, ack: true }));
                        break;
                    case 'sdp':
                        await queue.add(() => this.setState('scheduler_double_press',             { val: parseInt(o.sdp, 10), ack: true })); //
                        break;
                    case 'lch':
                    case 'loa':
                    case 'lof':
                    case 'log':
                    case 'lop':
                    case 'fsp':
                    case 'lom':
                    case 'lot':
                    case 'loe':
                        // These codes will not proceed yet.
                        break;
                    default:
                        this.log.info('Not supported key: ' + key + ' Please inform https://github.com/MK-2001/ioBroker.go-e/issues/new/choose');
                }
            }
            // Write the whole object for debugging in a State
            // await queue.add(() => this.setObjectNotExists("stateObject", o));
        } catch(e) {
            const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
            const errStack = e instanceof Error ? e.stack : '';
            this.log.warn('Error in go.e: ' + JSON.stringify(errMsg) + '; Stack: ' + errStack);
        }
    }
    /**
     *
     * @param {string} id
     * @param {string | number | boolean} value
     */
    setValue(id, value) {
        this.log.info('Set value ' + value + ' of id ' + id);
        axios.get('http://' + this.config.serverName + '/mqtt?payload=' + id + '=' + value)
            .then(o => {
                this.log.debug(o.status + ' with message: ' + o.statusText);
                this.processStatusObject(o.data);
            })
            .catch(err => {
                this.log.error(err.message + ' at ' + id + ' / ' + value);
            });
    }

    /**
     * Set values via API Version 2
     * @param {string} id
     * @param {string | number | boolean} value
     */
    setValueV2(id, value) {
        if(this.config.apiVersion == 2) {
            this.log.info('Set value V2 ' + value + ' of id ' + id);
            if(typeof value === 'string') {
                value = '"' + value + '"';
            }
            this.log.debug('call ' + 'http://' + this.config.serverName + '/api/set?' + id + '=' + value);
            return axios.get('http://' + this.config.serverName + '/api/set?' + id + '=' + value)
                .then(o => {
                    this.log.debug(o.status + ' with message: ' + o.statusText);
                    // this.processStatusObject(o.data);
                    // Response of V2 does not have all data.
                })
                .catch(err => {
                    this.log.error(err.message + ' at ' + id + ' / ' + value + ' with error message ' + JSON.stringify(err));
                });
        } else {
            return Promise.reject(new Error('Api V2 is not enabled'));
        }
    }

    /**
     * Set max amp to amx or amp based on firmware
     * @param {number} maxAmp
     */
    async setAmp(maxAmp) {
        // Get Firmware Version if amx is available
        const fw = await this.getStateAsync('firmware_version');
        let maxSetAmp = this.config.maxAmp;
        if(!maxSetAmp) {
            this.log.warn('Maximum Amperes not set in settings. Use of 16 amperes instead.');
            maxSetAmp = 16;
        }
        let amp = '';
        let ampStr = '';
        if(fw != undefined && fw != null && fw.val != null && parseInt(fw.val.toString()) > 33) {
            // Use AMX insted of AMP. Becaus the EEPROM of amp is only 100.000 times writeable
            // Available by firmware > 033
            amp = 'amx';
            ampStr = 'amperePV';
        } else {
            amp = 'amp';
            ampStr = 'ampere';
        }
        if(maxAmp < 6) {
            // The smallest value is 6 amperes
            this.setValue(amp, 6);
            this.setState(ampStr, { val: 6, ack: true });
            // this.log.debug("set maxAmperes (" + amp + "): 6 amperes");
        } else if(maxAmp < maxSetAmp) {
            this.setValue(amp, maxAmp);
            this.setState(ampStr, { val: Number(maxAmp), ack: true });
            // this.log.debug("set maxAmperes (" + amp + "): " + maxAmp + " amperes" );
        } else {
            // The maximum is 32 Amperes and is defined in Settings
            this.setValue(amp, maxSetAmp);
            this.setState(ampStr, { val: Number(maxSetAmp), ack: true });
            // this.log.debug("set maxAmperes (" + amp + "): " + maxSetAmp + " amperes");
        }
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
            try {
                // San for active phases on Adapter
                const prePhase1   = await this.getStateAsync('energy.phase1.preContactorActive');
                const prePhase2   = await this.getStateAsync('energy.phase2.preContactorActive');
                const prePhase3   = await this.getStateAsync('energy.phase3.preContactorActive');
                const avgVoltage1 = await this.getStateAsync('energy.phase1.voltage');
                const avgVoltage2 = await this.getStateAsync('energy.phase2.voltage');
                const avgVoltage3 = await this.getStateAsync('energy.phase3.voltage');
                const curAmpPha1  = await this.getStateAsync('energy.phase1.ampere');
                const curAmpPha2  = await this.getStateAsync('energy.phase2.ampere');
                const curAmpPha3  = await this.getStateAsync('energy.phase3.ampere');
                const car         = await this.getStateAsync('car');

                if(prePhase1 === null || prePhase1 === undefined || prePhase1.val === null ||
                   prePhase2 === null || prePhase2 === undefined || prePhase2.val === null ||
                   prePhase3 === null || prePhase3 === undefined || prePhase3.val === null ) {
                    this.log.error('Not all required information about the phases are found. Required Values are: energy.phaseX.preContactorActive');
                    return;
                }
                if(avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null ||
                   avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null ||
                   avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null ) {
                    this.log.error('Not all required information about the phases are found. Required Values are: energy.phaseX.voltage');
                    return;
                }
                if(curAmpPha1 === null || curAmpPha1 === undefined || curAmpPha1.val === null ||
                   curAmpPha2 === null || curAmpPha2 === undefined || curAmpPha2.val === null ||
                   curAmpPha3 === null || curAmpPha3 === undefined || curAmpPha3.val === null ) {
                    this.log.error('Not all required information about the phases are found. Required Values are: energy.phaseX.ampere');
                    return;
                }
                if(car === null || car === undefined || car.val === null) {
                    this.log.error('Not all required information about the phases are found. Required Values are: car');
                    return;
                }

                // Check which & how many phases are used for loading and summarize of these phases the volts
                let sumVolts = 0;
                if(car.val === 2) {
                    if(Number(curAmpPha1.val) > 0) {
                        sumVolts += parseInt(avgVoltage1.val.toString());
                    }
                    if(Number(curAmpPha2.val) > 0) {
                        sumVolts += parseInt(avgVoltage2.val.toString());
                    }
                    if(Number(curAmpPha3.val) > 0) {
                        sumVolts += parseInt(avgVoltage3.val.toString());
                    }
                } else {
                    sumVolts = Math.round((prePhase1.val === true ? parseInt(avgVoltage1.val.toString(), 10) : 0 ) +
                                (prePhase2.val === true ? parseInt(avgVoltage2.val.toString(), 10) : 0 ) +
                                (prePhase3.val === true ? parseInt(avgVoltage3.val.toString(), 10) : 0 ));
                }

                this.log.debug('Total '+ (car.val == 2 ? 'used ':'available ') + sumVolts + ' volts');
                const maxAmp = Math.round(watts/sumVolts);
                this.log.debug('Resulting max of ' + maxAmp + ' Ampere');

                this.setAmp(maxAmp);
            } catch (e) {
                const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
                this.log.error('Error during set MaxWatts: ' + errMsg);
            }
        } else {
            // Still existing Block-Timer
            this.log.silly('MaxWatts ignored. You are sending to fast! Update interval in settings is currently set to: ' + this.config.ampUpdateInterval);
        }
    }
    /**
     * Adjust the Ampere Level by set the amount of watts
     */
    async adjustAmpLevelInWatts(changeWatts) {
        if (!this.ampTimer) {
            this.ampTimer = setTimeout(() => {
                this.ampTimer = null;
            }, this.config.ampUpdateInterval * 3000);
            const loadWith6AAtLeast = this.config.loadWith6AAtLeast;
            try {
                const phaseSwitchWatts = this.config.phaseSwitchWatts || 4200;
                let phaseSwitchModeBuffer = await this.getStateAsync('phaseSwitchModeBuffer');
                if(phaseSwitchModeBuffer === null || phaseSwitchModeBuffer === undefined || phaseSwitchModeBuffer.val === null) {
                    this.log.warn('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: phaseSwitchModeBuffer; Will use 0;');
                    phaseSwitchModeBuffer = { val: 0, ack: true, ts: 0, from: '', lc: 0};
                }
                const phaseSwitchMode = await this.getStateAsync('phaseSwitchMode');
                if(phaseSwitchMode === null || phaseSwitchMode === undefined || phaseSwitchMode.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: phaseSwitchMode');
                    return;
                }
                const phaseSwitchModeEnabled = await this.getStateAsync('phaseSwitchModeEnabled');
                if(phaseSwitchModeEnabled === null || phaseSwitchModeEnabled === undefined || phaseSwitchModeEnabled.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: phaseSwitchModeEnabled');
                    return;
                }
                const avgVoltage1 = await this.getStateAsync('energy.phase1.voltage');
                if(avgVoltage1 === null || avgVoltage1 === undefined || avgVoltage1.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase1.voltage');
                    return;
                }
                const avgVoltage2 = await this.getStateAsync('energy.phase2.voltage');
                if(avgVoltage2 === null || avgVoltage2 === undefined || avgVoltage2.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase2.voltage');
                    return;
                }
                const avgVoltage3 = await this.getStateAsync('energy.phase3.voltage');
                if(avgVoltage3 === null || avgVoltage3 === undefined || avgVoltage3.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: eneregy.phase3.voltage');
                    return;
                }
                const curAmpPha1 = await this.getStateAsync('energy.phase1.ampere');
                if(curAmpPha1 === null || curAmpPha1 === undefined || curAmpPha1.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase1.ampere');
                    return;
                }
                const curAmpPha2 = await this.getStateAsync('energy.phase2.ampere');
                if(curAmpPha2 === null || curAmpPha2 === undefined || curAmpPha2.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase2.ampere');
                    return;
                }
                const curAmpPha3 = await this.getStateAsync('energy.phase3.ampere');
                if(curAmpPha3 === null || curAmpPha3 === undefined || curAmpPha3.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: energy.phase3.ampere');
                    return;
                }
                const car = await this.getStateAsync('car');
                if(car === null || car === undefined || car.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: car');
                    return;
                }
                const allowCharge = await this.getStateAsync('allow_charging');
                if(allowCharge === null || allowCharge === undefined || allowCharge.val === null) {
                    this.log.error('adjustAmpLevelInWatts: Not all required information about the phases are found. Required Values are: alw');
                    return;
                }
                // car.val == 2 => Fahrzeug aktiv am laden
                // car.val == 4  && alw.val == 0 => Fahrszeug pasiert zum laden
                //  false  || ( true && true)
                if(!(car.val == 2 || (car.val == 4 && allowCharge.val === 0))) {
                    this.log.debug('Ignore to change ampere level by watts, because there is no car loading. Car: ' + car.val + '; alw: ' + allowCharge.val);
                    return;
                }


                let usedPhases = 0;
                let usedAmperes = 0;
                let usedWatts = 0;
                let usedVolts = 0;
                if(allowCharge.val === 1) {
                    // Check which phases are currently used
                    if(Number(curAmpPha1.val) > 0) {
                        usedVolts += parseInt(avgVoltage1.val.toString(), 10);
                        usedAmperes += parseInt(curAmpPha1.val.toString(), 10);
                        usedWatts += parseInt(avgVoltage1.val.toString(), 10) * parseInt(curAmpPha1.val.toString(), 10);
                        usedPhases += 1;
                    }
                    if(Number(curAmpPha2.val) > 0) {
                        usedVolts += parseInt(avgVoltage2.val.toString(), 10);
                        usedAmperes += parseInt(curAmpPha2.val.toString(), 10);
                        usedWatts += parseInt(avgVoltage2.val.toString(), 10) * parseInt(curAmpPha2.val.toString(), 10);
                        usedPhases += 1;
                    }
                    if(Number(curAmpPha3.val) > 0) {
                        usedVolts += parseInt(avgVoltage3.val.toString(), 10);
                        usedAmperes += parseInt(curAmpPha3.val.toString(), 10);
                        usedWatts += parseInt(avgVoltage3.val.toString(), 10) * parseInt(curAmpPha3.val.toString(), 10);
                        usedPhases += 1;
                    }
                } else {
                    // Wenn derzeit keine Phase zum Laden verwendet wird, wie bei alw = 0;
                    usedPhases = Number(phaseSwitchMode.val) != 1 ? 3 : 1;
                    usedVolts = 230 * usedPhases;
                }

                // Currents Watts + adjustment / average Volts / usedPhases => max Ampere
                // Example: 3 Phases, 220V , Current 14 A (Adding 2A each Phase)
                // (9240 W + 1320) / (660 / 3) / 3 => 16 A
                // Using floor (abrunden) anstatt runden, damit immer etwas übrig bleibt.
                let maxAmp = Math.floor((usedWatts + changeWatts) / (usedVolts / usedPhases) / usedPhases);
                this.log.info('Change Amperes: Current used ' + Math.round(usedWatts) +  ' Watts with ' + usedAmperes + ' Ampere (sum) by ' + usedPhases + ' Phases and adjusting this with  ' + changeWatts + ' watts by ' + (usedVolts / usedPhases) + ' Volts (avg) to new max of ' + maxAmp + ' Amperes per Phase; PhaseSwitchLevel: from ' + (phaseSwitchModeEnabled.val ? (phaseSwitchMode.val +  ' at ' + (phaseSwitchMode.val != 1 ? '<' + (Number(phaseSwitchWatts) - Number(phaseSwitchModeBuffer.val)) : '>' + (Number(phaseSwitchWatts) + Number(phaseSwitchModeBuffer.val)))): 'off'));
                if((usedWatts + changeWatts) > Number(phaseSwitchWatts) + Number(phaseSwitchModeBuffer.val) && phaseSwitchMode.val != 2 && phaseSwitchModeEnabled.val == true) {
                    // initiate phase switch to 3-phases
                    this.log.info(`Current Watts ${usedWatts + changeWatts} require Mode 3-phases; current: ${phaseSwitchMode.val}; Change maxAmp from ${maxAmp} to ${Math.round(maxAmp / 3)}`);
                    await axios.get('/api/set?psm=2')
                        .then(() => {
                            this.setState('phaseSwitchMode', {val: 2, ack: true});
                            maxAmp = Math.round(maxAmp / 3);
                        })
                        .catch((e) => {
                            this.log.error(e);
                        });
                } else if((usedWatts + changeWatts) < Number(phaseSwitchWatts) - Number(phaseSwitchModeBuffer.val) && phaseSwitchMode.val != 1) {
                    // initiate phase switch to 1 phase
                    if(this.lastPhaseSwitchRequest == null) {
                        this.lastPhaseSwitchRequest = Date.now();
                        this.log.debug('Wait to Down phaseSwitch until ' + new Date (this.lastPhaseSwitchRequest + (this.config.timeToWait * 1000)).toISOString());
                        // set maxAmp to lowerst value:
                        maxAmp = 6;
                    } else {
                        if(this.lastPhaseSwitchRequest + (this.config.timeToWait * 1000) < Date.now()) {
                            this.log.info(`Current Watts ${usedWatts + changeWatts} require Mode 1-phase; current: ${phaseSwitchMode.val}; Change maxAmp from ${maxAmp} to ${Math.round(maxAmp * 3)}`);
                            await axios.get('/api/set?psm=1')
                                .then(() => {
                                    this.setState('phaseSwitchMode', {val: 1, ack: true});
                                    maxAmp = maxAmp * 3;
                                    if(maxAmp < 6)
                                        maxAmp = 6;
                                })
                                .catch((e) => {
                                    this.log.error(e);
                                });
                        } else {
                            this.log.debug('Wait to Down phaseSwitch until ' + new Date(this.lastPhaseSwitchRequest + (this.config.timeToWait * 1000)).toISOString());
                        }
                    }
                } else {
                    if(this.lastPhaseSwitchRequest !== null) {
                        this.lastPhaseSwitchRequest = null;
                        this.log.silly('Reset wait for lastPhaseSwitchRequest...');
                    }
                }
                if(maxAmp < 6) {
                    // Allow charge (Ist Auto angehängt und freigabe vorhanden.)
                    // loadWith6AAtLeast => true; nicht abschalten
                    if(!loadWith6AAtLeast) {
                        // prüfe, wann der letzte Stop request gesetzt wurde
                        if(this.lastStopRequest == null) {
                            this.lastStopRequest = Date.now();
                            this.log.silly('Wait to stop until ' + new Date(this.lastStopRequest + (this.config.timeToWait * 1000)).toISOString());
                            // set maxAmp to lowerst value:
                            this.setAmp(6);
                        } else {
                            if(this.lastStopRequest + (this.config.timeToWait * 1000) < Date.now()) {
                                if( allowCharge.val !== 0)
                                    this.setValue('alw', 0);
                            } else {
                                this.log.debug('Wait to stop until ' + new Date(this.lastStopRequest + (this.config.timeToWait * 1000)).toISOString());
                                // set maxAmp to lowerst value:
                                this.setAmp(6);
                            }
                        }
                    } else {
                        this.log.debug('Continue because loadWith6AAtLeast is activated.');
                        this.setAmp(6);
                    }
                } else {
                    if(this.lastStopRequest !== null) {
                        this.lastStopRequest = null;
                        this.log.silly('Reset wait for lastStopRequest...');
                    }
                    this.setAmp(maxAmp);
                    if(allowCharge.val == 0)
                        this.setValue('alw', 1);
                }

            } catch (e) {
                const errMsg = e instanceof Error ? e.message : JSON.stringify(e);
                this.log.error('Error during set adjust Watts: ' + errMsg);
            }

        } else {
            // Still existing Block-Timer
            this.log.silly('MaxWatts ignored. You are sending to fast! Update interval in settings is currently set to: ' + this.config.ampUpdateInterval);
        }
    }
    /**
     * Get the max Watts from foreign adapters
     * params: stateObjectId = "[unknown State ID]"
     */
    async calculateFromForeignObjects(foreignObj = 'unknown') {
        try {
            const allowCharge = await this.getStateAsync('allow_charging');
            if(allowCharge === null || allowCharge === undefined || allowCharge.val === null) {
                this.log.error('calculateFromForeignObjects: Not all required information about the phases are found. Required Values are: alw');
                return;
            }

            // Check if scheduler is active
            const stopChargeingEnabled = await this.getStateAsync('schedule.stopChargeingEnabled');
            const stopChargeingAt = await this.getStateAsync('schedule.stopChargeingAt');
            if(stopChargeingEnabled !== null && stopChargeingEnabled !== undefined && stopChargeingEnabled.val === true &&
              stopChargeingAt !== null && stopChargeingAt !== undefined && stopChargeingAt.val != null && !isNaN(Date.parse(stopChargeingAt.val.toString())) && Date.parse(stopChargeingAt.val.toString()) < Date.now()
            ) {
                this.log.info('Scheduler does not allow to load after ' + stopChargeingAt.val);
                if( allowCharge.val !== 0)
                    this.setValue('alw', 0);
                return;
            }
            // Check is solar load is enabled; Dont act if not.
            const solarOnly = await this.getStateAsync('solarLoadOnly');
            if (solarOnly === undefined || solarOnly == null || solarOnly.val == null || solarOnly.val !== true) {
                this.log.silly(`Solar calculation disabled: ${solarOnly}`);
                if(solarOnly != undefined && solarOnly != null && solarOnly.val != null && !solarOnly.ack)
                    this.setState('solarLoadOnly', { val: false, ack: true });
                return;
            }

            // Check if SoC Car is enabled
            const carBatterySoC = await this.getNumberFromForeignObjectId(this.config.carBatterySoCForeignObjectID);
            const stopChargeingAtCarSoC = await this.getStateAsync('stopChargeingAtCarSoC');
            if(stopChargeingAtCarSoC != null && stopChargeingAtCarSoC != undefined && stopChargeingAtCarSoC.val === true && carBatterySoC >= 80) {
                this.log.info('Stop loading over 80% because car SoC is at ' + carBatterySoC);
                if( allowCharge.val !== 0)
                    this.setValue('alw', 0);
                return;
            }

            const usedPower = await this.getStateAsync('energy.power');
            // Check if used Power has a value
            if(usedPower === undefined || usedPower == null || usedPower.val == null) {
                this.log.debug('No actual energy.power found. Abort recalculation by foreign adapter.');
                return;
            }

            let availWatts1 = 0;
            availWatts1 = availWatts1 + (await this.getNumberFromForeignObjectId(this.config.solarPowerForeignObjectID));
            if(this.config.solarPowerForeignObjectNegate) {
                availWatts1 = availWatts1 * -1;
                this.log.silly('Negate watts of Solar new: ' + availWatts1);
            }
            let availWatts2 = availWatts1;
            if(availWatts1 >= this.config.bufferToSolar) {
                availWatts2 -= this.config.bufferToSolar;
            }
            const houseConsumption = await this.getNumberFromForeignObjectId(this.config.houseConsumptionForeignObjectID);
            const availWatts3 = availWatts2 - houseConsumption;

            // houseBatteryForeignObjectID - Ladestrom der Hausbatterie
            // Wenn dieses Fremdobjekt angegeben wird, ist die Priorisierung auf das Laden des Fzg. gesetzt.
            let houseBattery = await this.getNumberFromForeignObjectId(this.config.houseBatteryForeignObjectID);
            if(this.config.houseBatteryForeignObjectNegate) {
                houseBattery *= -1;
                this.log.silly('Negate watts of battery new: ' + houseBattery);
            }
            //if(houseBattery > this.config.bufferToBattery) {
            //    houseBattery -= this.config.bufferToBattery;
            //} else {
            //    houseBattery = 0;
            //}
            const availWatts = availWatts3 + houseBattery;
            // If your home battery contains 3000 Wh use in one hour the whole energy to load.
            //

            this.log.debug('Incoming request from foreign Object ' + foreignObj + ' with ' + (availWatts - parseInt(usedPower.val.toString(), 10)) + ` Watts. (${availWatts1} solarPower - ${this.config.bufferToSolar} Buffer - ${houseConsumption} House consumption + ${houseBattery} House battery)`);
            this.adjustAmpLevelInWatts(availWatts - parseInt(usedPower.val.toString(), 10));
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
            this.log.error('Error in calculateFromForeignObjects: ' + JSON.stringify(errMsg));
        }
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
            this.log.silly('Foreign Object error: ' + err);
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
            this.log.warn('Cant set ' + ampLvl + ' to ' + attribute + 'it must be between 6 and 32 ampere');
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
