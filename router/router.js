/**
 * Created by Danny on 2015/9/26 15:39.
 */
var formidable = require("formidable");
var db = require("../models/db.js");
var md5 = require("../models/md5.js");
var path = require("path");
var fs = require("fs");
var gm = require("gm");

//首页
exports.showIndex = function (req, res, next) {
    //检索数据库，查找此人的头像
    if (req.session.login == "1") {
        //如果登陆了
        var username = req.session.username;
        var login = true;
    } else {
        //没有登陆
        var username = "";  //制定一个空用户名
        var login = false;
    }
    //已经登陆了，那么就要检索数据库，查登陆这个人的头像
    db.find("users", {username: username}, function (err, result) {
        if (result.length == 0) {
            var avatar = "moren.jpg";
        } else {
            var avatar = result[0].avatar;
        }
        res.render("index", {
            'title':'首页',
            "login": login,
            "username": username,
            "active": "首页",
            "avatar": avatar    //登录人的头像
        });
    });
};

//注册页面
exports.showRegist = function (req, res, next) {
    res.render("regist",{
        'title':'注册',
        'login': req.session.login == '1' ? true : false,
        'username': req.session.login == '1' ? req.session.username : '',
        "active":"注册"
    });
};
//注册业务
exports.doRegist = function (req, res, next) {
    //得到用户填写的东西
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        //得到表单之后做的事情
        var username = fields.username;
        var password = fields.password;

        //console.log(username,password);
        //查询数据库中是不是有这个人
        db.find("users", {"username": username}, function (err, result) {
            if (err) {
                res.send("-3"); //服务器错误
                return;
            }
            if (result.length != 0) {
                res.send("-1"); //被占用
                return;
            }
            //没有相同的人，就可以执行接下来的代码了：
            //设置md5加密
            password = md5(md5(password) + "robo");

            //现在可以证明，用户名没有被占用
            db.insertOne("users", {
                "username": username,
                "password": password,
                "avatar": 'moren.jpg'
            }, function (err, result) {
                if (err) {
                    res.send("-3"); //服务器错误
                    return;
                }
                req.session.login = '1';
                req.session.username = username;
                res.send("1"); //注册成功，写入session
            })
        });
    });
};


//登录页面
exports.showLogin = function (req, res, next) {
    res.render("login",{
        'title':'登录',
        'login': req.session.login == '1' ? true : false,
        'username': req.session.login == '1' ? req.session.username : '',
        "active": "登录"
    });
};
//登录业务
exports.doLogin = function(req, res, next){
    //得到用户表单信息
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        //得到表单之后做的事情
        var username = fields.username;
        var password = fields.password;
        var jiamihou = md5(md5(password) + "robo");
        //查询数据库，看看有没有这个人
        db.find("users",{"username":username},function(err, result){
            if(err){
                res.send("-5");
                return;
            }
            //没有这个人
            if(result.length == 0){
                res.send("-1");
                return;
            }
            //如果有，进一步看看这个人密码是否匹配
            if(jiamihou == result[0].password){
                req.session.login = "1";
                req.session.username = username;
                //console.log(username);
                res.send("1");  //登录成功
                return;
            }else{
                res.send("-2"); //密码错误
                return;
            }
        });

    });
};

//上传头像，必须保持是登录状态
exports.showSetAvatar = function (req, res, next) {
    if(req.session.login != "1"){
        res.send("需要登录");
        return;
    }
    res.render("setavatar",{
        'title':'上传头像',
        'login': true,
        'username': req.session.username,
        'active':"上传头像"
    });
};
//设置头像页面
exports.dosetavatar = function (req, res, next) {
    var form = new formidable.IncomingForm();
    form.uploadDir = path.normalize(__dirname + "/../avatar");
    form.parse(req, function(err,fields,files){
        var oldpath = files.touxiang.path;
        console.log(req.session.username);
        console.log(oldpath);
        var newpath = path.normalize(__dirname + "/../avatar") + "/" + req.session.username + ".jpg";
        fs.rename(oldpath,newpath,function(err){
            if(err){
                res.send("失败");
                return;
            }
            req.session.avatar = req.session.username + ".jpg";
            //跳转到切的业务
            res.redirect("/cut");
        });
    });
};

