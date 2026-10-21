import {ApiError,model} from './qdrant.js';
export const kinds=['alumni','job','mentorship','student','department','batch','company','skill','event','donation'];
export function filters(input={}){const must=[];for(const field of ['kind','department','skill','location']){if(input[field]===undefined||input[field]==='')continue;const v=input[field];if(typeof v!=='string'||v.length>100)throw new ApiError('Invalid filter.',400);if(field==='kind'&&!kinds.includes(v))throw new ApiError('Invalid kind filter.',400);must.push({key:field==='skill'?'skills':field,match:{value:v.toLowerCase().trim()}});}if(input.synthetic!==undefined){if(typeof input.synthetic!=='boolean')throw new ApiError('Invalid synthetic filter.',400);must.push({key:'synthetic',match:{value:input.synthetic}});}return must.length?{must}:undefined;}
export function searchBody(input,env={}){
 if(!input||Object.keys(input).some(k=>!['query','kind','department','skill','location','synthetic','limit'].includes(k)))throw new ApiError('Unknown search filter.',400);
 if(typeof input.query!=='string'||!input.query.trim()||input.query.length>1000)throw new ApiError('Enter a query between 1 and 1000 characters.',400);
 const filter=filters(input),text=input.query.trim();
 return {prefetch:[{query:{text,model:model(env)},using:'dense',limit:30,params:{exact:true},...(filter?{filter}:{})},{query:{text,model:'qdrant/bm25'},using:'bm25',limit:30,...(filter?{filter}:{})}],query:{fusion:'rrf'},limit:Math.min(5,Math.max(1,Number.isSafeInteger(input.limit)?input.limit:5)),with_payload:true,with_vector:false,...(filter?{filter}:{})};
}
export function validateRecord(input){
 if(!input||!kinds.includes(input.kind)||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.description!=='string'||input.description.trim().length<20||input.description.length>4000)throw new ApiError('Provide a valid kind, title and description (20–4000 characters).',400);
 if(input.skills!==undefined&&(!Array.isArray(input.skills)||input.skills.length>20||input.skills.some(s=>typeof s!=='string'||!s.trim()||s.length>80)))throw new ApiError('Invalid skills.',400);
 for(const k of ['department','location'])if(input[k]!==undefined&&(typeof input[k]!=='string'||input[k].length>100))throw new ApiError('Invalid '+k,400);
 if(input.synthetic!==undefined&&typeof input.synthetic!=='boolean')throw new ApiError('Invalid synthetic flag.',400);
 return {kind:input.kind,title:input.title.trim(),description:input.description.trim(),department:(input.department||'').trim().toLowerCase(),location:(input.location||'').trim().toLowerCase(),skills:[...new Set((input.skills||[]).map(s=>s.trim().toLowerCase()))],synthetic:input.synthetic??false,origin:'admin'};
}
export function documentText(p){return `${p.kind}. ${p.title}. ${p.description} Skills: ${(p.skills||[]).join(', ')}. Department: ${p.department||''}. Location: ${p.location||''}.`;}
export function browseFilters(params){const input={};for(const k of ['kind','department','skill','location'])if(params.has(k))input[k]=params.get(k);if(params.has('synthetic')){const v=params.get('synthetic');if(!['true','false'].includes(v))throw new ApiError('Invalid synthetic filter.',400);input.synthetic=v==='true';}return filters(input);}
export function mergeRecord(existing,updated){return {...existing,...updated,origin:existing.origin||'admin'};}
