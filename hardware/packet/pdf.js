const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.argv[2],{waitUntil:'load'});await p.waitForTimeout(1500);
await p.pdf({path:process.argv[3],width:'17in',height:'11in',printBackground:true});await b.close();})();
