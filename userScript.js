let timeout;
/************************************* Debug / Logging ***********************************************/
const logging = false;
const debug = false;
const force = false;

/************************************* Vor dem Star anpassen ***********************************************/
// Bitte die Instanz auswählen

// const preafix = '0_userdata.0';
// oder
const preafix = "javascript.0";
//---------------------------------//
const ueberschussDp = "smartmeter.0.1-0:16_7_0__255.value";
const voltDP = "javascript.0.go_echarger.nrg0";
const ladenOn = "javascript.0.go_echarger.nrg11"
/************************************* Variablen ***********************************************/

let ampere = [
/* bei 224 Volt
Stuffe 1 : 1344 W, Stuffe 2 : 1792 W, Stuffe 3 : 2240 W, Stuffe 4 : 2688 W, Stuffe 5 : 3136 W, Stuffe 6 : 3584 W, Stuffe 7 : 4032 W,
Stuffe 8 : 4480 W, Stuffe 9 : 4928 W, Stuffe 10 : 5376 W, Stuffe 11 : 5824 W, Stuffe 12 : 6272 W, Stuffe 13 : 6720 W, Stuffe 14 : 7168 W
*/
6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32
];

let Stuffe = null;
let oldWatt = null;
let newWatt = null;
let ladenStatus = false;
let oldState = null;
let differenz = null;
let ueberschuss = getState(ueberschussDp).val;
let volt = getState(voltDP).val;
let laden = null;
let test6 = null
sendState(6)
/******************************************************* berechnung des Ladestrom functions ***************************************************************************/

function chargeLevel() {

    ueberschuss = getState(ueberschussDp).val;


    if (debug) console.log("Überschuss: " + ueberschuss);
    /* berechnung der Ladestrom Stufe */
    if (ueberschuss >= 0) {
        if (debug) console.log("ladenStatus " + ladenStatus);
        if (ueberschuss >= 0 && Stuffe <= 14 + 1 && Stuffe >= 0 - 1) {
            Stuffe = (Stuffe - 1);
            if (logging) console.log("Stuffe: " + Stuffe);
        }
    }
    //if (ueberschuss < 0 && ladenStatus == true || oldState > ueberschuss || Stuffe === 0 ) {
    if (ueberschuss < 0 ) {
        let test6 = getState("javascript.0.go_echarger.nrg11").val * 1000 - 200;
        oldState = ueberschuss;
        if (logging) console.log("oldState: " + oldState);
        ladenStatus = false;
        if (logging) console.log(ladenStatus);
        let ueberschuss = Math.abs(getState(ueberschussDp).val);
        let ueberschuss_new = (test6 + ueberschuss);

        //log (ueberschuss_new, 'warn')
        if (debug) console.log(" " + ueberschuss);
        if (debug) console.log("ladenStatus " + ladenStatus);
        oldWatt = ueberschuss;
        timeout = setTimeout(function () {
            if (ueberschuss_new >= 0 && ueberschuss_new <= (ampere[0] * volt)) {
                Stuffe = 1;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[1] * volt - ((ampere[1] * volt) - (ampere[0] * volt))) && ueberschuss_new <= ampere[1] * volt) {
                Stuffe = 2;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[2] * volt - ((ampere[2] * volt) - (ampere[1] * volt))) && ueberschuss_new <= ampere[2] * volt) {
                Stuffe = 3;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[3] * volt - ((ampere[3] * volt) - (ampere[2] * volt))) && ueberschuss_new <= ampere[3] * volt) {
                Stuffe = 4;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[4] * volt - ((ampere[4] * volt) - (ampere[3] * volt))) && ueberschuss_new <= ampere[4] * volt) {
                Stuffe = 5;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[5] * volt - ((ampere[5] * volt) - (ampere[4] * volt))) && ueberschuss_new <= ampere[5] * volt) {
                Stuffe = 6;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[6] * volt - ((ampere[6] * volt) - (ampere[5] * volt))) && ueberschuss_new <= ampere[6] * volt) {
                Stuffe = 7;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[7] * volt - ((ampere[7] * volt) - (ampere[6] * volt))) && ueberschuss_new <= ampere[7] * volt) {
                Stuffe = 8;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[8] * volt - ((ampere[8] * volt) - (ampere[7] * volt))) && ueberschuss_new <= ampere[8] * volt) {
                Stuffe = 9;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[9] * volt - ((ampere[9] * volt) - (ampere[8] * volt))) && ueberschuss_new <= ampere[9] * volt) {
                Stuffe = 10;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[10] * volt - ((ampere[10] * volt) - (ampere[9] * volt))) && ueberschuss_new <= ampere[10] * volt) {
                Stuffe = 11;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[11] * volt - ((ampere[11] * volt) - (ampere[10] * volt))) && ueberschuss_new <= ampere[11] * volt) {
                Stuffe = 12;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[12] * volt - ((ampere[12] * volt) - (ampere[11] * volt))) && ueberschuss_new <= ampere[12] * volt) {
                Stuffe = 13;
                if (logging) console.log("Stuffe: " + Stuffe);
            } else if (ueberschuss_new >= (ampere[13] * volt - ((ampere[13] * volt) - (ampere[12] * volt))) && ueberschuss_new <= ampere[13] * volt) {
                Stuffe = 14;
                if (logging) console.log("Stuffe: " + Stuffe);
            }
        }, 15000);
    }
}

