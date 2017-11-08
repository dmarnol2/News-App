var express = require('express');
var pug = require('pug');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var newsusers = require('./newsusers.json');
var fs = require('fs');
var options = {encoding:'utf8', flag:'r'};
var xml2js = require('xml2js');
var news = "";
var path = require('path');
var app = express();
app.set('views','./views');
app.set('view engine', 'pug');
app.engine('pug', pug.__express);
app.use(cookieParser());
app.use(bodyParser.urlencoded( {
    extended: false
}));
app.use(bodyParser.json());
app.use(session({
	secret: 'ser421lab3key',
	resave: true,
	saveUninitialized: true
}));
function loadArticles() {
    fs.readFile('./news.xml', options, function(err, data){
        if (err){
          console.log("Failed to open File.");
        } else {
          console.log("File Loaded.");
          xml2js.parseString(data, function (err, result) {
              news = result;
          });
        }
    });
}
loadArticles();

app.listen(8080, function() {
    console.log("Server Started");
});

app.locals.appname = "New News Inc";
app.locals.catchphrase = "REAL NEWS; TODAY";

function jsToXmlFile(filename, obj, cb) {
    var filepath = path.normalize(path.join(__dirname, filename));
    var builder = new xml2js.Builder();
    var xml = builder.buildObject(obj);
    fs.writeFile(filepath, xml, cb);
}

app.get('/', function(req,res){
    if(!req.session.login) {    // Not logged in, set session to default values
        req.session.login = false;
        req.session.user = "Guest";
        req.session.role = "";
        req.session.tempusername = "";
    }

    res.render('main', {
        appname:app.locals.appname,
        catchphrase: app.locals.catchphrase,
        username: req.session.user,
        role: req.session.role,
        news:news
    });
});

app.get('/view/', function(req,res){
    var content = "";
    var valid = false;
    var error = 0;
    for (var i = 0; i < news.NEWS.ARTICLE.length; i++) {
        if(news.NEWS.ARTICLE[i].TITLE == req.query.title && news.NEWS.ARTICLE[i].AUTHOR == req.query.author){
            content = news.NEWS.ARTICLE[i].CONTENT;
            valid = true;
            if(news.NEWS.ARTICLE[i].PUBLIC != "T" && req.session.role != "Subscriber" && req.query.author != req.session.user) {
                error = 403;  // 403 error
                valid = false;
            }
        }
    }

    if(valid) {
        res.render('article', {
            appname:app.locals.appname,
            catchphrase: app.locals.catchphrase,
            news:news,
            username: req.session.user,
            role:req.session.role,
            title:req.query.title,
            author:req.query.author,
            content:content
        });
    }
    else if(error == 403) {
        res.writeHead(403, {'Content-type':'text/plain'});
        res.end("Forbidden Access.");
    }
    else {
        res.writeHead(404, {'Content-type':'text/plain'});
        res.end("Article not found.");
    }
});

app.post('/', function(req,res){
    req.session.tempusername = ""; // reset tempusername

    if(req.body.login_status == "Logout") { // reset all other user data
        req.session.user="Guest";
        req.session.role="";
        req.session.login = false;   
    }
    else if(req.body.login_status == "Login") {
        req.session.tempusername = req.body.name;
        // check if user exists
        newsusers.users.forEach(function(user) {
            if(user.name == req.body.name) {
                req.session.user = req.body.name;
                req.session.role = user.role;
                req.session.tempusername = "";
                req.session.login = true; 
            }
        });
    }
    else if(req.body.login_status == "Register") {
        req.session.user = req.body.name;
        req.session.role = req.body.role;
        req.session.tempusername = "";
        req.session.login = true; 
        newsusers['users'].push({
            "name": req.session.user,
            "role": req.session.role});
        // Below saves users to file
        fs.writeFile('newsusers.json', JSON.stringify(newsusers, null, 2), (err)=>{
            if (err) {
                console.log("Error saving new user to file.");
            }
            else {
                console.log('News Users file has been updated with new user.');
            }
        })
    }

    if(req.session.tempusername != "") {   // tempusername set means you are in the process of adding a new user
        res.render('register', {
            appname:app.locals.appname, 
            catchphrase: app.locals.catchphrase,
            tempusername:req.body.name,
            news:news
        });
    }
    else {
        res.render('main', {
            appname:app.locals.appname,
            catchphrase: app.locals.catchphrase,
            username: req.session.user,
            role: req.session.role,
            news:news});
    }
});

app.post('/login', function(req,res){
    res.render('login', {
        appname:app.locals.appname,
        catchphrase: app.locals.catchphrase,
        news:news});
});
app.get('/add', function(req,res){
    if (req.session.role != "Reporter") {
        res.writeHead(403, {'Content-type':'text/plain'});
        res.end("Forbidden Access.");
    }
    else {
        res.render('add', {
            appname:app.locals.appname,
            catchphrase: app.locals.catchphrase,
            username: req.session.user,
            role: req.session.role,
            page:"add",
            news:news});
    }
})
app.post('/add', function(req,res){
    if (req.session.role != "Reporter") {
        res.writeHead(403, {'Content-type':'text/plain'});
        res.end("Forbidden Access.");
    }
    else {
        news.NEWS["ARTICLE"].push({
            "TITLE":[req.body.title],
            "AUTHOR":[req.session.user],
            "CONTENT":[req.body.content],
            "PUBLIC":[req.body.public]
        })
        // Below saves articles to file after adding new article
        jsToXmlFile("news.xml", news, function(err) {
            if(err)
                console.log("err: " + JSON.stringify(err));
        })
        //loadArticles();
        res.redirect('/');
    }
});

app.post('/remove/', function(req,res){
    var content = "";
    var valid = false;
    var error = 0;
    for (var i = 0; i < news.NEWS.ARTICLE.length; i++) {
        if(news.NEWS.ARTICLE[i].TITLE == req.body.title && news.NEWS.ARTICLE[i].AUTHOR == req.body.author){
            content = news.NEWS.ARTICLE[i].CONTENT;
            valid = true;
            if(req.body.author != req.session.user) {
                error = 403;  // 403 error
                valid = false;
            }
            else if(req.body.confirm == "true") {
                news.NEWS.ARTICLE.splice(i,1);
                // Below saves articles to file after deletion
                jsToXmlFile("news.xml", news, function(err) {
                    if(err)
                        console.log("err: " + JSON.stringify(err));
                })
            }
        }
    }

    if(req.body.confirm == "true") {
        res.redirect('/');
    }
    else if(valid) {
        res.render('remove', {
            appname:app.locals.appname,
            catchphrase:app.locals.catchphrase,
            news:news,
            username: req.session.user,
            role: req.session.role,
            title:req.body.title,
            author:req.body.author,
            content:content
        });
    }
    else if(error == 403) {
        res.writeHead(403, {'Content-type':'text/plain'});
        res.end("Forbidden Access.");
    }
    else {
        res.writeHead(404, {'Content-type':'text/plain'});
        res.end("Article not found.");
    }
});