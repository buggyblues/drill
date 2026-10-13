/** Create local development secrets without ever overwriting an existing .env. */
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const hex=()=>randomBytes(24).toString('hex');
const db=hex();
const values={AUTH_PASSWORD:hex(),JWT_SECRET:hex()+hex(),POSTGRES_ADMIN_PASSWORD:hex(),DRILL_DB_PASSWORD:db,S3_SECRET_KEY:hex(),EMBEDDING_KEY:hex(),DATABASE_URL:`postgresql://drill_app:${db}@localhost:5432/drill`,PGSSL:''};
let text=await readFile(new URL('../.env.example',import.meta.url),'utf8');
for(const [key,value] of Object.entries(values))text=text.replace(new RegExp('^'+key+'=.*$','m'),key+'='+value);
try{await writeFile(new URL('../.env',import.meta.url),text,{flag:'wx',mode:0o600});console.log('已创建 .env。连接口令位于 AUTH_PASSWORD；请保密，不要上传或提交该文件。');}
catch(e){if(e.code==='EEXIST'){console.error('已有 .env，未覆盖。请直接检查现有配置。');process.exitCode=1;}else throw e;}
