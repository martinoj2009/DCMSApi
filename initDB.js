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
db.run('CREATE TABLE IF NOT EXISTS "blog_post" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "text" text, "short" varchar(120), "title" varchar(140) NOT NULL, "image" varchar(2083), "status" varchar(1) NOT NULL DEFAULT 0, "date" datetime NOT NULL, "author" varchar(140) NOT NULL)');

// Make the status table
db.run('CREATE TABLE IF NOT EXISTS "status_updates" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "text" text, "image_url" varchar(2083), "date" datetime NOT NULL, "author" varchar(140) NOT NULL)');

// Make alerts table
db.run('CREATE TABLE IF NOT EXISTS alerts(title STRING PRIMARY KEY, message STRING)');