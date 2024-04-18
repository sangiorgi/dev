const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {claimModel} = require('../public/middle/models');
const {setCred} = require('./parents');
const arrAccountID = [82307807,371764921,84454171,225763835,216512394,580414888,85197255];

router.post('/', (req, res) => {	
	let post  = req.body;   
    let url = post.resource;
	let user_id = post.user_id;
	setCred(user_id).then(cred => {
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);  		
		tObject.get(url).then(resp => {			
			if (resp.status == 200) {				
				let claim = resp.data, found = claim.players.some(a => {return (a.type === 'seller' || a.type === 'sender') && arrAccountID.includes(a.user_id)});
				console.log(found)
				if (found) {
					let urlReason = `/post-purchase/sites/MLB/v2/reasons/${claim.reason_id}?attributes=id,parent_id,detail`;						
					tObject.get(urlReason).then(async resp => {
						if (resp.status == 200) {
							let objTemp = {'reasons': {'reason_id': resp.data.id, 'reason_detail': resp.data.detail, 'reason_main': '', 'reason_parent': resp.data.parent_id}}, urlTemp;						
							if (resp.data.parent_id) { 
								let parent = await tObject.get(`/post-purchase/sites/MLB/v2/reasons/${resp.data.parent_id}?attributes=id,parent_id,detail`);
								if (parent.status == 200) {
									objTemp.reasons.reason_main = parent.data.detail;
								};
							};						
							Object.assign(claim, objTemp);						
							if (claim.resource === 'order') {urlTemp = `/orders/${claim.resource_id}`;}
							else if (claim.resource === 'shipment') {urlTemp = `/shipments/${claim.resource_id}`;};						
							tObject.get(urlTemp).then(resp => {															
								if (resp.status == 200) {
									if (claim.resource === 'order') {
										Object.assign(claim, {'order_details': resp.data});										
										if (resp.data.shipping.id) {
											urlTemp = `/shipments/${resp.data.shipping.id}`
										}
										else {
											console.log(resp.data.shipping.id)
											Object.assign(claim, {'shipment': {'id:': null}});
											claimModel.updateOne({'id': claim.id}, {'$set': claim}, {'upsert': true}, async (err,data) => {		
												if (err) {																			
													console.log('erro atualizando reclamação:', claim.id);																		
												};												
											});
											res.end();	
											return false;					
										};
									}
									else if (claim.resource === 'shipment') {
										Object.assign(claim, {'shipment': resp.data});
										urlTemp = `/orders/${resp.data.order_id}`
									};																					
									tObject.get(urlTemp).then(resp => {															
										console.log(urlTemp)	
										console.log(claim.resource)																			
										if (resp.status == 200) {										
											if (claim.resource === 'order') {Object.assign(claim, {'shipment': resp.data});}
											else if (claim.resource === 'shipment') {Object.assign(claim, {'order_details': resp.data});};						
											claimModel.updateOne({'id': claim.id}, {'$set': claim}, {'upsert': true}, async (err,data) => {		
												if (err) {																			
													console.log('erro atualizando reclamação:', claim.id);																		
												};
												res.end();						
											});
										}
										else {
											console.log('erro atualizando recursos da reclamação', claim.id);						
											res.end();						
										};
									});	
								}
								else {								
									console.log('erro atualizando recurso da reclamação', claim.id);						
									res.end();						
								};
							});						
						}
						else {
							console.log('erro obtendo razão secundária em reclamação: ', claim );						
							res.end();						
						};
					});
				}
				else {
					console.log('reclamação %d fora do escopo de contas', claim.id);
					res.end();
				};				
			}
			else {
				console.log('erro obtendo reclamação: ', resp.status );
				console.log(err);
				res.end();
			};			
		});		
	}).catch(err => {
		console.dir('erro ao atualizar credenciais e token');
		console.log(err);
		res.end();
	});		
});

module.exports = router;