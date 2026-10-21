const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
const p=await b.newPage({viewport:{width:1200,height:675}});
for(const f of process.argv.slice(2)){
 await p.goto('file://'+__dirname+'/'+f+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
 await p.screenshot({path:__dirname+'/sample-'+f+'.png'});}
await b.close()})();
