const mongoose = require('mongoose');
const {inventoryConnection, siteConnection, mlConnection} = require('./mongoConnect');

const orderSchema = new mongoose.Schema(
    {
        id:Number,
        date_created:String,
        date_closed:String,
        last_updated:String,
        manufacturing_ending_date:String,
        feedback:{sale:String,purchase:String},
        comment:String,
        pack_id:Number,
        pickup_id:String,
        order_request:{return:String,change:String},
        fulfilled:Boolean,
        mediations:Array,
        total_amount:Number,
        paid_amount:Number,
        coupon:{id:String,amount:Number},
        expiration_date:String,
        order_items:[
        {item:
        {id:String,
        title:String,
        category_id:String,
        variation_id:Number,
        seller_custom_field:String,
        variation_attributes:[
            {id:String,
            name:String,
            value_id:String,
            value_name:String},
            {id:String,
            name:String,
            value_id:String,
            value_name:String}],
            warranty:String,
            condition:String,
            seller_sku:String,
            global_price:String},
            quantity:Number,
            unit_price:Number,
            full_unit_price:Number,
            currency_id:String,
            manufacturing_days:String,
            sale_fee:Number,
            listing_type_id:String}
            ],
        currency_id:String,
        payments:[
        {id:Number,
        order_id:Number,
        payer_id:Number,
        collector:{id:Number},
        card_id:String,
        site_id:String,
        reason:String,
        payment_method_id:String,
        currency_id:String,
        installments:Number,
        issuer_id:String,
        atm_transfer_reference:{company_id:String,transaction_id:String},
        coupon_id:String,
        activation_uri:String,
        operation_type:String,
        payment_type:String,
        available_actions:[String],
        status:String,
        status_code:String,
        status_detail:String,
        transaction_amount:Number,
        taxes_amount:Number,
        shipping_cost:Number,
        coupon_amount:Number,
        overpaid_amount:Number,
        total_paid_amount:Number,
        installment_amount:String,
        deferred_period:String,
        date_approved:String,
        authorization_code:String,
        transaction_order_id:String,
        date_created:String,
        date_last_modified:String}
        ],
        shipping:{id:Number},
        status:String,
        status_detail:String,
        tags:[String],
        buyer:{id:Number,nickname:String,email:String,first_name:String,last_name:String},
        seller:{id:Number,nickname:String,email:String,first_name:String,last_name:String,phone:{extension:String,area_code:String,number:String,verified:Boolean},alternative_phone:{area_code:String,extension:String,number:String}}
        ,taxes:{amount:String,currency_id:String},
        fiscal_info:{item_id:String,seller_id:String,variations:[{id:String,sku:{id:String,sku:{seller_id:String,sku:String,title:String,type:String,tax_information:{ncm:String,origin_type:String,origin_detail:String,csosn:String,cest:String,empty:Boolean},cost:Number,measurement_unit:String,register_type:String}}}]}
    },    
    {collection:'orders'}, { bufferCommands: false }
);

const shipmentSchema = new mongoose.Schema(    
    {        
        id:{'type': Number, 'required': true},
        substatus_history:[{date:String, substatus:String,status:String}],    
        receiver_id:Number,
        base_cost:Number,
        status_history:{date_shipped:String,date_returned:String,date_delivered:String,date_first_visit:String,date_not_delivered:String,date_cancelled:String,date_handling:String,date_ready_to_ship:String},
        type:String,
        return_details:{date_returned:String,date_estimated_delivery:String,tracking_number:String,status:String},
        sender_id:Number,
        mode:String,
        order_cost:Number,
        service_id:Number,
        shipping_items:[{quantity:Number,dimensions_source:{origin:String,id:String},description:String,id:String,dimensions:String}],    
        tracking_number:String,
        cost_components:{loyal_discount:Number,special_discount:Number,compensation:Number,gap_discount:Number,ratio:Number},
        tracking_method:String,
        last_updated:String,
        comments:String,
        substatus:String,
        date_created:String,
        date_first_printed:String,
        created_by:String,
        application_id:String,
        shipping_option:{processing_time:String,cost:Number,estimated_schedule_limit:{date:String},shipping_method_id:Number,estimated_delivery_final:{date:String,offset:Number},buffering:{date:String},list_cost:Number,	estimated_delivery_limit:{date:String,offset:Number},delivery_promise:String,delivery_type:String,estimated_handling_limit:{date:String},estimated_delivery_time:{date:String,pay_before:String,schedule:String,unit:String,offset:{date:String,shipping:Number},shipping:Number,time_frame:{from:String,to:String},handling:Number,type:{ type: String }},name:String,id:Number,estimated_delivery_extended:{date:String,offset:Number},currency_id:String},
        tags:[],
        sender_address:{country:{id:String,name:String}, address_line:String,types:[],agency:String,city:{id:String,name:String},geolocation_type:String,latitude:Number,municipality:{id:String,name:String},street_name:String,zip_code:String,geolocation_source:String,intersection:String,street_number:String,comment:String,id:Number,state:{id:String,name:String},neighborhood:{id:String,name:String},geolocation_last_updated:String,longitude:Number},
        return_tracking_number:String,
        site_id:String,
        carrier_info:String,
        market_place:String,
        receiver_address:{country:{id:String,name:String}, address_line:String,types:[],agency:{carrier_id:Number,phone:String,agency_id:Number,description:String,type:{type: String},open_hours:String},city:{id:String,name:String},geolocation_type:String,latitude:Number,municipality:{id:String,name:String},street_name:String,zip_code:String,geolocation_source:String,intersection:String,street_number:String,receiver_name:String,comment:String,id:Number,state:{id:String,name:String},neighborhood:{id:String,name:String},geolocation_last_updated:String,receiver_phone:String,longitude:Number},
        order_id:Number,
        status:String,
        logistic_type:String
    },
    {collection:'shipments'}, 
    {bufferCommands: false}
);

