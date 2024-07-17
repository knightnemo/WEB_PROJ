import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class DoctorQueryMessage extends DoctorMessage {
    doctorName: string;

    constructor(doctorName: string) {
        super();
        this.doctorName = doctorName;
    }
}

// 添加一个新的接口来处理返回的数据
export interface DoctorInfo {
    userName: string;
    bio: string;
    followers: number;
    following: number;
    reviewCount: number;
    slot1: string;
    slot2: string;
    slot3: string;
    slot4: string;
    slot5: string;
    slot6: string;
    slot7: string;
    slot8: string;
}