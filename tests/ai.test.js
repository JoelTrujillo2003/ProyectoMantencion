import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL, GEMINI_HTTP_OPTIONS, generateReport, parseReport, mapAiError } from '../src/ai.js';
import { GoogleGenAI } from '@google/genai';
const report={estado:'Ejemplo de prueba; no es una evaluación real.',critico:['Revisar en taller.','Confirmar historial.'],mantenimiento:['Consultar manual.','Confirmar versión.']};
test('Gemini solicita salida estructurada, con límite de espera y sin identidad de cuenta',async()=>{
  const previous=process.env.GEMINI_MODEL; delete process.env.GEMINI_MODEL;
  try {
    const response=await generateReport({type:'Moto',brand:'Bajaj',model:'Pulsar RS200',year:2020,mileage:10000},'Dato de prueba',{yearBasis:'reference'},async request=>{
      assert.equal(request.model,DEFAULT_MODEL); assert.equal(request.model,'gemini-3.8-flash');
      assert.equal(request.config.responseMimeType,'application/json'); assert.equal(request.config.thinkingConfig.thinkingLevel,'LOW');
      assert.ok(request.config.abortSignal); assert.ok(!request.contents.includes('email'));
      assert.equal(JSON.parse(request.contents).sintomas,'Dato de prueba');
      return {text:JSON.stringify(report)};
    });
    assert.deepEqual(response.report,report); assert.match(response.result,/\[ESTADO\]/); assert.match(response.result,/\[MANTENIMIENTO\]/);
  } finally { if(previous===undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL=previous; }
});
test('rechaza respuestas vacías, incompletas y malformadas',()=>{
  for(const content of ['',null,'[]','null','{"estado":"hola"}',JSON.stringify({...report,critico:['solo uno']})]) assert.throws(()=>parseReport(content),{code:'ai_invalid_response'});
});
test('traduce cuota agotada, modelo no disponible, permisos y tiempo agotado',async()=>{
  for(const [error,code] of [[{status:429},'ai_rate_limit'],[{status:404},'ai_model_unavailable'],[{status:403},'ai_access_error'],[{name:'TimeoutError'},'ai_timeout'],[{message:'network'},'ai_unavailable']]) {
    assert.equal(mapAiError(error).code,code);
    await assert.rejects(()=>generateReport({},'',{},async()=>{throw error}),{code});
  }
});

test('el SDK instalado serializa la solicitud y lee el reporte con transporte simulado',async()=>{
  let called=false;
  const client=new GoogleGenAI({apiKey:'test-key-no-real-service',httpOptions:{fetch:async(url,options)=>{
    called=true;
    assert.match(String(url),/gemini-3.8-flash:generateContent/);
    const body=JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType,'application/json');
    assert.ok(body.generationConfig.responseJsonSchema);
    return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(report)}]},finishReason:'STOP'}]});
  }}});
  const previous=process.env.GEMINI_MODEL; delete process.env.GEMINI_MODEL;
  try {
    const result=await generateReport({},'',{},params=>client.models.generateContent(params));
    assert.ok(called); assert.deepEqual(result.report,report);
  } finally { if(previous===undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL=previous; }
});

test('reintenta una indisponibilidad temporal de Gemini y recupera el reporte',async()=>{
  let calls=0;
  const client=new GoogleGenAI({apiKey:'test-key-no-real-service',httpOptions:{...GEMINI_HTTP_OPTIONS,fetch:async()=>{
    calls++;
    if(calls===1) return Response.json({error:{code:503,message:'Temporary unavailable',status:'UNAVAILABLE'}},{status:503});
    return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(report)}]},finishReason:'STOP'}]});
  }}});
  const result=await generateReport({},'',{},params=>client.models.generateContent(params));
  assert.equal(calls,2);
  assert.deepEqual(result.report,report);
});

test('usa el respaldo solo ante indisponibilidad temporal e informa el modelo real',async()=>{
  const models=[];
  const result=await generateReport({},'',{},async request=>{
    models.push(request.model);
    if(models.length===1) throw Object.assign(new Error('Unavailable'),{status:503});
    return {text:JSON.stringify(report)};
  });
  assert.deepEqual(models,[DEFAULT_MODEL,DEFAULT_FALLBACK_MODEL]);
  assert.equal(result.model,DEFAULT_FALLBACK_MODEL);
  assert.deepEqual(result.report,report);
});

test('no cambia de modelo para eludir errores de permiso, cuota o respuestas inválidas',async()=>{
  for(const failure of [{status:403},{status:429}]) {
    let calls=0;
    await assert.rejects(()=>generateReport({},'',{},async()=>{calls++;throw failure;}));
    assert.equal(calls,1);
  }
  let calls=0;
  await assert.rejects(()=>generateReport({},'',{},async()=>{calls++;return {text:'respuesta incompleta'};}),{code:'ai_invalid_response'});
  assert.equal(calls,1);
});
