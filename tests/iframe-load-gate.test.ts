import {test} from 'node:test';
import assert from 'node:assert/strict';
import {iframeLoadGate} from '../src/integration/iframeLoadGate';
test('load before effect setup initializes immediately on connect',()=>{const gate=iframeLoadGate();let n=0;gate.onLoad();gate.connect(()=>n++);assert.equal(n,1);});
test('effect before load never sends into initial document',()=>{const gate=iframeLoadGate();let n=0;gate.connect(()=>n++);assert.equal(n,0);gate.onLoad();assert.equal(n,1);});
test('cleanup and effect replay keep loaded state without stale sender',()=>{const gate=iframeLoadGate();let old=0,current=0;const stop=gate.connect(()=>old++);stop();gate.onLoad();gate.connect(()=>current++);assert.equal(old,0);assert.equal(current,1);});
