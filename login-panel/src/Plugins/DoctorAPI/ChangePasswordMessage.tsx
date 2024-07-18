import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class ChangePasswordMessage extends DoctorMessage {
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