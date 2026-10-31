const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1632,height:1056}});
for (const f of process.argv.slice(3)){await p.goto('file://'+process.argv[2]+'/'+f+'.svg');await p.waitForTimeout(300);await p.screenshot({path:process.argv[2]+'/'+f+'.png'});}
await b.close();})();
