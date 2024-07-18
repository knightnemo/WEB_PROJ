import { DoctorMessage } from 'Plugins/DoctorAPI/DoctorMessage'

export class CheckDoctorSlotAvailabilityMessage extends DoctorMessage {
    doctorName: string;
    slotNumber: number;

    constructor(doctorName: string, slotNumber: number) {
        super();
        this.doctorName = doctorName;
        this.slotNumber = slotNumber;
    }
}