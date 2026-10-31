import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {allowedResultsHost,isResultPilot,originalResultSource,validOriginalResult,parseOriginalResultMessage,OriginalResultReceiver,ORIGINAL_RESULTS_PROTOCOL as protocol} from '../../src/integration/originalResults';
const gameId='ahorcado-simplex',session=randomUUID(),runId=randomUUID(),url=originalResultSource('https://israeltiburcio-ai.github.io/ahorcado-simplex/',gameId,session,'http://127.0.0.1:5189');
const result={reason:'completed',correct:3,total:3,attempts:24,errors:1,durationMs:18000};
const ready={protocol,version:1,gameId,session,type:'game:ready'},start={...ready,type:'game:started',runId},end={...start,type:'game:completed',result};
const source={},frame={window:source,sourceUrl:url,connected:true};
const event=(data:unknown)=>({origin:'null',source,data});
test('only configured pilot IDs and explicit HTTPS/loopback parent origins get session URLs',()=>{
  assert.equal(isResultPilot('memorama-simplex'),false);assert.equal(isResultPilot('unknown-game'),false);
  for(const origin of ['https://israeltiburcio-ai.github.io','http://127.0.0.1:5189','http://localhost:5173'])assert.ok(allowedResultsHost(origin));
  for(const origin of ['null','https://evil.example','https://israeltiburcio-ai.github.io.evil.example','http://evil.example','https://israeltiburcio-ai.github.io/path','https://user@israeltiburcio-ai.github.io'])assert.equal(allowedResultsHost(origin),false);
  assert.equal(new URL(url).searchParams.get('optilabSession'),session);assert.equal(new URL(url).searchParams.size,2);
  assert.equal(originalResultSource('https://israeltiburcio-ai.github.io/unknown-game/','unknown-game',session,'http://127.0.0.1:5189'),'https://israeltiburcio-ai.github.io/unknown-game/');
});
test('gym 5 games expose only their native fields and exact totals',()=>{
  const samples={
    'desviacion-express':{reason:'completed',correct:8,total:8,durationMs:12345},
    'torre-prioridades':{reason:'completed',correct:12,total:12,attempts:15,durationMs:80000},
    'rompecabezas-metas':{reason:'completed',correct:5,total:7,durationMs:90000},
    'ruta-de-metas':{reason:'completed',correct:4,total:5,durationMs:70000},
    'candado-simplex':{reason:'completed',correct:3,total:5,attempts:8,durationMs:60000},
  } as const;
  for(const [id,res] of Object.entries(samples)){
    assert.ok(isResultPilot(id));assert.ok(validOriginalResult(res,id as never));
    assert.equal(validOriginalResult({...res,errors:0},id as never),false);
    assert.equal(validOriginalResult({...res,score:1},id as never),false);
    assert.equal(validOriginalResult({...res,reason:'time-limit'},id as never),false);
  }
  assert.equal(validOriginalResult({...samples['desviacion-express'],total:7},'desviacion-express'),false);
  assert.equal(validOriginalResult({...samples['torre-prioridades'],correct:13},'torre-prioridades'),false);
  assert.equal(validOriginalResult({...samples['torre-prioridades'],attempts:11},'torre-prioridades'),false);
  assert.equal(validOriginalResult({...samples['rompecabezas-metas'],correct:8},'rompecabezas-metas'),false);
  assert.equal(validOriginalResult({...samples['ruta-de-metas'],total:6},'ruta-de-metas'),false);
  assert.equal(validOriginalResult({...samples['candado-simplex'],attempts:2},'candado-simplex'),false);
});
test('additional games expose only their own native fields and exact round totals',()=>{
  for(const [id,total] of [['system-lab',8],['SystemScope',6],['complexity-lab',4]] as const){
    const result={reason:'completed',correct:2,total,score:200,...(id==='SystemScope'?{durationMs:4000}:{})};
    assert.ok(validOriginalResult(result,id));assert.equal(validOriginalResult({...result,attempts:total},id),false);assert.equal(validOriginalResult({...result,errors:0},id),false);assert.equal(validOriginalResult({...result,total:99},id),false);assert.equal(validOriginalResult({...result,score:-1},id),false);assert.equal(validOriginalResult({...result,reason:'time-limit'},id),false);
  }
});
test('gym4 preserves each game’s native units, null origin and replay protections',()=>{
  for(const [id,total,hasErrors] of [['espejo-dual',5,true],['balanza-dual',5,false],['domino-holguras',6,true],['mercado-recursos-dual',6,false],['semaforo-sensibilidad',6,false]] as const){
    const result={reason:'completed',correct:total,total,durationMs:4000,...(hasErrors?{errors:2}:{})};
    assert.ok(validOriginalResult(result,id));assert.equal(validOriginalResult({...result,attempts:1},id),false);assert.equal(validOriginalResult({...result,score:100},id),false);assert.equal(validOriginalResult({...result,durationMs:4001},id),false);assert.equal(validOriginalResult({...result,total:total+1},id),false);
    const session=randomUUID(),runId=randomUUID(),src=originalResultSource(`https://israeltiburcio-ai.github.io/${id}/`,id,session,'http://127.0.0.1:5189'),direct={...frame,sourceUrl:src},receiver=new OriginalResultReceiver(id,session,src),ready={protocol,version:1,gameId:id,session,type:'game:ready'},start={...ready,type:'game:started',runId},end={...start,type:'game:completed',result};
    assert.equal(receiver.accept({...event(ready),source:{}},direct),null);assert.equal(receiver.accept({...event(ready),origin:'https://evil.example'},direct),null);assert.ok(receiver.accept(event(ready),direct));assert.ok(receiver.accept(event(start),direct));assert.equal(receiver.accept(event({...end,session:randomUUID()}),direct),null);assert.ok(receiver.accept(event(end),direct));assert.equal(receiver.accept(event(end),direct),null);
  }
});
test('gym2 distinguishes incorrect answers from expirations and accepts only native fields',()=>{
  for(const id of ['model-match','constraint-dash'] as const){
    const result={reason:'completed',correct:7,total:10,attempts:9,errors:2,timeouts:1,durationMs:30000,...(id==='constraint-dash'?{score:500}:{})};
    assert.ok(validOriginalResult(result,id));for(const patch of [{timeouts:2},{errors:3},{attempts:10},{durationMs:30001},{uid:'student'},{score:id==='model-match'?100:-1}])assert.equal(validOriginalResult({...result,...patch},id),false);
  }
  const factory={reason:'completed',correct:13,total:15,attempts:15,errors:2,durationMs:23567,score:2500};assert.ok(validOriginalResult(factory,'lp-factory'));assert.equal(validOriginalResult({...factory,errors:3},'lp-factory'),false);
  const feasible={reason:'completed',correct:4,total:6,durationMs:21432,score:500};assert.ok(validOriginalResult(feasible,'feasible-drop'));assert.equal(validOriginalResult({...feasible,timeouts:2},'feasible-drop'),false);
  for(const id of ['model-match','lp-factory','constraint-dash','feasible-drop'] as const){
    const session=randomUUID(),runId=randomUUID(),src=originalResultSource(`https://israeltiburcio-ai.github.io/${id}/`,id,session,'http://127.0.0.1:5189'),direct={...frame,sourceUrl:src},receiver=new OriginalResultReceiver(id,session,src),ready={protocol,version:1,gameId:id,session,type:'game:ready'},start={...ready,type:'game:started',runId};
    assert.equal(receiver.accept({...event(ready),source:{}},direct),null);assert.equal(receiver.accept({...event(ready),origin:'https://evil.example'},direct),null);assert.ok(receiver.accept(event(ready),direct));assert.ok(receiver.accept(event(start),direct));assert.equal(receiver.accept(event(start),direct),null);
  }
});
test('last eight games preserve native totals, precision and omission of unavailable counters',()=>{
  const samples={
    'OptiQuest1':{reason:'completed',correct:3,total:3},
    'or-mission':{reason:'completed',correct:6,total:8,errors:3,durationMs:42000,score:780},
    'solution-detective':{reason:'completed',correct:7,total:8,durationMs:21000},
    'planificador-produccion':{reason:'completed',correct:5,total:6,durationMs:20000,score:500},
    'mapa-produccion':{reason:'completed',correct:5,total:5,durationMs:15000},
    'claves-planeacion-produccion':{reason:'completed',correct:4,total:5,durationMs:15000},
    'rompecabezas-simplex':{reason:'completed',correct:6,total:7,attempts:9,errors:2,durationMs:23123,score:800},
    'caza-el-pivote':{reason:'completed',correct:14,total:15,attempts:16,errors:1,durationMs:24000,score:1450},
  } as const;
  for(const [id,res] of Object.entries(samples)){
    assert.ok(isResultPilot(id));assert.ok(validOriginalResult(res,id as never));
    for(const patch of [{total:99},{correct:99},{timeouts:1},{uid:'teacher'},{reason:'abandoned'}])assert.equal(validOriginalResult({...res,...patch},id as never),false);
    const session=randomUUID(),runId=randomUUID(),src=originalResultSource(`https://israeltiburcio-ai.github.io/${id}/`,id,session,'http://127.0.0.1:5189'),direct={...frame,sourceUrl:src},receiver=new OriginalResultReceiver(id as never,session,src),ready={protocol,version:1,gameId:id,session,type:'game:ready'},start={...ready,type:'game:started',runId},end={...start,type:'game:completed',result:res};
    assert.equal(receiver.accept({...event(ready),source:{}},direct),null);assert.equal(receiver.accept({...event(ready),origin:'https://evil.example'},direct),null);assert.ok(receiver.accept(event(ready),direct));assert.equal(receiver.accept(event(end),direct),null);assert.ok(receiver.accept(event(start),direct));assert.equal(receiver.accept(event({...end,session:randomUUID()}),direct),null);assert.ok(receiver.accept(event(end),direct));assert.equal(receiver.accept(event(end),direct),null);
  }
  assert.equal(validOriginalResult({...samples.OptiQuest1,durationMs:0},'OptiQuest1'),false);
  assert.equal(validOriginalResult({...samples['mapa-produccion'],correct:4},'mapa-produccion'),false);
  assert.equal(validOriginalResult({...samples['solution-detective'],score:7},'solution-detective'),false);
  assert.equal(validOriginalResult({...samples['or-mission'],durationMs:42001},'or-mission'),false);
  assert.equal(validOriginalResult({...samples['rompecabezas-simplex'],attempts:8},'rompecabezas-simplex'),false);
  for(const total of [6,7,8])assert.ok(validOriginalResult({...samples['rompecabezas-simplex'],correct:total,total,attempts:total,errors:0},'rompecabezas-simplex'));
  assert.ok(validOriginalResult({...samples['caza-el-pivote'],reason:'time-limit',correct:0,attempts:0,errors:0,durationMs:120000,score:0},'caza-el-pivote'));
  assert.equal(validOriginalResult({...samples['caza-el-pivote'],reason:'time-limit'},'caza-el-pivote'),false);
});
test('additional games require opaque source and a unique started run',()=>{
  for(const id of ['system-lab','SystemScope','complexity-lab'] as const){
    const session=randomUUID(),runId=randomUUID(),src=originalResultSource(`https://israeltiburcio-ai.github.io/${id}/`,id,session,'http://127.0.0.1:5189');
    const receiver=new OriginalResultReceiver(id,session,src),ready={protocol,version:1,gameId:id,session,type:'game:ready'},start={...ready,type:'game:started',runId},end={...start,type:'game:completed',result:{reason:'completed',correct:2,total:id==='system-lab'?8:id==='SystemScope'?6:4,score:200,...(id==='SystemScope'?{durationMs:5000}:{})}},other={};
    assert.equal(receiver.accept({origin:'null',source:other,data:ready},frame),null);
    assert.equal(receiver.accept({origin:'https://israeltiburcio-ai.github.io',source,data:ready},{...frame,sourceUrl:src}),null);
    const active={...frame,sourceUrl:src};assert.ok(receiver.accept(event(ready),active));assert.equal(receiver.accept(event(end),active),null);assert.ok(receiver.accept(event(start),active));assert.ok(receiver.accept(event(end),active));assert.equal(receiver.accept(event(end),active),null);
  }
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
