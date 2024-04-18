const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {shipmentModel, ml_itemModel, fiscalModel, clientModel} = require('../public/middle/models');
const arrTranslateAccountID = [{ 'id': 82307807, 'value': 'AMALIA' }, { 'id': 371764921, 'value': 'CTESTES' }, { 'id': 84454171, 'value': 'SANMODAS' }, { 'id': 225763835, 'value': 'NSL MODAS' }, { 'id': 216512394, 'value': 'AMALIA-SAN' }, { 'id': 580414888, 'value': 'SAN-MAG' }, { 'id': 85197255, 'value': 'KMARSS' }];

const cred = {
    nickID: null,  
	name: null,
    userID: null,  
    appID: null,
    secretID : null,
    access_token: null,
	refresh_token: null,
    email : null,
};

const setCred = async user_id => { 
	return new Promise(async (resolve, reject) => {
		let tObject = new tool.Tool()
		await tObject.getTokenByID(user_id).then(data  => {
			if(data) {                				
				cred.nickID = data.nickID;
				cred.name = data.name;
				cred.userID = data.userID;
				cred.appID = data.appID;
				cred.secretID = data.secretID;
				cred.access_token = data.token;
				cred.refresh_token = data.refresh_token;
				cred.email = data.email;
				resolve(cred);
			};                     
		}, (err => {          			
			reject(err);						
		}));
	});
};

const setMongoDBShipments = ship => {
	return new Promise((resolve, reject) => {
		if (!ship.id) {
			console.log('Erro sem ship ID: ', ship.id );								
			resolve();				
		};	
		shipmentModel.updateOne({ "id" : ship.id }, ship, { upsert: true }, (err,data) => {		
			if (!err) {				
				resolve()}
			else {
				console.log('erro atualizando dados de envios (em orders): ', ship.id );												
				resolve();				
			}
		});
	});		
}

const setMongoDBItems = (tObject, item_id, fiscal_info) => {
	return new Promise((resolve, reject) => {
        let url_item = `items/${item_id}?include_attributes=all`
		tObject.get(url_item).then(resp => {	
			if (resp.status == 200) {
				let item = resp.data;				
				ml_itemModel.updateOne({ "id" : item.id }, item, { upsert: true }, async (err, data) => {							
					if (!err && data.modifiedCount === 1) {		
						if (fiscal_info) {				
							await fiscalModel.updateOne({ "item_id" : fiscal_info.item_id }, fiscal_info, { upsert: true });												
							resolve();
						}
						else {
							console.log('erro atualizando informaçoes fiscais de', item_id);
							resolve();	
						}	
					}
					else {
						if (data.modifiedCount !== 1) {
							console.log('item não atualizado e operação suspensa', item_id);						
						}
						else {
							console.log('erro atualizando atualizando item', err);						
						};
						resolve();
					};
				});
			}
			else {
				console.log('Erro obtendo item: ', item_id );
				resolve();
			};
		});		
	});		
}

const setMongoDBClient = (buyer) => {
	return new Promise((resolve, reject) => {
		clientModel.findOne({"id" : buyer.id}).then(async client => {			
			if (client) {resolve();}
			else {
				await clientModel.updateOne({"id" : buyer.id}, buyer, { upsert: true });
				resolve();
			};
		});        
	});		
}

const getNickName = (tObject, seller_id) => {
	return new Promise((resolve, reject) => {
		let url_account = `users/${seller_id}?attributes=nickname`
		tObject.get(url_account).then(resp => {	
			if (resp.status == 200) {				
				resolve(resp.data.nickname);
			}
			else {
				console.log(resp);
				resolve();
			}
		});			
	});
}

const translateInverseAccount = id => {    
    let retValue = 'NA';
    arrTranslateAccountID.map(k => { if (k.id === id) {retValue = k.value;}});    
    return retValue;
};

module.exports = { 
    setCred,
	setMongoDBShipments,
	setMongoDBItems,
	setMongoDBClient,
	getNickName,
	translateInverseAccount    
}