const ml_itemSchema = new mongoose.Schema(
    {
        id:String,
        site_id:String,
        title:String,
        subtitle:String,
        seller_id:Number,
        category_id:String,
        official_store_id:String,
        price:Number,
        base_price:Number,
        original_price:String,
        inventory_id:String,
        currency_id:String,
        initial_quantity:Number ,
        available_quantity:Number,
        sold_quantity:Number,
        sale_terms:[{id:String,name:String,value_id:String,value_name:String,value_struct:{number:Number,unit:String},values:[{id:String,name:String,struct:{number:Number,unit:String}}],value_type:String}],
        buying_mode:String,
        listing_type_id:String,
        start_time:String,
        stop_time:String,
        end_time:String,
        expiration_time:String,
        condition:String,
        permalink:String,
        thumbnail_id:String,
        thumbnail:String,
        secure_thumbnail:String,
        pictures:[{id:String,url:String,secure_url:String,size:String,max_size:String,quality:String}],
        video_id:String,
        descriptions:[],
        accepts_mercadopago:Boolean,
        non_mercado_pago_payment_methods:[],
        shipping:{mode:String,methods:[],tags:[],dimensions:String,local_pick_up:Boolean,free_shipping:Boolean,logistic_type:String,store_pick_up:Boolean},
        international_delivery_mode:String,
        seller_address:{comment:String,address_line:String,zip_code:String,city:{id:String,name:String},state:{id:String,name:String},country:{id:String,name:String},search_location:{neighborhood:{id:String,name:String},city:{id:String,name:String},state:{id:String,name:String}},latitude:Number,longitude:Number,id:Number},
        seller_contact:String,
        location:{},
        geolocation:{latitude:Number,longitude:Number},
        coverage_areas:[],
        attributes:[{id:String,name:String,value_id:String,value_name:String,value_struct:{number:Number,unit:String},values: [{id:String,name:String,struct:{number:Number,unit:String}}],attribute_group_id:String,attribute_group_name:String}],
        warnings:[],
        listing_source:String,
        variations:[{id:Number,picture_ids:[],price:Number,available_quantity:Number,sold_quantity:Number,sale_terms: [],attributes: [],seller_custom_field:String,catalog_product_id:String,inventory_id:String,item_relations:[],attribute_combinations:[{id:String,name:String,value_id:String,value_name:String,value_struct:String,values:[{id:String,name:String,struct:String}]}]}],status:String,
        sub_status:[],
        tags:[],
        warranty:String,
        catalog_product_id:String,
        domain_id:String,
        seller_custom_field:String,
        parent_item_id:String,
        differential_pricing:String,
        deal_ids:[],
        automatic_relist:Boolean,
        date_created:String,
        last_updated:String,
        health:Number,
        catalog_listing:Boolean,
        item_relations:[],
        channels:[]
    },
    {collection:'itens'}, 
    {bufferCommands: false}
);

const fiscalSchema = new mongoose.Schema(
    {
        item_id:String,
        seller_id:String,        
        variations:[{          
        id:String,
        sku:{id:String,sku:{seller_id:String,sku:String,title:String,type:String,tax_information:{ncm:String,origin_type:String,origin_detail:String,csosn:String,cest:String,empty:Boolean},cost:Number,measurement_unit:String,register_type:String}}}]
    },
    {collection:'fiscal_info'}, 
    {bufferCommands: false}
);

const noteSchema = new mongoose.Schema(
    {
        order_id:Number,
        results:[{id:String,date_created:String,date_last_updated:String,note:String}]        
    },         
    {collection:'notes'}, 
    {bufferCommands: false}
);

