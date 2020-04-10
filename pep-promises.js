let fs = require('fs');
let path = require('path');
let cd = require('chromedriver');
let swd = require('selenium-webdriver');
let bldr = new swd.Builder();
let driver = bldr.forBrowser('chrome').build();

let cfile = process.argv[2];//credetials
let mfile = process.argv[3];//metadata
let cname = process.argv[4];//coursename

let userName, pwd, metadata;
let globalCourse, CourseIdx, globalCourseUrl;
let globalEditor, globalTextBox;


let cfilePromise = fs.promises.readFile(cfile);
cfilePromise.then(function (content) {
    let credentials = JSON.parse(content);
    userName = credentials.un;
    pwd = credentials.pwd;

}).then(function () {
    //inplicit timeout
    let toWillBeSetPromise = driver.manage().setTimeouts({
        implicit: 10000
    });
    return toWillBeSetPromise;

}).then(function () {
    //load login page
    var pageLoadPromise = driver.get('https://www.pepcoding.com/login');
    return pageLoadPromise;
}).then(function () {
    var userNameFound = driver.findElement(swd.By.css('input[type=email]'));
    var pswrdFound = driver.findElement(swd.By.css('input[type=password]'));
    return Promise.all([userNameFound, pswrdFound]);
}).then(function (Elements) {
    //enter username and password
    var userNameEntered = Elements[0].sendKeys(userName);
    var pswrdEntered = Elements[1].sendKeys(pwd);
    return Promise.all([userNameEntered, pswrdEntered]);
}).then(function () {
    var signInBtn = driver.findElement(swd.By.css('button[type=submit]'));
    return signInBtn;
}).then(function (btnElement) {
    //click signIn button
    var btnClicked = btnElement.click();
    return btnClicked;
}).then(function () {
    //rsrc load wait
    var rsrcLinkLoad = driver.findElement(swd.By.css('div.resource a'));
    return rsrcLinkLoad;
}).then(function (rsrcElement) {
    //resource href
    var resourceHref = rsrcElement.getAttribute('href');
    var loadResources = driver.get(resourceHref);
    return loadResources;
}).then(function () {
    //site overlay   
    return overlayWait();
}).then(function () {
    //course element
    var courseWait = driver.findElements(swd.By.css('h2.courseInput'));
    return courseWait;

}).then(function (courseElement) {
    //course text promise
    globalCourse = courseElement;
    let ceTextPromise = [];
    for (var i = 0; i < globalCourse.length; i++) {
        ceTextPromise.push(globalCourse[i].getText());
    }
    return Promise.all(ceTextPromise);
}).then(function (ceTexts) {
    //course text and click
    // console.log(ceTexts);
    for (var i = 0; i < ceTexts.length; i++) {
        if (cname === ceTexts[i]) {
            CourseIdx = i;
            break;
        }
    }
    let courseClick = globalCourse[CourseIdx].click();
    return courseClick;

}).then(function () {
    let CourseUrl = driver.getCurrentUrl();
    return CourseUrl;
}).then(function (url) {
    //save course Url globally
    globalCourseUrl = url;
    //read metadata file
    let metadataRead = fs.promises.readFile(mfile);
    return metadataRead;
}).then(function (content) {
    metadata = JSON.parse(content);
    // console.log(metadata);
    return metadata;
}).then(function () {

    let quesPromise = solveQuestion(metadata.questions[0]);
    for (let i = 1; i < metadata.questions.length; i++) {
        quesPromise = quesPromise.then(function () {
            return solveQuestion(metadata.questions[i]);
        })
    }
    return quesPromise;

}).then(function () {
    console.log("well done");
}).catch(function (err) {
    console.log(err);
}).finally(function () {
    // driver.quit();
});





