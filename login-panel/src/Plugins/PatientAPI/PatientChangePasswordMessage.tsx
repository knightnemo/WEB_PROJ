import { PatientMessage } from 'Plugins/PatientAPI/PatientMessage'

export class PatientChangePasswordMessage extends PatientMessage {
    userName: string;
    oldPassword: string;
    newPassword: string;

    constructor(userName: string, oldPassword: string, newPassword: string) {
        super();
        this.userName = userName;
        this.oldPassword = oldPassword;
        this.newPassword = newPassword;
    }
}