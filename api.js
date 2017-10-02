/*
DCMS - API
Author: Martino Jones
20170601
This is the API for the blog. This API should never serve HTML/CSS/IMAGE/MULTIMEDIA, it's job is to access a DB
when needed and serve JSON data. This API also controls the state of the application, the web application should be 
stateless. 
*/

// Get the needed NPM packages
var restify = require('restify'),
fs = require('fs');
var jwt = require('jsonwebtoken');

// Custom code
var ApiBackend = require('./ApiBackend.js');
var Backend = new ApiBackend();


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


// Configure restify server
var server = restify.createServer({
	name: config.Server_Name,
});
server.use(restify.bodyParser());

// Rate limit some config, only applies when you specify
// Global ratelimit
server.use(restify.throttle({burst:100,rate:50,ip:true}));
var rateLimitStrict = restify.throttle({burst:1,rate:1,ip:true});
var rateLimitLight = restify.throttle({burst:100,rate:50,ip:true});


// APIs
server.get('/api/ping', function (req, res, next) 
{
	var token = req.headers['x-access-token'];
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				res.send(200, {success: true, loggedIn: false});
				return;
			} 
			else 
			{
				// Ping with username
				req.decoded = decoded;
				res.send(200, {success: true, loggedIn: true, user: decoded.user});
				return;
			}
		});
	}
	else
	{
		res.send(200, {success: true, loggedIn: false});
		return;
	}

});


// This is for getting pages of articles with offset
server.get(/api\/articles\/(\d+)/, function (req, res, next) 
{
	if (req.params[0] > 1000) 
	{
		res.send(200, {success: false, "message": "Page request too big."});
		return;
	}
	
	try 
	{
		var offset = parseInt(req.params[0]);
	} 
	catch (e) 
	{
		console.log("Error parsing offset!");
		res.send(200, {success: false, message: "I can\'t seem to read your offset"});
		return;
	}
	
	if (offset < 0) 
	{
		res.send(200, {success: false, message: "Can\'t find what you\'re looking for!"});
		return;
	} 
	else if (offset === 1) 
	{
		offset = 0;
	} 
	else 
	{
		offset = offset * 5 - 5;
	}
	
	Backend.getPosts(function (posts) 
	{
		if (!posts || !posts) 
		{
			res.send(200, {success: false, message: "Articles not found"});
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.send(200, posts);
	}, offset);

});

server.get('/api/alert', function (req, res, next) 
{
	Backend.getAlerts(function (message) 
	{
		if (message === "" || !message) 
		{
			res.setHeader('Content-Type', 'application/json');
			res.send(200, {success: true, message: null});
			return;
		} 
		else 
		{
			res.setHeader('Content-Type', 'application/json');
			message[0].success = true;
			res.send(200, message[0]);
			return;
		}
	});
	
});

server.post('/api/alert/update', function(req, res, next)
{
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{	
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to post articles: ", decoded);
					return;
				}

				if (!req.body) 
				{
					res.send(200, {success: false, message: "Please provide alert_title and alert_message in body."});
					console.log(req.body);
					return;
				}

				let newAlert = {}
				newAlert.title = req.body.alert_title;
				newAlert.message = req.body.alert_message;

				// Make sure they provided data
				if(!newAlert.title || !newAlert.message)
				{
					res.send(200, {success: false, message: "Please provide alert_title and alert_message in body."});
					return;
				}

				console.log(newAlert);

				Backend.setAlert(function(status)
				{
					if(status)
					{
						res.send(200, {success: true, message: "Alert set"});
						return;
					}
					else
					{
						res.send(200, {success: false, message: "Alert not set"});
					}
				}, newAlert);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
	}
});

// Authentication and registration
server.post('/api/login', function (req, res, next) 
{
	var username = req.headers.username;
	var password = req.headers.password;
	
	if (!username || !password) 
	{
		res.send(200, {success: false, message: "Invalid login!"});
		return;
	}
	
	// Get the user
	Backend.verifyUser(function (user) 
	{
		if (!user || !user[0]) 
		{
			res.send(200, {success: false, message: "Invalid login!"});
			return;
		}
		
		// Valid user!
		let userObject = {
			user: user[0].username,
			isAdmin: user[0].is_admin,
			firstname: user[0].first_name,
			lastname: user[0].last_name
		}
		console.log("User logged in: ", userObject);
		
		jwt.sign(userObject, secret, { expiresIn: config.Session_Timeout }, function (err, token) 
		{
			if (err) 
			{
				console.log(err);
				res.json({
					success: false,
					message: 'Failed to sign web token'
				});
				return;
			} 
			else 
			{
				res.json({
					success: true,
					message: 'Enjoy your token!',
					token: token
				});
				return;
			}
			
		});
	}, username, password);
	
});

