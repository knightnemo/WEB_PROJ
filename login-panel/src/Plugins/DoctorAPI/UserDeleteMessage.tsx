import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class UserDeleteMessage extends DoctorMessage {
    userName: string;

    constructor(userName: string) {
        super();
        this.userName = userName;
    }
}