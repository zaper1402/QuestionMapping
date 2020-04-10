const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require("path");


let cfile = process.argv[2];//credetials
let mfile = process.argv[3];//metadata
let cname = process.argv[4];//coursename

let courseUrl;
(async function() {
    try {
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            slowMo: 10,

            args: ['--start-maximized', '--disable-notifications']
        });
        
        let CredObj = await fs.promises.readFile(cfile, 'utf-8');
        let credentials = JSON.parse(CredObj);
        let username = credentials.un;
        let pwd = credentials.pwd;
        let URL = credentials.url;

        let pages = await browser.pages();
        let page = pages[0];
        page.goto(URL, {
            waitUntil: 'networkidle0'
        });

        await page.waitForSelector("button[type=submit]", {visible: true});

        await page.type('input[type=email]', username);
        await page.type('input[type=password]', pwd);
        await page.click("button[type=submit]");
        await page.waitForSelector("div.resource a", {visible: true});
        
        let rsrcElement = await page.$('div.resource a');
        let resourceHref = await rsrcElement.evaluate(el => el.getAttribute('href'));
        page.goto(path.join(page.url(),resourceHref), {
            waitUntil: 'networkidle0'
        });
        await page.waitForNavigation({waitUntil: 'networkidle0'});
        await page.waitForSelector('div#siteOverlay', {visible: false});

        await page.waitForSelector('h2.courseInput', {visible: true});


        let courses = await page.$$('h2.courseInput');

        for (var i = 0; i < courses.length; i++) {
            //text of i-th course
            let courseText = await courses[i].evaluate(el => el.textContent);
            courseText  = courseText.trim();
            console.log(courseText);
            //if text = course name
            if (cname === courseText) {
                await courses[i].click();
                break;
            }
        }

        await page.waitForSelector(".lis.tab .hoverable", {visible: true});
        
        courseUrl = await page.url();
        // console.log(courseUrl);
        let metadataRead = await fs.promises.readFile(mfile);
        //parse metadata file
        let metadata = await JSON.parse(metadataRead);

        for (let i = 0; i < metadata.questions.length; i++) {
            
            await solveQuestion(page,metadata.questions[i]);
        }
         
        // await page.close();

    }catch(err){
        console.log(err);
        // await page.close();
    }
})();

async function solveQuestion(page,question) {
    try {
        await openTheQuestion(page,question);

        await page.waitForSelector('.editorTab', {visible: true});

        await page.click('.editorTab');
        await page.click('.ace_editor');

        let editorBox = page.$('.ace_text-input');

        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');

        await page.keyboard.press('Delete');


        await page.click('.testCase');

        let textBox = page.$('#customInput');

        let codeFile = await fs.promises.readFile(path.join(question.path, "main.java"));
        let content = codeFile+"";
        
        await page.type('#customInput', content);

        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');

        await page.keyboard.down('Control');
        await page.keyboard.press('x');
        await page.keyboard.up('Control');

        await page.click('.ace_editor');

        await page.keyboard.down('Control');
        await page.keyboard.press('v');
        await page.keyboard.up('Control');

        await page.click('#submitCode');

        await page.waitForSelector('#testCases', {visible: true});

        let testCasesRows = await page.$$('#testCases');
        let testcasesValues = [];
        //iterate for each testcase row 
        for (let i = 0; i < testCasesRows.length; i++) {
            //get all values for each testcase
            let Inputs = await testCasesRows[i].$$("input[type=hidden]");
            let InputArr = [];
            let InputVal = await Inputs[0].evaluate(el => el.getAttribute("value"));
            let ExpectedOP = await Inputs[1].evaluate(el => el.getAttribute("value"));
            let ActualOP = await Inputs[2].evaluate(el => el.getAttribute("value"));
            InputArr = [InputVal, ExpectedOP, ActualOP];
            //push the value to testcasesArray
            testcasesValues.push(InputArr);
        }


        let ObjArray = testcasesValues.map(function (row) {
            return {
                input: row[0],
                expected: row[1],
                actual: row[2]
            }
        });

        //write to file 
        await fs.promises.writeFile(
            path.join(question.path, "tc.json"),
            JSON.stringify(ObjArray)
        );

    }catch(err){
        console.log(err);
    }
}

async function openTheQuestion(page,question) {
    try{
    page.goto(courseUrl, {
        waitUntil: 'networkidle0'
    });
    await page.waitForNavigation({waitUntil: 'networkidle0'});
    await page.waitForSelector(".lis.tab .hoverable", {visible: true});

    let moduleList = await page.$$(".lis.tab .hoverable");

    for (let i = 0; i < moduleList.length; i++) {
        //text for i-th module element 
        let moduleTxt = await moduleList[i].evaluate(el => el.textContent);
        moduleTxt = moduleTxt.trim();
        //compare moduleTxt with module name 
        if (moduleTxt == question.module) {
            await moduleList[i].click();
            break;
        }
    }
    await page.waitForSelector(".collection-item ", {visible: true});


    let lecturesList = await page.$$(".collection-item ");
    for (let i = 0; i < lecturesList.length; i++) {
        //text for i-th
        let LectureTxt = await lecturesList[i].evaluate(el => el.textContent);
        LectureTxt= LectureTxt.trim();       
        //compare  lectureText with lecture name   
        if (LectureTxt == question.lecture) {
            await lecturesList[i].click();
            break;
        }
    }
    await page.waitForSelector(".green-text.no-margin", {visible: true});

    let quesList = await page.$$(".green-text.no-margin");
    for (let i = 0; i < quesList.length; i++) {
        quesTxt = await quesList[i].evaluate(el => el.textContent);
        quesTxt= quesTxt.replace(/\s/g,'');
        quesTxt = quesTxt.substr(1);
        // console.log(quesTxt);
        //compare ques text with question name
        if (quesTxt == question.question.replace(/\s/g,'')) {
            console.log
            await quesList[i].click();
            break;
        }
    }
}catch(err){
    console.log(err);
}


}