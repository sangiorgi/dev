const express = require('express');
const ritems = express.Router();
const tool = require('../public/middle/tool');
const {codeModel, ml_itemModel, fiscalModel, inventory_itemModel, colorModel, countersMlModel} = require('../public/middle/models');
const {setCred} = require('./parents');
const arrProcess = [];
const arrTranslateAccountToToken = [{ 'id': '82307807', 'value': 'AMALIA COLLECTIONS' }, { 'id': '371764921', 'value': 'CTESTES' }, { 'id': '84454171', 'value': 'SANMODAS' }, { 'id': '225763835', 'value': 'NSLMODAATACADO' }, { 'id': '216512394', 'value': 'AMALIA-SAN' }, { 'id': '580414888', 'value': 'SAN-MAG' }, { 'id': '85197255', 'value': 'KMARSS' }];

ritems.post('/', (req, res) => {	
	let post  = req.body;   
    let url = post.resource;		
	let user_id = post.user_id;		
	setCred(user_id).then(cred => {
		let tObject = new tool.Tool(cred.appID, cred.secretID, cred.access_token, cred.refresh_token);  
		let url_item = `${url}?include_attributes=all`;
		tObject.get(url_item).then(resp => {				
			if (resp.status === 200) {				
				let item = resp.data, item_id = item.id, title = item.title.trim(), seller = item.seller_id, status = item.status, arrVars = item.variations;
				item.title = title;
				ml_itemModel.updateOne({ "id" : item_id }, item , { upsert: true }, async (err, data) => {					
					if (!err && (data.modifiedCount === 1 || data.upsertedCount === 1)) {	
						let url_fiscal = `${url}/fiscal_information/detail`;
						let existProcess = arrProcess.some(e => {return e === title;});
						if (!existProcess) {arrProcess.push(title);};								
						tObject.get(url_fiscal).then(resp => {												
							if (resp.status === 200 || resp.status === 400 || resp.status === 404) { 				
								let fiscal_info = resp.status === 200 ? resp.data : {'item_id': item_id, 'seller_id': seller, 'variations': []}, objCustom;								
								fiscalModel.updateOne({'item_id' : fiscal_info.item_id }, fiscal_info, { upsert: true }, async (err, data) => {									
									if (!err) {
										if (!existProcess && status === 'active') {		
											await doClearCode(title, item_id);									
											codeModel.findOne({'title': title}).then(async objCode => {												
												let account = translateInverseAccount(seller), date = new Date().toISOString();	
												if (!objCode) { 					
													let checkMLB = await doCheckDataMl(item_id, arrVars);	
													if (checkMLB) {																															
														doCode(item, account).then(objCode => {															
															if (objCode.id) {																																
																doItensUpdate(objCode);																														
															}
															else {
																console.log('novo código para custom field não informado');															
															};														
															arrProcess.length = 0;													
															res.end();
														});
													}
													else {
														console.log('houve um erro na checagem de duplicidades');
														arrProcess.length = 0;													
														res.end();
													};
												}
												else {																								
													await doCheckDupsMLBs(item_id, title, arrVars);
													if (arrVars.length) {objCode = doAddVars(objCode, arrVars);};
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
													let intItem = await inventory_itemModel.findOne({'title': title});
													if (intItem) {
														let intDataMl = intItem.data_ml, founded, hasToAdd = false;														
														objCode.data_ml.forEach(a => {															
															founded = intDataMl.some(b => {return a.item_id == b.id}); 
															if (!founded) {
																let objToIntDataMl = {'id': a.item_id, 'seller_id': a.seller_id, 'account': a.account};
																intDataMl.push(objToIntDataMl);
																hasToAdd = true;
															};															
														});
														if (hasToAdd) {
															await inventory_itemModel.updateOne({'title': title},{'$set':{'data_ml': intDataMl, 'last_updated': date}});
														};														
													};
													doItensUpdate(objCode)
													arrProcess.length = 0;													
													res.end();
												};										
											});
										}
										else {res.end};
									}
									else {								
										console.log('Erro atualizando dados fiscais: ', item_id );									
										console.log(err);
										res.end();
									};	
								});																
							}							
							else {								
								console.log('Erro obtendo dados fiscais: ', item_id );									
								res.end();
							};	
						});											
					}
					else {
						if (data.modifiedCount !== 1) {
							console.log('item não atualizado e operação suspensa', item_id);						
						}
						else {
							console.log('erro atualizando atualizando item', err);						
						};
						res.end();
					};
				});
			}
			else {
				console.log('Erro obtendo item: ', resp.status );
				res.end();
			};
		});
	}).catch(err => {
		console.log('erro obtendo credenciais');
		console.log(err)
		res.end();
	});
});

