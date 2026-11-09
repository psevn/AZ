import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../src/lib/quickAdd.mjs";
const now = new Date(2026,10,9,12,0,0);
const subjects = [{id:"math-id",name:"رياضيات"},{id:"bio-id",name:"Biology"},{id:"calc-id",name:"Math"}];

test("Arabic date, subject, high priority, duration",()=>{
 assert.deepEqual(parseQuickAdd("مراجعة الفصل غداً #رياضيات !1 45د",subjects,now),
 {title:"مراجعة الفصل",subjectId:"math-id",dueDate:"2026-11-10",estMinutes:45,priority:3,priorityToken:"!1",priorityNotice:false});
});
test("English tomorrow, subject, medium priority, minutes",()=>{
 const r=parseQuickAdd("Read chapter tomorrow #Biology !2 30m",subjects,now);
 assert.equal(r.title,"Read chapter"); assert.equal(r.subjectId,"bio-id"); assert.equal(r.dueDate,"2026-11-10");
 assert.equal(r.estMinutes,30); assert.equal(r.priority,2); assert.equal(r.priorityToken,"!2");
});
test("mixed Arabic/English, weekday, and !4 normalization",()=>{
 const r=parseQuickAdd("حل واجب Calculus #Math Fri !4 20m",subjects,now);
 assert.equal(r.title,"حل واجب Calculus"); assert.equal(r.subjectId,"calc-id"); assert.equal(r.dueDate,"2026-11-13");
 assert.equal(r.estMinutes,20); assert.equal(r.priority,1); assert.equal(r.priorityToken,"!3"); assert.equal(r.priorityNotice,true);
});
test("explicit day and month",()=>{
 const r=parseQuickAdd("Submit essay 15 Nov",[],now); assert.equal(r.title,"Submit essay"); assert.equal(r.dueDate,"2026-11-15");
});
test("Arabic weekday and Arabic-Indic duration",()=>{
 const r=parseQuickAdd("حل مسائل الخميس ٤٥د",[],now); assert.equal(r.title,"حل مسائل"); assert.equal(r.dueDate,"2026-11-12"); assert.equal(r.estMinutes,45);
});
test("unknown subject and unrecognized words stay in title",()=>{
 const r=parseQuickAdd("Review #Unknown after lab",subjects,now); assert.equal(r.title,"Review #Unknown after lab"); assert.equal(r.subjectId,null); assert.equal(r.dueDate,null);
});
test("defaults match existing task form",()=>{
 const r=parseQuickAdd("Read lecture notes",[],now); assert.equal(r.title,"Read lecture notes"); assert.equal(r.subjectId,null);
 assert.equal(r.dueDate,null); assert.equal(r.estMinutes,45); assert.equal(r.priority,2); assert.equal(r.priorityToken,"!2");
});
test("unsupported !0 stays in title",()=>{
 const r=parseQuickAdd("Review !0 later",[],now); assert.equal(r.title,"Review !0 later"); assert.equal(r.priority,2);
});