server.post('/api/register', function (req, res, next) 
{
	//First make sure the username doesn't exist and then make the user
	// Make sure needed information is provided
	
	var userRegistrationData = {};
	userRegistrationData.firstname = req.body.firstname;
	userRegistrationData.lastname = req.body.lastname;
	userRegistrationData.email = req.body.email;
	userRegistrationData.username = req.body.username;
	userRegistrationData.password = req.body.password;
	userRegistrationData.isActive = true;
	userRegistrationData.isAdmin = false;
	
	// Verify provided information
	// Check null || empty
	if (!userRegistrationData.firstname || !userRegistrationData.lastname ||
		!userRegistrationData.email || !userRegistrationData.username ||
		!userRegistrationData.password) 
	{
		console.log("INVALID: %o", userRegistrationData);
		res.send(200, {success: false, message: 'Invalid data, make sure all data is provided.'});
		return;
	} 
	else 
	{
		// Verify email format
		var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
		if (reg.test(userRegistrationData.email) == false) 
		{
			res.send(200, {success: false, message: 'Invalid email format!'});
			return;
		}
		
		// Make sure password is at least Password_Min_Length
		if (userRegistrationData.password === undefined || userRegistrationData.password.length < config.Password_Min_Length) 
		{
			res.send(200, {success: false, message: 'Password does not meet the min complexity'});
			return;
		}

		console.log("Registering: " + userRegistrationData.username);
		
		// Make sure the user doesn't exist
		Backend.verifyUsername(function (exists) 
		{
			if (exists === false) 
			{
				// Register user
				Backend.createUser(function (confirm) 
				{
					if (confirm) 
					{
						res.send(200, {success: true, message: 'Registration succeeded.'});
						return;
					} 
					else 
					{
						res.send(200, {success: false, message: 'Registration failed.'});
						return;
					}
				}, userRegistrationData)
			} 
			else 
			{
				res.send(200, {success: false, message: 'Username already exists.'});
				return;
			}
		}, userRegistrationData.username)
	}
});
	
server.get(/api\/article\/(\d+)/, function (req, res, next) 
{
	var id = req.params[0];
	Backend.getArticle(function (post) 
	{
		if (!post || !post[0]) 
		{
			res.send(200, {success: false, message: "Article not found"});
			return;
		}
		post[0].success = true;
		res.setHeader('Content-Type', 'application/json');
		res.send(200, post[0])
	}, id);
});
	
/*
This section is for authenticated requests ONLY! Always check for tokens!
*/
server.post('/api/article/post', function (req, res, next) 
{
	// UNDER DEVELOPMENT
	// This function is for posting articles, NOT updating
	
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) 
				{
					res.send(200, {success: false, message: "Invalid post format!"});
					console.log(req.body);
					return;
				}

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to post articles: ", decoded);
					return;
				}

				// Make the post
				var post = {};
				post.title = req.body.post_title;
				post.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
				post.text = req.body.post_text;
				post.image = req.body.post_image;
				post.short = req.body.post_short;
				post.status = req.body.post_status;
				post.author = decoded.user;

				console.log("Creating post: " + post.title);

				// Make sure status is set, default to 1 for published
				if(!post.status)
				{
					post.status = 1;
				}
				
				// Check requirements
				if (!post.title || !post.date) 
					{
					console.log('Error making post!', post);
					res.send(200, {success: false, message: "I was not able to make a post with the data provided!"});
					return;
				}
				
				Backend.createArticle(function(result)
				{
					if(result)
						{
						res.send(200, {success: true, message: "Posted"});
						return;
					}
					else
						{
						res.send(200, {success: false, message: "Was not able to post"});
						return;
					}
				}, post);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
	
});

server.post('/api/article/delete', function(req, res, next)
{
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) 
				{
					res.send(200, {success: false, message: "Invalid post format!"});
					console.log(req.body);
					return;
				}

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to post articles: ", decoded);
					return;
				}

				// Make the post
				var post = {};
				post.id = req.body.post_id;
				Backend.deleteArticle(function(status)
				{
					if(status)
					{
						res.send(200, {success: true, message: "Post deleted."});
						return;
					}
					else
					{
						res.send(200, {success: false, message: "Could not delete post."});
						return;
					}
				}, post)
				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});
	
server.post('/api/article/update', function (req, res, next) 
{	
	// Make sure they have a valid token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) 
				{
					res.send(200, {success: false, message: "Invalid post format!"});
					console.log(req.body);
					return;
				}

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to post articles: ", decoded);
					return;
				}
				
				// Make the post
				var post = {};
				post.title = req.body.post_title;
				post.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
				post.text = req.body.post_text;
				post.image = req.body.post_image;
				post.short = req.body.post_short;
				post.status = req.body.post_status;
				post.id = req.body.post_id;
				
				// Check requirements
				if (!post.id) 
				{
					res.send(200, {success: false, message: "I was not able to update a post with the data provided!"});
					return;
				}
				
				Backend.updateArticle(function(result)
				{
					if(result)
					{
						res.send(200, {success: true, message: "Updated"});
						return;
					}
					else
					{
						res.send(200, {success: false, message: "Was not able update post"});
						return;
					}
				}, post);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
	
});
	
server.post('/api/upload', function(req, res, next)
{
	res.send(200, {success: false, message: "Feature not ready."});
	return;
	console.log(arguments.formatters); // no files in any request properties
	req.on('file', function() 
	{ // "end" doesn't work either, callback never called
		console.log(arguments);
	});

});

server.listen(config.Server_Port);
console.log("Server started for %s on port %s", config.Server_Name, config.Server_Port);
