import { PatientMessage } from 'Plugins/PatientAPI/PatientMessage'

export class UserDeleteMessage extends PatientMessage {
    userName: string;

    constructor(userName: string) {
        super();
        this.userName = userName;
    }
}