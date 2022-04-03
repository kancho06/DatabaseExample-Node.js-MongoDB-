const express = require('express');
const http = require('http');
const static = require('serve-static');
const path = require('path');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');

const expressErrorHandler = require('express-error-handler');

// mongodb module
const MongoClient = require('mongodb').MongoClient;

// mongodb connection
var database;

function connectDB() {
    const databaseUrl = 'mongodb://localhost:27017/local';

    MongoClient.connect(databaseUrl, function(err, db) {
        if (err) {
            console.log('데이터베이스 연결 시 에러 발생함');
            return;
        }

        console.log('데이터베이스에 연결됨 : ' + databaseUrl);
        
        // mongodb 3.0 이상 버전에서는 데이터베이스 명을 꼭 명시해 주어야한다.
        database = db.db('local');
    })
}




const app = express();

app.set('port', process.env.PORT || 3000);
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(expressSession({
    secret:'my key',
    resave: true,
    saveUninitialized:true
}));


const router = express.Router();


// 로그인 시 데이터베이스의 정보와 대조한다.
router.route('/process/login').post(function(req, res) {
    console.log('/process/login 라우팅 함수 호출됨');

    const paramId = req.body.id || req.query.id;
    const paramPassword = req.body.password || req.query.password;
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);

    if (database) {
        authUser(database, paramId, paramPassword, function(err, docs) {
            if (err) {
                console.log('에러 발생');
                // 이건 브라우저로 요청을 보내는것에 목적이기 때문에 리턴 필요 없다.
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>에러 발생</h1>');
                res.end();
                return;
            }

            if (docs) {
                console.dir(docs);

                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>사용자 로그인 성공</h1>');
                res.write('<div><p>사용자 : ' + docs[0].name + '</p></div>');
                res.write('<br><br><a href="/public/login.html">다시 로그인하기</a>');
                res.end();
                
            } else {
                console.log('사용자 데이터 조회 안됨');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>사용자 데이터 조회 안됨</h1>');
                res.end();
                
            }

        });
    } else {
        console.log('데이터베이스 연결 안됨');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
        res.write('<h1>데이터베이스 연결 안됨</h1>');
        res.end();
    }

});

// 회원가입
router.route('/process/adduser').post(function(req, res) {
    console.log('/process/adduser 라우팅 함수 호출됨');

    const paramId = req.body.id || req.query.id;
    const paramPassword = req.body.password || req.query.password;
    const paramName = req.body.name || req.query.name;

    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' + paramName);

    if (database) {
        addUser(database, paramId, paramPassword, paramName, 
            function (err, result) {
                if (err) {
                    console.log('에러 발생');
                    res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                    res.write('<h1>에러 발생</h1>');
                    res.end();
                return;
                }

                if (result) {
                    console.dir(result);
                    res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                    res.write('<h1>사용자 추가 성공</h1>');
                    res.write('<div><p>사용자 : ' + paramName + '</p></div>');
                    res.write('<br><br><a href="/public/login.html">다시 로그인하기</a>');
                    res.end();
                } else {
                    console.log('사용자 추가 안됨');
                    res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                    res.write('<h1>사용자 추가 안됨</h1>');
                    res.end();
                }
            })
    } else {
        console.log('데이터베이스 연결 안됨');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
        res.write('<h1>데이터베이스 연결 안됨</h1>');
        res.end();
    }
});



app.use('/', router);



// 호출해서 사용할 수 있는 함수를 만드는게 명확하다 (DB, api)
// node.js는 비동기 방식을 선호하기 때문에 (코드안에 코드가 들어감 ex.콜백함수) 함수를 분리하는것이 좋다.
// why? 코드가 깊고 복잡해지는 것을 막기위해

const authUser = function(db, id, password, callback) {
    console.log('authUser 호출됨 : ' + id + ', ' + password);

    const users = db.collection('users');

    users.find({"id":id, "password":password}).toArray(function(err, docs) {
        if (err) {
            // 여기서의 콜백함수의 파라미터는 에러, docs(결과물) 두개이다.
            callback(err, null);
            return;
        }

        if (docs.length > 0) {
            console.log('일치하는 사용자를 찾음');
            callback(null, docs);
        } else {
            console.log('일치하는 사용자를 찾지 못함');
            // 에러는 없지만 일치하는 사용자가 없다.
            callback(null, null);
        }
    });
};


// 
const addUser = function(db, id, password, name, callback) {
    console.log('addUser 호출됨 : ' + id + ', ' + password + ', ' + name);

    const users = db.collection('users');
    //여러개를 한번에 추가헐 수 있는 함수라 배열을 넣고 객체를 넣는다 [] = 배열 {} = 객체
    users.insertMany([{"id":id, "password":password, "name":name}], 
    function(err, result) {
        if (err) {
            callback(err,null);
            return;
        }

        if (result.insertedCount > 0) {
            console.log('사용자 추가됨 : ' + result.insertedCount);
            callback(null, result);
        } else {
            console.log('추가된 문서객체(레코드)가 없음');
            callback(null, null);
        }
    });
};






const errorHandler = expressErrorHandler({
    static:  {
        '404': './public/404.html'
    }
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);

const server = http.createServer(app).listen(app.get('port'), function () {
    console.log('server listening on port : ' + app.get('port'));

    // 서버에 연결될 때 DB 호출
    connectDB();
});