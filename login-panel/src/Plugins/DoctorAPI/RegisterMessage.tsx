import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class RegisterMessage extends DoctorMessage {
    userName: string;
    password: string;
    bio?: string;  // 可选的bio字段

    constructor(userName: string, password: string, bio?: string) {
        super();
        this.userName = userName;
        this.password = password;
        this.bio = bio;
    }
}