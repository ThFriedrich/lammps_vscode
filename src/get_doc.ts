import { command_docs } from "./lmp_doc";
export function get_doc(find_command: string) {
    return command_docs.find(e => e.command === find_command);
}
