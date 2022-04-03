const express = require('express');
const http = require('http');
const static = require('serve-static');
const path = require('path');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');

const expressErrorHandler = require('express-error-handler');

// mysql
const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit:10,
    host:'localhost', 
    user:'root',
    password:'wotjd1',
    database:'test',
    debug:false
});






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

router.route('/process/adduser').post(function (req, res) {
    console.log('/process/adduser 라우팅 함수 호출됨');

    const paramId = req.body.id || req.query.id;
    const paramPassword = req.body.password || req.query.password;
    const paramName = req.body.name || req.query.name;
    const paramAge = req.body.age || req.query.age;

    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword + ', ' 
    + paramName + ', ' + paramAge);

    addUser(paramId, paramPassword, paramName, paramAge, function(err, addUser) {{
        if (err) {
            console.log('에러 발생 addUser');
            res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
            res.write('<h1>에러 발생 addUser</h1>');
            res.end();
            return;
        }

        if (addUser) {
            console.dir(addUser);
            res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
            res.write('<h1>사용자 추가 성공</h1>');
            res.end();

        } else {
            console.log('사용자 추가 실패');
            res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
            res.write('<h1>사용자 추가 실패</h1>')
            res.end();
        }

    }});
});


router.route('/process/login').post(function(req, res) {
    console.log('/process/login 라우팅 함수 호출됨');

    const paramId = req.body.id || req.query.id;
    const paramPassword = req.body.password || req.query.password;
    console.log('요청 파라미터 : ' + paramId + ', ' + paramPassword);

        authUser(paramId, paramPassword, function(err, rows) {
            if (err) {
                console.log('에러 발생');
                // 이건 브라우저로 요청을 보내는것에 목적이기 때문에 리턴 필요 없다.
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>에러 발생</h1>');
                res.end();
                return;
            }

            if (rows) {
                console.dir(rows);

                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>사용자 로그인 성공</h1>');
                res.write('<div><p>사용자 : ' + rows[0].name + '</p></div>');
                res.write('<br><br><a href="/public/login.html">다시 로그인하기</a>');
                res.end();
                
            } else {
                console.log('사용자 데이터 조회 안됨');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>사용자 데이터 조회 안됨</h1>');
                res.end();
                
            }

        });
    

});



app.use('/', router);


// 호출해서 사용할 수 있는 함수를 만드는게 명확하다 (DB, api)
// node.js는 비동기 방식을 선호하기 때문에 (코드안에 코드가 들어감 ex.콜백함수) 함수를 분리하는것이 좋다.
// why? 코드가 깊고 복잡해지는 것을 막기위해

const addUser = function(id, password, name, age, callback) {
    console.log('addUser 호출됨');

    // 위에 커넥션을 최대 10개까지 지정해놨으므로 -> connectionLimit:10 <- 이부분
    // 그래서 쓰고나면 다시 릴리즈를 해줘야한다.
    pool.getConnection(function(err, connection) {
        if (err) {
            if (connection) {
                conn.release();
            }
            callback(err,null);
            return;
        }
        console.log('데이터베이스 연결의 스레드 아이디 : ' + connection.threadId);
        
        const data = {id:id, password:password, name:name, age:age};
        const exec = connection.query('insert into users set ?', data, function(err, result) {
            connection.release();
            console.log('실행된 SQL : ' + exec.sql);
            if (err) {
                console.log('SQL 실행시 에러발생');
                console.error(err);
                callback(err,null);
                return;
            }

            callback(null,result);
        });
    });
};



const authUser = function(id, password, callback) {
    console.log('authUser 호출됨 : ' + id + ', ' + password);

    pool.getConnection(function(err, connection) {
        if (err) {
            if (connection) {
                connection.release();
            }
            console.error(err);
            callback(err,null);
            return;
        }
        console.log('데이터베이스 연결 스레드 아이디 : ' + connection.threadId);

        const tableName = 'users';
        const columns = ['id', 'name', 'age'];
        const exec = connection.query('select ?? from ?? where id = ? and password = ?', 
        [columns, tableName, id, password], function(err, rows) {
            connection.release();
            console.log('실행된 SQL : ' + exec.sql);

            if (err) {
                callback(err, null);
                return;
            }

            if (rows.length > 0) {
                console.log('사용자 찾음');
                callback(null,rows);
            } else {
                console.log('사용자 찾지 못함');
                callback(null, null);
            }
        });
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
});