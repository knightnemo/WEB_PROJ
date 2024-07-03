import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class LoginMessage extends DoctorMessage {
    userName: string;
    password: string;

    constructor(userName: string, password: string) {
        super();
        this.userName = userName;
        this.password = password;
    }
}