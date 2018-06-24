// express is the server that forms part of the nodejs program
var express = require('express');
var path = require("path");
var app = express();

// adding functionality to allow cross-domain queries when PhoneGap is running a server
app.use(function(req, res, next) {
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
	res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
	next();
});


// adding functionality to log the requests
app.use(function (req, res, next) {
	var filename = path.basename(req.url);
	var extension = path.extname(filename);
	console.log("The file " + filename + " was requested.");
	next();
});


// add an http server to serve files to the Edge browser 
// due to certificate issues it rejects the https files if they are not
// directly called in a typed URL
var http = require('http');
var httpServer = http.createServer(app); 
httpServer.listen(4480);

app.get('/',function (req,res) {
	res.send("hello world from the HTTP server");
});


var fs = require("fs");
//read in the file and force it to be a string by adding "" at the beginning
//var configtext = "" + fs.readFileSync(__dirname+"/postGISConnection.js");
var configtext = "" + fs.readFileSync("E:/Work/GIS/Dissertation/practice/serverside/connection/postGISConnection.js");

//now convert the configuration file into the correct format -i.e. a name/value pair array
var configarray = configtext.split(",");
var config = {};
for (var i = 0; i < configarray.length; i++){
	var split = configarray[i].split(':');
	config[split[0].trim()] = split[1].trim();
}

var pg = require('pg');
var pool = new pg.Pool(config);
app.get('/postgistest',function (req,res){
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+ err);
			res.status(400).send(err);
			return;
		}
		client.query('SELECT name FROM united_kingdom_counties',function(err,result){
			done();
			if(err){
				console.log(err);
				res.status(400).send(err);
				return;
			}
			res.status(200).send(result.rows);
		});
	});
});


app.get('/getPOI', function (req,res) {
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection " + err);
			res.status(400).send(err);
			return;
		}
		// use the inbuilt geoJSON functionality
		// and create the required geoJSON format using a query adapted from here: http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html, access on 02/03/2018
		// note that query needs to be a single string with no line breaks so built it up bit by bit
		
		var querystring = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM ";
		querystring = querystring + "(SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, ";
		querystring = querystring + "row_to_json((SELECT l FROM (SELECT id, name, category) as l )) as properties ";
		querystring = querystring + "FROM united_kingdom_poi as lg limit 100) As F";
		console.log(querystring);
		client.query(querystring,function(err,result){
			//call 'done()' to release the client back to the pool done();
			if(err){
				console.log(err)
				res.status(400).send(err);
				return;
			}
			res.status(200).send(result.rows);
		});
	});
});


//adapted from the practicle codes in the module
//return GeoJSON text of the selected table
app.get('/getGeoJSON/:tablename/:geomcolumn',function(req,res){
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+ err);
			res.status(400).send(err);
			return;
		}
		var colnames = "";
		
		//first get a list of the columns that are in the table
		//use string agg to generate a comma separated list that can then be pasted into the next query
		var querystring = "select string_agg(colname,'\",\"') from (select column_name as colname ";
		querystring = querystring + " FROM information_schema.columns as colname ";
		querystring = querystring + " where table_name ='" + req.params.tablename + "'";
		querystring = querystring + " and column_name <>'" + req.params.geomcolumn +"') as cols ";
		
		console.log(querystring);
		
		//now run the query
		client.query(querystring, function(err,result){
			//call 'done()' to release the client back to the pool
			console.log("trying");
			done();
			if(err){
				console.log(err);
				res.status(400).send(err);
				return;
			}
			for (var i = 0; i < result.rows.length; i++){
				console.log(result.rows[i].string_agg);
			}
			thecolnames = result.rows[0].string_agg;
			colnames = '\"'+thecolnames+'\"';
			console.log("the colnames "+colnames);
			//now use the inbuilt geoJSON functionality and create the required geoJSON format using  a query adapted from here:
			//http://www.postgresonline.com/journal/archives/267-Creating-GeoJSON-Feature-Collections-with-JSON-and-PostGIS-functions.html
			//note that query needs  to be a single string with no line breaks so built it upp bit by bit
			
			var querystring = "select 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM ";
			querystring = querystring + "(select 'Feature' As type, ST_AsGeoJSON(lg." + req.params.geomcolumn + ")::json As geometry, ";
			querystring = querystring + "row_to_json((select l from (select "+colnames+ ") As l )) as properties";
			querystring =querystring + " from \"" + req.params.tablename + "\" as lg order by lg.id) as f  ";
			console.log(querystring);
			//run the second query
			client.query(querystring,function(err,result){
				//call 'done' to release the client back to the pool
				done();
				if(err){
					console.log(err);
					res.status(400).send(err);
					return;
				}
				res.status(200).send(result.rows);
				
			});
		});
	});
});


