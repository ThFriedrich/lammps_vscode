"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lmp_doc_1 = require("./lmp_doc");
function get_doc(find_command) {
    return lmp_doc_1.command_docs.find(e => e.command === find_command);
}
exports.get_doc = get_doc;
//# sourceMappingURL=get_doc.js.map