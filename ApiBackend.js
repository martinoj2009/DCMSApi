fs = require('fs');
var sqlite3 = require('sqlite3');
var pbkdf2 = require('pbkdf2');


// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) 
{
  console.log('Error reading in config file!')
  process.exit();
}

/* Configure Password Settings */
var salt = config.Pasword_Salt;
var secret = config.JSON_Web_Token_Secret;

// SQLite3 functions
var db = new sqlite3.cached.Database(config.Database_Location);

/* Locad modules */
var authentication = new (require('./modules/accountmanagment.js'))(salt, secret, db);
var articlemanagment = new (require('./modules/articlemanagment.js'))(db);
var statusmanagment = new (require('./modules/statusmanagment.js'))(db);


function Backend()
{
  console.log('Backend Started');
}

// Functions
Backend.prototype.startupCheck = function()
{
  // Setup needed security
  if (config.Pasword_Salt === undefined || config.JSON_Web_Token_Secret === undefined || config.Password_Min_Length === undefined) 
  {
    console.log('Whoa! security needs to be setup. Check to make sure you have sale and secret setup')
    process.exit();
  }
}

/* Authentication */
Backend.prototype.verifyUser = authentication.verifyUser;
Backend.prototype.verifyUsername = authentication.verifyUsername;
Backend.prototype.createUser = authentication.createUser;
Backend.prototype.getAccountInformation = authentication.getAccountInformation;
Backend.prototype.updateAccountInformation = authentication.updateAccountInformation;

// WARNING: THIS HAS NOT BEEN TESTED!
Backend.prototype.deleteAccount = authentication.deleteAccount;

/* Article Managment */
Backend.prototype.createArticle = articlemanagment.createArticle;
Backend.prototype.getPosts = articlemanagment.getArticles;
Backend.prototype.getArticle = articlemanagment.getArticle;
Backend.prototype.updateArticle = articlemanagment.updateArticle;
Backend.prototype.deleteArticle = articlemanagment.deleteArticle;

/* Status Managment */
Backend.prototype.getStatuses = statusmanagment.getStatuses;
Backend.prototype.getStatus = statusmanagment.getStatus;
Backend.prototype.deleteStatus = statusmanagment.deleteStatus;
Backend.prototype.createStatus = statusmanagment.createStatus;
Backend.prototype.updateStatus = statusmanagment.updateStatus;

/* Site Alerts */

Backend.prototype.getAlerts = function(callback) 
{
  //This function is for getting any alerts that should be posted to the page
  db.all("select * from alerts limit 1", function (err, rows) 
  {
    if (err) 
    {
      callback(undefined);
      return;
    }
    callback(rows);
  });
}

Backend.prototype.setAlert = function(callback, alert)
{
  // Clear the table and set the new alert, this is bad. Will do better way later ;-)
  db.run("DELETE FROM alerts", function(err, data)
  {
    if(err)
    {
      console.log("Error clearing alerts!");
      console.log(err);
      callback(false);
      return;
    }
    db.run("INSERT OR IGNORE INTO alerts (title, message) VALUES (?,?)", [alert.title, alert.message], 
    function(err, data)
    {
      var result;
      if(err)
      {
        console.log(err);
        result = false;
      }
      else
      {
        result = true;
      }
      callback(result);
    });
  });
}




// export the class
module.exports = Backend;