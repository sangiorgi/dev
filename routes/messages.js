const express = require('express');
const router = express.Router();
const moment = require('moment');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const {ordersModel} = require('../public/middle/models');
moment.locale('pt-br');

Object.defineProperty(Object, 'formatPT', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: target => {
        'use strict';
        if (target === undefined || target === null) {throw new TypeError('cannot convert argument to object');};
        let to = Object(target);            
        return Number(to).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
});

router.post('/sms', (req, res) => {    
    if (!req.query.from || !req.query.to || !req.query.body) {
		return res.status(500).json({ err: 'Dados informados insuficientes' });
	};	
    let from = `whatsapp:+${req.query.from}`, to = `whatsapp:+${req.query.to}`, body = req.query.body;
    client.messages.create({from: from, to: to, body: body}).then(message => {    
        message.dateUpdated = moment(new Date(message.dateUpdated)).format('DD/MM/YYYY HH:mm:ss, dddd' ); 								
        return res.status(201).json({resultData:  message});        
    });
});
	
router.post('/tw', async (req, res) => {
    let body = req.body, option = body.option, agg, od; 
    console.log(body)    
    if (option == 1) {        
        let d = new Date();
        d.setDate(d.getDate()-1);
        let start = `${d.toISOString().substr(0,11)}00:00:01.000Z`, end = `${new Date().toISOString().substr(0,11)}23:59:59.000Z`;
        console.log(start, end)
        agg = [
            {$set: {convertedDate: {$dateFromString: {dateString: {$substrCP: ['$date_created', 0, 19],}, timezone: '-01'}}, account: '$seller.nickname'}}, 
            {'$match': {'convertedDate': {'$gte': new Date(start), '$lte': new Date(end)}, status: {$ne: 'cancelled'}, account: {$in: ['SANMODAS','NSLMODAATACADO','AMALIA COLLECTIONS']}}},
            {$lookup: {from: 'itens', localField: 'order_items.item.id', foreignField: 'id', as: 'item'}},
            {$set: {vi: {$first: '$item'}, oi: {$first: '$order_items'}}},
            {$set: {sail_variation: {$first: {$filter: {input: '$vi.variations', as: 'vars', cond: {$eq: ['$$vars.id','$oi.item.variation_id']}}}}}},
            {$set: {'order_items.item.thumb': {$concat: ['https://mlb-s1-p.mlstatic.com/', {$first: '$sail_variation.picture_ids'}, '-O.jpg']}}},
            {$group: {_id: {$ifNull: ['$pack_id', '$id']}, pack_itens: {$push: {OrderRef: '$id', itens: [{$first: '$order_items'}]}}, pack_value: {$sum: '$paid_amount'}, pack_orders: {$push: '$id'}, detail: {$first: '$$ROOT'}}},
            {$replaceRoot: {newRoot: {$mergeObjects: [{pack_orders: '$pack_orders'}, {pack_itens: '$pack_itens'}, {pack_value: '$pack_value'}, '$detail']}}},
            {$sort: {date_created: -1}},
            {$limit: 3},
            {$project: {_id: 0, __v: 0, vi: 0, oi: 0, sail_variation: 0}}
        ];  
        let arrResults = await ordersModel.aggregate(agg).exec(), arrOrdersFinal = [];
        arrResults.map(a => {
                objRowOrder = formatItemsML(a.order_items);                                            
                arrOrdersFinal.push(objRowOrder);            
        });    
        res.status(200).json({'body': arrOrdersFinal});
    }
    else if (option == 2) {
        let obj_id = body.data;        
        if (!isNaN(obj_id)) {        
            obj_id = Number(obj_id);
            agg = [{ '$match': { '$or': [{ 'id': obj_id }, { 'shipping.id': obj_id }, { 'pack_id': obj_id }, { 'buyer.id': obj_id }] } }];
        }
        else { agg = [{'$match': {'$or': [{'$expr': {'$regexMatch': {'input': {'$concat': ['$buyer.first_name', ' ', '$buyer.last_name']}, 'regex': obj_id, 'options': "i" }}}, {'buyer.nickname': {'$regex': obj_id, '$options': 'i' }}]}}]};
        agg.push({ "$lookup": { "from": "shipments", "localField": "shipping.id", "foreignField": "id", "as": "shipping_data" } }, { "$project": { "_id": 0, "shipping": 0 } }, {'$addFields': {'oi': {'$first': '$order_items'}}}, { '$lookup': {'from': 'itens','localField': 'oi.item.id','foreignField': 'id','as': 'item'}}, { '$addFields': {'shipping': {'$first': '$shipping_data'}, 'item_vars': {'$first': '$item'}}}, { '$addFields': {'sail_variation': {'$first': {'$filter': {'input': '$item_vars.variations', 'as': 'var', 'cond': {'$eq': ['$$var.id', '$oi.item.variation_id']}}}},'item': {'$first': '$item'}}}, {"$set":{"order_items.item.thumb": {"$concat": ["https://mlb-s1-p.mlstatic.com/", {'$first':"$sail_variation.picture_ids"}, "-O.jpg"]}}}, { '$project': {'_id': 0,'item_vars': 0, 'oi': 0, 'sail_variation': 0}});        
        od = await ordersModel.aggregate(agg).exec();        
        res.status(200).json({'body': od[0]});
    };               
});

const formatItemsML = arrItens => {
    let br, sf, scf, tb, price, objRet = {}, arrAttrib, arrComb, valueText, descAttrib, valColor = 'não informado', valSize = 'não informado';         
    arrItens.map(a => {
        if(a.listing_type_id === 'gold_special') {br = 0.14}
        else if(a.listing_type_id === 'gold_pro') {br = 0.19};
        sf = a.full_unit_price * br;
        if (a.full_unit_price < 79) {sf += 5.50;};
        scf = a.item.seller_custom_field ? a.item.seller_custom_field : '';
        tb = a.item.thumb ? a.item.thumb : '';                
        price = a.full_unit_price;
        objRet.id = a.item.id;
        objRet.var_id = a.item.variation_id;
        objRet.title = a.item.title;
        objRet.value = price;
        objRet.qtd = a.quantity;
        objRet.type = a.listing_type_id;
        objRet.seller_sku = a.item.seller_sku;
        objRet.seller_custom_field = scf;                
        objRet.sale_fee = Object.formatPT(sf);        
        objRet.val_net = Object.formatPT(((price - sf) * a.quantity));        
        objRet.val_num = ((price - sf) * a.quantity);
        objRet.thumb = tb;                
        arrAttrib = a.item.variation_attributes;        
    });        
    valueText = `${Object.formatPT(price)} x ${objRet.qtd} ${objRet.qtd > 1 ? 'unidades' : 'unidade'}`;  
    arrComb = arrAttrib.filter(c => {return c.id === 'COLOR' || c.id === 'SIZE'});  
    arrComb.forEach(d => {
        if (d.id === 'COLOR') { valColor = d.value_name; }
        else if (d.id === 'SIZE') { valSize = d.value_name; };        
    });
    descAttrib = chunkString(`${valColor}, Tamanho ${valSize}`, 90);        
    Object.assign(objRet, { 'descText': descAttrib, 'valueText': valueText, 'color': valColor, 'size': valSize });            
    return [objRet];        
};

const chunkString = (str, len) => {
    return result = str
        .split(/(\s+)/)
        .reduce((output, item) => {
        let last = output.pop() || "";                   //get the last item
        return last.length + item.length > len           //would adding the current item to it exceed len chars?
            ? [...output, last, item]                    //Yes: start a new item
            : [...output, last + item]                   //No:  add to previous item  
        },[])[0].trim();
};

module.exports = router;