let fs = require('fs');
let path = require('path');
require('chromedriver');
let swd = require('selenium-webdriver');
let bldr = new swd.Builder();
let driver = bldr.forBrowser('chrome').build();

let cfile = process.argv[2];//credetials
let mfile = process.argv[3];//metadata
let cname = process.argv[4];//coursename

let CourseUrl;
(async function () {
    try {
        //Implicit timeout on pageLoad and other task such as findElement
        await driver.manage().setTimeouts({
            implicit: 10000,
            pageload: 10000
        });

        //credential file read
        let cfileRead = await fs.promises.readFile(cfile);
        let credentials = await JSON.parse(cfileRead);
        let userName = credentials.un;
        let pwd = credentials.pwd;
        let URL = credentials.url;

        //load pepcoding login page
        await driver.get(URL);
        //input username
        await driver.findElement(swd.By.css('input[type=email]')).sendKeys(userName);
        //input password
        await driver.findElement(swd.By.css('input[type=password]')).sendKeys(pwd);
        //click login button
        await driver.findElement(swd.By.css('button[type=submit]')).click();


        //load resourse Webelement
        let rsrcElement = await driver.findElement(swd.By.css('div.resource a'));
        //get link from resourse webelement
        var resourceHref = await rsrcElement.getAttribute('href');
        //load link
        await driver.get(resourceHref);


        //find list of courses
        let courses = await driver.findElements(swd.By.css('h2.courseInput'));

        //for loop to get text of each course 
        for (var i = 0; i < courses.length; i++) {
            //text of i-th course
            let courseText = await courses[i].getText();
            //if text = course name
            if (cname === courseText) {
                await courses[i].click();
                break;
            }
        }

        //save course url
        CourseUrl = await driver.getCurrentUrl();

        //metadata file 
        let metadataRead = await fs.promises.readFile(mfile);
        //parse metadata file
        let metadata = await JSON.parse(metadataRead);

        //loop for metadata objects
        for (let i = 0; i < metadata.questions.length; i++) {
            //call on solve ques for i-th object
            //this is a series call 
            await solveQuestion(metadata.questions[i]);
        }
    } catch (err) {
        console.log(err);
    }
})();

async function solveQuestion(question) {
    try {
        //call on open the question
        await openTheQuestion(question);
        //click editor tab
        await driver.findElement(swd.By.css('.editorTab')).click();
        //click editor box
        await driver.findElement(swd.By.css('.ace_editor')).click();
        //save editor box
        let editorBox = await driver.findElement(swd.By.css('.ace_text-input'));
        //ctrl-a
        await editorBox.sendKeys(swd.Key.chord(swd.Key.CONTROL, "a"));
        //ctrl-delete
        await editorBox.sendKeys(swd.Key.chord(swd.Key.DELETE));


        //testcase box
        await driver.findElement(swd.By.css('.testCase')).click();
        //save testcasebox
        let textBox = await driver.findElement(swd.By.css('#customInput'));


        //Read codeFile 
        let codeFile = await fs.promises.readFile(path.join(question.path, "main.java"));
        //convert content to string 
        let content = codeFile + "";
        //paste content to textBox
        await textBox.sendKeys(content);
        //ctrl-a 
        await textBox.sendKeys(swd.Key.chord(swd.Key.CONTROL + 'a'));
        //ctrl-x
        await textBox.sendKeys(swd.Key.chord(swd.Key.CONTROL + 'x'));
        //ctrl-v
        await editorBox.sendKeys(swd.Key.chord(swd.Key.CONTROL + "v"));
        //click submit 
        await driver.findElement(swd.By.css('#submitCode')).click();


        //site overlay element 
        let soe = await driver.findElement(swd.By.css('div#siteOverlay'));
        //wait for overlay to hide
        await driver.wait(swd.until.elementIsNotVisible(soe), 10000);


        //select test cases rows
        let testCasesRows = await driver.findElements(swd.By.css('#testCases'));
        let testcasesValues = [];
        //iterate for each testcase row 
        for (let i = 0; i < testCasesRows.length; i++) {
            //get all values for each testcase
            let Inputs = await testCasesRows[i].findElements(swd.By.css("input[type=hidden]"));
            let InputArr = [];
            let InputVal = await Inputs[0].getAttribute("value");
            let ExpectedOP = await Inputs[1].getAttribute("value");
            let ActualOP = await Inputs[2].getAttribute("value");
            InputArr = [InputVal, ExpectedOP, ActualOP];
            //push the value to testcasesArray
            testcasesValues.push(InputArr);
        }
        // console.log(testcasesValues);
        //convert into json object 
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


    } catch (err) {
        console.log(err);
    }
}

async function openTheQuestion(question) {
    //s1 - open with url
    //     await driver.get(question.url);

    //s2 open courseURL,click module ,click lecture,click question,click editor
    //get courseURL
    await driver.get(CourseUrl);

    //get moduleList 
    let moduleList = await driver.findElements(swd.By.css(".lis.tab .hoverable"));

    //loop for modules
    for (let i = 0; i < moduleList.length; i++) {
        //text for i-th module element 
        let moduleTxt = await moduleList[i].getText();
        //compare moduleTxt with module name 
        if (moduleTxt == question.module) {
            await moduleList[i].click();
            break;
        }
    }

    //lecture list 
    let lecturesList = await driver.findElements(swd.By.css(".collection-item "));

    //loop for list of lectures
    for (let i = 0; i < lecturesList.length; i++) {
        //text for i-th
        let LectureTxt = await lecturesList[i].getText();
        //compare  lectureText with lecture name   
        if (LectureTxt == question.lecture) {
            await lecturesList[i].click();
            break;
        }
    }

    //load quesList
    let quesList = await driver.findElements(swd.By.css(".green-text.no-margin"));

    //loop for queslist 
    for (let i = 0; i < quesList.length; i++) {
        quesTxt = await quesList[i].getText();
        //removing coin text from ques
        quesTxt = quesTxt.substr(4);
        // console.log(quesTxt);
        //compare ques text with question name
        if (quesTxt == question.question) {
            await quesList[i].click();
            break;
        }
    }

}
