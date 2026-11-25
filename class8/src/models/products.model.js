import mongoose from "mongoose"

const productSchema= new mongoose.Schema({
    image:{
        type: String,
        required:true
    },
    sku:{
        type: String,
        required:true,
        trim:true,
        uppercase:true,
        unique:true,
        sparse:true
    },
    name:  {
        type: String,
        required:true,
        trim:true,
        maxlength:120
    },
    desc: {
        type: String,
        required:true,
        trim:true,
        maxlength:1000
    },
    unitPrice: {
        type: Number,
        min:0,
        default:0
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default: null
    },
    category: {
        type: String,
        trim:true,
        maxlength:60,
        default:"General"
    },
    quantity: {
        type: Number,
        min:0,
        default:0
    },
    reorderLevel: {
        type: Number,
        min:0,
        default:5
    },
    location: {
        type: String,
        trim:true,
        maxlength:100,
        default:""
    },
    admin:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default:null
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        default:null
    }
}, { timestamps:true })
const productModel = mongoose.model("product",productSchema)
export default productModel