//切图页面
exports.showcut = function(req,res){
    res.render("cut",{
        avatar: req.session.avatar
    });
};
//执行切图
exports.docut = function(req,res,next){
    //这个页面接收几个GET请求参数
    //w、h、x、y
    var filename = req.session.avatar;
    var w = req.query.w;
    var h = req.query.h;
    var x = req.query.x;
    var y = req.query.y;

    gm("./avatar/" + filename)
        .crop(w,h,x,y)
        .resize(100,100,"!")
        .write("./avatar/"+ filename,function(err){
            if(err){
                res.send("-1");
                //console.log(err);
                return;
            }
            //更改数据库前的avatar这个值
            db.updateMany("users",{"username":req.session.username},{
                $set:{"avatar":req.session.avatar}},function(err,results){
                    res.send("1");
            });

        });
};

//发表说说
exports.doPost = function (req, res, next) {
    //必须保证登陆
    if (req.session.login != "1") {
        res.end("非法闯入，这个页面要求登陆！");
        return;
    }
    //用户名
    var username = req.session.username;

    //得到用户填写的东西
    var form = new formidable.IncomingForm();
    form.parse(req, function (err, fields, files) {
        //得到表单之后做的事情
        var content = fields.content;

        //现在可以证明，用户名没有被占用
        db.insertOne("posts", {
            "username": username,
            "datetime": new Date(),
            "content": content
        }, function (err, result) {
            if (err) {
                res.send("-3"); //服务器错误
                return;
            }
            res.send("1"); //注册成功
        });
    });
};


//列出所有说说，有分页功能
exports.getAllShuoshuo = function(req,res,next){
    //这个页面接收一个参数，页面
    var page = req.query.page;
    db.find("posts",{},{"pageamount":20,"page":page,"sort":{"datetime":-1}},function(err,result){
        res.json(result);
    });
};


//列出某个用户的信息
exports.getuserinfo = function(req,res,next){
    //这个页面接收一个参数，页面
    var username = req.query.username;
    db.find("users",{"username":username},function(err,result){
        if(err || result.length == 0){
            res.json("");
            return;
        }
        var obj = {
            "username" : result[0].username,
            "avatar" : result[0].avatar,
            "_id" : result[0]._id,
        };
        res.json(obj);
    });
};

//说说总数
exports.getshuoshuoamount = function(req,res,next){
    db.getAllCount("posts",function(count){
        res.send(count.toString());
    })
};

//个人说说
exports.showUser = function(req,res,next){
    var user = req.params["user"];
    db.find("posts",{"username":user},function(err,result){
        db.find("users",{"username":user},function(err,result2){
            res.render("user",{
                'title':'个人说说',
                'login': req.session.login == '1' ? true : false,
                'username': req.session.login == '1' ? req.session.username : '',
                "user": user,
                "active": "我的说说",
                "cirenshuoshuo": result,
                "cirentouxiang": result2[0].avatar
            })
        });
    });
};

//成员列表
exports.showuserlist = function(req,res,next){
    db.find("users",{},function(err,result){
        res.render("userlist",{
            'title':'成员列表',
            'login': req.session.login == '1' ? true : false,
            'username': req.session.login == '1' ? req.session.username : '',
            "active": "成员列表",
            "suoyouchengyuan": result
        })
    });
};

//聊天室页面
exports.chatRoom = function(req, res, next){
    res.render("chat",{
        'title': '聊天室',
        'login': req.session.login == '1' ? true : false,
        'username': req.session.login == '1' ? req.session.username : '',
        "active": "聊天室"
    });
};