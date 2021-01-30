//jshint esversion:6

require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const jsalert=require("js-alert");
const mongoose = require("mongoose");
// const encrypt=require("mongoose-encryption");
// const md5=require("md5");
// const saltrounds = 10;
const passport = require("passport");
//passport-local is used by passport-local-mongoose
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const MongoStore = require('connect-mongo')(session);
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

mongoose.connect("mongodb+srv://admin-ayush:test123@cluster0-nvgjh.mongodb.net/projectDB", {
  useUnifiedTopology: true,
  useNewUrlParser: true
});

//to suppress deprecation warning
mongoose.set('useCreateIndex', true);

//for local authentication
app.use(session({
  secret: "this is a secret string",
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

app.use(passport.initialize());
app.use(passport.session());

const itemsSchema = new mongoose.Schema({
  checked: Boolean,
  name: String
});

const Item = new mongoose.model("Item", itemsSchema);

const listSchema = new mongoose.Schema({
  name: String,
  items: [itemsSchema]
});

const List = new mongoose.model("List", listSchema);

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  password: String,
  googleId: String,
  facebookId: String,
  githubId: String,
  profilePicture:String,
  lists: [listSchema]
});

//for plugins the schema must be a mongoose schema not the normal one
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: "730767656064-k0489kec340c5vsmn418198thm8dbies.apps.googleusercontent.com",
    clientSecret: "0Ymo6syQXqSAsgidpv84u1YC",
    callbackURL: "https://secret-woodland-77314.herokuapp.com/auth/google/lists",
    userProfileUrl: "http://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      googleId: profile.id,
      name:profile.displayName,
      profilePicture:profile._json.picture
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: "2544770645780092",
    clientSecret: "e8d31a8aa0473c3ec5e6dc3c4e78bbd7",
    callbackURL: "https://secret-woodland-77314.herokuapp.com/auth/facebook/lists",
    // profileFields: ['id', 'displayName', 'photos', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      facebookId: profile.id,
      name:profile.displayName,
      profilePicture:"https://graph.facebook.com/"+profile.id+"/picture?width=200&height=200&access_token="+accessToken
    }, function(err, user) {
        return cb(err, user);
    });
  }
));

passport.use(new GitHubStrategy({
    clientID: "760c64ed3f698a3a049d",
    clientSecret: "4f99a31fe4ab2f02257572716fb43adedf4f4d57",
    callbackURL: "https://secret-woodland-77314.herokuapp.com/auth/github/lists"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({
      githubId: profile.id,
      name:profile.username,
      profilePicture:profile._json.avatar_url
    }, function(err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
  res.render("cover");
});

app.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  }));

app.get("/auth/google/lists",
  passport.authenticate("google", {
    failureRedirect: "/login"
  }),
  function(req, res) {
    res.redirect("/lists");
  });

app.get('/auth/facebook',
  passport.authenticate('facebook',{
    profileFields:["username","profile","photos"]
  }));

app.get('/auth/facebook/lists',
  passport.authenticate('facebook', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    res.redirect('/lists');
  });

app.get('/auth/github',
  passport.authenticate('github'));

app.get('/auth/github/lists',
  passport.authenticate('github', {
    failureRedirect: '/login'
  }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/lists');
  });

app.get("/login", function(req, res) {
  if(req.isAuthenticated()){
    res.redirect("/lists");
  }
  res.render("login");
});

app.get("/logout",function(req,res){
  req.logout();
  res.redirect("/login");
});

app.get("/register", function(req, res) {
  res.render("register");
});

app.get("/lists", function(req, res) {

  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, foundUser) {
      if (err) {
        console.log(err);
      } else {
        if (foundUser.lists.length === 0) {
          foundUser.lists = new List();

          var obj = foundUser.lists[0];
          obj.name=" ";
          foundUser.save();
        }

        // window.location.reload();

        res.render("lists", {
          listNames: foundUser.lists,
          user:foundUser,
          request:req
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/lists/:listId/:listName", function(req, res) {

  const listId = req.params.listId;
  const listName = req.params.listName;

  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, foundUser) {
      var foundList = foundUser.lists.id(listId);

      if (foundList.items.length === 0) {
        foundList.items = new Item();

        var obj = foundList.items[0];
        obj.name=" ";
        foundUser.save();
      }

      res.render("list", {
        listItems: foundList.items,
        listName: foundList.name,
        listId: foundList._id,
        request:req
      });
    });
  } else {
    res.redirect("/login");
  }
});

//------- ------------------post routes---------------------------

app.post("/lists", function(req, res) {
  if (req.isAuthenticated()) {
    const newList = req.body.newList;
    const userID = req.user.id;

    User.findById(userID, function(err, foundUser) {

      if (req.body.add === "add" && newList !== "") {
        const list = new List({
          name: newList
        });
        foundUser.lists.push(list);
      } else if (req.body.delete === "delete") {
          foundUser.lists.id(req.body.listId).remove();
      }

      foundUser.save();
      res.redirect("/lists");
    });

  } else {
    res.redirect("/login");
  }

});


app.post("/lists/:listId/:listName", function(req, res) {
  const listId = req.params.listId;
  const listName = req.params.listName;

  if (req.isAuthenticated()) {
    User.findById(req.user.id, function(err, foundUser) {
      var foundList = foundUser.lists.id(req.params.listId);

      if (req.body.add === "add" && (req.body.newItem !== "" || req.body.newItem!==null)) {
        const item = new Item({
          checked: false,
          name: req.body.newItem
        });
        foundList.items.push(item);

      } else if (req.body.delete === "delete") {

        foundList.items.id(req.body.itemId).remove();

      } else {

        var item = foundList.items.id(req.body.itemId);
        item.checked = !item.checked;
      }

      foundUser.save();
      res.redirect("/lists/" + listId + "/" + "listName");
    });
  } else {
    res.redirect("/login");
  }
});


app.post("/register", function(req, res) {

  if(req.body.name==""||req.body.name==" "){
    res.redirect("/register");
  }
  else{
    User.register({
      username: req.body.username,
      name: req.body.name
    }, req.body.password, function(err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/lists");
        });
      }
    });
  }
});

app.post("/login", function(req, res) {

 if(req.body.username=="" || req.body.password==""){
   res.redirect("/login");
 }

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local",{failureRedirect: '/login' })(req, res, function() {
        res.redirect("/lists");
      });
    }
  });
});

let port=process.env.PORT;
if(port==null || port=="")
    {
      port=3000;
    }

app.listen(port, function() {
  console.log("Server started successfully");
});