const doCode = (item, account) => {
	return new Promise(async (resolve, reject) => {
		let item_id = item.id, title = item.title.trim(), seller = item.seller_id, seq = await createNextSequenceValue(title.substr(0,3).toUpperCase()), arrVariations = item.variations;
		let arrComb, objColor, found, arrData = [], hasColor, objCor = {codes: []}, date = new Date().toISOString();    
		let objFinalCode = {'date_created': date, 'data_ml': [{'item_id': item.id, 'seller_id': seller, 'account': account}], 'id': seq[0], 'last_updated': date , 'codes': '', 'title': title};
		if (arrVariations.length) {
			arrVariations.map(a => {                			
				arrComb = a.attribute_combinations.filter(b => {return b.id === 'COLOR' || b.id === 'SIZE'});                			
				objColor = {'color': 'SEM COR', 'size' : 'ST', 'vars': [a.id]};
				if (arrComb.length) {
					arrComb.forEach(c => {            
						hasColor = false;
						if (c.id === 'COLOR') {    
							hasColor = true;                					                            
							objColor.color = c.value_name;
							found = arrData.some(d => {return d == c.value_name });
							if (!found) {arrData.push(c.value_name);};
						}
						else if (c.id === 'SIZE') {						
							objColor.size = doSufixSize(c.value_name);
						};
					});
					if (!hasColor) {
						found = arrData.some(d => {return d == 'SEM COR' });
						if (!found) {arrData.push('SEM COR');};
					};        
				}			
				else {
					found = arrData.some(d => {return d == 'SEM COR' });
					if (!found) {arrData.push('SEM COR');};
				};
				objCor.codes.push(objColor);
			});   		
		}
		else {
			arrData.push('SEM COR');
			objCor.codes.push({'color': 'SEM COR', 'size' : 'ST', 'vars': ['no vars exists']});
		};
		objCor.codes.sort(compareValues('color')); 
		colorModel.find({"name": {'$in': arrData }}, {'eqv':1, 'name':1, 'code':1, '_id':0}).then(async arrFounded => {			
			let filter = {$or: [ {'id': seq[0] }, {'data_ml': {'$elemMatch': {'id': item_id}}}, {'title': title}]};
			if (arrFounded.length == arrData.length) {            				
				let objCode = doSufixColors(seq[0], arrFounded, objCor);
                objFinalCode.codes = objCode.codes;
				try {await codeModel.updateOne(filter, objFinalCode, { upsert: true });}
				catch (err) {console.log('erro atalizando tabela de códigos internos 1');};
				resolve(objFinalCode);
            }
            else {      
				let hasColor, arrDif = [];          
                arrData.map(a => {
					hasColor = arrFounded.some(b => { return a == b.name});
					if (!hasColor) {arrDif.push(a);};
                });								
                doColorsUpdate(arrDif).then(async arrFinalDif => {
					if (arrFinalDif) {
						arrFounded = arrFounded.concat(arrFinalDif);
						let objCode = doSufixColors(seq[0], arrFounded, objCor);						
						objFinalCode.codes = objCode.codes;
						try {await codeModel.updateOne(filter, objFinalCode, { upsert: true });}
						catch (err) {console.log('erro atalizando tabela de códigos internos 2');};
						resolve(objFinalCode);
					}
					else {                        
						console.log(arrFounded);
						console.log(arrDif);
						resolve(null);
                    };
				});			
            };   			
		});		
	});	
};

