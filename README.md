# DCMS - API
DCMS stands for Decoupled Content Management System, this is a change from the traditional monolithic content management systems in that the back-end and the front-end are decoupled from each other. The client accesses a web server that serves them a web application which talks to an open API. The web application runs on the client in a stateless manner, unless authentication is needed, then a web token is used, all cookie data sent to the server is ignored, only the web token set in the header is read. This allows the back-end and front-end to be developed at their own rate as long as functionality is maintained, this also allows extendability (i.e. mobile application), without needing to write new code. 

The purpose of this new CMS platform is to make a new CMS platform in NodeJS with an API decoupled from the web application. You can have a server with very minimal specs (512MB RAM, 1 core CPU) and distribute the work load to the clients. The client accesses the website and starts the web application, the web application contacts the API back-end for rendering the page client-side. All of these phones and desktops have a lot of computing power, why stress the server when the client can do the work, to within reason. Majority of the state is handled in the API, so there's still some work that needs to be done on the server.

This repository will maintain the API, development of the API should not interfere with development of the web application or mobile application (if one chooses to have a mobile application). The API is responsible for accepting CRUD, accessing a database if needed then returning the results. The API will also maintain session information, with that comes user authentication.

config.json:
The server needs a config.json to configure the API on startup. You need to make a file that looks like this
{
"comment": "This is the config file for the API server.",
"Database_Location": "blog.sqlite3",
"Pasword_Salt": "PASSWORD SALT STRING",
"JSON_Web_Token_Secret": "SECRET STRING",
"Server_Name": "NAME OF BLOG API"
"Password_Min_Length": 7
}


