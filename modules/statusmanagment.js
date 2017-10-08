var db;

function StatusManagment(serverDb)
{
  db = serverDb;
  console.log('Status Managment backend started');
}


StatusManagment.prototype.getStatuses = function(callback, offset) 
{
  if (offset === undefined) 
  {
    offset = 0;
  }
  // FIX
  db.all("select * from status_updates limit 5 offset " + offset, function (err, rows) 
  {
    console.log(rows);
    callback(rows);
  });
};

StatusManagment.prototype.getStatus = function(callback, id) 
{
  //FIX!!
  db.all("select * from status_updates where id == " + id, function (err, rows) 
  {
    callback(rows);
  });
};

StatusManagment.prototype.deleteStatus = function(callback, status) 
{
  db.all(`DELETE FROM status_updates
          WHERE id=?`,[status.id], function (err, rows) 
  {
    if(err)
    {
      console.log("There was an error deleting the status ", status);
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


StatusManagment.prototype.createStatus = function(callback, status)
{
  console.log(status);
  db.run("INSERT OR IGNORE INTO status_updates (text, image_url, date, author) VALUES (?,?,?,?)", [status.text, status.image_url, status.date, status.author], 
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

StatusManagment.prototype.updateStatus = function(callback, status)
{
  //FIX!!
  db.all("select * from status_updates where id == " + status.id, function (err, rows) 
  {
    let update = rows[0];
    let i;
    let keys = Object.keys(update);
    let keysLength = keys.length;
    for(i=0; i<keysLength; i++)
    {
      if(status[keys[i]])
      {
        update[keys[i]] = status[keys[i]];
      }
    }

    db.run(`UPDATE status_updates
          SET text=?, image_url=?, date=?
          WHERE id=?`, [update.text, update.image_url, update.date, update.id], 
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
module.exports = StatusManagment;