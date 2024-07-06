// 查询管理员(用来生成用户主页)
import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class DoctorQueryMessage extends DoctorMessage {
    doctorName: string;

    constructor(doctorName: string) {
        super();
        this.doctorName = doctorName;
    }
}