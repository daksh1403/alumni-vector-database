import {createHash} from 'node:crypto';
import {documentText} from '../src/search.js';
const uuid=s=>{const h=createHash('sha256').update(s).digest('hex').slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const identity=n=>n.label+':'+JSON.stringify(n.key);
export const topics=[
 ['machine learning','cse',['python','machine learning','pytorch'],'building predictive models, neural networks, recommendation systems and responsible artificial intelligence'],
 ['web development','it',['javascript','react','node.js'],'building accessible websites, frontend interfaces, APIs and full stack web applications'],
 ['cloud infrastructure','cse',['aws','docker','kubernetes'],'deploying reliable cloud services, container orchestration, DevOps and infrastructure automation'],
 ['cybersecurity','it',['network security','python','penetration testing'],'protecting applications from attacks, threat detection, secure development and ethical hacking'],
 ['data analytics','cse',['sql','python','power bi'],'analysing business data, building dashboards, data pipelines and statistical reports'],
 ['product design','design',['figma','ux research','prototyping'],'conducting user research, designing usable products and testing interactive prototypes'],
 ['mobile development','it',['flutter','kotlin','android'],'building mobile applications, Android interfaces and cross platform smartphone experiences'],
 ['financial analysis','mba',['financial modelling','excel','valuation'],'evaluating investments, company valuation, corporate finance and financial forecasting'],
 ['robotics','ece',['embedded systems','c++','robotics'],'building autonomous robots, microcontrollers, sensors and real time embedded hardware'],
 ['product management','mba',['product strategy','agile','analytics'],'prioritising product roadmaps, understanding customers and coordinating product launches']
];
export function buildDataset(graph={nodes:[],relationships:[]}){
 const byKey=new Map(graph.nodes.map(n=>[identity(n),n]));const out=[];
 for(const n of graph.nodes){const p=n.properties,key=identity(n);const links=graph.relationships.flatMap(r=>identity(r.from)===key?[{type:r.type,direction:'out',target:uuid(identity(r.to)),properties:r.properties||{}}]:identity(r.to)===key?[{type:r.type,direction:'in',target:uuid(identity(r.from)),properties:r.properties||{}}]:[]);
 const targets=graph.relationships.filter(r=>identity(r.from)===key).map(r=>byKey.get(identity(r.to))).filter(Boolean);
 const title=[p.FirstName,p.LastName].filter(Boolean).join(' ')||p.CompanyName||p.SkillName||p.DeptName||p.EventName||p.JobTitle||(p.BatchYear?'Batch '+p.BatchYear:null)||(p.MentorshipID?'Mentorship '+p.MentorshipID:null)||(p.Amount?'Donation '+p.DonationID:null)||n.label;
 const dept=targets.find(t=>t.label==='Department')?.properties.DeptCode||'';const skills=targets.filter(t=>t.label==='Skill').map(t=>t.properties.SkillName.toLowerCase());
 const description=Object.entries(p).filter(([k,v])=>typeof v!=='object'&&!k.endsWith('ID')&&!['Email','LinkedInProfile','DateOfBirth'].includes(k)).map(([k,v])=>`${k}: ${v}`).join('. ')+'. Connections: '+targets.map(t=>t.properties.CompanyName||t.properties.SkillName||t.properties.DeptName||t.label).join(', ');
 const payload={kind:n.label.toLowerCase(),title,description,skills,department:dept.toLowerCase(),location:'',synthetic:false,origin:'neo4j-migration',source_id:key,source_properties:p,relationships:links};out.push({id:uuid(key),payload});}
 const names=['Ananya Rao','Rohan Nair','Meera Shah','Arjun Menon','Kavya Iyer','Dev Patel','Nisha Sen','Varun Das','Isha Kapoor','Sahil Joshi'];
 const cities=['bengaluru','chennai','hyderabad','pune','remote'];
 for(const [kind,total] of [['alumni',50],['job',20],['mentorship',15]]){
  const count=out.filter(r=>r.payload.kind===kind).length;
  for(let i=0;i<total-count;i++){const [topic,department,skills,focus]=topics[i%topics.length],variant=Math.floor(i/topics.length),location=cities[(i+variant)%cities.length];
   const title=kind==='alumni'?`${names[i%names.length]} · ${topic} ${variant+1}`:kind==='job'?`${topic[0].toUpperCase()+topic.slice(1)} ${variant?'engineer':'intern'}`:`${topic[0].toUpperCase()+topic.slice(1)} mentoring ${variant+1}`;
   const description=kind==='alumni'?`Synthetic alumni profile. Specialist in ${topic}, with ${3+variant*2} years of experience ${focus}. Works with ${skills.join(', ')}. Offers practical mentoring, portfolio feedback and career guidance for students interested in ${topic}. Current project: ${['education','healthcare','sustainability','retail','public transport'][variant%5]} technology. Based in ${location}.`:kind==='job'?`Synthetic job opportunity for a ${variant?'professional':'student'} interested in ${topic}. Responsibilities include ${focus}. Essential skills: ${skills.join(', ')}. ${variant?'Two years of relevant experience preferred.':'Entry level internship with guided onboarding and a portfolio project.'} Location: ${location}.`:`Synthetic mentoring opportunity focused on ${topic}. Learn ${focus}. Sessions cover ${skills.join(', ')} through hands-on practice, project reviews and interview preparation. ${variant?'Intermediate learning path for a capstone project.':'Beginner friendly learning path with weekly one-to-one guidance.'} Sessions available in ${location}.`;
   out.push({id:uuid('synthetic-v1:'+kind+':'+i),payload:{kind,title,description,skills,department,location,synthetic:true,origin:'synthetic-demo',topic,relationships:[]}});
  }
 }
 return out.map(p=>({...p,text:documentText(p.payload)}));
}
