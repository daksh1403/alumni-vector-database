import{readFileSync,writeFileSync,existsSync,mkdirSync}from'node:fs';import{request,collection,vectors}from'../src/qdrant.js';import{buildDataset}from'./data.js';
const env=process.env,base='/collections/'+collection(env),graph=existsSync('private/migrated-graph.json')?JSON.parse(readFileSync('private/migrated-graph.json','utf8')):{nodes:[],relationships:[]},points=buildDataset(graph);
let exists=false;try{const c=await request(env,base);exists=true;if(c.config.params.vectors.dense.size!==384)throw Error('Existing collection has incompatible vectors.');}catch(e){if(e.status!==404)throw e;}
if(!exists)await request(env,base,'PUT',{vectors:{dense:{size:384,distance:'Cosine'}},sparse_vectors:{bm25:{modifier:'idf'}}});
for(const [field,schema]of [['kind','keyword'],['department','keyword'],['skills','keyword'],['location','keyword'],['synthetic','bool'],['source_id','keyword']])await request(env,base+'/index?wait=true','PUT',{field_name:field,field_schema:schema});
for(let i=0;i<points.length;i+=12){await request(env,base+'/points?wait=true','PUT',{points:points.slice(i,i+12).map(({id,payload,text})=>({id,payload,vector:vectors(text,env)}))});console.log('Indexed',Math.min(i+12,points.length),'of',points.length);}
mkdirSync('private',{recursive:true});writeFileSync('private/dataset.json',JSON.stringify(points,null,2),{mode:0o600});
console.log('Seeded:',points.length,'records. Repeating seed upserts the same stable IDs without duplicates.');