//adapted from the practicle codes in the module
//get question and answer history of the user by using join query
app.get('/getQuestionANS/:id',function(req,res){
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+ err);
			res.status(400).send(err);
			return;
		}
		
			
		var querystring = "SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM ";
		querystring = querystring + "(SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, ";
		querystring = querystring + "row_to_json((SELECT l FROM (SELECT lg.*, b.accountid, b.truefalse) as l )) as properties ";
		querystring = querystring + "FROM public.question as lg left join";
		querystring = querystring + "(select * from public.user_ans as a where  a.accountid = " + req.params.id + " )as b";
		querystring = querystring + " on lg.id = b.questionid) As F";
		console.log(querystring);
		
		
		client.query(querystring,function(err,result){
			//call 'done' to release the client back to the pool
			done();
			if(err){
				console.log(err);
				res.status(400).send(err);
				return;
			}
			res.status(200).send(result.rows);
				
			
		});
	});
});


//delete recode in the question table
//adapted from the practicle codes in the module
app.get('/deleteRow/:tablename/:id',function(req,res){
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+ err);
			res.status(400).send(err);
			return;
		}
		var colnames = "";
		
		//first get a list of the columns that are in the table
		//use string agg to generate a comma separated list that can then be pasted into the next query
		var querystring = "delete from public." + req.params.tablename + " where id = " + req.params.id;		
		console.log(querystring);
		
		//now run the query
		client.query(querystring,function(err,result){
			done();
			if(err){
				console.log(err)
				res.status(400).send(err);
				return;
			}			
			res.status(200).send("Question Deleted");
			
		});
	});
});



//upload new question
//adapted from the practicle codes in the module
app.post('/uploadQuestion',function(req,res){
	//note that we using POST here as we are uploading data
	//so the parameters form part of the BODY of the requet rather than the RESTful API
	console.dir(req.body);
	
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+err);
			res.status(400).send(err);
			return;
		}
		//pull the geometry component together
		//note that weel known text requires the points as longitude/latitude!
		//well known text should look like: 'POINT(100 13)'
		var geometrystring = "st_geomfromtext('POINT(" + req.body.longitude + " " + req.body.latitude + ")')";
		
		var querystring = "insert into public.question (question,qurl,choice1,choice2,choice3,choice4,choice1url,choice2url,choice3url,choice4url,answer,fullanswer,geom) values ('" +req.body.question+"','"+req.body.qurl +"','"+req.body.choice1 + "','" + req.body.choice2+ "','" + req.body.choice3+ "','" + req.body.choice4 + "','" + req.body.choice1url + "','" + req.body.choice2url + "','" + req.body.choice3url + "','" + req.body.choice4url + "','" + req.body.answer + "','" + req.body.fullanswer + "'," + geometrystring + ")";
		console.log(querystring);
		client.query(querystring,function(err,result){
			done();
			if(err){
				if (err.constraint == "question_geom_unique"){ //alert the unique constraint
					console.log(err.constraint)
					res.status(400).send(err.constraint);
					return
				}
				console.log(err);
				res.status(400).send(err);
				return;
			}
			res.status(200).send("Question inserted");
			
		});
	});
	
});

//edit question from the posted id(primary key)
//adapted from the practicle codes in the module
app.post('/editQuestion',function(req,res){
	//note that we using POST here as we are uploading data
	//so the parameters form part of the BODY of the requet rather than the RESTful API
	console.dir(req.body);
	
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+err);
			res.status(400).send(err);
			return;
		}
		//pull the geometry component together
		//note that weel known text requires the points as longitude/latitude!
		//well known text should look like: 'POINT(100 13)'
		var geometrystring = "st_geomfromtext('POINT(" + req.body.longitude + " " + req.body.latitude + ")')";
		
		var querystring = "update public.question set (question,qurl,choice1,choice2,choice3,choice4,choice1url,choice2url,choice3url,choice4url,answer,fullanswer,geom) = ('" +req.body.question+"','"+req.body.qurl +"','"+req.body.choice1 + "','" + req.body.choice2+ "','" + req.body.choice3+ "','" + req.body.choice4 + "','" + req.body.choice1url + "','" + req.body.choice2url + "','" + req.body.choice3url + "','" + req.body.choice4url + "','" + req.body.answer + "','" + req.body.fullanswer + "'," + geometrystring + ") where id = " + req.body.id;
		console.log(querystring);
		client.query(querystring,function(err,result){
			done();
			if(err){
				if (err.constraint == "question_geom_unique"){
					console.log(err.constraint)
					res.status(400).send(err.constraint);
					return
				}
				console.log(err)
				res.status(400).send(err);
				return;
			}
			
			res.status(200).send("Question Edited");
		});
	});
	// //for now, just echo the request back to the client
	// res.send(req.body);
});