const doItensUpdate = objCode => {		
	let arrIds = objCode.data_ml, arrPromises = [], arrNewPromises = [], count = 0, arrCred = [], objCustom;			
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
						if (a.data.variations.length) {					
							let arrVars, tObject1, url_item, arrNoColorsFounded, arrSizes, hasColor, arrNoColors = [];
							let objResults = doVarsUpdate(a.data.id, a.data.variations, objCode);																		
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
									try {await codeModel.updateOne(filter, objCode, { upsert: true });}
									catch (err) {console.log('erro atalizando tabela de códigos internos 3');};
									Promise.all(arrNewPromises).then(arrResponse => {
										if (arrResponse.length) {return true;}
										else {																						
											console.log('Erro atualizando itens', 1);
											return false;
										};									
									});        
								}
								else {           
									console.log('não foi possível atualizar cores');             
									return false;									
								};							
							}
							else {
								objCode = doCheckSizes(objCode, arrSizes);                                        
								objResults = doVarsUpdate(objResults.item_id, arrVars, objCode);                                        
								arrVars = objResults.arrVars;								
								objCustom = {'seller_custom_field': objCode.id, 'variations': objResults.arrNewVars};
								arrNewPromises.push(tObject1.put(url_item, objCustom));
								Promise.all(arrNewPromises).then(arrResponse => {
									if (arrResponse.length) {return true;}
									else {																						
										console.log('Erro atualizando itens', 1);
										return false;
									};									
								});
							};
						}
						else {
							let tObject1, url_item;
							arrCred.map(f => {
								if(f.item_id === a.data.id) {
									tObject1 = new tool.Tool(f.cred.appID, f.cred.secretID, f.cred.access_token, f.cred.refresh_token);
									url_item = `/items/${f.item_id}`;				
								};
							});	
							objCustom = {'seller_custom_field': objCode.id};
							arrNewPromises.push(tObject1.put(url_item, objCustom));
							Promise.all(arrNewPromises).then(arrResponse => {								
								if (arrResponse.length) {return true;}
								else {																						
									console.log('Erro atualizando itens', 1);
									return false;
								};									
							});							
						};
					});                                  					
                });    
            };                           
        });        
    };         
};

const doClearCode = (title, item_id) => {
	return new Promise((resolve, reject) => {
		let filter = {'title': title, '$or': [{'codes.color': {$exists: false}}, {'codes.size': {$exists: false}}, {'codes.code': {$exists: false}}, {'codes.vars': {$exists: false}}]};
		codeModel.deleteOne(filter).then(resp => {
			if (resp.deletedCount === 1) {
				console.log('Código para %s excluído por estar incorretamente preenchido', item_id);			
			};					
			resolve(true);
		});
	});
};

const doVarsUpdate = (item_id, arrVars, objCode) => {    
    try {
        let seq = objCode.id, arrCodes = objCode.codes, arrComb, cor, size, arrConf, arrNoColorsFounded = [], arrSizes = [], arrNewVars = [];    
        arrVars.map(a => {			
            let objVar = {'id': a.id, 'seller_custom_field': '' };            
			arrComb = a.attribute_combinations.filter(b => {return b.id === 'COLOR' || b.id === 'SIZE'});                                			
			if (arrComb.length) {
				size = 'ST';
				cor = 'SEM COR';
				arrComb.forEach(c => {            					
					if (c.id === 'COLOR') {
						cor = c.value_name						
					}
					else if (c.id === 'SIZE') {size = doSufixSize(c.value_name);};
				});
			}
			else {
				size = 'ST';
				cor = 'SEM COR';
			};                        				
            let newCode = {'code': `${seq}-${doAuxEqv(cor)}_${size}`}; 
            arrConf = arrCodes.filter(d => { return d.code == newCode.code });			
            if (arrConf.length) {
                arrConf.map(e => {
                    if (e.size == size) {objVar.seller_custom_field = e.code;};                
                });			
            }
            else {arrNoColorsFounded.push({'cor': cor, 'size': size });};		
            arrSizes.push({'cor': cor, 'size': size, 'var_id': a.id });                
            arrNewVars.push(objVar);            
        });				
        return {'item_id': item_id, 'arrVars': arrVars, 'arrNoColorsFounded': arrNoColorsFounded, 'arrSizes' : arrSizes, 'arrNewVars' : arrNewVars};		        
    }
    catch (err) {
        console.log(err);
        return null;
    };     
};

const doCheckSizes = (objCode, arrSizes) => {      
	let seq = objCode.id, founded, objToCompare;        
	try {
		arrSizes.map(a => {
			founded = false, objToCompare = {};                
			objCode.codes.forEach(b => {        
				if (b.vars.length && b.vars.includes(a.var_id)) {                
					if (b.color.toUpperCase() == a.cor.toUpperCase() && b.size.toUpperCase() == a.size.toUpperCase()) { 
						let str = b.code.substring(0, b.code.lastIndexOf('_') + 1);
						b.code = `${str}${a.size}`                
						b.size = a.size;                             
						founded = true;                            
					};
				};
				objToCompare.cor = a.cor;
				objToCompare.size = a.size;
				objToCompare.var_id = a.var_id;                    
			});            
			if (!founded) {               
				let newAux = doAuxEqv(objToCompare.cor);                
				let newCode = {'code': `${seq}-${newAux}_${objToCompare.size.toUpperCase()}`};  
				objCode.codes.map(c => { 
					if (c.code == newCode.code) {   
						if (!c.vars.includes(objToCompare.var_id)) {                                             
							c.vars.push(objToCompare.var_id);
						};
					};                    
				});            
			};
		});   
		return objCode;         
	}
	catch (err) {
		console.log(err);
        return null;
	};            
};