function test3() {
    if (Stuffe === 0) {
        if (logging) console.log("Laden Aus");
        if (logging) console.log("Laden Aus");
    } else if (Stuffe === 1) {
        if (logging) console.log(ueberschuss + " w");
        if (logging) console.log(ampere[0] + " A");
        sendState(ampere[0]);
    } else if (Stuffe === 2) {
        if (logging) console.log(ueberschuss + " w")
        if (logging) console.log(ampere[1] + " A ");
        sendState(ampere[1]);
    } else if (Stuffe === 3) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[2] + " A ");
        sendState(ampere[2]);
    } else if (Stuffe === 4) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[3] + " A ");
        sendState(ampere[3]);
    } else if (Stuffe === 5) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[4] + " A ");
        sendState(ampere[4]);
    } else if (Stuffe === 6) {
        if (logging) console.log(ueberschuss + " w")
        if (logging) console.log(ampere[5] + " A ");
        sendState(ampere[5]);
    } else if (Stuffe === 7) {
        if (logging) console.log(ueberschuss + " w")
        if (logging) console.log(ampere[6] + " A ");
        sendState(ampere[6]);
    } else if (Stuffe === 8) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[7] + " A ");
        sendState(ampere[7]);
    } else if (Stuffe === 9) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[8] + " A ");
        sendState(ampere[8]);
    } else if (Stuffe === 10) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[9] + " A ");
        sendState(ampere[9]);
    } else if (Stuffe === 11) {
        if (logging) console.log(ueberschuss + " w")
        if (logging) console.log(ampere[10] + " A ");
        sendState(ampere[10]);
    } else if (Stuffe === 12) {
        if (logging) console.log(ueberschuss + " w")
        if (logging) console.log(ampere[11] + " A ");
        sendState(ampere[11]);
    } else if (Stuffe === 13) {
        if (logging) console.log(ueberschuss + " w")
        if (logging)  console.log(ampere[12] + " A ");
        sendState(ampere[12]);
    } else if (Stuffe === 14) {
        if (logging)  console.log(ampere[13] + " A ");
        if (logging) console.log(ueberschuss + " W");
        sendState(ampere[13]);
    }
}

function sendState(text) {
    if (debug) log(text);
    setState("javascript.0.go_echarger.write_amp", text, false);
}

/************************************* Trigger ***********************************************/

on({ id: ueberschussDp, change: "any" }, function (obj) {
    newWatt = Math.abs(obj.state.val);
    oldWatt = Math.abs(obj.oldState.val);
    chargeLevel();
    test3();
});

on({ id: ueberschussDp, change: "any" }, function (obj) {
    volt = getState(voltDP).val;
});

on({ id: ladenOn, change: "ne" }, function (obj) {
    laden = obj.state.val
    if (laden == 0) {
        ladenStatus = false;
        if (logging) console.log("The vehicle has started charging");
    }
});