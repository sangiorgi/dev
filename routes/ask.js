const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {ordersModel,  ml_itemModel, fiscalModel, codeModel} = require('../public/middle/models');
const {setCred, setMongoDBShipments, setMongoDBItems, setMongoDBClient, getNickName} = require('./parents');
const {translateInverseAccount,doCode,doAddVars,doVarsUpdate,doColorsUpdate,addSufixColors,doCheckSizes,doCheckDataMl,doCheckDupsMLBs} = require('./items');
const arrTranslateNoFiscal = ['AMALIA-SAN', 'SAN-MAG', 'KMARSS'];
let respData = {}; //must remains as variable

router.post('/orders', (req, res) => {	
	let post  = req.body;     			
	let url = post.resource;
	let user_id = post.user_id;
	setCred(user_id).then(async cred => {			
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);                     
		tObject.get(url).then( async resp => {
			if (resp.status == 200) {				
				let buyer = resp.data.buyer;						
				setMongoDBOrders(cred.name, tObject, resp.data).then(async (resp) => {											
					if (resp && resp.ship_id) {
						let urlShip = `shipments/${resp.ship_id}`;
						tObject.get(urlShip).then(respShip => {	
							if (respShip) {
								setMongoDBShipments(respShip.data).then(async () => {  										
									await setMongoDBItems(tObject, resp.item_id, resp.fiscal_info); 
									setMongoDBClient(buyer).then(() => {
										res.status(200).json({ resultData: respData });										
									});										
								});
							}
							else {console.log('envio não registrado: ', resp.ship_id)}
						}).catch(err => {
							console.log(err);
							res.end();
						});
					}
					else {
						await setMongoDBItems(tObject, resp.item_id, resp.fiscal_info); 
						console.log('envio não encontrado: ', resp.ship_id )
						res.status(200).json({ resultData: respData });										
					};
				}).catch(err => {
					console.log(err);
					res.end();
				});						
			}
			else {
				res.status(resp.status).json(resp.data);
				console.log(resp);
				res.end();	
			};						
		}).catch(err => {
			console.log(err);
			res.end();
		}); 
	})
	.catch(err => {
		console.dir('erro ao atualizar credenciais e token');
		console.log(err);
		res.end();
	});	
});						

router.post('/itens', (req, res) => {		
	let post  = req.body;   	
    let url = post.resource;
	let user_id = post.user_id;		
	setCred(user_id).then(cred => {
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);  		
		let url_item = `${url}?include_attributes=all`		
		tObject.get(url_item).then(resp => {	
			if (resp.status == 200) {
				let item = resp.data;
				ml_itemModel.updateOne({"id" : item.id}, item, {'upsert': true}, async (err, data) => {		
					if (!err) {							
						let url_fiscal = `${url}/fiscal_information/detail`;						
						tObject.get(url_fiscal).then(resp => {								
							if (resp.status == 200) { 				
								let fiscal_info = resp.data;							
								fiscalModel.updateOne({"item_id" : fiscal_info.item_id}, fiscal_info , {upsert: true}, (err, data) => {																	
									let respData = {'item': fiscal_info.item_id, 'modifiedCout': data.modifiedCount, 'matchedCount': data.matchedCount, 'upsertedCount': data.upsertedCount};									
									res.status(200).json({resultData: respData});																											
								});																
							}							
							else {
								console.log('erro obtendo dados fiscais: ', item.id );									
								res.sendStatus(resp.status);																									
							};	
						});											
					}
					else {
						console.log('erro atualizando item: ', err);						
						res.status(500).json({resultData: err});																													
						res.end();
					};
				});
			}
			else {
				console.log('erro obtendo item: ', err );
				res.status(500).json({ resultData: err });																																	
			};
		});
	});
});

router.post('/codes', (req, res) => {		
	let post  = req.body;   	
    let url = post.resource;
	let user_id = post.user_id;		
	setCred(user_id).then(cred => {
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);  
		if (!post.application_id) {post.application_id = cred.appID};
		let url_item = `${url}?include_attributes=all`		
		tObject.get(url_item).then(resp => {	
			if (resp.status == 200) {
				let item = resp.data, item_id = item.id, title = item.title.trim(), seller = item.seller_id, arrVars = item.variations;
				item.title = title;
				ml_itemModel.updateOne({"id" : item.id}, item, {'upsert': true}, async (err, data) => {		
					if (!err) {							
						codeModel.findOne({'title': title}).then(async objCode => {																								
							let account = translateInverseAccount(seller), date = new Date().toISOString();	
							if (!objCode) { 	
								let checkMLB = await doCheckDataMl(item_id);	
								if (checkMLB) {																																				
									doCode(item, account).then(objCode => {															
										if (objCode.id) {																																
											doItensUpdate(objCode).then(newCode => {
												res.status(200).json(newCode);
											}).catch(err => {
												console.log('erro obtendo code final');
												console.log(err);
												res.status(500).json({resultData: []});	
											});																														
										}
										else {
											res.status(500).json({resultData: []});
										};																								
									});
								}
								else {
									res.status(500).json({resultData: []});
								};	
							}
							else {
								await doCheckDupsMLBs(item_id, title, arrVars);
								objCode = doAddVars(objCode, arrVars);													
								let idItem = objCode.data_ml.some(a => {return a.item_id == item_id});																										
								if (!idItem) {							
									let objToDataMl = {'item_id': item_id, 'seller_id': seller, 'account': account};												
									await codeModel.updateOne({'id': objCode.id},{'$addToSet':{'data_ml': objToDataMl},'$set':{'last_updated': date, 'codes': objCode.codes}});
									objCode.last_updated = date;																
									objCode.data_ml.push(objToDataMl);														
								}
								else {																				
									await codeModel.updateOne({'id': objCode.id},{'$set':{'last_updated': date, 'codes': objCode.codes}});														
								};									
								doItensUpdate(objCode).then(newCode => {
									res.status(200).json(newCode);
								}).catch(err => {										
									console.log('erro obtendo code final');
									console.log(err);
									res.status(500).json({resultData: []});	
								});									
							};										
						});						
					}
					else {
						console.log('erro atualizando item: ', err);						
						res.status(500).json({resultData: err});						
					};
				});
			}
			else {
				console.log('erro obtendo item: ', err );
				res.status(500).json({ resultData: err });																																	
			};
		});
	});
});

