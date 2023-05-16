const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    username: String,
    password: String,
});
const model = mongoose.model("Admin", messageSchema);

module.exports = model