const questionSchema = new mongoose.Schema(
    {
        id:Number,
        seller_id:Number,
        text:String,        
        tags:String,
        status:String,
        item_id:String,
        date_created:String,
        hold:Boolean,
        deleted_from_listing:Boolean,
        answer:{text:String,status:String,date_created:String},
        from:{id:Number,answered_questions:Number,buyer_nickname:String},        
        seller_nickname:String
    },         
    {collection:'questions'}, 
    {bufferCommands: false}
);

const claimSchema = new mongoose.Schema(
    {  
        "id":Number,
        "type":String,
        "stage":String,
        "status":String,
        "parent_id":String,
        "client_id":Number,
        "resource_id":Number,
        "resource":String,
        "reason_id":String,
        "fulfilled":Boolean,
        "players": [{"role":String,"type":{type: String},"user_id":Number,"available_actions":[{"action":String,"due_date":String,"mandatory":Boolean}]}],
        "resolution": {"reason":String,"benefited":[],"date_created":String,"closed_by":String},
        "labels": [{"name":String,"value":String,"comments":String,"admin_id":String,"date_created":String}],
        "site_id":String,
        "date_created":String,
        "last_updated":String,
        "reasons": {"reason_id":String,"reason_detail":String,"reason_main":String,"reason_parent":String},
        "shipment": {},
        "order_details": {}
      },         
      {collection:'claims'}, 
      {bufferCommands: false}
);

const clientSchema = new mongoose.Schema(
    { 
        id:Number,
        nickname:String,
        email:String,
        first_name:String,
        last_name:String,
        phone:{area_code:String,extension:String,number:String,verified:Boolean},
        alternative_phone:{area_code:String,extension:String,number:String,verified:Boolean},
        updated:Boolean
    },         
    {collection:'clients'}, 
    {bufferCommands: false}
);

const inventory_itemSchema = new mongoose.Schema(
    {
        id:String,
        start_time:String,
        last_updated:String,
        available_quantity:Number,
        data_ml:[{account:String,seller_id:String,id:String}],
        description:String,
        permalink:String,
        pictures:[String],
        price:Number,
        providers:[String],    
        secure_thumbnail:String,
        title:String,
        status:String,
        seller_custom_field:String,
        variations:[{id:Number,picture_ids:[String],price:Number,available_quantity:Number,
            attribute_combinations:[{id:String,name:String,value_id:String,value_name:String,value_struct:String,values:[{id:String,name:String,struct:String}]}],
            attributes:[{id:String,name:String,value_id:String,value_name:String,value_struct:String,values:[{id:String,name:String,struct:String}]}],
            seller_custom_field:String}]
    },
    {collection:'itens'}, 
    {bufferCommands: false}
);

const codeSchema = new mongoose.Schema(
    {
        id:String,
        title:String,
        data_ml:[{account:String,seller_id:Number,item_id:String}],
        date_created:String,
		last_updated:String,
        codes:[{code:String,color:String,size:String,vars:[]}]
    },
    {collection:'codes'}, 
    {bufferCommands: false}
);

const colorSchema = new mongoose.Schema(
    {
        id:String,
        code:String,
        name:String,
        eqv:String
    },    
    {collection:'colors'}, 
    {bufferCommands: false}
);
	
const counterSchema = new mongoose.Schema(
    {
        _id:String,
        sequence_value:Number
    },    
    {collection:'counters'}, 
    {bufferCommands: false}
);

const userSchema = new mongoose.Schema({id:Number,
    password:String,
    email:String,
    level:Number,
    last_login:String,
    user_name:String,
    login:String},       
    {collection:'users'}, { bufferCommands: false })

const ordersModel = mlConnection.model('Orders', orderSchema);
const shipmentModel = mlConnection.model('shipments', shipmentSchema);
const ml_itemModel = mlConnection.model('itens', ml_itemSchema);
const fiscalModel = mlConnection.model('fiscal_info', fiscalSchema);
const noteModel = mlConnection.model('notes', noteSchema);
const questionModel = mlConnection.model('questions', questionSchema);
const claimModel = mlConnection.model('claims', claimSchema);
const clientModel = mlConnection.model('clients', clientSchema);
const inventory_itemModel = inventoryConnection.model('itens', inventory_itemSchema);
const codeModel = mlConnection.model('codes', codeSchema);
const colorModel = mlConnection.model('colors', colorSchema);
const countersMlModel = mlConnection.model('counters', counterSchema);
const userModel = siteConnection.model('User', userSchema);
    
 module.exports = {    
    ordersModel,    
    shipmentModel,
    fiscalModel,
    noteModel,
    questionModel,
    claimModel,
    ml_itemModel,    
    clientModel,
    inventory_itemModel,
	codeModel,    
	colorModel,    
	countersMlModel,
	userModel
 };