const express = require('express');
const router = express.Router();
const pool = require('../public/middle/pool');

router.get('/', (req, res) => {
	if (!req || !req.query.id) {
		return res.status(500).json({ err: 'Dados informados insuficientes' });
	};	
	let account = req.query.id;
	getResults(account, (err, resp) => {				
		if(err) { return res.status(500).json({err: err});  }
		else { return res.status(201).json({ resultData: resp }); };
	});	
});

router.post('/', (req, res) => {
	if (!req || !req.query.id) {
		return res.status(500).json({ err: 'Dados informados insuficientes' });
	};	
	let sqlData  = req.body, account = req.query.id;
	updateData(sqlData, account, (err, resp) => {
		if(err) { return res.status(500).json({err: err});  }
		else { return res.status(201).json({ resultData: resp }); };
	});	
});

const updateData = (data, account, cb) => {
    pool.getConnection((err, connection) => {
        if (!err) {            
			let qs = `UPDATE accounts SET access_token='${data.access_token}',refresh_token='${data.refresh_token}', expires_t=STR_TO_DATE('${data.expires_t}', '%Y-%m-%d %H:%i:%s'), expires=${data.expires} WHERE name = '${account}'`;
            let query = connection.format(qs);
            connection.query(query, (err, results) => {
				connection.release();
                if(err) { cb(err,null); }
                else { cb(null,results); };
            }); 
        }
        else { cb(err,null); };
    });   
};

const getResults = (account, cb) => {
    pool.getConnection((err, connection) => {
        if (!err) {            
			let query = connection.format('SELECT * FROM accounts WHERE name = ?', account);
            connection.query(query, (err, results) => {
				connection.release();
                if(err) { cb(err,null); }
                else { cb(null,results); };
            }); 
        }
        else { cb(err,null); };
    });   
};

module.exports = router;