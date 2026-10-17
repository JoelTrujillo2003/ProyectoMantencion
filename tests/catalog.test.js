import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { catalog, rules, validateVehicle } from '../src/vehicle-validation.js';

const vehicle = { type:'Moto', brand:'Bajaj', model:'Pulsar RS200', year:2020, mileage:'10.000' };
test('RS200 rechaza 2000 y años futuros; admite un año del rango', () => {
  assert.equal(validateVehicle(vehicle).mileage,10000);
  for (const year of [2000,2014,rules.currentYear()+1,'',null]) assert.throws(()=>validateVehicle({...vehicle,year}),{code:'invalid_vehicle_year'});
});
test('tipo, marca y modelo deben corresponder, incluso en peticiones directas', () => {
  for (const patch of [{type:'Auto'},{brand:'Toyota'},{model:'Corolla'},{brand:'__proto__'},{model:'constructor'}]) assert.throws(()=>validateVehicle({...vehicle,...patch}),{code:'invalid_vehicle'});
});
test('kilometraje acepta extremos y formato chileno, y rechaza formatos ambiguos', () => {
  for (const [input, expected] of [[0,0],['0',0],['10.000',10000],['999.999',999999],[999999,999999],['10000',10000]]) assert.equal(rules.parseMileage(input),expected);
  for (const input of ['',null,undefined,true,1000000,-1,1.5,'-1','1,5','10.00','1.000.000','12abc','1e3','   ']) assert.ok(Number.isNaN(rules.parseMileage(input)),String(input));
  assert.equal(rules.editMileage('10000'),'10.000'); assert.equal(rules.editMileage('999999'),'999.999');
  assert.equal(rules.editMileage('1000000'),null); assert.equal(rules.editMileage('-10'),null);
});
test('años explícitos no rellenan huecos y se limitan al año actual', () => {
  assert.deepEqual(rules.yearsFor({years:[2020,2022,2027]},2026),[2022,2020]);
  assert.deepEqual(rules.yearsFor({minYear:2020,maxYear:2030},2022),[2022,2021,2020]);
  assert.throws(()=>validateVehicle({...vehicle,brand:'Cyclone',model:'RA2',year:2000}),{code:'invalid_vehicle_year'});
});
test('catálogo de navegador, JSON y premium están sincronizados', () => {
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/vehicles.js',import.meta.url),'utf8'),sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.vehicleDB)),catalog);
  const premium=JSON.parse(fs.readFileSync(new URL('../public/premium-vehicles.json',import.meta.url),'utf8'));
  assert.equal(new Set(premium.map(v=>[v.type,v.brand,v.model].join('\0'))).size,premium.length);
  for (const item of premium) assert.ok(rules.modelInfo(catalog,item.type,item.brand,item.model));
  for(const brands of Object.values(catalog)) for(const models of Object.values(brands)) for(const info of Object.values(models)) {
    assert.ok(rules.yearsFor(info).length); assert.ok(info.minYear<=info.maxYear);
    if(info.yearBasis==='catalog_snapshot') assert.ok(info.source && Array.isArray(info.years));
  }
});
