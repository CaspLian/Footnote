import type { DocumentAttachment, DocumentKind } from '@/domain';
import type { ImportPreparation, ImportResult, ImportSource } from './documents';
import { NativeActionError, nativeMessages } from './errors';
import { safeDisplayFilename, validateImportedFile } from './import-validation';
export type { ImportResult, ImportSource } from './documents';
export async function appendAttachmentToForm(form:FormData,attachment:DocumentAttachment,field='files'):Promise<void>{const blob=await readAttachmentBlob(attachment.uri);form.append(field,new File([blob],attachment.name,{type:attachment.mimeType}));}
const PREFIX='unfold-attachment://';
export const createLocalId=(prefix='document')=>`${prefix}-${crypto.randomUUID()}`;
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('unfold-local-documents',1);request.onupgradeneeded=()=>request.result.createObjectStore('files');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function operation<T>(mode:IDBTransactionMode,key:string|undefined,work:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await database();try{return await new Promise<T>((resolve,reject)=>{const transaction=db.transaction('files',mode);const request=work(transaction.objectStore('files'));let result:T;request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error);transaction.oncomplete=()=>resolve(result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);});}finally{db.close();}}
export async function readAttachmentBlob(uri:string):Promise<Blob>{if(uri.startsWith(PREFIX)){const blob=await operation<Blob|undefined>('readonly',uri,s=>s.get(uri));if(!blob)throw new NativeActionError('file-unavailable');return blob;}if(!uri.startsWith('/')&&!/^https?:\/\/(localhost|127\.0\.0\.1|[^/]+)\//.test(uri))throw new NativeActionError('file-unavailable');const response=await fetch(uri);if(!response.ok)throw new NativeActionError('file-unavailable');return response.blob();}
async function saveBlob(blob:Blob,name:string,kind:DocumentKind):Promise<DocumentAttachment>{const header=new Uint8Array(await blob.slice(0,64).arrayBuffer());const valid=validateImportedFile({name,mimeType:blob.type,size:blob.size},header);if(!valid.valid)throw new NativeActionError(valid.code);const id=createLocalId();const uri=PREFIX+id;await operation('readwrite',uri,s=>s.put(blob,uri));return {id,uri,name:safeDisplayFilename(name),mimeType:valid.mimeType,size:blob.size,kind,origin:'import',importedAt:new Date().toISOString()};}
export async function persistImportedAttachment(picked:{uri:string;name:string;mimeType?:string;size?:number},kind:DocumentKind='auto'){return saveBlob(await(await fetch(picked.uri)).blob(),picked.name,kind);}
export async function importDocument(source:ImportSource,kind:DocumentKind='auto',onPreparing?:ImportPreparation):Promise<ImportResult>{
  const saved:DocumentAttachment[]=[];
  try{
    const files=await new Promise<File[]|undefined>(resolve=>{const input=document.createElement('input');input.type='file';input.accept=source==='files'?'application/pdf,image/*':'image/*';input.multiple=source!=='camera';if(source==='camera')input.setAttribute('capture','environment');input.style.display='none';document.body.appendChild(input);const finish=(files?:File[])=>{input.remove();resolve(files);};input.addEventListener('change',()=>finish(input.files?Array.from(input.files):undefined),{once:true});input.addEventListener('cancel',()=>finish(),{once:true});input.click();});
    if(!files?.length)return {status:'cancelled'};
    if(files.length>10)return {status:'error',code:'import-failed',message:{en:'Choose up to 10 documents at a time. Add more before starting the review.',es:'Elige hasta 10 documentos a la vez.'}};
    for(const [index,file] of files.entries()){await onPreparing?.({name:files.length>1?`${index+1} of ${files.length} · ${safeDisplayFilename(file.name)}`:safeDisplayFilename(file.name)});saved.push(await saveBlob(file,file.name,kind));}
    return {status:'success',attachment:saved[0],additionalAttachments:saved.slice(1)};
  }catch(error){await Promise.all(saved.map(a=>deleteAttachment(a).catch(()=>{})));const code=error instanceof NativeActionError?error.code:'import-failed';return {status:'error',code,message:nativeMessages[code]};}
}

export async function deleteAttachment(attachment:DocumentAttachment){if(attachment.origin==='import'&&attachment.uri.startsWith(PREFIX))await operation('readwrite',attachment.uri,s=>s.delete(attachment.uri));}
export async function clearLocalAttachments(){await operation('readwrite',undefined,s=>s.clear());}