//create Account
//adapted from the practicle codes in the module
app.post('/createAcc',function(req,res){
	//note that we using POST here as we are uploading data
	//so the parameters form part of the BODY of the requet rather than the RESTful API
	console.dir(req.body);
	
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+err);
			res.status(400).send(err);
			return;
		}
		//pull the geometry component together
		//note that weel known text requires the points as longitude/latitude!
		//well known text should look like: 'POINT(100 13)'
		
		var querystring = "insert into public.account_web (username,password) values ('" +req.body.username+"','"+req.body.password +"')";
		console.log(querystring);
		client.query(querystring,function(err,result){
			done();
			if(err){
				if (err.constraint == "account_web_username_unique"){
					console.log(err.constraint)
					res.status(400).send(err.constraint);
					return
				}
				console.log(err)
				res.status(400).send(err);
				return;
			}
			res.status(200).send("Account created");
			
			
			
		});
	});
	// //for now, just echo the request back to the client
	// res.send(req.body);
});


//validate username and password in DB by selecting query
//adapted from the practicle codes in the module
app.post('/validateLogin',function(req,res){
	//note that we using POST here as we are uploading data
	//so the parameters form part of the BODY of the requet rather than the RESTful API
	console.dir(req.body);
	
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+err);
			res.status(400).send(err);
			return;
		}
		
		
		var querystring = "select id, username from public.account_web where username = '" +req.body.username+"' and password = '"+req.body.password +"'";
		console.log(querystring);
		client.query(querystring,function(err,result){
			done();
			if(err){
				console.log(err)
				res.status(400).send(err);
				return;
			}
			if (result.rows.length == 1){ //length 1 mean there is an account that have compatible username and password
				res.status(200).send(result.rows[0]["id"]+"||"+result.rows[0]["username"]);
				console.log(result.rows[0]["id"]+"||"+result.rows[0]["username"]);
			}else{
				res.status(200).send("invalid login"); // report invalid login
			}
			
			
			
			
			
		});
	});
	
});


//Record User Answers of the qustion
app.post('/postAns',function(req,res){
	//note that we using POST here as we are uploading data
	//so the parameters form part of the BODY of the requet rather than the RESTful API
	console.dir(req.body);
	
	pool.connect(function(err,client,done){
		if(err){
			console.log("not able to get connection "+err);
			res.status(400).send(err);
			return;
		}
		
		var querystring = "insert into public.user_ans (accountid,questionid,userans,truefalse) values (" +req.body.accountid+","+req.body.questionid +",'" + req.body.userans +"',"+req.body.truefalse +")";
		console.log(querystring);
		client.query(querystring,function(err,result){
			done();
			if(err){
				console.log(err)
				res.status(400).send(err);
				return;
			}
			res.status(200).send("Answer recorded");
			
			
			
		});
	});
	// //for now, just echo the request back to the client
	// res.send(req.body);
});


	
			

	// the / indicates the path that you type into the server - in this case, what happens when you type in:  http://developer.cege.ucl.ac.uk:32560/xxxxx/xxxxx
  app.get('/:name1', function (req, res) {
  // run some server-side code
  // the console is the command line of your server - you will see the console.log values in the terminal window
  console.log('request '+req.params.name1);

  // the res is the response that the server sends back to the browser - you will see this text in your browser window
  res.sendFile(__dirname + '/'+req.params.name1);
});


  // the / indicates the path that you type into the server - in this case, what happens when you type in:  http://developer.cege.ucl.ac.uk:32560/xxxxx/xxxxx
  app.get('/:name1/:name2', function (req, res) {
  // run some server-side code
  // the console is the command line of your server - you will see the console.log values in the terminal window
  console.log('request '+req.params.name1+"/"+req.params.name2);

  // the res is the response that the server sends back to the browser - you will see this text in your browser window
  res.sendFile(__dirname + '/'+req.params.name1+'/'+req.params.name2);
});


	// the / indicates the path that you type into the server - in this case, what happens when you type in:  http://developer.cege.ucl.ac.uk:32560/xxxxx/xxxxx/xxxx
	app.get('/:name1/:name2/:name3', function (req, res) {
		// run some server-side code
		// the console is the command line of your server - you will see the console.log values in the terminal window
		console.log('request '+req.params.name1+"/"+req.params.name2+"/"+req.params.name3); 
		// send the response
		res.sendFile(__dirname + '/'+req.params.name1+'/'+req.params.name2+ '/'+req.params.name3);
	});
  // the / indicates the path that you type into the server - in this case, what happens when you type in:  http://developer.cege.ucl.ac.uk:32560/xxxxx/xxxxx/xxxx
  app.get('/:name1/:name2/:name3/:name4', function (req, res) {
  // run some server-side code
  // the console is the command line of your server - you will see the console.log values in the terminal window
 console.log('request '+req.params.name1+"/"+req.params.name2+"/"+req.params.name3+"/"+req.params.name4); 
  // send the response
  res.sendFile(__dirname + '/'+req.params.name1+'/'+req.params.name2+ '/'+req.params.name3+"/"+req.params.name4);
});

