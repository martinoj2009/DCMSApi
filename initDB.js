// This is for setting up the database

var sqlite3 = require('sqlite3');
	fs = require('fs');

// Pull the config
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) {
	console.log('Error reading in config file!')
	process.exit();
}

var db = new sqlite3.cached.Database(config.Database_Location);
// Make the user table
db.run('CREATE TABLE IF NOT EXISTS "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_admin" bool NOT NULL, "first_name" varchar(30) NOT NULL, "last_name" varchar(30) NOT NULL, "email" varchar(254) NOT NULL, "is_active" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE)');

// Make the articles table
