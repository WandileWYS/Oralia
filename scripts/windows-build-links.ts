import { cp, lstat, readdir, realpath, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

/** Nitro copies per-route functions with symlinks; Windows cannot recreate them without elevation. */
export async function materializeWindowsBuildLinks(directory:string) {
  if(process.platform!=='win32')return;
  const root=resolve('.vercel/output/functions/__server.func');
  const visit=async(path:string):Promise<void>=>{
    const absolute=resolve(path);
    if(!absolute.startsWith(root+sep))throw new Error('Build dependency path escaped the function output.');
    const stat=await lstat(absolute).catch(()=>null);if(!stat)return;
    if(stat.isSymbolicLink()){
      const source=await realpath(absolute);
      if(!source.startsWith(root+sep))throw new Error('Build dependency target escaped the function output.');
      await unlink(absolute);
      await cp(source,absolute,{recursive:true,dereference:true});
      return;
    }
    if(stat.isDirectory())for(const item of await readdir(absolute))await visit(resolve(absolute,item));
  };
  await visit(resolve(directory));
}
