var express = require('express');
var router = express.Router();
const {ordersModel} = require('../public/middle/models');
// const {mlConnection} = require('../public/middle/mongoConnect');

router.get('/', async (req, res) => { 
    var start = req.query.start;
    var end = req.query.end;
    var account = req.query.id, filter, sortBy = {}, ff = null;     
    var attribsTemp = req.query.attributes;
    var st = req.query.status;
    if (req.query.fulfilled) {        
        if (req.query.fulfilled !== 'all') {
            ff = JSON.parse(req.query.fulfilled);
        }
        else { ff = req.query.fulfilled ;};
    };
    var sorter = req.query.sort;
    var ascDesc = req.query.order;
    var order_id = req.query.order_id;
    if (order_id) { filter = {id: order_id}; }
    else { filter = {'seller.nickname': account}};
    var attribs =  {"_id": 0} ;
    if (attribsTemp) {
        var fields = attribsTemp.split(',');
        fields.map((k) => {attribs[k] = 1})
    };    
    if (st && !order_id) {
        Object.assign(filter, {'status': st})
    }
    else if (!st && start) {
        st = 'paid';
    };
    if (!order_id) {
        Object.assign(filter, {'fulfilled': ff})
    };
    if (sorter && !order_id) {
        if (ascDesc && ascDesc == 'desc' ) { sortBy[sorter] = -1; }
        else { sortBy[sorter] = 1;};
    }
    else { sortBy = {last_updated: -1}; };
    var offset = Number(req.query.offset);
    if (!offset || offset <= 20) {offset = 0;};
    if (start && end) {
        const agg = [
            { '$addFields': { convertedDate: {"$toDate": { "$substr": ["$date_created", 0, 10] } }, account: "$seller.nickname" }}, 
            { '$match': { 'convertedDate': { '$gte': new Date(start), '$lte': new Date(end)}, 'status': {'$eq' : st} }}, 
            { '$project': attribs }, 
            { '$sort': sortBy }
        ];        
        if (ff !== 'all') { 
            agg.push( { $match: {'fulfilled': {'$eq' : ff} }})
            }
        else {             
            agg.push( { $match: {'fulfilled': {'$ne' : 'cancelled'} }})
        };        
        if (account) { agg.unshift( { $match: {'seller.nickname' : account} } )};
        await ordersModel.aggregate(agg, (err, result) => {
            if (!err) { 
                var data; 
                if (attribsTemp) { data = result.sort(dynamicSortMultiple(attribsTemp)); } 
                else { data = result; }
                return res.status(200).json({ total: data.length, resultData: data });            
            }
            else { return res.status(404).send( 'dados nao encontrados' ); }
        }).then(() => {
           // mlConnection.close();         
        });  
    }
    else {
        ordersModel.countDocuments(filter, function (err, count) {
            ordersModel.find(filter        
                ,attribs
                ,(err, result) => {
                if (!err) {
                    var data;         
                    if (attribsTemp) { data = result.sort(dynamicSortMultiple(attribsTemp)); } 
                    else { data = result; }
                    return res.status(200).json({ total: count, offset: offset, limit: 20, records: data.length, resultData: data });            
                }
                else { return res.status(404).send( 'dados nao encontrados' ); }
                }).sort(sortBy).limit(20).skip(offset);    
            }).then(() => {
                //mlConnection.close();         
            }); 
    }    
});

router.patch('/', async (req, res) => { 
    var op = req.query.op;
    if (op == 'clean') {
        const agg = [
            { '$sort': { 'last_updated': -1 }}, 
            { '$group': { '_id': '$id', 'orders': { '$push': '$$ROOT' }, 'dups': { '$addToSet': '$_id' }, 'count': { '$sum': 1 }}}, 
            { '$match': { 'count': { '$gt': 1 }}}
        ];
        ordersModel.aggregate(agg, (err, result) => {
            if (!err) {
                var duplicates = [];
                result.forEach(function(doc) {
                    doc.dups.shift();      // First element skipped for deleting
                    doc.dups.forEach( function(dupId){ 
                        duplicates.push(dupId);   // Getting all duplicate ids
                        }
                    )
                })
                if (duplicates.length) {
                    try {
                        mlConnection.collection('orders').deleteMany({_id:{$in:duplicates}});
                        return res.status(200).send( 'operação afetou: ' + duplicates.length + ' registros');
                    }
                    catch(e) {
                        return res.status(500),send('encontrado erro: ' + err );
                    }
                }
                else { return res.status(200).send( 'duplicidades não encontradas');}    
            }
            else { return res.status(500),send('encontrado erro: ' + err ); }            
        }).then(() => {
            //mlConnection.close();         
        }); 
    }
})

function dynamicSortMultiple() {
    /*
     * save the arguments object as it will be overwritten
     * note that arguments object is an array-like object
     * consisting of the names of the properties to sort by
     */
    var props = arguments;
    return function (obj1, obj2) {
        var i = 0, result = 0, numberOfProperties = props.length;
        /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
        while(result === 0 && i < numberOfProperties) {
            result = dynamicSort(props[i])(obj1, obj2);
            i++;
        }
        return result;
    }
}

function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        /* next line works with strings and numbers, 
         * and you may want to customize it to your needs
         */
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

module.exports = router;