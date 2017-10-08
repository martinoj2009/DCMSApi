var database = require('./database.js');
var sqlite3 = require('sqlite3');
var pbkdf2 = require('pbkdf2');


var salt;
var secret;
var db;


function AccountManagment(serverSalt, serverSecret, serverDb)
{
	salt = serverSalt;
	secret = serverSecret;
	db = serverDb;

  console.log('Account Managment backend started');
}



AccountManagment.prototype.verifyUser = function(callback, user) 
{
  var derivedKey = pbkdf2.pbkdf2Sync(user.password, salt, 1, 32, 'sha256');
  user.password = derivedKey.toString('hex');
  var query = db.all("select username, first_name, last_name, is_admin from auth_user where username == ? and password == ?", [user.username, user.password], function (err, data) 
  {
    if(err)
    {
      console.log("Error logging in ", user);
      console.log(err);
      callback(false);
    }
    else
    {
      console.log(data);
      callback(data);
    }
    
  });
}


AccountManagment.prototype.verifyUsername = function(callback, username) 
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

AccountManagment.prototype.createUser = function(callback, user) 
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

AccountManagment.prototype.getAccountInformation = function(callback, user)
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

AccountManagment.prototype.updateAccountInformation = function(callback, user)
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
AccountManagment.prototype.deleteAccount = function(callback, user)
{
  console.log(user);
  db.get("select username from auth_user where username == ? and password == ?", [user.username, user.password], 
    function(data)
  {
    if(!data)
    {
      callback(false);
      return;
    }
    
    db.run(`DELETE FROM auth_user
            WHERE username == ?`, [data.username], function(err, data)
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
module.exports = AccountManagment;