import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class OccupyDoctorSlotMessage extends DoctorMessage {
    doctorName: string;
    slotNumber: number;
    courseName: string;

    constructor(doctorName: string, slotNumber: number, courseName: string) {
        super();
        this.doctorName = doctorName;
        this.slotNumber = slotNumber;
        this.courseName = courseName;
    }
}