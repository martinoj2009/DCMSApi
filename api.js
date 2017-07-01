/*
Martino Jones
20170601
This is the API for the blog. This API should never serve HTML/CSS/IMAGE/MULTIMEDIA, it's job is to access a DB
when needed and serve JSON data. This API also controls the state of the application, the web application should be 
stateless. 
*/

// Get the needed NPM packages
var restify = require('restify'),
fs = require('fs');
var sqlite3 = require('sqlite3');
var jwt    = require('jsonwebtoken');
var pbkdf2 = require('pbkdf2')

// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if(!config)
{
	console.log('Error reading in config file!')
	process.exit();
}

// Setup needed security
if(config.Pasword_Salt === undefined || config.JSON_Web_Token_Secret === undefined)
{
	console.log('Whoa! security needs to be setup. Check to make sure you have sale and secret setup')
	process.exit();
}
var salt = config.Pasword_Salt;
var secret = config.JSON_Web_Token_Secret;


// Configure restify server
var server = restify.createServer(
{
	name: config.Server_Name,
});


// SQLite3 functions
var db = new sqlite3.cached.Database(config.Database_Location);

// Functions
function verifyUser(callback, username, password)
{
	var derivedKey = pbkdf2.pbkdf2Sync(password, salt, 1, 32, 'sha256');
	password = derivedKey.toString('hex')
	var query = db.all("select username from auth_user where username == ? and password == ?", [username, password], function(err, data)
	{
		console.log(data);
		callback(data);
	});

}

function getPosts(callback, offset)
{
	if(offset === undefined)
	{
		offset = 0;
	}

	db.all("select id,post_title,post_short from blog_status limit 5 offset " + offset,function(err,rows){
		callback(rows);	
	})
};

function getArticle(callback, id)
{
	db.all("select * from blog_status where id == " + id,function(err,rows){
	callback(rows);
	})
};

function getAlerts(callback)
{
	//This function is for getting any alerts that should be posted to the page
	db.all("select * from alerts limit 1", function(err, rows)
	{
		if(err)
		{
			callback(undefined);
			return;
		}
		callback(rows);
	})
}


// APIs
server.get('/api/ping', function (req, res, next) {
	res.send(200,'Okay');
});


// This is for getting pages of articles with offset
server.get(/api\/articles\/(\d+)/, function (req, res, next)
{
	if(req.params[0] > 1000)
	{
		console.log("Page request bigger than limit! ");
		res.send(404, "Can\'t find what you\'re looking for!");
	}

	try
	{
		var offset = parseInt(req.params[0]);
	}
	catch(e)
	{
		console.log("Error parsing offset!");
		res.send(404, "I can\'t seem to read your offset");
	}

	if(offset < 0)
	{
		res.send(404, "Can\'t find what you\'re looking for!");
	}
	else if(offset === 1)
	{
		offset = 0;
	}
	else
	{
		offset = offset * 5 - 5;
	}
	

	getPosts(function(posts)
	{
		if(posts === undefined || posts === null)
		{
			res.send(404, "Articles not found");
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.send(200, posts);
	}, offset);

});

server.get('/api/alerts', function(req, res, next) 
{

	getAlerts(function(message)
	{
		console.log("Message: " + message);
		if(message == "" || message === undefined || message === null)
		{
			res.setHeader('Content-Type', 'application/json');
			res.send(200, '{message: null}');
			return;
		}
		else
		{
			res.setHeader('Content-Type', 'application/json');
			res.send(200, message);
			return;
		}
	});

});

server.post('/api/login', function(req, res, next)
{
	var username = req.headers.username;
	var password = req.headers.password;
	if(!username || !password)
	{
		res.send(401, "Invalid login!");
		return;
	}

	// Get the user
	verifyUser(function(user)
	{
		if(!user)
		{
			res.send(401, "Invalid login!");
			return;
		}

		// Valid user!
		console.log("User logged in: " + user[0]);

		jwt.sign(username, secret, function(err, token){
			res.json({
          success: true,
          message: 'Enjoy your token!',
          token: token
        });
			console.log(token);
        });

        


	}, username, password);

});

server.get(/api\/article\/(\d+)/, function (req,res,next)
{
	var id = req.params[0];
	getArticle(function(post)
	{
		if(post === undefined || post === null)
		{
			res.send(404, "Article not found");
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.send(200, post)
	}, id);	

});

server.listen(8080);
console.log("Server started for " + config.Server_Name);
