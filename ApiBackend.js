fs = require('fs');
var sqlite3 = require('sqlite3').verbose();
var pbkdf2 = require('pbkdf2');

// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) 
{
  console.log('Error reading in config file!')
  process.exit();
}


var salt = config.Pasword_Salt;
var secret = config.JSON_Web_Token_Secret;

// SQLite3 functions
var db = new sqlite3.cached.Database(config.Database_Location);

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

Backend.prototype.verifyUser = function(callback, username, password) 
{
  var derivedKey = pbkdf2.pbkdf2Sync(password, salt, 1, 32, 'sha256');
  password = derivedKey.toString('hex');

  var query = db.all("select username, first_name, last_name, is_admin from auth_user where username == ? and password == ?", [username, password], function (err, data) 
  {
    if(err)
    {
      console.log("Error logging in ", username);
      console.log(err);
    }
    callback(data);
  });
}

Backend.prototype.verifyUsername = function(callback, username) 
{
  db.all("select username from auth_user where username == ?", username, function (err, data) 
  {
    if (!data || data[0] === undefined || data[0] === null) 
    {
      callback(false);
    } 
    else 
    {
      callback(true);
    }
  });
}

Backend.prototype.createUser = function(callback, user) 
{
  // Hash password
  var derivedKey = pbkdf2.pbkdf2Sync(user.password, salt, 1, 32, 'sha256');
  password = derivedKey.toString('hex');

  // TODO
  db.run("INSERT OR IGNORE INTO auth_user (username, password, email, first_name, last_name, is_active, is_admin) VALUES (?,?,?,?,?,?,?)", [user.username, password, user.email, user.firstname, user.lastname, user.isActive, user.isAdmin], function (err, data) 
  {
    if (err) 
    {
      console.log(err);
      callback(false);
    } 
    else 
    {
      callback(true);
    }
  });
}

Backend.prototype.getPosts = function(callback, offset) 
{
  if (offset === undefined) 
  {
    offset = 0;
  }

  db.all("select id,title,short,date from blog_post limit 5 offset " + offset, function (err, rows) 
  {
    callback(rows);
  });
};

Backend.prototype.getArticle = function(callback, id) 
{
  //FIX!!
  db.all("select * from blog_post where id == " + id, function (err, rows) 
  {
    callback(rows);
  });
};

Backend.prototype.deleteArticle = function(callback, post) 
{
  //FIX!!
  db.all(`DELETE FROM blog_post
          WHERE id=?`,[post.id], function (err, rows) 
  {
    if(err)
    {
      console.log("There was an error deleting the post ", post);
      console.log(err)
      callback(false);
      return;
    }
    else
    {
      callback(true);
    }
  });
};

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

Backend.prototype.createArticle = function(callback, post)
{
  db.run("INSERT OR IGNORE INTO blog_post (text, short, title, image, status, date, author) VALUES (?,?,?,?,?,?, ?)", [post.text, post.short, post.title, post.image, post.status, post.date, post.author], 
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

Backend.prototype.updateArticle = function(callback, post)
{
  //FIX!!
  db.all("select * from blog_post where id == " + post.id, function (err, rows) 
  {
    let update = rows[0];
    let i;
    let keys = Object.keys(update);
    let keysLength = keys.length;
    for(i=0; i<keysLength; i++)
    {
      if(post[keys[i]])
      {
        update[keys[i]] = post[keys[i]];
      }
    }

    db.run(`UPDATE blog_post
          SET text=?, short=?, title=?, image=?, status=?, date=?
          WHERE id=?`, [update.text, update.short, update.title, update.image, update.status, update.date, update.id], 
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

/* Account Managment */
Backend.prototype.getAccountInformation = function(callback, user)
{
  db.get(`SELECT username, first_name, last_name, email, last_login 
          FROM auth_user 
          WHERE username == ?`, [user.username], function(err, data)
          {
            if(err)
            {
              console.log("There was an error getting the user information requested.");
              console.log(err);
              callback(false);
            }
            else
            {
              callback(data);
            }
          });
}

Backend.prototype.updateAccountInformation = function(callback, user)
{
  db.get(`SELECT first_name, last_name, password 
          FROM auth_user 
          WHERE username == ?`, [user.username], function(err, data)
          {
            if(err)
            {
              console.log("There was an error getting the user information requested.");
              console.log(err);
              callback(false);
            }
            else
            {
              // Hash the password if they provided one
              if(user.password && user.password.length)
              {
                let derivedKey = pbkdf2.pbkdf2Sync(user.password, salt, 1, 32, 'sha256');
                user.password = derivedKey.toString('hex');
              }

              let update = data;
              let i;
              let keys = Object.keys(update);
              let keysLength = keys.length;
              for(i=0; i<keysLength; i++)
              {
                if(user[keys[i]])
                {
                  update[keys[i]] = user[keys[i]];
                }
              }

              // Update the user account
              db.run(`UPDATE auth_user
                      SET first_name=?, last_name=?, password=?`, [update.first_name, update.last_name, update.password], function(err, data)
                      {
                        if(err)
                        {
                          console.log("There was an error updating the user account: ", update);
                          console.log(err);
                          callback(false);
                        }
                        else
                        {
                          callback(true);
                        }
                      });
            }
          });
}

// WARNING: THIS HAS NOT BEEN TESTED!
Backend.prototype.deleteAccount = function(callback, user)
{
  db.all("select username from auth_user where username == ? and password == ?", [user.username, user.password], function(data)
  {
    console.log("Deleting user: ", data[0]);
    db.run(`DELETE FROM auth_user
            WHERE username == ?`, [data[0].username], function(err, data)
            {
              if(err)
              {
                console.log("Error deleting account: ", user);
                console.log(err);
                callback(false);
              }
              else
              {
                callback(true);
              }
            });
  });
  
}

// export the class
module.exports = Backend;