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
var salt = config.salt;
var secret = config.secret;


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
server.post('/ping', function create(req, res, next) {
   res.send(200, Math.random().toString(36).substr(3, 8));
   return next();
 });


server.get('/api/ping', function (req, res, next) {
	res.send(200,'Okay');
	console.log('Done');
});

// To be removed!
server.get('/api/articles', function (req, res, next)
{
	getPosts(function(posts)
	{
		res.send(200, posts);
		console.log(posts);
	});

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
		res.send(200, posts);
		console.log(posts);
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
		res.send(200, post)
	}, id);	

});

server.listen(8080);
console.log("Server started for " + config.Server_Name);
