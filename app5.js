const express = require('express');
const http = require('http');
const static = require('serve-static');
const path = require('path');

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');

const expressErrorHandler = require('express-error-handler');

// 암호화 모듈
const crypto = require('crypto');

// mongodb module
const mongoose = require('mongoose');

// mongodb connection
var database;
var UserSchema;
var UserModel;

function connectDB() {
    const databaseUrl = 'mongodb://localhost:27017/local';
    // mongodb -> mongoose로 변경
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUrl);
    database = mongoose.connection;

    // 연결시도 확인방법을 이벤트로 제공해줌
    database.on('open', function() {
        console.log('데이터베이스에 연결됨 : ' + databaseUrl);
        

        UserSchema = mongoose.Schema({
            id: {type: String, required: true, unique: true, 'default':''},
            hashed_password: {type: String, required: true, 'default':''},
            salt: {type: String, required: true},
            name: {type: String, index:'hashed', 'default':''}, 
            age: {type: Number, 'default': -1},
            created: {type: Date, index:{unique:false}, 'default': Date.now()},
            updated: {type: Date, index:{unique:false}, 'default': Date.now()}
        });
        console.log('UserSchema 정의됨');

        UserSchema
            .virtual('password')
            .set(function(password) {
                this.salt = this.makeSalt();
                this.hashed_password = this.encryptPassword(password);
                console.log('virtual password 저장됨 : ' + this.hashed_password);
                
            });

        // salt 값을 이용해서 비밀번호를 encoding(암호화) 한다.
        // plainText는 유저가 지금 입력한 password이다
        UserSchema.method('encryptPassword', function(plainText, inSalt) {
            if (inSalt) {
                return crypto.createHmac('sha1', inSalt).update(plainText).digest('hex');
            } else {
                return crypto.createHmac('sha1', this.salt).update(plainText).digest('hex');
            }
        });

        // 매번 같은 salt로 encoding 을 해주면 보안의 문제가 있기때문에
        // salt값을 매번 랜덤으로 생성해 준다.
        UserSchema.method('makeSalt', function() {
            return Math.round((new Date().valueOf() * Math.random())) + '';
        });

        // 비밀번호 대조
        UserSchema.method('authenticate', function(plainText, inSalt, hashed_password) {
            if (inSalt) {
                console.log('authenticate 호출됨');
                return this.encryptPassword(plainText, inSalt) === hashed_password;
            } else {
                console.log('authenticate 호출됨');
                return this.encryptPassword(plainText) === hashed_password;
            }
        });
        
        // jpa에서 findByIdAndUserNickName과 같은 함수 비슷하게 쓰는 함수를 설정
        UserSchema.static('findById', function(id, callback) {
            return this.find({id:id}, callback);
        });

        UserSchema.static('findAll', function(callback) {
            return this.find({}, callback);
        });
        // 이런식으로도 사용가능
        // this는 내부적으로 모델객체를 참조한다. (find가 모델을 찾는거이기 때문에)
        // UserSchema.static.findById = function(id, callback) {
        //     return this.find({id:id}, callback);
        // }
        
        UserModel = mongoose.model('users3', UserSchema);
        console.log('UserModel 정의됨');

    });

    database.on('disconnected', function() {
        console.log('데이터베이스 연결 끊어짐');
    });

    database.on('error', console.error.bind(console, 'mongoose 연결 에러'));
};



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

router.route('/process/listuser').post(function (req, res) {
    console.log('/process/listuser 라우팅 함수 호출됨');

    if (database) {
        UserModel.findAll(function(err, results) {
            if (err) {
                console.log('에러 발생');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write('<h1>에러 발생</h1>');
                res.end();
            return;
            }

            if (results) {
                console.dir(results);

                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write("<h3>사용자 리스트</h3>");
                res.write("<div><ul>");

                for (var i = 0; i < results.length; i++) {
                    const curId = results[i]._doc.id;
                    const curName = results[i]._doc.name;
                    res.write("    <li>#" + i + " -> " + curId + ", "+ curName + "</li>");
                }

                res.write("</ul></div>);");
            } else {
                console.log('에러 발생');
                res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
                res.write("<h1>조회된 사용자 없음</h1>");
                res.end();
            }
        });
    } else {
        console.log('에러 발생');
        res.writeHead(200, {"Content-Type":"text/html;charset=utf8"});
        res.write("<h1>데이터베이스 연결 안됨</h1>");
        res.end();
    }
});



app.use('/', router);



// 호출해서 사용할 수 있는 함수를 만드는게 명확하다 (DB, api)
// node.js는 비동기 방식을 선호하기 때문에 (코드안에 코드가 들어감 ex.콜백함수) 함수를 분리하는것이 좋다.
// why? 코드가 깊고 복잡해지는 것을 막기위해

const authUser = function(db, id, password, callback) {
    console.log('authUser 호출됨 : ' + id + ', ' + password);

    //변경된 방식
    UserModel.findById(id, function(err, results) {
        if (err) {
            callback(err, null);
            return;
        }

        console.log('아이디 %s로 검색한 결과', id);
        if (results.length > 0) {
            const user = new UserModel({id:id});
            const authenticated = user.authenticate(password, results[0]._doc.salt,
            results[0]._doc.hashed_password);

            if (authenticated) {
                console.log('비밀번호 일치함');
                callback(null, results);
            } else {
                console.log('비밀번호 일치하지 않음.');
                callback(null, null);
            }
        } else {
            console.log('아이디 일치하는 사용자 없음.');
            callback(null, null);
        }
    });


    // 이전 방식
    // UserModel.find({"id":id, "password":password}, function(err, docs) {
    //     if (err) {
    //         callback(err, null);
    //         return;
    //     }
        
    //     if (docs.length > 0) {
    //         console.log('일치하는 사용자를 찾음');
    //         callback(null, docs);
    //     } else {
    //         console.log('일치하는 사용자를 찾지 못함');
    //         // 에러는 없지만 일치하는 사용자가 없다.
    //         callback(null, null);
    //     }

    // });
    
};


// 
const addUser = function(db, id, password, name, callback) {
    console.log('addUser 호출됨 : ' + id + ', ' + password + ', ' + name);

    const user = new UserModel({"id":id, "password":password,"name":name});

    user.save(function(err) {
        if (err) {
            callback(err, null);
            return;
        }

        console.log('사용자 데이터 추가함');
        callback(null, user);

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