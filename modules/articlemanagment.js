var db;

function ArticleManagment(serverDb)
{
  db = serverDb;
  console.log('Article Managment backend started');
}


ArticleManagment.prototype.getArticles = function(callback, offset) 
{
  if (!offset) 
  {
    offset = 0;
  }

  db.all("select id,title,short,date,author from blog_post limit 5 offset " + offset, function (err, rows) 
  {
    callback(rows);
  });
};

ArticleManagment.prototype.getArticle = function(callback, id) 
{
  db.get(`SELECT *
          FROM blog_post 
          WHERE id == ?`, [id], function (err, rows) 
  {
    callback(rows);
  });
};

ArticleManagment.prototype.deleteArticle = function(callback, post) 
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



ArticleManagment.prototype.createArticle = function(callback, post)
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

ArticleManagment.prototype.updateArticle = function(callback, post)
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

// export the class
module.exports = ArticleManagment;