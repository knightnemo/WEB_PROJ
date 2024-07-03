import { PatientMessage } from 'Plugins/PatientAPI/PatientMessage'

export class PatientLoginMessage extends PatientMessage {
    userName: string;
    password: string;

    constructor(userName: string, password: string) {
        super();
        this.userName = userName;
        this.password = password;
    }
}