var meli = require('mercadolibre');
var pool = require('./pool');

/**
 *
 * Creates a new object Tool
 *
 * @constructor
 * @param {string} meli_client_id
 * @param {string} meli_client_secret
 * @param {string} [meli_access_token]
 * @param {string} [meli_refresh_token]
 */

var Tool = function (meli_client_id, meli_client_secret, meli_access_token, meli_refresh_token) {

 /**
     * Save the parameters in a private variable
     */
  var _parameters = {
    client_id: meli_client_id,
    client_secret: meli_client_secret,
    access_token: meli_access_token,
    refresh_token: meli_refresh_token
};


 /**  
    * @param {string} account_id
     *
     * Refresh or return the token and others wirh account name
     */

this.getToken = async (account_id) => {
    return new Promise(function (resolve, reject) {
    var objData = {};
    pool.getConnection((err, connection) => {
        if (!err) {
            var query = connection.format('SELECT * FROM accounts WHERE name = ?', account_id);                
            connection.query(query, function (err, results) {                                          
              connection.release();                  
              if (results.length && (results[0].access_token && results[0].access_token != null && results[0].access_token != 'undefined' && results[0].expires)) {
                  if(new Date().getTime() > results[0].expires){                           
                      var meliObject = new meli.Meli(results[0].appID, results[0].secretID, undefined, results[0].refresh_token);
                      meliObject.refreshAccessToken((err, response) => {
                          if(response) {
                              updateData(response, account_id).then((resp) => {
                                  objData.nickID = results[0].nickID; 
                                  objData.userID = results[0].userID;
                                  objData.appID = results[0].appID;
                                  objData.secretID = results[0].secretID;
                                  objData.token = response.access_token;
                                  objData.refresh_token = response.refresh_token;
                                  objData.email = results[0].email;
                                  resolve(objData);
                              }, (err)=> {                        
                                  reject(err);
                                  console.log(err);
                              });
                          }                   
                          })
                  }
                  else {                            
                      objData.nickID = results[0].nickID; 
                      objData.userID = results[0].userID;
                      objData.appID = results[0].appID;
                      objData.secretID = results[0].secretID;
                      objData.token = results[0].access_token;
                      objData.refresh_token = results[0].refresh_token;
                      objData.email = results[0].email;                        
                      resolve(objData);        
                  }                        
              }                  
            }) 
        }
        else {            
            reject(err);
        }        
    });
});
}

/** 
     * @param {string} name
     *
     * Refresh the token
     */

 this.refreshToken = async (name) => {
  return new Promise(function (resolve, reject) { 
    var meliObject = new meli.Meli(_parameters.client_id, _parameters.client_secret, _parameters.access_token, _parameters.refresh_token);
    meliObject.refreshAccessToken((err, response) => {
          if(response) {
              updateData(response, name).then((results) => {          
                var objData = {};    
                objData.token = response.access_token;
                objData.refresh_token = response.refresh_token;              
                resolve(objData);
              }, (err)=> {                        
                  reject(err);
                  console.log(err);
              });
          }                   
        })
  })
 }


/**  
    * @param {string} user_id
     *
     * Refresh or return the token and others with accound ID
     */

 this.getTokenByID = async (user_id) => {
  return new Promise(function (resolve, reject) {
	  let objData = {};
	  pool.getConnection((err, connection) => {
      if (!err) {
        let query = connection.format('SELECT * FROM accounts WHERE userID = ?', user_id);                
			  connection.query(query, function (err, results) {                       
				  connection.release();                 
          if (results.length && results[0].access_token && results[0].access_token != null && results[0].access_token != 'undefined' && results[0].refresh_token != 'undefined' && results[0].expires) {            
            if(new Date().getTime() > results[0].expires){               
              let meliObject = new meli.Meli(results[0].appID, results[0].secretID, undefined, results[0].refresh_token);
              meliObject.refreshAccessToken((err, response) => {
                if(response) {
                  updateData(response, results[0].name).then((resp) => {
                    objData.nickID = results[0].nickID; 
                    objData.name = results[0].name;
                    objData.userID = results[0].userID;                  
                    objData.appID = results[0].appID;
                    objData.secretID = results[0].secretID;
                    objData.token = response.access_token;
                    objData.refresh_token = response.refresh_token;
                    objData.email = results[0].email;
                    resolve(objData);
                  }, (err)=> {                        
                    reject(err);
                    console.dir('erro ao atualizar token');
                    console.log(err);
                  });
                };                   
              });
            }
            else {                       
              objData.nickID = results[0].nickID;
              objData.name = results[0].name; 
              objData.userID = results[0].userID;                    
              objData.appID = results[0].appID;
              objData.secretID = results[0].secretID;
              objData.token = results[0].access_token;
              objData.refresh_token = results[0].refresh_token;
              objData.email = results[0].email;              
              resolve(objData);        
            }                        
          }
          else {   	
            reject(results[0]);        
          };    	
			  }); 
		  }
		  else {
			  reject(err);
		  }        
	  });
	});
}

/**  
    * @param {string} url
    * @param {string} params
    * Refresh or return the token
    */

this.get = (url, params = undefined) => (
    new Promise((resolve, reject) => {
      var meliObject = new meli.Meli(_parameters.client_id, _parameters.client_secret, _parameters.access_token);  
      meliObject.get(url, params, (err, result) => {
        if (err) {
          reject(err);
        } else {          
          resolve(result);
        }
      });
    })
  );

this.post = (url, body, params = undefined, toUpload) => (    
    new Promise((resolve, reject) => {      
      var meliObject = new meli.Meli(_parameters.client_id, _parameters.client_secret, _parameters.access_token);
      if (toUpload) {
        meliObject.upload(url, body, params, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      }  
      else {
        meliObject.post(url, body, params, (err, result, status) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
    }
    })
  );  

this.put = (url, body, params = undefined) => (
    new Promise((resolve, reject) => {            
      var meliObject = new meli.Meli(_parameters.client_id, _parameters.client_secret, _parameters.access_token);  
      meliObject.put(url, body, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        };
      });
    })
  );  

this.delete = (url, params = undefined) => (
    new Promise((resolve, reject) => {
      var meliObject = new meli.Meli(_parameters.client_id, _parameters.client_secret, _parameters.access_token);  
      meliObject.delete(url, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    })
  );  

var updateData = async (data, account_id) => {
    return new Promise((resolve, reject) =>{
    pool.getConnection(function(err, connection) {
        if (!err) {
            dt = new Date().getTime() + 21600000;
            var qTemp = "UPDATE accounts SET access_token = '" + data.access_token + "',refresh_token = '" + data.refresh_token;
            qTemp +=  "',expires_t = DATE_ADD(now(), INTERVAL 6 HOUR), expires = " + dt + " WHERE name = '" + account_id + "'"; 
            var query = connection.format(qTemp);
            connection.query(query, function (err, results) {
                if(err){			
                    connection.release();
                    reject(err);		 
            }	 else {                    
                    connection.release();
                    resolve('Dados atualizados.')                        
                }
            }) 
        }
        else {
            reject(err);	
            connection.release();
        }
    });   
});
}

}

exports.Tool = Tool;