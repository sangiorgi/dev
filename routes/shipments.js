const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {shipmentModel} = require('../public/middle/models');
const { setCred } = require('./parents');

router.post('/', (req, res) => {	
	let post  = req.body;   
    let url = post.resource;
	let user_id = post.user_id;
	post.resource = post.resource.split('/')[2];
	delete post._id;			
	setCred(user_id).then(cred => {		
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);  		
		tObject.get(url).then(resp => {			
			if (resp.status == 200) {
				let ship = resp.data;					
				shipmentModel.updateOne({"id" : ship.id}, ship, {'upsert': true}, async (err,data) => {		
					if (err) {							
						console.log('erro atualizando dados de envios (em shipments): ', ship.id );
					};
					res.end();						
				});
			}
			else {
				console.log('Erro obtendo shipment: ', post.resource );
				res.end();
			};
		});
	}).catch(err => {
		console.log('erro obtendo credenciais');
		console.log(err)
		res.end();
	});
});


module.exports = router;