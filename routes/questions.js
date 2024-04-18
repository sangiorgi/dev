const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {questionModel} = require('../public/middle/models');
const {setCred, getNickName} = require('./parents');

router.post('/', (req, res) => {	
	let post  = req.body; 			
	let url = post.resource;
	let user_id = post.user_id;
	setCred(user_id).then(async cred => {		
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);                     
		tObject.get(url).then( async resp => {								
			if (resp.status == 200) {
				let question = resp.data;				
				let nick = await getNickName(tObject, question.seller_id);
				let buyer = await getNickName(tObject, question.from.id);
				Object.assign(question, {seller_nickname: nick});
				Object.assign(question.from, {buyer_nickname: buyer});
				questionModel.updateOne({"id": question.id}, question, { upsert: true }, async (err, data) => {					
					res.end();
				});
			}
			else {
				console.log('erro obtendo pergunta ', resp.status);
				res.end();
			}
		});
	}).catch(err => {
		console.log('erro obtendo credenciais');
		console.log(err)
		res.end();
	});
});					

module.exports = router;