const WEEKDAYS = new Map([
  ["sun",0],["sunday",0],["mon",1],["monday",1],["tue",2],["tues",2],["tuesday",2],
  ["wed",3],["wednesday",3],["thu",4],["thur",4],["thurs",4],["thursday",4],
  ["fri",5],["friday",5],["sat",6],["saturday",6],
  ["الأحد",0],["الاحد",0],["الإثنين",1],["الاثنين",1],["الثلاثاء",2],
  ["الأربعاء",3],["الاربعاء",3],["الخميس",4],["الجمعة",5],["السبت",6],
]);
const MONTHS = new Map([
  ["jan",0],["january",0],["feb",1],["february",1],["mar",2],["march",2],["apr",3],["april",3],
  ["may",4],["jun",5],["june",5],["jul",6],["july",6],["aug",7],["august",7],["sep",8],
  ["sept",8],["september",8],["oct",9],["october",9],["nov",10],["november",10],["dec",11],["december",11],
]);
const arabicDigits = (value) => value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
const pad = (value) => String(value).padStart(2,"0");
const dateKey = (date) => date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate());
const cloneDate = (date) => new Date(date.getFullYear(),date.getMonth(),date.getDate());

function extractDate(source, now) {
  const today = cloneDate(now);
  for (const item of [
    { pattern:/\b(today)\b|اليوم/iu, offset:0 },
    { pattern:/\b(tomorrow)\b|غدًا|غداً|غدا|بكرة/iu, offset:1 },
  ]) {
    const match = item.pattern.exec(source);
    if (match) {
      const date = new Date(today); date.setDate(date.getDate()+item.offset);
      return { date:dateKey(date), token:match[0] };
    }
  }
  const explicit = /(?<!\d)(\d{1,2})\s+([a-z]{3,9})(?![a-z])/iu.exec(source);
  if (explicit) {
    const month = MONTHS.get(explicit[2].toLowerCase()), day = Number(explicit[1]);
    if (month !== undefined && day>=1 && day<=31) {
      let year = now.getFullYear(), date = new Date(year,month,day);
      if (date.getMonth()!==month || date.getDate()!==day) return null;
      if (date<today) date = new Date(++year,month,day);
      return { date:dateKey(date), token:explicit[0] };
    }
  }
  for (const [name,weekday] of WEEKDAYS) {
    const pattern = /[\u0600-\u06ff]/u.test(name) ? new RegExp(name,"iu") : new RegExp("\\b"+name+"\\b","iu");
    const match = pattern.exec(source);
    if (match) {
      const date = new Date(today);
      date.setDate(date.getDate()+((weekday-date.getDay()+7)%7));
      return { date:dateKey(date), token:match[0] };
    }
  }
  return null;
}

/** Existing stored priority: 3 high, 2 medium, 1 low. Quick-add ranks: !1 high, !2 medium, !3 low. */
export function parseQuickAdd(input, subjects=[], now=new Date()) {
  let title = arabicDigits(String(input ?? "")).trim();
  if (!title) return { title:"",subjectId:null,dueDate:null,estMinutes:45,priority:2,priorityToken:"!2",priorityNotice:false };
  let subjectId = null;
  const subjectMatch = /#([^\s#]+)/u.exec(title);
  if (subjectMatch) {
    const subjectName = subjectMatch[1].toLocaleLowerCase();
    const subject = subjects.find((item)=>item.name.trim().toLocaleLowerCase()===subjectName);
    if (subject) { subjectId=subject.id; title=title.replace(subjectMatch[0]," "); }
  }
  let priority=2, priorityToken="!2", priorityNotice=false;
  const priorityMatch = /!(\d+)\+?/u.exec(title);
  if (priorityMatch) {
    const rank=Number(priorityMatch[1]);
    if (rank>=1 && rank<=3) {
      priority=4-rank; priorityToken="!"+rank; title=title.replace(priorityMatch[0]," ");
    } else if (rank>=4) {
      priority=1; priorityToken="!3"; priorityNotice=true; title=title.replace(priorityMatch[0]," ");
    }
  }
  let estMinutes=45;
  const durationMatch = /(\d+)\s*(دقيقة|دقائق|د|min(?:utes?)?|mins?|m)(?![\p{L}])/iu.exec(title);
  if (durationMatch) {
    estMinutes=Math.min(600,Math.max(5,Number(durationMatch[1])));
    title=title.replace(durationMatch[0]," ");
  }
  const parsedDate=extractDate(title,now);
  if (parsedDate) title=title.replace(parsedDate.token," ");
  title=title.replace(/\s+/gu," ").replace(/\s+([،,.;])/gu,"$1").trim();
  return { title,subjectId,dueDate:parsedDate?.date??null,estMinutes,priority,priorityToken,priorityNotice };
}
