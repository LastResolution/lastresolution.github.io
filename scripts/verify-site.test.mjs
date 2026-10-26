import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicFiles, verifySite } from './verify-site.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(),'lastresolution-site-'));
  try {
    for (const file of publicFiles) await cp(path.join(source,file),path.join(root,file),{recursive:true});
    await run(root);
  } finally { await rm(root,{recursive:true,force:true}); }
}
async function change(root,file,before,after) {
  const text = await readFile(path.join(root,file),'utf8');
  assert.ok(text.includes(before));
  await writeFile(path.join(root,file),text.replace(before,after));
}
test('the root identity and intentional payload are valid',()=>fixture(async root=>{
  const result = await verifySite(root,{distribution:true});
  assert.equal(result.files,publicFiles.length); assert.ok(result.checks>100);
}));
test('a copied GitHub error-page site name is rejected',()=>fixture(async root=>{
  await change(root,'index.html','content="LastResolution"','content="GitHub Pages documentation"');
  await assert.rejects(verifySite(root),/Placeholder\/default/);
}));
test('a project URL cannot masquerade as the root canonical',()=>fixture(async root=>{
  await change(root,'index.html','rel="canonical" href="https://lastresolution.github.io/"','rel="canonical" href="https://lastresolution.github.io/ReStart/"');
  await assert.rejects(verifySite(root),/root canonical/);
}));
test('the creator is the WebSite identity, not a featured product',()=>fixture(async root=>{
  await change(root,'index.html','"name": "LastResolution",','"name": "ReStart",');
  await assert.rejects(verifySite(root),/WebSite name/);
}));
test('root robots must not block ReStart',()=>fixture(async root=>{
  await change(root,'robots.txt','Allow: /','Disallow: /');
  await assert.rejects(verifySite(root),/robots blocks/);
}));
test('broken internal navigation is rejected',()=>fixture(async root=>{
  await change(root,'index.html','href="#work"','href="#missing"');
  await assert.rejects(verifySite(root),/Broken anchor/);
}));
test('local private paths are rejected without reporting their contents',()=>fixture(async root=>{
  await writeFile(path.join(root,'assets/site.js'), 'const test = "'+'C:'+'\\Users\\FixtureUser\\file.txt";');
  await assert.rejects(verifySite(root),/Private data pattern/);
}));
test('relative distribution paths resolve without escaping or hanging',()=>fixture(async root=>{
  const result = await verifySite(path.relative(process.cwd(),root),{distribution:true});
  assert.equal(result.files,publicFiles.length);
}));
test('unlisted output files are rejected before publication',()=>fixture(async root=>{
  await writeFile(path.join(root,'unrelated.txt'),'not intended for deployment');
  await assert.rejects(verifySite(root,{distribution:true}),/Unexpected deployment files/);
}));
test('noindex cannot silently enter the homepage',()=>fixture(async root=>{
  await change(root,'index.html','<meta name="referrer"','<meta name="robots" content="noindex"><meta name="referrer"');
  await assert.rejects(verifySite(root),/excludes indexing/);
}));
test('identical theme screenshots are rejected',()=>fixture(async root=>{
  await cp(path.join(root,'assets/restart-light.png'),path.join(root,'assets/restart-dark.png'));
  await assert.rejects(verifySite(root),/screenshots must differ/);
}));

test('form submission cannot be enabled by omitting its independent directive',()=>fixture(async root=>{
  await change(root,'index.html',"form-action 'none'; ",'');
  await assert.rejects(verifySite(root),/content policy/);
}));

test('an overriding script directive cannot bypass the default script policy',()=>fixture(async root=>{
  await change(root,'index.html',"script-src 'self';", "script-src 'self'; script-src-elem https://example.invalid;");
  await assert.rejects(verifySite(root),/content policy/);
}));

test('unused image source permissions cannot silently return',()=>fixture(async root=>{
  await change(root,'index.html',"img-src 'self';", "img-src 'self' data:;");
  await assert.rejects(verifySite(root),/Content policy/);
}));
