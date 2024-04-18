const express = require('express');
const router = express.Router();
const tool = require('../public/middle/tool');
const {ordersModel, noteModel} = require('../public/middle/models');
const {setCred, setMongoDBShipments, setMongoDBItems, setMongoDBClient, getNickName,translateInverseAccount} = require('./parents');
const moment = require('moment');
moment.locale('pt-br');
const arrTranslateNoFiscal = ['AMALIA-SAN', 'SAN-MAG', 'KMARSS'];
const arrShowed = [];

router.post('/', (req, res) => {
	let post  = req.body; 		
	let url = post.resource;
	let user_id = post.user_id;	
	setCred(user_id).then(async cred => {		
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);                     
		tObject.get(url).then( async resp => {				
			if (resp.status == 200 && resp.data) {				
				let order = resp.data, buyer = order.buyer;						
				setMongoDBOrders(cred.name, tObject, order).then(async (respInserted) => {											
					if (respInserted && respInserted.ship_id) {						
						let urlShip = `shipments/${respInserted.ship_id}`;
						tObject.get(urlShip).then(respShip => {	
							if (respShip) {
								if (respInserted.order_status == 'cancelled' && respShip.data.status == 'ready_to_print') {
									respShip.data.status = 'cancelled';
								};
								setMongoDBShipments(respShip.data).then(async () => {  										
									await setMongoDBItems(tObject, respInserted.item_id, respInserted.fiscal_info);									
									if (respInserted.qtd > 1) {
										let txtNote = `${respInserted.qtd} ${respInserted.title}`;
										try {await addNote(tObject, order.id, txtNote);}
										catch (err) {console.log('erro inserindo observação');};
									};
									setMongoDBClient(buyer).then(() => {
										res.end();									
									});										
								});
							}
							else {console.log('envio não registrado')}
						}).catch(err => {
							console.log(err);
							res.end();
						});
					}
					else {
						console.log('Pedido %d não tem envio registrado', order.id);						
						await setMongoDBItems(tObject, respInserted.item_id, respInserted.fiscal_info); 						
						if (respInserted.qtd > 1) {
							let txtNote = `${respInserted.qtd} ${respInserted.title}`;
							try {await addNote(tObject, order.id, txtNote);}
							catch (err) {console.log('erro inserindo observação');};
						};
						res.end();
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
	}).catch(err => {
		console.dir('erro ao atualizar credenciais e token');
		console.log(err);
		res.end();
	});	
});

const setMongoDBOrders = (account, tObject, order) => {
	return new Promise(async (resolve, reject) => {		
		let seller_nick = translateInverseAccount(order.seller.id), item_id = order.order_items[0].item.id, url_fiscal = `items/${item_id}/fiscal_information/detail`;		
		let newId = 'NA', dtn = moment(new Date()), dateNow = dtn.format('DD/MM/YYYY HH:mm:ss, dddd' ),  respData = {};					
		Object.assign(order.seller, {nickname: seller_nick});
		ordersModel.updateOne({ "id" : order.id }, order ,{ upsert: true }, async (err, data) => {				
			let existShowed = true; 
			if (!err) {			
				let buyer_nick = '', fullName = '';			
				if (data.upsertedId) {newId = data.upsertedId.toString();};						
				let dt = moment(new Date(order.date_created)); 								
				let du = moment(new Date(order.last_updated)).format('DD/MM/YYYY HH:mm:ss, dddd' ); 								
				let dateC = dt.format('DD/MM/YYYY HH:mm:ss, dddd' );
				if (order.buyer.nickname) {buyer_nick = order.buyer.nickname;}
        		else {buyer_nick = await getNickName(tObject, order.buyer.id);}; 
				if (order.buyer.first_name && order.buyer.last_name) {fullName = `${order.buyer.first_name} ${order.buyer.last_name} (${buyer_nick})`;}        		
        		else {fullName = buyer_nick;};
				let ship_id = order.shipping.id ? order.shipping.id : 'Não informado'
				let seller = order.seller.nickname;
				let total = order.total_amount.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
				if (order.status  === 'cancelled') {
					existShowed = arrShowed.some(e => { return e === order.id; }); 
				};
				if (data.upsertedCount >= 1 || order.status  === 'cancelled') {
					if (order.status  === 'cancelled') {
						if (!existShowed) {
							console.log("-".repeat(50));					
							console.log('Modificado: ', data.modifiedCount);
							console.log('Novo ID: ', newId);
							console.log(fullName);							
							console.log(`Envio: ${ship_id}`);				
							console.log(`Pedido: ${order.id}`);				
							console.log(`${seller} (${total})`);
							console.log(`CRIADO    EM ${dateC}`);
							console.log(`RECEBIDO  EM ${dateNow}`);
							console.log(`CANCELADO EM ${du}`);
							console.log("-".repeat(50));											
							arrShowed.push(order.id);
						};
					}
					else {
						console.log("-".repeat(50));					
						console.log('Inserido: ', data.upsertedCount);
						console.log('Novo ID: ', newId);
						console.log(fullName);							
						console.log(`Envio: ${ship_id}`);				
						console.log(`Pedido: ${order.id}`);				
						console.log(`${seller} (${total})`);						
						console.log(`CRIADO    EM ${dateC}`);
						console.log(`RECEBIDO  EM ${dateNow}`);
						console.log("-".repeat(50));										
					};
				};	
				respData.order = order.id.toString();
				respData.modifiedCout = data.modifiedCount;
				respData.matchedCount = data.matchedCount;
				respData.upsertedCount = data.upsertedCount;				
				let oi = order.order_items[0];
				let resData = {'ship_id': order.shipping.id, 'item_id': oi.item.id, 'qtd': oi.quantity, 'title': chunkString(oi.item.title, 30), 'order_status': order.status, 'fiscal_info': []};
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
					});				
				}
				else {resolve(resData);};
			}
			else {
				console.log('erro atualizando pedido:', order.id);
				reject(err);
			};				
		});
	});	
};

const addNote = (tObject, id, txtNote) => {
	return new Promise(async (resolve, reject) => {
		let checkNote, url = `orders/${id}/notes`, canDo = false;
		try {checkNote = await tObject.get(url);}
		catch (err) {
			console.log('erro obtendo observação');
			resolve();
		};
		if (checkNote.data.length) {
			if (checkNote.data[0].results.length) {
				if (checkNote.data[0].results[0].note.trim().toUpperCase() != txtNote.trim().toUpperCase()) {canDo = true;};			
			}
			else {canDo = true;};
		};
		if (canDo) {
			let  objNote = {'note': txtNote};
			tObject.post(url, objNote).then(async resp => {		
				console.log('fez')	
				let objNewNote = {order_id: id,results: [{'id': resp.data.note.id, 'date_created': new Date().toISOString(), 'date_last_updated': new Date().toISOString(), 'note': txtNote}]};        
				try {
					await noteModel.findOneAndUpdate({'order_id': id}, objNewNote, {new: true, upsert: true});
					resolve(resp);
				}
				catch (err) {
					console.log('erro gravando observação base interna');
					resolve();	
				};					
			}).catch (err => {
				console.log(err);
				resolve();
			});
		}
		else {resolve();};		
	});
};

const chunkString = (str, len) => {
    return result = str.split(/(\s+)/).reduce((output, item) => {
        let last = output.pop() || "";
        return last.length + item.length > len ? [...output, last, item] : [...output, last + item];
	},[])[0].trim();
};

module.exports = router;