const doCheckDataMl = (item_id, arrVars) => {
	return new Promise((resolve, reject) => {
		let filter = {'data_ml': {'$elemMatch': {'item_id': item_id}}}, len;
		codeModel.find(filter).exec().then(async arrResults => {
			len = arrResults.length;
			if (len === 0) {				
				resolve(true);
			}			
			else if (len === 1) {
				let arrDataMl = arrResults[0].data_ml, codeId = arrResults[0].id;
				if (arrDataMl.length === 1) {
					codeModel.deleteOne({'id': codeId}).then(resp => {
						if (resp.deletedCount === 1) {
							console.log('item %s excluído por estar incorretamente anexado', item_id);
							resolve(true);
						}
						else {
							console.log('item %s incorretamente anexado não pode ser excluído', item_id);
							resolve(false);
						};					
					});				
				}
				else {
					let arrNewDataMl = arrDataMl.filter(a => {return a.item_id != item_id});		
					let arrItemVars = [], arrNewCodes = [];
					arrVars.forEach(c => {arrItemVars.push(c.id)}), 							
					arrResults[0].codes.map(d => {
						let objCode = {'code': d.code, 'color': d.color, 'size': d.size, 'vars': []};
						d.vars.forEach(e => {
							if (!arrItemVars.includes(e)) {objCode.vars.push(e);};
						});								
						if (objCode.vars.length) {arrNewCodes.push(objCode);};
					});					
					await codeModel.updateOne({'id': codeId},{'$set':{'data_ml': arrNewDataMl, 'codes': arrNewCodes, 'last_updated': new Date().toISOString()}});
					console.log('item %s removido da tabela de anexos', item_id);
					resolve(true);
				};
			}
			else {
				console.log('item %s anexado em mais de uma tabela', item_id);
				resolve(false);
			};
		});
	});
};

const doCheckDupsMLBs = (item_id, title, arrVars) => {
	return new Promise((resolve, reject) => {		
		let filter = {'data_ml': {'$elemMatch': {'item_id': item_id}}}, len;
		codeModel.find(filter).exec().then(async arrResults => {
			len = arrResults.length;
			if (len === 0) {				
				resolve(true);
			}			
			else {
                arrResults.map(async a => {										
                    if (a.title != title) {                        
                        let arrDataMl = a.data_ml, codeId = a.id;
                        if (arrDataMl.length === 1) {    
							codeModel.deleteOne({'id': codeId}).then(resp => {
								if (resp.deletedCount === 1) {
									console.log('item %s excluído por estar incorretamente anexado a %s', item_id, codeId);
									resolve(true);
								}
								else {
									console.log('item %s incorretamente anexado não pode ser excluído de %s', item_id, codeId);
									resolve(false);
								};					
							});		                                                    
                        }
                        else {
                            let arrNewDataMl = arrDataMl.filter(b => {return b.item_id != item_id});					
							let arrItemVars = [], arrNewCodes = [];
							arrVars.forEach(c => {arrItemVars.push(c.id)}), 							
							a.codes.map(d => {
								let objCode = {'code': d.code, 'color': d.color, 'size': d.size, 'vars': []};
								d.vars.forEach(e => {
									if (!arrItemVars.includes(e)) {objCode.vars.push(e);};
								});							
								if (objCode.vars.length) {arrNewCodes.push(objCode);};								
							});							
					        await codeModel.updateOne({'id': codeId},{'$set':{'data_ml': arrNewDataMl, 'codes': arrNewCodes, 'last_updated': new Date().toISOString()}});
					        console.log('item %s removido da tabela de anexos %s', item_id, codeId);
                        };
                    };
                });
                resolve(true);
			};
		});
	});
};