const setMongoDBOrders = (account, tObject, order) => {
	return new Promise(async (resolve, reject) => {		
		let nick = await getNickName(tObject, order.seller.id), item_id = order.order_items[0].item.id, url_fiscal = `items/${item_id}/fiscal_information/detail`;		
		Object.assign(order.seller, {nickname: nick});
		ordersModel.updateOne({ "id" : order.id }, order,{'upsert': true }, async (err, data) => {	
			if (!err) { 				
				respData.order = order.id;
				respData.modifiedCout = data.modifiedCount;
				respData.matchedCount = data.matchedCount;
				respData.upsertedCount = data.upsertedCount;
				let resData = {'ship_id': order.shipping.id, 'item_id': order.order_items[0].item.id, 'fiscal_info': []};						
				if (!arrTranslateNoFiscal.includes(account)) {
					tObject.get(url_fiscal).then(resp => {							
						if (resp.status == 200) { 				
							resData.fiscal_info = resp.data;						
							resolve(resData);
						}
						else {
							console.log('erro obtendo dados fiscais em setMongoDBOrders no pedido', order.id );
							console.log('status: ', resp.status);							
							resolve(resData);	
						};
					})
				}
				else {resolve(resData);};	
			}
			else {
				console.log('erro atualizando pedido: ', order.id);
				reject(err);
			};
		});		
	});	
}

let doItensUpdate = objCode => {
	return new Promise(async (resolve, reject) => {			
		let arrIds = objCode.data_ml, arrPromises = [], count = 0, arrCred = [], objCustom;		
		for (let x = 0; x < arrIds.length; x++) {
			let item_id = arrIds[x].item_id;
			let acc = arrIds[x].seller_id;  
			let url_item = `/items/${item_id}`;				
			setCred(acc).then(cred => {			
				let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token); 			
				arrCred.push(JSON.parse(JSON.stringify({'cred': cred, 'item_id': item_id, 'url_item': url_item})));
				arrPromises.push(tObject.get(url_item)); 
				count++;                       
				if (count == arrIds.length) { 
					Promise.all(arrPromises).then(arrResponse => {      							
						arrResponse.map(async a => {						
							let arrVars, tObject1, url_item, arrNoColorsFounded, arrSizes, hasColor, arrNoColors = [], arrNewPromises = [];					
							let objResults = doVarsUpdate(a.data.item_id, a.data.variations, objCode);												
							arrVars = objResults.arrVars;									
							arrNoColorsFounded = objResults.arrNoColorsFounded;	
							arrSizes = objResults.arrSizes;	                                
							arrCred.map(f => {
								if(f.item_id === a.data.id) {
									tObject1 = new tool.Tool(f.cred.appID, f.cred.secretID, f.cred.access_token, f.cred.refresh_token);
									url_item = `/items/${f.item_id}`;				
								};
							});	
							if (arrNoColorsFounded.length) {
								arrNoColorsFounded.map(a => {
									hasColor = arrNoColors.some(f => { return f == a.cor});
									if (!hasColor) {arrNoColors.push(a.cor);};
								});							
								let arrFinalDif = await doColorsUpdate(arrNoColors);								
								if (arrFinalDif) {																							
									objCode = addSufixColors(objCode.id, arrFinalDif, arrNoColorsFounded, objCode);										
									objCode = doCheckSizes(objCode, arrSizes);         															
									objResults = doVarsUpdate(objResults.item_id, arrVars, objCode);								
									arrVars = objResults.arrVars;	
									objCode = doAddVars(objCode, arrVars);								
									objCustom = {'seller_custom_field': objCode.id, 'variations': objResults.arrNewVars};																
									arrNewPromises.push(tObject1.put(url_item, objCustom));											
									let filter = {'id': objCode.id };		
									objCode.last_updated = new Date().toISOString();					
									await codeModel.updateOne(filter, objCode, { upsert: true });									
									if (!arrResponse.length) {																						
										console.log('Erro atualizando itens', 1);										
									};									
									resolve(objCode);    
								}
								else {           
									console.log('não foi possível atualizar cores');             
									reject();
								};							
							}
							else {
								objCode = doCheckSizes(objCode, arrSizes);                                        
								objResults = doVarsUpdate(objResults.item_id, arrVars, objCode);                                        
								arrVars = objResults.arrVars;								
								objCustom = {'seller_custom_field': objCode.id, 'variations': objResults.arrNewVars};
								arrNewPromises.push(tObject1.put(url_item, objCustom));
								Promise.all(arrNewPromises).then(arrResponse => {
									if (!arrResponse.length) {																						
										console.log('Erro atualizando itens', 1);										
									};									
									resolve(objCode);
								});      
							};
						});                                  
					});    
				};                           
			});			        
    	};
	});         
};

module.exports = router;