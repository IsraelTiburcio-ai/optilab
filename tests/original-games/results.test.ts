import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {allowedResultsHost,isResultPilot,originalResultSource,validOriginalResult,parseOriginalResultMessage,OriginalResultReceiver,ORIGINAL_RESULTS_PROTOCOL as protocol} from '../../src/integration/originalResults';
const gameId='ahorcado-simplex',session=randomUUID(),runId=randomUUID(),url=originalResultSource('https://israeltiburcio-ai.github.io/ahorcado-simplex/',gameId,session,'http://127.0.0.1:5189');
const result={reason:'completed',correct:3,total:3,attempts:24,errors:1,durationMs:18000};
const ready={protocol,version:1,gameId,session,type:'game:ready'},start={...ready,type:'game:started',runId},end={...start,type:'game:completed',result};
const source={},frame={window:source,sourceUrl:url,connected:true};
const event=(data:unknown)=>({origin:'null',source,data});
test('only two pilot IDs and explicit HTTPS/loopback parent origins get session URLs',()=>{
  assert.equal(isResultPilot('memorama-simplex'),false);assert.equal(isResultPilot('lp-factory'),false);
  for(const origin of ['https://israeltiburcio-ai.github.io','http://127.0.0.1:5189','http://localhost:5173'])assert.ok(allowedResultsHost(origin));
  for(const origin of ['null','https://evil.example','https://israeltiburcio-ai.github.io.evil.example','http://evil.example','https://israeltiburcio-ai.github.io/path','https://user@israeltiburcio-ai.github.io'])assert.equal(allowedResultsHost(origin),false);
  assert.equal(new URL(url).searchParams.get('optilabSession'),session);assert.equal(new URL(url).searchParams.size,2);
  assert.equal(originalResultSource('https://israeltiburcio-ai.github.io/lp-factory/','lp-factory',session,'http://127.0.0.1:5189'),'https://israeltiburcio-ai.github.io/lp-factory/');
});
test('native units differ: word hits/letter guesses versus placements/checks',()=>{
  assert.ok(validOriginalResult(result,gameId));assert.ok(validOriginalResult({...result,reason:'time-limit',correct:0,attempts:0,errors:0,durationMs:90000},gameId));
  assert.ok(validOriginalResult({...result,correct:0,attempts:18,errors:18},gameId)); // ended, not won
  const order={reason:'completed',correct:26,total:34,attempts:7,errors:8,durationMs:40000};
  assert.ok(validOriginalResult(order,'ordena-simplex')); // errors can exceed checks
  assert.equal(validOriginalResult({...order,correct:6},'ordena-simplex'),false);
  assert.equal(validOriginalResult({...order,reason:'time-limit'},'ordena-simplex'),false);
  assert.equal(validOriginalResult({...result,total:8},gameId),false);
  for(const patch of [{durationMs:90001},{attempts:1000},{errors:19},{correct:4},{total:0},{attempts:-1},{durationMs:NaN},{errors:1.5},{correct:'3'},{reason:new String('completed')},{attempts:3},{correct:0},{uid:'other'}])assert.equal(validOriginalResult({...result,...patch},gameId),false);
  assert.ok(validOriginalResult({...result,score:12.5},gameId));
  for(const score of [NaN,Infinity,'100',null,1e20])assert.equal(validOriginalResult({...result,score},gameId),false);
});
test('strict envelope rejects old protocols, extra keys, wrong session/game/version and non-objects',()=>{
  assert.ok(parseOriginalResultMessage(end,gameId,session));
  for(const data of [null,[],JSON.stringify(end),{...start,type:new String('game:started')},{...end,protocol:'optilab-game'},{...end,session:randomUUID()},{...end,gameId:'memorama-simplex'},{...end,version:2},{...end,role:'teacher'},{...end,runId:'bad'},{...end,result:{...result,completed:true}}])assert.equal(parseOriginalResultMessage(data,gameId,session),null);
});
test('null origin alone is insufficient: exact active direct frame and source URL are mandatory',()=>{
  for(const patch of [{origin:'https://israeltiburcio-ai.github.io'},{origin:''},{source:{}},{source:null}])assert.equal(new OriginalResultReceiver(gameId,session,url).accept({...event(ready),...patch},frame),null);
  for(const patch of [{window:null},{connected:false},{sourceUrl:url+'#other'}])assert.equal(new OriginalResultReceiver(gameId,session,url).accept(event(ready),{...frame,...patch}),null);
});
test('ready/start/completion order, deduplication and run replacement',()=>{
  const receiver=new OriginalResultReceiver(gameId,session,url);
  assert.equal(receiver.accept(event(start),frame),null);assert.equal(receiver.accept(event(end),frame),null);
  assert.ok(receiver.accept(event(ready),frame));assert.equal(receiver.accept(event(ready),frame),null);
  assert.equal(receiver.accept(event(end),frame),null);assert.ok(receiver.accept(event(start),frame));assert.equal(receiver.accept(event(start),frame),null);
  assert.equal(receiver.accept(event({...end,runId:randomUUID()}),frame),null);
  assert.ok(receiver.accept(event(end),frame));assert.equal(receiver.accept(event(end),frame),null);
  const next=randomUUID();assert.ok(receiver.accept(event({...start,runId:next}),frame));
  assert.equal(receiver.accept(event(end),frame),null);assert.equal(receiver.accept(event(start),frame),null);
  assert.ok(receiver.accept(event({...end,runId:next}),frame));
});
test('aborted, superseded and unmounted sessions cannot emit accepted late results',()=>{
  const receiver=new OriginalResultReceiver(gameId,session,url);receiver.accept(event(ready),frame);receiver.accept(event(start),frame);
  assert.ok(receiver.accept(event({...start,type:'game:aborted'}),frame));assert.equal(receiver.accept(event(end),frame),null);
  receiver.invalidate();assert.equal(receiver.accept(event({...start,runId:randomUUID()}),frame),null);
  const other=new OriginalResultReceiver(gameId,randomUUID(),url);assert.equal(other.accept(event(ready),frame),null);
});
test('bounded replay memory rejects further run IDs without losing active completion',()=>{
  const receiver=new OriginalResultReceiver(gameId,session,url);receiver.accept(event(ready),frame);let last='';
  for(let i=0;i<256;i++){last=randomUUID();assert.ok(receiver.accept(event({...start,runId:last}),frame));}
  assert.equal(receiver.accept(event({...start,runId:randomUUID()}),frame),null);
  assert.ok(receiver.accept(event({...end,runId:last}),frame));
});