//--------------------------------------------------------------------
function solveQuestion(question) {
    //this will solve ques in async and return promise 
    return new Promise(function (resolve, reject) {
        let ques = openTheQuestion(question);
        ques.then(function () {
            return overlayWait();
        }).then(function (){
            return driver.findElement(swd.By.css('.editorTab')).click();
        }).then(function () {
            //editor text box
            return driver.findElement(swd.By.css('.ace_editor')).click();
        }).then(function () {
            return driver.findElement(swd.By.css('.ace_text-input'));
        }).then(function (editor) {
            globalEditor = editor;
            //ctrl a 
            return globalEditor.sendKeys(swd.Key.chord(swd.Key.CONTROL, "a"));
        }).then(function () {
            //delete 
            return globalEditor.sendKeys(swd.Key.chord(swd.Key.DELETE));
        }).then(function () {
            //custom input text box found
            return driver.findElement(swd.By.css('.testCase')).click();
        }).then(function () {
            return driver.findElement(swd.By.css('#customInput'));
        }).then(function (textBox) {
            globalTextBox = textBox;
            //read code
            return fs.promises.readFile(path.join(question.path, "main.java"));
        }).then(function (content) {
            let code = content + "";
            //ctrl v in text box
            return globalTextBox.sendKeys(code);
        }).then(function () {
            //ctrl a 
            return globalTextBox.sendKeys(swd.Key.chord(swd.Key.CONTROL + 'a'));
        }).then(function () {
            //ctrl x in text box
            return globalTextBox.sendKeys(swd.Key.chord(swd.Key.CONTROL + 'x'));
        }).then(function () {
            //ctrl v in editor
            return globalEditor.sendKeys(swd.Key.chord(swd.Key.CONTROL + "v"));
        }).then(function () {
            //submit
            return driver.findElement(swd.By.css('#submitCode')).click();
        }).then(function () {
            //wait
            return overlayWait();
        }).then(function () {
            return driver.findElements(swd.By.css('#testCases'));
        }).then(function (testCasesRows) {
            //all testcases rows are retrieved
            let testCasesInputs = [];
            for (let i = 0; i < testCasesRows.length; i++) {
                let Inputs = testCasesRows[i].findElements(swd.By.css("input[type=hidden]"));
                testCasesInputs.push(Inputs);
            }

            return Promise.all(testCasesInputs);
        }).then(function (AllTestCasesVal) {
            //once all rows are resolved getting value of each rows I/P,O/P,actual O/P
            let testcasesVal = [];
            for (let i = 0; i < AllTestCasesVal.length; i++) {
                let InputVal = AllTestCasesVal[i][0].getAttribute("value");
                let ExpectedOP = AllTestCasesVal[i][1].getAttribute("value");
                let ActualOP = AllTestCasesVal[i][2].getAttribute("value");
                let rowPromise = Promise.all([InputVal, ExpectedOP, ActualOP]);
                testcasesVal.push(rowPromise);
            }
            return Promise.all(testcasesVal);
        }).then(function (AllValues) {
            //making json object of the 2D array recieved
            // console.log(AllValues);
            let ObjArray = AllValues.map(function (row) {
                return {
                    input: row[0],
                    expected: row[1],
                    actual: row[2]
                }
            });
            let testCaseFileWillBeWrittenPromise = fs.promises.writeFile(
                path.join(question.path, "tc.json"),
                JSON.stringify(ObjArray)
            );
            return testCaseFileWillBeWrittenPromise;
        }).then(function () {
            resolve();
        }).catch(function (err) {
            console.log(err);
            reject();
        })
});




}

function openTheQuestion(question) {
    let glistTab, gLectures, gQuestion;
    //s1 - copen with url
    // return new Promise(function (resolve, reject) {
    //     let ques = driver.get(question.url);
    //     ques.then(function () {
    //         resolve();
    //     }).catch(function () {
    //         reject();
    //     })
    // });

    //s2- click module ,lecture ,question ,editor
    return new Promise(function (resolve, reject) {
        let course = driver.get(globalCourseUrl);
        course.then(function () {
            //module
            return driver.findElements(swd.By.css(".lis.tab .hoverable"));
        }).then(function (listTab) {
            glistTab = listTab;
            let moduleArr = []
            for (let i = 0; i < listTab.length; i++) {
                moduleArr.push(listTab[i].getText());
            }
            return Promise.all(moduleArr);

        }).then(function (Modules) {

            for (let i = 0; i < Modules.length; i++) {
                if (Modules[i] == question.module) {
                    return glistTab[i].click();
                    break;
                }
            }

        }).then(function () {
            //lecture
            return driver.findElements(swd.By.css(".collection-item "));
        }).then(function (lectureList) {
            gLectures = lectureList;
            let LectureArr = []
            for (let i = 0; i < gLectures.length; i++) {
                LectureArr.push(gLectures[i].getText());
            }
            return Promise.all(LectureArr);

        }).then(function (Lectures) {

            for (let i = 0; i < Lectures.length; i++) {
                if (Lectures[i] == question.lecture) {
                    return gLectures[i].click();
                    break;
                }
            }

        }).then(function () {
            //question
            return driver.findElements(swd.By.css(".green-text.no-margin"));
        }).then(function (quesList) {
            gQuestion = quesList;
            let QuesArr = []
            for (let i = 0; i < gQuestion.length; i++) {
                QuesArr.push(gQuestion[i].getText());
            }
            return Promise.all(QuesArr);

        }).then(function (Questions) {
            // console.log(Questions);
            for (let i = 0; i < Questions.length; i++) {
                Questions[i] = Questions[i].substr(4);
                //  console.log(Questions[i]);
                if (Questions[i] == question.question) {
                    return gQuestion[i].click();
                    break;
                }
            }

        }).then(function () {
            resolve();
        }).catch(function () {
            reject();
        })
    });
}

function overlayWait() {
    return new Promise(function (resolve, reject) {
        var siteOverlay = driver.findElement(swd.By.css('div#siteOverlay'));
        siteOverlay.then(function (soe) {
            //site overlay hide
            var OverlayHidden = driver.wait(swd.until.elementIsNotVisible(soe), 10000);
            return OverlayHidden;
        }).then(function () {
            resolve();
        }).catch(function (err) {
            console.log(err);
            reject();
        })
    });


}
//node pep.js ../credentials.json ../metadata.json "The Placement Program"