const doColorsUpdate = async arrDif => {	
	return new Promise(async (resolve, reject) => {		
		const regex = /[//\\|_(-]/g, regex1 = /[çÇ]/g;
		let arrTemp, arrFinalDif = [], count = 0; 		
		for (let a = 0; a < arrDif.length; a++) { 
			if (arrDif[a] !== 'SEM COR') {
				arrTemp = arrDif[a].split(','); 
				for (let a = 0; a < arrTemp.length; a++) {
					let objFinal = {}, colorAll = arrTemp[a].trim(), index = 0, suf, arrNoSpaces = [];        
					let colorCleaned = colorAll.replace(regex, ' ').replace(regex1, 'C');  	
					let arrClear = colorCleaned.split(' ');    
					arrClear.map(a => {		
						if(a) {     
							suf = a.toUpperCase().trim() 						
							if (index++ == 0) {              
								if ( suf == 'VERMELHO') {arrNoSpaces.push('VM')}
								else if (suf == 'ROXO') {arrNoSpaces.push('RX')}
								else if (suf == 'ROSE' || suf == 'ROSÉ') {arrNoSpaces.push('RS')}
								else if (suf == 'LAVANDA') {arrNoSpaces.push('LV')}
								else if (suf == 'TERRACOTA') {arrNoSpaces.push('TC')}
								else if (suf == 'VINHO') {arrNoSpaces.push('VN')}
								else if (suf == 'MAGENTA') {arrNoSpaces.push('MG')}
								else if (suf == 'MOCASSIM') {arrNoSpaces.push('MC')}
								else if (suf == 'TERRA') {arrNoSpaces.push('TR')}
								else if (suf == 'TELHA') {arrNoSpaces.push('TL')}
								else if (suf == 'CAMUFLADA') {arrNoSpaces.push('CM')}
								else if (suf == 'PRATA' || suf == 'PRATEADO') {arrNoSpaces.push('PT')}
								else {arrNoSpaces.push(suf.substring(0,2))};
							}
							else {			
								if (suf.substring(0,4) == 'VERM') {arrNoSpaces.push('VML')}
								else {arrNoSpaces.push(suf.substring(0,3))};			
							};
						};        
					});
					objFinal = {'code': 'black', 'name': colorAll, 'eqv': arrNoSpaces.join('_')};
					try {await colorModel.updateOne({ 'name': colorAll }, objFinal, {'upsert': true});}
					catch (err) {console.log('erro atualizando tabela de cores');};
					arrFinalDif.push(objFinal);
				};
			}
			else {
				objFinal = {'code': 'black', 'name': arrDif[a], 'eqv': 'SC'};
				try {await colorModel.updateOne({ 'name': arrDif[a] }, objFinal, {'upsert': true});}
				catch (err) {console.log('erro atualizando tabela de cores');};
				arrFinalDif.push(objFinal);
			};	
			count++;                       
            if (count == arrDif.length) { 
				resolve(arrFinalDif);
			};
		};
	});	
};

const doSufixColors = (seq, arrSufixColors, objCode) => { 	
    arrSufixColors.map(a => {
        objCode.codes.forEach(b => {
            if (a.name.toUpperCase() == b.color.toUpperCase()) {                
                Object.assign(b, {'code': `${seq}-${a.eqv}_${b.size}` });                
            };
        });
    });
    return objCode;
};

const doSufixSize = sizeValue => {
    if (sizeValue) {
        let arrS = sizeValue.split(' '), str0 = arrS[0], str1 = arrS[1], sufixSize;
        if (str0.toUpperCase().substring(0,3) == 'TAM') {sufixSize = str1.substring(0,2);}
        else {sufixSize = str0.substring(0,2);};     
        return sufixSize.toUpperCase().trim();	
    }
    else {return 'ST'};    
};

const doAuxEqv = colorAll => {
	if (colorAll.toUpperCase() !== 'SEM COR' ) {
		const regex = /[//\\|_(-]/g, regex1 = /[çÇ]/g;
		let colorCleaned = colorAll.replace(regex, ' ').replace(regex1, 'C');  	
		let arrClear = colorCleaned.split(' '), arrNoSpaces = [], index = 0, suf;    
		arrClear.map(a => {		
			if(a) {     
			suf = a.toUpperCase().trim() 
			if (index++ == 0) {              
				if ( suf == 'VERMELHO') {arrNoSpaces.push('VM')}
				else if (suf == 'ROXO') {arrNoSpaces.push('RX')}
				else if (suf == 'ROSE' || suf == 'ROSÉ') {arrNoSpaces.push('RS')}
				else if (suf == 'LAVANDA') {arrNoSpaces.push('LV')}
				else if (suf == 'TERRACOTA') {arrNoSpaces.push('TC')}
				else if (suf == 'VINHO') {arrNoSpaces.push('VN')}
				else if (suf == 'MAGENTA') {arrNoSpaces.push('MG')}
				else if (suf == 'MOCASSIM') {arrNoSpaces.push('MC')}
				else if (suf == 'TERRA') {arrNoSpaces.push('TR')}
				else if (suf == 'TELHA') {arrNoSpaces.push('TL')}
				else if (suf == 'CAMUFLADA') {arrNoSpaces.push('CM')}
				else if (suf == 'PRATA' || suf == 'PRATEADO') {arrNoSpaces.push('PT')}
				else {arrNoSpaces.push(suf.substring(0,2))};
			}
			else {			
				if (suf.substring(0,4) == 'VERM') {arrNoSpaces.push('VML')}
				else {arrNoSpaces.push(suf.substring(0,3))}			
			};
			};        
		});	
		return arrNoSpaces.join('_');
	}
	else {return 'SC'};
};

const doAddVars = (objCode, arrVars) => {
	let arrComb, cor, size, newCode;
	objCode.codes.map(a => {
		arrVars.forEach(b => {                            			
			arrComb = b.attribute_combinations.filter(c => {return c.id === 'COLOR' || c.id === 'SIZE'});                    
			arrComb.map(d => {           
				size = 'ST'
				if (d.id === 'COLOR') {cor = d.value_name;} 
				else if (d.id === 'SIZE') {size = doSufixSize(d.value_name);};    
			});  		
			if (cor) {	
				newCode = `${objCode.id}-${doAuxEqv(cor)}_${size}`;   			
			};
			if(a.code == newCode) {												
				if (!a.vars.includes(b.id)) {a.vars.push(b.id);};
			};
		});
	});    
	return objCode;
};

const addSufixColors = (seq, arrSufixColors, arrNoColorsSizes, objCode) => {		
	let code, hasCode; 	
	if (!objCode.codes) {
		Object.assign(objCode, {'codes': []});
	};
    arrSufixColors.map(a => {        
		arrNoColorsSizes.forEach(b => {
            if (a.name.toUpperCase() == b.cor.toUpperCase()) {                
				code = {'code': `${seq}-${a.eqv}_${b.size}`, 'color': a.name, 'size': b.size, 'vars': []};				
				hasCode = objCode.codes.some(c => { return  c.code == code.code});				
				if (!hasCode) {objCode.codes.push(code);}				
            };            
		});
    });	
    return objCode;
};
 
const createNextSequenceValue = async (sequenceName, inc) => {  
	return new Promise(async (resolve, reject) => {		
		let range = inc || 1, arrSequence = [];    
		let query = { _id: sequenceName }, dataToChange = {$inc: { sequence_value: range }};
		let sequenceDocument = await countersMlModel.findOne(query).exec();  
		if (sequenceDocument) {
			for (let a = 1; a <= range; a++) {            
				let s = String(sequenceDocument.sequence_value + a).padStart(4, '0');   
				arrSequence.push(`${sequenceName}${s}`);            
			};          
		}
		else { 
			for (let a = 1; a <= range; a++) {
				let s = String(a).padStart(4, '0');   
				arrSequence.push(`${sequenceName}${s}`)
			};        
		};  
		await countersMlModel.findOneAndUpdate(query, dataToChange, {new: true, upsert: true});  
		resolve(arrSequence);
	});
};

const compareValues = (key, order) => {
    let orderUse = order || 'asc';
    return (a, b) => {
        if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) { return 0; };
        const varA = (typeof a[key] === 'string') ? a[key].toUpperCase() : a[key];
        const varB = (typeof b[key] === 'string') ? b[key].toUpperCase() : b[key];
        let comparison = 0;
        if (varA > varB) { comparison = 1;} 
        else if (varA < varB) { comparison = -1; };        
        return orderUse === 'desc' ? comparison * -1 : comparison;
    };
};

const translateInverseAccount = id => {    
    let retValue = 'NA';
    arrTranslateAccountToToken.map(k => { if (Number(k.id) === id) { retValue = k.value; } });    
    return retValue;
};

module.exports = {
	ritems,
	translateInverseAccount,	
	doCode,
	doColorsUpdate,
	doAddVars,
	doVarsUpdate,
	addSufixColors,
	doCheckSizes,
	doCheckDataMl,
	doCheckDupsMLBs
};