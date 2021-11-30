'use strict'

// A server that uses a database. 

// express module provides basic server functions
const express = require("express");

// our database operations
const dbo = require('./databaseOps');

// Promises-wrapped version of sqlite3
const db = require('./sqlWrap');

// functions that verify activities before putting them in database
const act = require('./activity');

// object that provides interface for express
const app = express();

const passport = require('passport');
const cookieSession = require('cookie-session');
const GoogleStrategy = require('passport-google-oauth20');

let currUser = {};

// use this instead of the older body-parser
app.use(express.json());

// make all the files in 'public' available on the Web
app.use(express.static('public'))

// when there is nothing following the slash in the url, return the main page of the app.
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/splash.html");
});

// This is where the server receives and responds to get /all requests
// used for debugging - dumps whole database
app.get('/all', async function(request, response, next) {
  console.log("Server received a get /all request at", request.url);
  let results = await dbo.get_all()
  
  response.send(results);
});

// This is where the server recieves and responds to store POST requests
app.post('/store', async function(request, response, next) {
  let activity = act.Activity(currUser.id, request.body)
  await dbo.post_activity(activity)
  
  response.send({ message: "I got your POST request"});
});

app.get('/reminder', async function(request, response, next) {
  let currTime = newUTCTime()
  currTime = (new Date()).getTime()

  // Get Most Recent Past Planned Activity and Delete All Past Planned Activities
  let result = await dbo.get_most_recent_planned_activity_in_range(currUser.id, 0, currTime)
  await dbo.delete_past_activities_in_range(currUser.id, 0, currTime);

  if (result != null){
    // Format Activity Object Properly
    result.scalar = result.amount
    result.date = result['MAX(date)']
    // Send Client Most Recent Planned Activity from the Past
    response.send(act.Activity(result));
  } else {
    response.send({message: 'All activities up to date!'});
  }
});

app.get('/name', function(request, response, next) {
  response.send({name: currUser.name});
});


// This is where the server recieves and responds to week GET requests
app.get('/week', async function(request, response, next) {
  let date = parseInt(request.query.date)
  let activity = request.query.activity
  
  /* Get Latest Activity in DB if not provided by query params */
  if (activity === undefined) {
    let result = await dbo.get_most_recent_entry(currUser.id)
    try {
      activity = result.activity
    } catch(error) {
      activity = "none"
    }
  }

 

  /* Get Activity Data for current Date and The Week Prior */
  let min = date - 6 * MS_IN_DAY
  let max = date
  let result = await dbo.get_similar_activities_in_range(currUser.id, activity, min, max)

  /* Store Activity amounts in Buckets, Ascending by Date */
  let data = Array.from({length: 7}, (_, i) => {
    return { date: date - i * 86400000, value: 0 }
  })

  /* Fill Data Buckets With Activity Amounts */
  for(let i = 0 ; i < result.length; i++) {
    let idx = Math.floor((date - result[i].date)/MS_IN_DAY)
    data[idx].value += result[i].amount
  }
  
  // Send Client Activity for the Selected Week
  response.send(data.reverse());
});


// UNORGANIZED HELPER FUNCTIONS
const MS_IN_DAY = 86400000

/**
 * Convert GMT date to UTC
 * @returns {Date} current date, but converts GMT date to UTC date
 */
 function newUTCTime() {
    let gmtDate = new Date()
    let utcDate = (new Date(gmtDate.toLocaleDateString()))
    let utcTime = Date.UTC(
      utcDate.getFullYear(),
      utcDate.getMonth(),
      utcDate.getDay()
    )
    console.log("time:", utcTime)
    return utcTime
}

/**
 * Convert UTC date to UTC time
 * @param {Date} date - date to get UTC time of
 * @returns {number}
 */
function date_to_UTC_datetime(date) {
  let utcDate = new Date(date.toLocaleDateString())
  return Date.UTC(
    utcDate.getFullYear(),
    utcDate.getMonth(),
    utcDate.getDay()
  )
}  

const hiddenClientID = process.env['ClientID']
const hiddenClientSecret = process.env['ClientSecret']

// An object giving Passport the data Google wants for login.  This is 
// the server's "note" to Google.
const googleLoginData = {
  clientID: hiddenClientID,
  clientSecret: hiddenClientSecret,
  callbackURL: '/auth/accepted',
  proxy: true
};
 
passport.use(new GoogleStrategy(googleLoginData, gotProfile));

// pipeline stage that just echos url, for debugging
app.use('/', printURL);

app.get('/logout', function(req,res) {
  req.logout();
  currUser = {}
  res.redirect('/')
})

app.use(cookieSession({
  maxAge: 5 * 60 * 1000, // min * sec * millisec
  keys: ['hanger waldo mercy dance']  
  })
);

// Initializes passport by adding data to the request object
app.use(passport.initialize()); 

// If there is a valid cookie, this stage will ultimately call deserializeUser(),
// which we can use to check for a profile in the database
app.use(passport.session()); 

// Public static files - /public should just contain the splash page
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/public/splash.html");
  }
);

app.get('/*',express.static('public'));

app.get('/auth/google',
	passport.authenticate('google',{ scope: ['profile'] }) 
);

app.get('/auth/accepted',
	// for educational purposes
	function (req, res, next) {
	    console.log("at auth/accepted");
	    next();
	},
	passport.authenticate('google'),
	function (req, res) {
    console.log('Logged in and using cookies!')
    // console.log("Request Body: "+JSON.stringify(req.user));
	  // res.redirect(`/user/public/index.html?userName=${currUser.name}`);
	  res.redirect(`/index.html`);
    // res.send(req.user);
	}
);
  
// static files in /user are only available after login
app.get('/*',
	isAuthenticated, // only pass on to following function if
	express.static('user') 
); 

// next, put all queries (like store or reminder ... notice the isAuthenticated 
// middleware function; queries are only handled if the user is logged in
app.get('/query', isAuthenticated,
);  

// finally, file not found, if we cannot handle otherwise.
app.use( fileNotFound );

// Pipeline is ready. Start listening!  
const listener = app.listen(3000, () => {
  console.log("The static server is listening on port " + listener.address().port);
});

// middleware functions called by some of the functions above. 

// print the url of incoming HTTP request
function printURL (req, res, next) {
  // console.log(req.url);
  next();
}


// function for end of server pipeline
function fileNotFound(req, res) {
  let url = req.url;
  res.type('text/plain');
  res.status(404);
  res.send('Cannot find '+url);
}

// function to check whether user is logged when trying to access
// personal data
function isAuthenticated(req, res, next) {
  if (req.user) {
    console.log("user",req.user,"is logged in");
    next();
  } else {
	res.redirect('/splash.html');  // send response telling
	// Browser to go to login page
    }
}
 
async function gotProfile(accessToken, refreshToken, profile, done) {
  // console.log("Google profile has arrived",profile);
  let userProfile = profile;

  userProfile = await dbo.get_user(userProfile.id)
  .catch( function(error) {
    console.log(error);
  });
  if(typeof userProfile == 'undefined'){
    dbo.post_user([profile.id, profile.name.givenName])
    userProfile = await dbo.get_user(profile.id)
    .catch( function(error) {
      console.log(error);
    });
  }
  currUser = userProfile;
  done(null, userProfile); 
}

passport.serializeUser((userProfile, done) => {
  console.log("SerializeUser. Input is",userProfile.id);
  done(null, userProfile);
});

passport.deserializeUser((userProfile, done) => {
  // console.log("deserializeUser. Input is:", userProfile);
  let userData = {userData: userProfile.id };
  done(null, userData);
});
const mySecret = process.env['ClientID']

