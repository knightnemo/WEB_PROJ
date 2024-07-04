import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class UserQueryMessage extends DoctorMessage {
    userName: string;

    constructor(userName: string) {
        super();
        this.userName = userName;
    }
}