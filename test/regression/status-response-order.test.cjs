'use strict';

// Offline response-order regression: HTTP, ioBroker state writes and dependencies
// are mocked. No live adapter installation or device connection is performed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const corrected = fs.readFileSync(process.env.GOE_SOURCE_FILE || path.join(__dirname, '../../main.js'), 'utf8');

const settle = async () => {for (let n = 0; n < 60; n++) await Promise.resolve();};
function fixtureAdapter(source = corrected, options = {}) {
    const pending = [], writes = [];
    const axios = {defaults: {}, get(url) {
        if (url.includes('filter=psm') && !options.deferPhase)
            return Promise.resolve({data: {psm: 1}, status: 200});
        return new Promise((resolve, reject) => pending.push({url, resolve, reject}));
    }};
    class Adapter {
        constructor() {
            this.config = {apiVersion: 2, selectedAttributes: ['alw', 'car', 'amp'], serverName: 'offline.invalid'};
            this.log = {debug() {}, silly() {}, warn() {}, error() {}, info() {}};
        }
        on() {}
        async setState(id, state, ack) {
            await options.beforeWrite?.(id, state);
            writes.push({id, val: state?.val ?? state, ack: state?.ack ?? ack});
        }
    }
    class Queue {add(fn) {return Promise.resolve().then(fn);}}
    const sandbox = {module: {parent: {}, exports: {}}, require(id) {
        if (id === '@iobroker/adapter-core') return {Adapter};
        if (id === 'axios') return {default: axios};
        if (id === 'p-queue') return {default: Queue};
        if (id === './lib/schema.js') return {schema: {validate(data) {return {value: data};}}};
        throw Error('Unexpected offline dependency: ' + id);
    }, setTimeout, clearTimeout, setInterval, clearInterval, console};
    vm.runInNewContext(source, sandbox, {filename: 'go-e-main.js'});
    const adapter = sandbox.module.exports({});
    return {adapter, pending, writes,
        answer(index, data) {pending[index].resolve({data, status: 200});},
        values(id = 'allow_charging') {return writes.filter(write => write.id === id).map(write => write.val);}};
}

async function crossedPolls(source) {
    const h = fixtureAdapter(source);
    const older = h.adapter.getStateFromDevice(), newer = h.adapter.getStateFromDevice();
    h.answer(2, {alw: 1}); h.answer(3, {alw: 1});
    await newer; await settle();
    h.answer(0, {alw: 1}); h.answer(1, {alw: 0, car: 2});
    await older; await settle();
    return h;
}

test('older V1/V2 polls cannot overwrite a newer allow ACK; unrelated fields remain available', async () => {
    const h = await crossedPolls(corrected);
    assert.equal(h.values().at(-1), 1);
    assert.ok(!h.values().includes(0));
    assert.equal(h.values('car').at(-1), 2);
});

test('a genuinely newer device OFF remains accepted', async () => {
    const h = fixtureAdapter();
    let poll = h.adapter.getStateFromDevice();
    h.answer(0, {alw: 1}); h.answer(1, {alw: 1}); await poll; await settle();
    poll = h.adapter.getStateFromDevice();
    h.answer(2, {alw: 0}); h.answer(3, {alw: 0}); await poll; await settle();
    assert.equal(h.values().at(-1), 0);
});

test('a pre-command poll cannot masquerade as an acknowledgement of that command', async () => {
    const h = fixtureAdapter();
    const poll = h.adapter.getStateFromDevice();
    const command = h.adapter.setValue('alw', 1);
    h.answer(0, {alw: 0, car: 2}); h.answer(1, {alw: 0});
    await poll; await settle();
    assert.deepEqual(h.values(), []);
    assert.equal(h.values('car').at(-1), 2);
    h.answer(2, {alw: 1}); await command; await settle();
    assert.deepEqual(h.values(), [1]);
});

test('older write responses cannot overwrite a newer write response', async () => {
    const h = fixtureAdapter();
    const first = h.adapter.setValue('alw', 0), second = h.adapter.setValue('alw', 1);
    h.answer(1, {alw: 1}); await second; await settle();
    h.answer(0, {alw: 0}); await first; await settle();
    assert.deepEqual(h.values(), [1]);
});

test('a later poll supersedes a delayed write response, including an honest new OFF', async () => {
    const h = fixtureAdapter();
    const write = h.adapter.setValue('alw', 1), poll = h.adapter.getStateFromDevice();
    h.answer(1, {alw: 0}); h.answer(2, {alw: 0}); await poll; await settle();
    h.answer(0, {alw: 1}); await write; await settle();
    assert.equal(h.values().at(-1), 0);
    assert.ok(!h.values().includes(1));
});

test('V2 write fences old polls without inventing an ACK from its sparse set response', async () => {
    const h = fixtureAdapter();
    const poll = h.adapter.getStateFromDevice(), write = h.adapter.setValueV2('alw', 1);
    h.answer(0, {alw: 0}); h.answer(1, {alw: 0}); h.answer(2, {alw: true});
    await poll; await write; await settle();
    assert.deepEqual(h.values(), []);
    const fresh = h.adapter.getStateFromDevice();
    h.answer(3, {alw: 1}); h.answer(4, {alw: 1}); await fresh; await settle();
    assert.equal(h.values().at(-1), 1);
});

test('same-field async state writes settle in order, and a rejected state write does not poison later work', async () => {
    let release, entered;
    const gate = new Promise(resolve => {release = resolve;});
    const started = new Promise(resolve => {entered = resolve;});
    let first = true;
    const h = fixtureAdapter(corrected, {beforeWrite: async id => {
        if (id === 'allow_charging' && first) {first = false; entered(); await gate; throw Error('offline write failure');}
    }});
    const older = h.adapter.processStatusObject({alw: 0}, 1); await started;
    const newer = h.adapter.processStatusObject({alw: 1}, 2);
    await settle(); assert.deepEqual(h.values(), []);
    release(); await older; await newer; await settle();
    assert.deepEqual(h.values(), [1]);
});

test('a command arriving while an older response processes another field fences its remaining allow publication', async () => {
    let release, entered;
    const gate = new Promise(resolve => {release = resolve;});
    const started = new Promise(resolve => {entered = resolve;});
    const h = fixtureAdapter(corrected, {beforeWrite: async id => {if (id === 'car') {entered(); await gate;}}});
    const oldGeneration = h.adapter.statusResponseOrder.request();
    const old = h.adapter.processStatusObject({car: 2, alw: 0}, oldGeneration); await started;
    const write = h.adapter.setValue('alw', 1);
    h.answer(0, {alw: 1}); await write; await settle();
    release(); await old; await settle();
    assert.deepEqual(h.values(), [1]);
});

test('phase status polls also reject older responses across a V2 phase command', async () => {
    const h = fixtureAdapter(corrected, {deferPhase: true});
    const old = h.adapter.getStateFromDevice(), command = h.adapter.setValueV2('psm', 2);
    h.answer(0, {psm: 1}); h.answer(1, {car: 2}); h.answer(2, {car: 2}); h.answer(3, {psm: true});
    await old; await command; await settle();
    assert.deepEqual(h.values('phaseSwitchMode'), []);
    const fresh = h.adapter.getStateFromDevice();
    h.answer(4, {psm: 2}); h.answer(5, {car: 2}); h.answer(6, {car: 2}); await fresh; await settle();
    assert.equal(h.values('phaseSwitchMode').at(-1), 2);
});
